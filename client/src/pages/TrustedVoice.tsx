import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowRight, Check, CheckCircle2, Mic, Send, Sparkles, Square, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { api, ApiError } from "../lib/api";
import { cx, timeAgo, timeOf, useData } from "../lib/data";
import { SAMPLE_REPORTS } from "../lib/samples";
import type { AlertDraft, AlertKind, Grounding, PublishResult, Urgency } from "../lib/types";
import { useSpeech } from "../lib/useSpeech";
import { useAuth } from "../lib/auth";
import { DeliveryPanel } from "../components/DeliveryPanel";
import { CardHeader, EngineBadge, KindBadge, PageHeader, Spinner, UrgencyBadge } from "../components/ui";

export function TrustedVoice() {
  const [transcript, setTranscript] = useState("");
  const [draft, setDraft] = useState<AlertDraft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<PublishResult | null>(null);

  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  const speech = useSpeech((phrase) => setTranscript((t) => (t ? `${t} ${phrase}` : phrase)));

  const structure = async () => {
    if (speech.listening) speech.stop();
    setDrafting(true);
    setError(null);
    setPublished(null);
    try {
      setDraft(await api.draft(transcript));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reach MaiGuard. Check your connection.");
    } finally {
      setDrafting(false);
    }
  };

  const onPublished = (r: PublishResult) => {
    setPublished(r);
    setDraft(null);
    setTranscript("");
  };

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <PageHeader title="Trusted voice">
          Record or type a report. MaiGuard drafts a structured alert and selects the affected areas. Nothing is sent until you publish.
        </PageHeader>

        <section className="card" aria-label="Report">
          <CardHeader title="Report" description="Speak naturally. Order and wording don't matter." />
          <div className="p-5">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <button
              type="button"
              onClick={speech.listening ? speech.stop : speech.start}
              disabled={!speech.supported}
              aria-pressed={speech.listening}
              title={speech.supported ? undefined : "Speech input needs Chrome, Edge or Safari. You can type instead."}
              className={cx(
                "relative grid h-16 w-16 shrink-0 place-items-center rounded-full shadow-card transition disabled:opacity-40",
                speech.listening ? "bg-danger text-white" : "bg-signal text-white hover:bg-signal-hover",
              )}
            >
              {speech.listening && <span className="absolute inset-0 animate-ping rounded-full bg-danger/30" />}
              {speech.listening ? <Square className="h-5 w-5 fill-current" /> : <Mic className="h-6 w-6" />}
              <span className="sr-only">{speech.listening ? "Stop recording" : "Start recording"}</span>
            </button>
            <div className="w-full">
              <textarea
                value={speech.interim ? `${transcript} ${speech.interim}`.trim() : transcript}
                onChange={(e) => setTranscript(e.target.value)}
                readOnly={speech.listening}
                rows={5}
                placeholder={speech.supported ? "Tap the microphone and speak, or type here…" : "Type your report here…"}
                className="field resize-none leading-relaxed"
                aria-label="Report transcript"
              />
              {speech.error && <p className="mt-2 text-xs text-danger">{speech.error}</p>}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Examples</span>
            {SAMPLE_REPORTS.map((s) => (
              <button key={s.label} className="chip" onClick={() => setTranscript(s.text)}>
                {s.label}
              </button>
            ))}
          </div>

          </div>
          <div className="flex items-center justify-end gap-3 border-t border-line bg-sunken/60 px-5 py-3">
            {error && <p className="mr-auto text-sm text-danger">{error}</p>}
            <button className="btn-primary" onClick={structure} disabled={drafting || transcript.trim().length < 8}>
              {drafting ? <Spinner /> : <Sparkles className="h-4 w-4" />}
              {drafting ? "Drafting…" : "Draft alert"}
            </button>
          </div>
        </section>

        <AnimatePresence mode="wait">
          {draft && (
            <motion.div key="draft" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-6">
              <DraftEditor draft={draft} transcript={transcript} onPublished={onPublished} />
            </motion.div>
          )}
          {published && (
            <motion.div key="done" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card mt-6 flex flex-col gap-4 border-confirmed/30 bg-confirmed-soft p-5 sm:flex-row sm:items-center">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-confirmed" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink">Alert published</p>
                <p className="text-sm text-muted">
                  Reached {published.recipients} phone{published.recipients === 1 ? "" : "s"} in {published.alert.where}
                  {published.followUpsKept > 0 && <> · kept {published.followUpsKept} follow-up promise{published.followUpsKept === 1 ? "" : "s"}</>}.
                </p>
              </div>
              <a href="#delivery" className="btn-ghost">
                View delivery <ArrowRight className="h-4 w-4" />
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <aside className="space-y-6 lg:col-span-5 lg:pt-2">
        <TrendsPanel />
        <AlertsPanel />
      </aside>

      <div className="lg:col-span-12">
        <DeliveryPanel />
      </div>
    </div>
  );
}

function DraftEditor({ draft, transcript, onPublished }: { draft: AlertDraft; transcript: string; onPublished: (r: PublishResult) => void }) {
  const { meta, subscribers } = useData();
  const [d, setD] = useState(draft);
  const [edited, setEdited] = useState<Record<string, boolean>>({});
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof AlertDraft>(k: K, v: AlertDraft[K]) => {
    setD((prev) => ({ ...prev, [k]: v }));
    setEdited((e) => ({ ...e, [k]: true }));
  };
  const toggleArea = (id: string) => set("areaIds", d.areaIds.includes(id) ? d.areaIds.filter((a) => a !== id) : [...d.areaIds, id]);

  const recipients = subscribers.filter((s) => s.areaIds.some((id) => d.areaIds.includes(id))).length;
  const { voice } = useAuth();
  const ungrounded = (["what", "where", "action"] as const).filter((k) => !edited[k] && !d.grounding[k].grounded);

  const publish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const { grounding: _g, engine: _e, ...body } = d;
      onPublished(await api.publish({ ...body, transcript }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not publish. Try again.");
      setPublishing(false);
    }
  };

  return (
    <section className="card overflow-hidden" aria-label="Review alert">
      <CardHeader title="Review alert" description="Check each line against what you said, then publish." right={<EngineBadge engine={d.engine} />} />

      <div className="space-y-5 p-5">
        <Field label="What happened" value={d.what} onChange={(v) => set("what", v)} grounding={d.grounding.what} edited={edited.what} multiline />
        <Field label="Where" value={d.where} onChange={(v) => set("where", v)} grounding={d.grounding.where} edited={edited.where} />
        <Field
          label="What to do"
          value={d.action}
          onChange={(v) => set("action", v)}
          grounding={d.grounding.action}
          edited={edited.action}
          multiline
          emptyNote="You didn't say what people should do. Add it if you know, or leave it blank."
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="eyebrow mb-1.5">Type</p>
            <Segmented<AlertKind>
              value={d.kind}
              onChange={(v) => set("kind", v)}
              options={[
                ["danger", "Danger"],
                ["advisory", "Advisory"],
                ["all_clear", "All clear"],
              ]}
            />
          </div>
          <div>
            <p className="eyebrow mb-1.5">Urgency</p>
            <Segmented<Urgency>
              value={d.urgency}
              onChange={(v) => set("urgency", v)}
              options={[
                ["interrupt", "Interrupt now"],
                ["available", "Wait quietly"],
              ]}
            />
          </div>
        </div>
        {d.urgencyReason && !edited.urgency && (
          <p className="-mt-2 text-xs text-muted">
            <Sparkles className="mr-1 inline h-3 w-3 text-signal" />
            {d.urgencyReason}
          </p>
        )}

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="eyebrow">Affected areas</p>
            <p className="inline-flex items-center gap-1 text-xs text-muted">
              <Users className="h-3.5 w-3.5" /> {recipients} phone{recipients === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {meta?.areas.map((a) => {
              const on = d.areaIds.includes(a.id);
              return (
                <button key={a.id} onClick={() => toggleArea(a.id)} aria-pressed={on} className={cx("chip", on && "border-signal/40 bg-signal-soft text-signal hover:border-signal/60")}>
                  {on && <Check className="h-3 w-3" />} {a.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-sunken p-4">
          <p className="eyebrow mb-2">SMS preview</p>
          <div className="max-w-sm rounded-lg border border-line bg-surface px-3 py-2.5 text-[13px] leading-snug shadow-card">
            <div className="mb-1 flex items-center gap-2">
              <KindBadge kind={d.kind} />
              <UrgencyBadge urgency={d.urgency} />
            </div>
            <p className="font-medium text-ink">{d.where}</p>
            <p className="text-ink">{d.what}</p>
            {d.action && <p className="mt-1 text-ink"><span className="font-semibold">What to do:</span> {d.action}</p>}
            <p className="mt-1.5 text-[11px] text-muted">Verified by {voice ? `${voice.name}, ${voice.role}` : "you"}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-line bg-sunken/60 px-5 py-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-xs text-muted">
          {ungrounded.length > 0 ? (
            <span className="text-danger">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
              Check the highlighted line{ungrounded.length > 1 ? "s" : ""} before publishing.
            </span>
          ) : error ? (
            <span className="text-danger">{error}</span>
          ) : (
            `Publishing adds this to the verified record as ${voice?.name ?? "you"}.`
          )}
        </p>
        <button className="btn-primary" onClick={publish} disabled={publishing || d.areaIds.length === 0 || d.what.trim().length < 3}>
          {publishing ? <Spinner /> : <Send className="h-4 w-4" />}
          Publish to {recipients} phone{recipients === 1 ? "" : "s"}
        </button>
      </div>
    </section>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  grounding: Grounding;
  edited?: boolean;
  multiline?: boolean;
  emptyNote?: string;
}) {
  const { label, value, onChange, grounding, edited, multiline, emptyNote } = props;
  const warn = !edited && !grounding.grounded;
  const Input = multiline ? "textarea" : "input";
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</label>
      <Input
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => onChange(e.target.value)}
        rows={multiline ? 2 : undefined}
        className={cx("field resize-none", warn && "border-danger/60 bg-danger-soft/40")}
      />
      <p className={cx("mt-1.5 text-xs", warn ? "text-danger" : "text-muted")}>
        {edited ? (
          "Edited by you."
        ) : !value && emptyNote ? (
          emptyNote
        ) : grounding.grounded ? (
          <>
            <Check className="mr-1 inline h-3 w-3 text-confirmed" />
            From your words: <q className="italic">{grounding.quote}</q>
          </>
        ) : (
          <>
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            We couldn't find this in what you said. Correct it or remove it.
          </>
        )}
      </p>
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="inline-flex w-full rounded-lg border border-line bg-sunken p-0.5" role="radiogroup">
      {options.map(([v, label]) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cx("flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition", value === v ? "bg-surface text-ink shadow-card ring-1 ring-line" : "text-muted hover:text-ink")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function TrendsPanel() {
  const { trends } = useData();
  return (
    <section className="card" aria-label="What residents are asking">
      <CardHeader title="What residents are asking" description="Rumour checks in the last 3 hours, by place and topic." />
      <ul className="space-y-2 p-4">
        <AnimatePresence initial={false}>
          {trends.map((t) => (
            <motion.li key={t.key} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cx("rounded-lg border p-3", t.needsAnswer ? "border-signal/30 bg-signal-soft" : "border-line")}>
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white text-sm font-semibold tabular-nums text-ink ring-1 ring-line">{t.count}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {t.topicLabel} · {t.areaName}
                  </p>
                  <p className="truncate text-xs text-muted">“{t.latestText}”</p>
                </div>
                {t.needsAnswer && <span className="shrink-0 text-[11px] font-medium text-signal">Unanswered</span>}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
        {trends.length === 0 && <li className="rounded-lg border border-dashed border-line p-4 text-center text-sm text-muted">No rumour checks yet.</li>}
      </ul>
    </section>
  );
}

function AlertsPanel() {
  const { alerts, meta } = useData();
  return (
    <section className="card" aria-label="Verified alerts">
      <CardHeader title="Verified alerts" description="The only source rumour checks are compared against." />
      <ul className="divide-y divide-line px-5">
        {alerts.map((a) => {
          const voice = meta?.trustedVoices.find((v) => v.id === a.trustedVoiceId);
          return (
            <li key={a.id} className={cx("py-3", a.status === "resolved" && "opacity-55")}>
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <KindBadge kind={a.kind} />
                {a.status === "resolved" && <span className="text-[11px] text-muted">Superseded</span>}
                <span className="ml-auto font-mono text-[11px] text-muted" title={timeAgo(a.createdAt)}>{timeOf(a.createdAt)}</span>
              </div>
              <p className="text-sm text-ink">{a.what}</p>
              <p className="mt-0.5 text-xs text-muted">
                {a.where} · {voice?.name}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
