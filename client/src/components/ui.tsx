import { BellOff, BellRing, Cpu, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../lib/data";
import type { AiEngine, AlertKind, Urgency } from "../lib/types";

/** MaiGuard mark: a guard in a peaked cap, standing inside a shield. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cx("h-7 w-7", className)} aria-hidden>
      <path d="M16 1.8 27 5.9v8.6c0 7.2-4.6 12.6-11 15.7C9.6 27.1 5 21.7 5 14.5V5.9Z" className="fill-signal"/>
      <path d="M16 1.8 27 5.9v8.6c0 7.2-4.6 12.6-11 15.7" className="fill-signal-hover"/>
      <circle cx="16" cy="13.6" r="3.1" fill="#fff"/>
      <path d="M11.6 11.4 10.9 8.9c0-.6 2.3-1.6 5.1-1.6s5.1 1 5.1 1.6l-.7 2.5Z" fill="#fff"/>
      <rect x="11" y="11.1" width="10" height="1.5" rx=".75" fill="#fff"/>
      <path d="m16 8.3.55 1.1 1.2.15-.87.83.2 1.2L16 11l-1.08.58.2-1.2-.87-.83 1.2-.15Z" className="fill-signal"/>
      <path d="M9.6 24.6c.4-4.3 3-6.6 6.4-6.6s6 2.3 6.4 6.6c-1.8 1.9-3.9 3.3-6.4 4.4-2.5-1.1-4.6-2.5-6.4-4.4Z" fill="#fff"/>
      <path d="m16 18.6-1.3 1.9 1.3 5.4 1.3-5.4Z" className="fill-signal"/>
    </svg>
  );
}

const KIND: Record<AlertKind, { label: string; cls: string }> = {
  danger: { label: "Danger", cls: "bg-danger-soft text-danger ring-danger/20" },
  advisory: { label: "Advisory", cls: "bg-signal-soft text-signal ring-signal/20" },
  all_clear: { label: "All clear", cls: "bg-confirmed-soft text-confirmed ring-confirmed/20" },
};

export function KindBadge({ kind }: { kind: AlertKind }) {
  return <Pill className={KIND[kind].cls}>{KIND[kind].label}</Pill>;
}

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  return urgency === "interrupt" ? (
    <Pill className="bg-danger-soft text-danger ring-danger/20">
      <BellRing className="h-3 w-3" /> Interrupts now
    </Pill>
  ) : (
    <Pill className="bg-sunken text-ink-soft ring-line">
      <BellOff className="h-3 w-3" /> Waits quietly
    </Pill>
  );
}

export function EngineBadge({ engine, model }: { engine: AiEngine; model?: string | null }) {
  return engine !== "fallback" ? (
    <Pill className="bg-signal-soft text-signal ring-signal/20" title={model ?? undefined}>
      <Sparkles className="h-3 w-3" /> {engine === "gemini" ? "Gemini" : "Claude"}
    </Pill>
  ) : (
    <Pill className="bg-sunken text-muted ring-line" title="No API key set: rule-based fallback">
      <Cpu className="h-3 w-3" /> Rule-based
    </Pill>
  );
}

export function Pill({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", className)}>
      {children}
    </span>
  );
}

export function PageHeader({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {children && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{children}</p>}
      </div>
      {actions}
    </div>
  );
}

export function CardHeader({ title, description, right }: { title: string; description?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {right}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)} aria-hidden />;
}
