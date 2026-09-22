import type { Area } from "../types.js";

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Compare numbers as digits, treating local "0806…" and international "+234 806…" as the same. */
export function normalizePhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length === 11 && d.startsWith("0") ? `234${d.slice(1)}` : d;
}

/** "+234 ••• ••• 0101": enough to tell numbers apart, not enough to call them. */
export function maskPhone(phone: string): string {
  const d = normalizePhone(phone);
  return `+${d.slice(0, 3)} ••• ••• ${d.slice(-4)}`;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** "a•••@example.com" */
export function maskEmail(email: string): string {
  const [user = "", domain = ""] = normalizeEmail(email).split("@");
  return `${user.slice(0, 1)}•••@${domain}`;
}

/** A quote is grounded only if the speaker actually said those words, give or take punctuation. */
export function isGrounded(quote: string, transcript: string): boolean {
  const q = normalize(quote);
  return q.length > 0 && normalize(transcript).includes(q);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Area ids mentioned in free text, by name or alias, in the order they first appear. */
export function findAreas(text: string, areas: Area[]): { id: string; match: string }[] {
  const t = normalize(text);
  const hits: { id: string; match: string; index: number }[] = [];
  for (const area of areas) {
    const names = [area.name.replace(/\(.*?\)/g, ""), ...area.aliases].map(normalize).filter(Boolean);
    // Longest names first so "old bridge road" wins over "bridge road".
    names.sort((a, b) => b.length - a.length);
    for (const name of names) {
      const m = new RegExp(`\\b${escapeRe(name)}\\b`).exec(t);
      if (m) {
        hits.push({ id: area.id, match: name, index: m.index });
        break;
      }
    }
  }
  return hits.sort((a, b) => a.index - b.index).map(({ id, match }) => ({ id, match }));
}

export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function tidySentence(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return t;
  const cap = t[0]!.toUpperCase() + t.slice(1);
  return /[.!?]$/.test(cap) ? cap : `${cap}.`;
}

export type Topic =
  | "armed_group"
  | "gunfire"
  | "kidnapping"
  | "roadblock"
  | "fire_explosion"
  | "unrest"
  | "all_clear"
  | "other";

export const TOPICS: Topic[] = [
  "armed_group",
  "gunfire",
  "kidnapping",
  "roadblock",
  "fire_explosion",
  "unrest",
  "all_clear",
  "other",
];

export const TOPIC_LABEL: Record<Topic, string> = {
  armed_group: "Armed group",
  gunfire: "Gunfire",
  kidnapping: "Kidnapping",
  roadblock: "Roadblock",
  fire_explosion: "Fire or explosion",
  unrest: "Crowd or unrest",
  all_clear: "Says it's safe",
  other: "Other",
};

const TOPIC_PATTERNS: [Topic, RegExp][] = [
  ["kidnapping", /\b(kidnap\w*|abduct\w*)\b/],
  ["armed_group", /\b(armed|gunmen|gun men|bandits?|men with guns|militia|herdsmen with guns)\b/],
  ["gunfire", /\b(shoot\w*|shot|shots|gunshots?|gunfire|firing|bangs?)\b/],
  ["roadblock", /\b(roadblock|road block|checkpoint|blocked|blocking|barricade\w*)\b/],
  ["fire_explosion", /\b(fire|burning|explosion|explode\w*|blast)\b/],
  ["unrest", /\b(riot\w*|fight\w*|mob|protest\w*|clash\w*|crowd)\b/],
  ["all_clear", /\b(safe|all clear|is open|now open|calm|false alarm|nothing (is )?happening|no shooting)\b/],
];

export function topicOf(text: string): Topic {
  const t = normalize(text);
  for (const [topic, re] of TOPIC_PATTERNS) if (re.test(t)) return topic;
  return "other";
}

export const isDangerTopic = (t: Topic) => t !== "all_clear" && t !== "other";

export const TOWN_TZ = process.env.TOWN_TZ ?? "Africa/Lagos";

export const clockTime = (iso: string | Date) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TOWN_TZ }).format(
    new Date(iso),
  );

/** Current HH:MM in the town, or the demo's simulated clock. */
export function townClock(override?: string): { label: string; hour: number; isNight: boolean } {
  const label = override && /^\d{1,2}:\d{2}$/.test(override) ? override.padStart(5, "0") : clockTime(new Date());
  const hour = Number(label.slice(0, 2));
  return { label, hour, isNight: hour >= 22 || hour < 6 };
}
