import { motion } from "motion/react";
import { BellRing, CornerDownRight } from "lucide-react";
import { cx, timeOf } from "../lib/data";
import type { Delivery } from "../lib/types";

const KIND_TAG: Record<Delivery["kind"], string> = {
  broadcast: "",
  follow_up: "Follow-up",
};

export function SmsBubble({ d, fresh }: { d: Delivery; fresh?: boolean }) {
  const [head, ...rest] = d.body.split("\n");
  const footer = rest.length > 1 && rest[rest.length - 1]!.startsWith("Verified by") ? rest.pop() : undefined;
  return (
    <motion.div
      layout
      initial={fresh ? { opacity: 0, y: 12, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={cx(
        "rounded-lg border px-3 py-2.5 text-[13px] leading-snug shadow-card",
        d.urgency === "interrupt" && d.kind === "broadcast" ? "border-danger/25 bg-surface" : "border-line bg-surface",
      )}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-ink-soft">
        {d.kind === "follow_up" && <CornerDownRight className="h-3 w-3 text-confirmed" />}
        {d.urgency === "interrupt" && d.kind === "broadcast" && <BellRing className="h-3 w-3 text-danger" />}
        <span className="truncate">{head}</span>
        <span className="ml-auto flex shrink-0 gap-1">
          {d.channel !== "sms" && <span className="rounded-md bg-sunken px-1.5 py-px font-medium">{d.channel === "email" ? "Email" : "WhatsApp"}</span>}
          {KIND_TAG[d.kind] && <span className="rounded-md bg-sunken px-1.5 py-px font-medium">{KIND_TAG[d.kind]}</span>}
        </span>
      </div>
      <p className="whitespace-pre-line text-ink">{rest.join("\n")}</p>
      <div className="mt-1.5 flex items-end justify-between gap-2 text-[10.5px] text-muted">
        <span>{footer}</span>
        <span className="shrink-0 font-mono">{timeOf(d.createdAt)}</span>
      </div>
    </motion.div>
  );
}
