import { z } from "zod";
import { withFallback } from "./client.js";
import { store } from "../store.js";
import { clockTime, findAreas, isDangerTopic, topicOf, TOPICS, type Topic } from "../lib/text.js";
import type { AiEngine, Alert, CheckOutcome } from "../types.js";

const MatchSchema = z.object({
  outcome: z.enum(["match", "contradict", "unverified"]),
  alert_id: z.string().nullable().describe("Id of the verified alert that supports the outcome. Null when unverified."),
  claim_area_ids: z.array(z.string()).describe("Area ids from the directory that the rumour is about."),
  topic: z.enum(TOPICS as [Topic, ...Topic[]]),
  claim_summary: z.string().describe("The rumour restated neutrally in a short clause, e.g. 'armed men are at Old Bridge Road'."),
  reason: z.string().describe("One short sentence explaining the outcome, for the trusted voice's log."),
});

type RawMatch = z.infer<typeof MatchSchema>;

export interface ClaimMatch {
  outcome: CheckOutcome;
  alert?: Alert;
  areaIds: string[];
  topic: Topic;
  claimSummary: string;
  reason: string;
  engine: AiEngine;
}

const SYSTEM = `You check rumours for MaiGuard, a community safety service. A resident has forwarded a message they received and wants to know whether to believe it.

You do not decide what is true. You only compare the rumour with the verified alerts below, which are the only things trusted local people have said. Your own knowledge, the rumour's tone and how plausible it sounds do not count as evidence.

Choose exactly one outcome:
- "match": a verified alert that is still active describes the same event in the same place. Give its id.
- "contradict": a verified alert says otherwise. Either an active alert covers the same place and says the opposite (for example an all-clear), or the rumour describes an event that a trusted voice has since corrected or resolved. Give the id of the alert that says otherwise.
- "unverified": nothing verified is about this event in this place. Absence of an alert is never evidence that a place is safe.

A rumour that a place is safe also needs a verified alert to match. If there is none, it is unverified.
When unsure between an outcome and "unverified", choose "unverified".`;

export async function matchClaim(text: string): Promise<ClaimMatch> {
  return withFallback(
    "match",
    async (provider) => {
      const alerts = store.alerts
        .map(
          (a) =>
            `- id=${a.id} status=${a.status}${a.resolvedBy ? ` superseded_by=${a.resolvedBy}` : ""} kind=${a.kind} areas=${a.areaIds.join(",")} time=${clockTime(a.createdAt)}\n  what: ${a.what}\n  where: ${a.where}\n  action: ${a.action || "(none)"}`,
        )
        .join("\n");
      const directory = store.areas.map((a) => `- ${a.id}: ${a.name} (also called: ${a.aliases.join(", ")})`).join("\n");

      const raw = await provider.generate({
        system: SYSTEM,
        user: `Area directory:\n${directory}\n\nVerified alerts, newest first:\n${alerts || "(none)"}\n\nRumour the resident received:\n"""${text}"""`,
        schema: MatchSchema,
        maxTokens: 2000,
      });
      return enforce(raw, text, provider.engine);
    },
    () => enforce(heuristicMatch(text), text, "fallback"),
  );
}

/**
 * The truth rule lives here, in code, not in the prompt: a match or a
 * contradiction must point at a real verified alert, or it becomes unverified.
 */
export function enforce(raw: RawMatch, text: string, engine: AiEngine): ClaimMatch {
  const known = new Set(store.areas.map((a) => a.id));
  let areaIds = raw.claim_area_ids.filter((id) => known.has(id));
  if (areaIds.length === 0) areaIds = findAreas(text, store.areas).map((h) => h.id);

  let outcome: CheckOutcome = raw.outcome;
  let alert = raw.alert_id ? store.alert(raw.alert_id) : undefined;
  let reason = raw.reason;

  if (outcome !== "unverified" && !alert) {
    outcome = "unverified";
    reason = "No verified alert backs this up.";
  }
  // A rumour that repeats a superseded alert is out of date: answer with the correction.
  if (outcome === "match" && alert?.status === "resolved") {
    const newer = alert.resolvedBy ? store.alert(alert.resolvedBy) : undefined;
    outcome = newer ? "contradict" : "unverified";
    alert = newer;
    reason = newer ? "This repeats an earlier alert that has since been corrected." : "The only related alert is no longer active.";
  }
  if (outcome === "unverified") alert = undefined;

  return { outcome, alert, areaIds, topic: raw.topic, claimSummary: raw.claim_summary, reason, engine };
}

export function heuristicMatch(text: string): RawMatch {
  const topic = topicOf(text);
  const areaIds = findAreas(text, store.areas).map((h) => h.id);
  const summary = text
    .trim()
    .replace(/\s+/g, " ")
    // Drop the hearsay wrapper so the summary states the claim itself.
    .replace(/^(forwarded[^:]*:\s*)?((my|a) \w+ (said|says|told me)|i heard|heard|they said|people are saying)( that)?\s*/i, "")
    .replace(/[,.]?\s*is (it|this) true\??$/i, "")
    .replace(/[.!?]+$/, "")
    .slice(0, 140);
  const base = { claim_area_ids: areaIds, topic, claim_summary: summary };

  if (areaIds.length === 0) {
    return { ...base, outcome: "unverified", alert_id: null, reason: "The message does not name a place we can check." };
  }

  const inArea = store.alerts.filter((a) => a.areaIds.some((id) => areaIds.includes(id)));
  const active = inArea.find((a) => a.status === "active");
  const claimIsDanger = isDangerTopic(topic) || topic === "other";

  if (active) {
    const alertTopic = active.kind === "all_clear" ? "all_clear" : topicOf(`${active.what} ${active.where}`);
    if (active.kind === "all_clear" && claimIsDanger) {
      return { ...base, outcome: "contradict", alert_id: active.id, reason: "A trusted voice has given the all-clear here." };
    }
    if (active.kind !== "all_clear" && topic === "all_clear") {
      return { ...base, outcome: "contradict", alert_id: active.id, reason: "A danger alert is still active here." };
    }
    if (alertTopic === topic || topic === "other" || (active.kind === "all_clear" && topic === "all_clear")) {
      return { ...base, outcome: "match", alert_id: active.id, reason: "A verified alert describes this." };
    }
  }

  return { ...base, outcome: "unverified", alert_id: null, reason: "No verified alert covers this event in this place." };
}
