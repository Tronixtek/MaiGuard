import type { Alert, Area, Subscriber, TrustedVoice } from "../types.js";

/**
 * A fictional town used for the demo. Every name and number here is invented.
 * Minutes are relative to "now" so the seeded alerts always look fresh.
 */
export const TOWN_NAME = "Ubandu";

export const trustedVoices: TrustedVoice[] = [
  { id: "tv-hauwa", name: "Hauwa Danjuma", role: "Market women's leader", phone: "+234 803 555 0141" },
  { id: "tv-musa", name: "Musa Bello", role: "Transport union rep, Old Bridge park", phone: "+234 806 555 0172" },
  { id: "tv-ifeanyi", name: "Ifeanyi Okafor", role: "Ward 3 head", phone: "+234 809 555 0118" },
  { id: "tv-grace", name: "Grace Adeyemi", role: "Vigilante liaison, North Gate", phone: "+234 812 555 0190" },
  { id: "tv-yusuf", name: "Yusuf Garba", role: "Riverside youth leader", phone: "+234 815 555 0163" },
  // Not tied to one road: the coordinator's desk can publish for any area.
  { id: "tv-desk", name: "MaiGuard Desk", role: "Community coordinator", phone: "+234 800 555 0100" },
];

export const areas: Area[] = [
  {
    id: "market-road",
    name: "Market Road",
    aliases: ["market", "main market", "market junction", "central market", "market square"],
    neighbours: ["old-bridge", "ward-3"],
    trustedVoiceId: "tv-hauwa",
  },
  {
    id: "old-bridge",
    name: "Old Bridge Road",
    aliases: ["old bridge", "the bridge", "bridge road", "motor park", "bridge junction"],
    neighbours: ["market-road", "riverside"],
    trustedVoiceId: "tv-musa",
  },
  {
    id: "ward-3",
    name: "Ward 3 (Hilltop)",
    aliases: ["ward 3", "ward three", "hilltop", "hill top", "the hill"],
    neighbours: ["market-road", "north-gate"],
    trustedVoiceId: "tv-ifeanyi",
  },
  {
    id: "north-gate",
    name: "North Gate Road",
    aliases: ["north gate", "northgate", "checkpoint", "north road", "farm road"],
    neighbours: ["ward-3"],
    trustedVoiceId: "tv-grace",
  },
  {
    id: "riverside",
    name: "Riverside Way",
    aliases: ["riverside", "river", "river way", "the river", "waterside"],
    neighbours: ["old-bridge"],
    trustedVoiceId: "tv-yusuf",
  },
];

/** Seeded contacts: numbers or emails and the roads they care about. No names are stored. */
export function seedSubscribers(): Subscriber[] {
  const rows: [string | undefined, string | undefined, string[]][] = [
    ["+234 802 555 0101", undefined, ["market-road", "old-bridge"]],
    ["+234 802 555 0102", undefined, ["market-road"]],
    ["+234 802 555 0103", "ada.o@example.com", ["market-road", "ward-3"]],
    ["+234 802 555 0104", undefined, ["old-bridge", "riverside"]],
    ["+234 802 555 0105", undefined, ["old-bridge"]],
    ["+234 802 555 0106", undefined, ["ward-3"]],
    [undefined, "hilltop.shop@example.com", ["ward-3", "north-gate"]],
    ["+234 802 555 0108", undefined, ["north-gate"]],
    ["+234 802 555 0109", undefined, ["north-gate"]],
    ["+234 802 555 0110", undefined, ["riverside"]],
    ["+234 802 555 0111", "riverside.traders@example.com", ["riverside", "old-bridge"]],
    ["+234 802 555 0112", undefined, ["market-road", "riverside"]],
  ];
  const createdAt = new Date().toISOString();
  return rows.map(([phone, email, areaIds], i) => ({ id: `s-${String(i + 1).padStart(2, "0")}`, phone, email, areaIds, createdAt }));
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export function seedAlerts(): Alert[] {
  return [
    {
      id: "a-seed-northgate",
      what: "Armed men were seen near the North Gate checkpoint.",
      where: "North Gate Road, by the checkpoint",
      action: "Avoid North Gate Road after dark. Use Ward 3 road instead.",
      kind: "danger",
      areaIds: ["north-gate"],
      urgency: "interrupt",
      urgencyReason: "Armed people are reported on a road people use now.",
      status: "active",
      transcript:
        "Grace here, North Gate. Armed men were seen near the North Gate checkpoint, maybe 20 minutes ago. Avoid North Gate Road after dark. Use Ward 3 road instead.",
      trustedVoiceId: "tv-grace",
      createdAt: minutesAgo(38),
    },
    {
      id: "a-seed-market-danger",
      what: "Loud bangs were heard near Market Road.",
      where: "Market Road",
      action: "Stay indoors until we confirm what it is.",
      kind: "danger",
      areaIds: ["market-road"],
      urgency: "interrupt",
      urgencyReason: "Possible gunfire in a busy area.",
      status: "resolved",
      transcript: "Loud bangs near Market Road. Stay indoors until we confirm what it is.",
      trustedVoiceId: "tv-hauwa",
      createdAt: minutesAgo(95),
      resolvedBy: "a-seed-market-clear",
    },
    {
      id: "a-seed-market-clear",
      what: "The bangs on Market Road were a generator explosion at the welder's shop. Nobody was hurt and there is no shooting.",
      where: "Market Road",
      action: "Market Road is open. Carry on as normal.",
      kind: "all_clear",
      areaIds: ["market-road"],
      urgency: "available",
      urgencyReason: "Good news that corrects an earlier alert; it does not need to interrupt anyone.",
      status: "active",
      transcript:
        "Hauwa again. The bangs on Market Road were a generator explosion at the welder's shop. Nobody was hurt and there is no shooting. Market Road is open, carry on as normal.",
      trustedVoiceId: "tv-hauwa",
      createdAt: minutesAgo(70),
    },
  ];
}
