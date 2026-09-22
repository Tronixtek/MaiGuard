import { store } from "../store.js";
import { TOPIC_LABEL, type Topic } from "../lib/text.js";

export interface Trend {
  key: string;
  areaId: string | null;
  areaName: string;
  topic: Topic;
  topicLabel: string;
  count: number;
  unverifiedCount: number;
  latestText: string;
  latestAt: string;
  /** People are asking and no trusted voice has spoken about this area since they started. */
  needsAnswer: boolean;
}

const WINDOW_MS = 3 * 60 * 60_000;

/** Clusters of rumour checks: what the town is worried about right now. */
export function checkTrends(): Trend[] {
  const since = Date.now() - WINDOW_MS;
  const groups = new Map<string, Trend & { firstAt: string }>();

  for (const c of store.checks) {
    if (Date.parse(c.createdAt) < since) continue;
    const areaId = c.areaIds[0] ?? null;
    const key = `${areaId ?? "unknown"}|${c.topic}`;
    const g = groups.get(key);
    if (g) {
      g.count++;
      if (c.outcome === "unverified") g.unverifiedCount++;
      if (c.createdAt < g.firstAt) g.firstAt = c.createdAt;
    } else {
      groups.set(key, {
        key,
        areaId,
        areaName: areaId ? store.area(areaId)?.name ?? areaId : "Unknown place",
        topic: c.topic as Topic,
        topicLabel: TOPIC_LABEL[c.topic as Topic] ?? c.topic,
        count: 1,
        unverifiedCount: c.outcome === "unverified" ? 1 : 0,
        latestText: c.text,
        latestAt: c.createdAt,
        firstAt: c.createdAt,
        needsAnswer: false,
      });
    }
  }

  return [...groups.values()]
    .map(({ firstAt, ...t }) => ({
      ...t,
      needsAnswer:
        t.unverifiedCount > 0 &&
        !store.alerts.some((a) => t.areaId && a.areaIds.includes(t.areaId) && a.createdAt > firstAt),
    }))
    .sort((a, b) => Number(b.needsAnswer) - Number(a.needsAnswer) || b.count - a.count || b.latestAt.localeCompare(a.latestAt));
}
