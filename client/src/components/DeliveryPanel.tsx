import { ChevronDown, Mail, MessageCircle, MessageSquare, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { cx, timeOf, useData } from "../lib/data";
import type { Alert } from "../lib/types";
import { CardHeader, KindBadge, UrgencyBadge } from "./ui";

interface Row {
  alert: Alert;
  people: number;
  sms: number;
  email: number;
  whatsapp: number;
  followUps: number;
  recipients: string[];
}

/** For the trusted voice: who each published alert reached, and how many subscribers each road has. */
export function DeliveryPanel() {
  const { meta, alerts, deliveries, subscribers } = useData();
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => {
    const byAlert = new Map<string, Row>();
    for (const d of deliveries) {
      const alert = d.alertId ? alerts.find((a) => a.id === d.alertId) : undefined;
      if (!alert) continue;
      let row = byAlert.get(alert.id);
      if (!row) {
        row = { alert, people: 0, sms: 0, email: 0, whatsapp: 0, followUps: 0, recipients: [] };
        byAlert.set(alert.id, row);
      }
      row[d.channel]++;
      if (d.kind === "follow_up") row.followUps++;
      if (!row.recipients.includes(d.to)) row.recipients.push(d.to);
    }
    for (const row of byAlert.values()) {
      row.people = new Set(deliveries.filter((d) => d.alertId === row.alert.id).map((d) => d.subscriberId)).size;
    }
    return [...byAlert.values()].sort((a, b) => b.alert.createdAt.localeCompare(a.alert.createdAt));
  }, [alerts, deliveries]);

  const reach = (meta?.areas ?? []).map((a) => ({ name: a.name, count: subscribers.filter((s) => s.areaIds.includes(a.id)).length }));
  const areaName = (id: string) => meta?.areas.find((a) => a.id === id)?.name ?? id;

  return (
    <section id="delivery" className="card scroll-mt-20" aria-label="Delivery">
      <CardHeader title="Delivery" description="Who your published alerts reached." right={<span className="text-xs text-muted">{subscribers.length} subscribers</span>} />

      <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-line px-5 py-3 text-xs text-muted">
        {reach.map((r) => (
          <span key={r.name}>
            {r.name} <span className="font-semibold tabular-nums text-ink">{r.count}</span>
          </span>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
          <Send className="h-5 w-5 text-muted" />
          <p className="text-sm text-muted">Nothing sent yet. When you publish an alert, you'll see who it reached here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const expanded = open === r.alert.id;
            return (
              <li key={r.alert.id}>
                <button
                  onClick={() => setOpen(expanded ? null : r.alert.id)}
                  aria-expanded={expanded}
                  className="flex w-full flex-col gap-2 px-5 py-3.5 text-left transition hover:bg-sunken/60 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <KindBadge kind={r.alert.kind} />
                      <UrgencyBadge urgency={r.alert.urgency} />
                      <span className="text-xs text-muted">{r.alert.areaIds.map(areaName).join(", ")}</span>
                    </div>
                    <p className="truncate text-sm text-ink">{r.alert.what}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-xs text-muted">
                    <span className="text-sm font-semibold tabular-nums text-ink">
                      {r.people} {r.people === 1 ? "person" : "people"}
                    </span>
                    <span className="inline-flex items-center gap-1" title="Text messages">
                      <MessageSquare className="h-3.5 w-3.5" /> {r.sms}
                    </span>
                    <span className="inline-flex items-center gap-1" title="Emails">
                      <Mail className="h-3.5 w-3.5" /> {r.email}
                    </span>
                    {r.whatsapp > 0 && (
                      <span className="inline-flex items-center gap-1" title="WhatsApp messages">
                        <MessageCircle className="h-3.5 w-3.5" /> {r.whatsapp}
                      </span>
                    )}
                    {r.followUps > 0 && <span className="rounded-md bg-confirmed-soft px-1.5 py-0.5 font-medium text-confirmed">{r.followUps} follow-up{r.followUps > 1 ? "s" : ""}</span>}
                    <span className="font-mono">{timeOf(r.alert.createdAt)}</span>
                    <ChevronDown className={cx("h-4 w-4 transition", expanded && "rotate-180")} />
                  </div>
                </button>
                {expanded && (
                  <div className="flex flex-wrap gap-1.5 bg-sunken/60 px-5 pb-4 pt-1">
                    {r.recipients.map((to) => (
                      <span key={to} className="rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-[11px] text-ink-soft">
                        {to}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
