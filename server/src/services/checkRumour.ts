import { matchClaim } from "../ai/matchClaim.js";
import { store } from "../store.js";
import { clockTime } from "../lib/text.js";
import { contactLabel } from "./members.js";
import type { CheckResponse, Subscriber } from "../types.js";

const SAFE_GUIDANCE = [
  "If you can, wait before setting out.",
  "If you must travel, go with others and keep to busy roads.",
  "Ask the trusted contact below before you use this road.",
];

/**
 * Rumour check: one of three honest answers, never "it's safe" without a verified source.
 * The member's contact is on file, so an unverified answer comes with a follow-up promise.
 */
export async function checkRumour(text: string, member: Subscriber): Promise<CheckResponse> {
  const m = await matchClaim(text);

  const check = store.addCheck({
    text,
    subscriberId: member.id,
    areaIds: m.areaIds,
    topic: m.topic,
    outcome: m.outcome,
    alertId: m.alert?.id,
  });

  const primaryArea = m.areaIds[0] ? store.area(m.areaIds[0]) : undefined;
  const contactVoice = primaryArea ? store.trustedVoice(primaryArea.trustedVoiceId) : undefined;
  const contact = contactVoice && primaryArea ? { ...contactVoice, areaName: primaryArea.name } : undefined;

  let response: CheckResponse;

  if (m.outcome !== "unverified" && m.alert) {
    const a = m.alert;
    const voice = store.trustedVoice(a.trustedVoiceId);
    const by = `${voice?.name ?? "A trusted voice"}${voice ? ` (${voice.role})` : ""}`;
    const confirmed = m.outcome === "match";
    const earlier = store.alerts.find((x) => x.resolvedBy === a.id);
    response = {
      checkId: check.id,
      outcome: m.outcome,
      headline: confirmed ? "Confirmed" : "This doesn't match what's verified",
      summary: confirmed ? "A trusted voice has reported this. Here is the accurate version." : "A trusted voice has said otherwise. Here is the latest verified word.",
      alert: a,
      known: [
        `${by} said this at ${clockTime(a.createdAt)}.`,
        ...(!confirmed && earlier ? [`An earlier alert from ${clockTime(earlier.createdAt)} was corrected by this one.`] : []),
      ],
      unknown: [],
      guidance: a.action ? [a.action] : [],
      contact,
      reason: m.reason,
      engine: m.engine,
    };
  } else {
    const nearby = store.alerts.filter((a) => a.status === "active" && a.areaIds.some((id) => m.areaIds.includes(id)));
    const known = nearby.length
      ? nearby.map((a) => `Verified at ${clockTime(a.createdAt)}: ${a.what}`)
      : [primaryArea ? `No trusted voice has reported anything about ${primaryArea.name} yet.` : "No trusted voice has reported anything about this yet."];

    let followUp: CheckResponse["followUp"];
    if (m.areaIds.length) {
      store.addFollowUp({ checkId: check.id, subscriberId: member.id, areaIds: m.areaIds });
      // They asked about these roads, so future alerts for them should reach this member too.
      store.addAreas(member, m.areaIds);
      followUp = { promised: true, message: `We'll message ${contactLabel(member)} as soon as a trusted voice says anything about ${primaryArea?.name ?? "this"}.` };
    } else {
      followUp = { promised: false, message: "Add the name of the road or place so we can connect you to the right person." };
    }

    response = {
      checkId: check.id,
      outcome: "unverified",
      headline: "Nothing verified yet",
      summary: "No trusted voice has confirmed or denied this. That does not mean the road is safe.",
      known,
      unknown: [`Whether ${m.claimSummary.charAt(0).toLowerCase()}${m.claimSummary.slice(1)}.`],
      guidance: SAFE_GUIDANCE,
      contact,
      followUp,
      reason: m.reason,
      engine: m.engine,
    };
  }

  return response;
}
