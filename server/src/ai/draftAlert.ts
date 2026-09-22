import { z } from "zod";
import { withFallback } from "./client.js";
import { store } from "../store.js";
import { findAreas, isGrounded, sentences, tidySentence, townClock } from "../lib/text.js";
import type { AlertDraft, AlertKind, Urgency } from "../types.js";

const DraftSchema = z.object({
  what: z.string().describe("What happened, in one or two plain sentences."),
  what_quote: z.string().describe("The exact words from the transcript that support `what`."),
  where: z.string().describe("The place, as specifically as the speaker said it."),
  where_quote: z.string().describe("The exact words from the transcript that name the place."),
  action: z.string().describe("What people should do, only if the speaker said it. Empty string if they did not."),
  action_quote: z.string().describe("The exact words from the transcript that give the instruction. Empty if none."),
  kind: z.enum(["danger", "advisory", "all_clear"]),
  area_ids: z.array(z.string()).describe("Ids from the area directory that this alert affects."),
  urgency: z.enum(["interrupt", "available"]),
  urgency_reason: z.string().describe("One short sentence explaining the urgency decision."),
});

type RawDraft = z.infer<typeof DraftSchema>;

const SYSTEM = `You are the alert desk for MaiGuard, a community safety service in a small town.

A trusted local person (the "trusted voice") has just spoken a rushed report. It was transcribed by speech-to-text, so expect filler words, repetition and odd ordering. Your job is to turn it into a clear, structured alert that will be sent by SMS.

You are an amplifier, not an authority. The trusted voice is the only source of truth.
- Never add a fact, place, number, time or instruction the speaker did not state. You may reorder, shorten and clarify their words.
- If the speaker gave no instruction, leave "action" and "action_quote" empty. Do not invent safety advice.
- Never call a place "safe" unless the speaker used that word. "Calm", "open" or "they have left" are not the same claim; keep the speaker's own words.
- Every *_quote field must be copied word for word from the transcript so it can be checked automatically.
- Write for someone reading a basic phone in a hurry: short, plain sentences, no jargon.

Routing: choose area_ids only from the area directory. Include an area only if the report is about that place. Do not add neighbouring areas "to be safe"; a warning about one road should not alarm the whole town. A place named only as a detour ("use Riverside Way instead") is not affected.

Kind:
- "danger": a threat to people's safety.
- "advisory": useful but not dangerous, e.g. a road closed for repairs.
- "all_clear": the speaker says a danger is over, was false, or a place is safe.

Urgency decides whether phones buzz now ("interrupt") or the message simply waits to be read ("available"):
- A current or imminent danger to people interrupts, at any hour.
- An all-clear interrupts only if people in that area are currently under an active danger alert (they may be hiding or stuck); otherwise it is available.
- Advisories are available, and at night (22:00 to 06:00) anything that can wait until morning is available.`;

export async function draftAlert(transcript: string, clockOverride?: string): Promise<AlertDraft> {
  const clock = townClock(clockOverride);
  return withFallback(
    "draft",
    async (provider) => {
      const activeAlerts = store.alerts
        .filter((a) => a.status === "active")
        .map((a) => `- [${a.kind}] ${a.areaIds.join(", ")}: ${a.what}`)
        .join("\n");
      const directory = store.areas
        .map((a) => `- ${a.id}: ${a.name} (also called: ${a.aliases.join(", ")})`)
        .join("\n");

      const raw = await provider.generate({
        system: SYSTEM,
        user: `Area directory:\n${directory}\n\nCurrently active verified alerts:\n${activeAlerts || "(none)"}\n\nLocal time in town: ${clock.label}\n\nTranscript:\n"""${transcript}"""`,
        schema: DraftSchema,
        maxTokens: 4000,
      });
      return finalizeDraft(raw, transcript, clock.isNight, provider.engine);
    },
    () => finalizeDraft(heuristicDraft(transcript, clock.isNight), transcript, clock.isNight, "fallback"),
  );
}

/**
 * Checks that apply whichever engine wrote the draft: every line is tested
 * against the transcript, and areas must exist in the directory.
 */
export function finalizeDraft(raw: RawDraft, transcript: string, isNight: boolean, engine: AlertDraft["engine"]): AlertDraft {
  const known = new Set(store.areas.map((a) => a.id));
  let areaIds = [...new Set(raw.area_ids)].filter((id) => known.has(id));
  if (areaIds.length === 0) areaIds = findAreas(transcript, store.areas).map((h) => h.id);

  let urgency: Urgency = raw.urgency;
  let urgencyReason = raw.urgency_reason;
  if (isNight && raw.kind === "advisory" && urgency === "interrupt") {
    urgency = "available";
    urgencyReason = "It is night and this is not dangerous, so it waits until people check their phones.";
  }

  const action = raw.action.trim();
  return {
    what: raw.what.trim(),
    where: raw.where.trim(),
    action,
    kind: raw.kind,
    areaIds,
    urgency,
    urgencyReason,
    grounding: {
      what: { quote: raw.what_quote, grounded: isGrounded(raw.what_quote, transcript) },
      where: { quote: raw.where_quote, grounded: isGrounded(raw.where_quote, transcript) },
      action: { quote: raw.action_quote, grounded: action === "" || isGrounded(raw.action_quote, transcript) },
    },
    engine,
  };
}

const ACTION_RE = /\b(avoid|stay|use|don't|do not|dont|go |wait|keep|take|move|carry on|close|come|turn back|leave)\b/i;
const ALL_CLEAR_RE = /\b(false alarm|all clear|no shooting|is open|now open|safe now|is safe|nobody was hurt|resolved|cleared|calm now|carry on as normal)\b/i;
const DANGER_RE = /\b(gun\w*|shoot\w*|armed|attack\w*|kidnap\w*|bandits?|fight\w*|fire|explosion|blocked|roadblock|robbers?|machetes?|bangs?)\b/i;

/** Rule-based stand-in for the model, used when no key is set or the API fails. */
export function heuristicDraft(transcript: string, isNight: boolean): RawDraft {
  const parts = sentences(transcript).filter((s) => !/^(hello|hi|good (evening|morning)|this is|it's|\w+ here)\b[^.]*[.,]?$/i.test(s));
  const all = parts.length ? parts : [transcript.trim()];

  const kind: AlertKind = ALL_CLEAR_RE.test(transcript) ? "all_clear" : DANGER_RE.test(transcript) ? "danger" : "advisory";
  const actionSentence = all.find((s) => ACTION_RE.test(s)) ?? "";
  // Route on places the report is about, not detours named in the instruction ("use Riverside Way").
  const reportText = all.filter((s) => s !== actionSentence).join(" ");
  const reportHits = findAreas(reportText, store.areas);
  const areaHits = reportHits.length ? reportHits : findAreas(transcript, store.areas);
  const whatSentence = all.find((s) => s !== actionSentence && (DANGER_RE.test(s) || ALL_CLEAR_RE.test(s))) ?? all.find((s) => s !== actionSentence) ?? all[0]!;

  const areaIds = areaHits.map((h) => h.id);
  const hasActiveDanger = store.alerts.some(
    (a) => a.status === "active" && a.kind === "danger" && a.areaIds.some((id) => areaIds.includes(id)),
  );

  let urgency: Urgency;
  let reason: string;
  if (kind === "danger") {
    urgency = "interrupt";
    reason = "A danger to people on a road they may be using now.";
  } else if (kind === "all_clear") {
    urgency = hasActiveDanger ? "interrupt" : "available";
    reason = hasActiveDanger
      ? "People here are under an active danger alert and need to know it is over."
      : "Good news with no active alert to cancel, so it does not need to interrupt anyone.";
  } else {
    urgency = "available";
    reason = isNight ? "It is night and this can wait until morning." : "Useful to know, but not dangerous.";
  }

  return {
    what: tidySentence(whatSentence),
    what_quote: whatSentence.replace(/[.!?]$/, ""),
    where: areaIds.map((id) => store.area(id)!.name).join(", "),
    where_quote: areaHits[0]?.match ?? "",
    action: actionSentence ? tidySentence(actionSentence) : "",
    action_quote: actionSentence.replace(/[.!?]$/, ""),
    kind,
    area_ids: areaIds,
    urgency,
    urgency_reason: reason,
  };
}
