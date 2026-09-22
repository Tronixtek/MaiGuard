import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BellRing, Mic, Phone, Search, ShieldAlert, ShieldCheck, ShieldQuestion, Square } from "lucide-react";
import { Link } from "react-router";
import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { cx, timeOf } from "../lib/data";
import { SAMPLE_RUMOURS } from "../lib/samples";
import { useSpeech } from "../lib/useSpeech";
import { contactOf, useMember } from "../lib/member";
import type { CheckOutcome, CheckResponse } from "../lib/types";
import { CardHeader, EngineBadge, PageHeader, Spinner } from "../components/ui";

export function CheckRumour() {
  const { member, checking, signOut } = useMember();
  const [text, setText] = useState("");
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const speech = useSpeech((phrase) => setText((t) => (t ? `${t} ${phrase}` : phrase)));

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (speech.listening) speech.stop();
    setLoading(true);
    setError(null);
    try {
      setResult(await api.check(text));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach MaiGuard. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div>
        <PageHeader title="Check a rumour">
          Paste a message you received to see whether it matches an alert from a trusted voice. A road is never reported safe without one.
        </PageHeader>

        {checking ? (
          <div className="card grid h-40 place-items-center text-muted">
            <Spinner />
          </div>
        ) : !member ? (
          <ContactGate />
        ) : (
        <>
        <p className="mb-3 text-xs text-muted">
          Updates go to <span className="font-medium text-ink-soft">{contactOf(member)}</span> ·{" "}
          <button onClick={signOut} className="font-medium text-signal hover:underline">
            Not you?
          </button>
        </p>
        <form onSubmit={submit} className="card">
          <CardHeader title="Message" description="Paste the forward, type it, or say what you heard." />
          <div className="p-5">
          <div className="relative">
            <textarea
              value={speech.interim ? `${text} ${speech.interim}`.trim() : text}
              onChange={(e) => setText(e.target.value)}
              readOnly={speech.listening}
              rows={4}
              placeholder={speech.supported ? "Paste the WhatsApp forward, type it, or tap the mic…" : "Paste the WhatsApp forward, or type what you heard…"}
              className="field resize-none pr-14 leading-relaxed"
              aria-label="Message you received"
            />
            {speech.supported && (
              <button
                type="button"
                onClick={speech.listening ? speech.stop : speech.start}
                aria-pressed={speech.listening}
                title={speech.listening ? "Stop" : "Speak"}
                className={cx(
                  "absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full shadow-card transition",
                  speech.listening ? "bg-danger text-white" : "bg-signal text-white hover:bg-signal-hover",
                )}
              >
                {speech.listening && <span className="absolute inset-0 animate-ping rounded-full bg-danger/30" />}
                {speech.listening ? <Square className="h-3.5 w-3.5 fill-current" /> : <Mic className="h-4 w-4" />}
                <span className="sr-only">{speech.listening ? "Stop recording" : "Speak the message"}</span>
              </button>
            )}
          </div>
          {speech.listening && <p className="mt-2 text-xs text-danger">Listening… tap the square to stop.</p>}
          {speech.error && <p className="mt-2 text-xs text-danger">{speech.error}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Examples</span>
            {SAMPLE_RUMOURS.map((s) => (
              <button type="button" key={s.label} className="chip" onClick={() => setText(s.text)}>
                {s.label}
              </button>
            ))}
          </div>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-line bg-sunken/60 px-5 py-3">
            {error && <p className="mr-auto text-sm text-danger">{error}</p>}
            <button type="submit" className="btn-primary" disabled={loading || text.trim().length < 5}>
              {loading ? <Spinner /> : <Search className="h-4 w-4" />}
              {loading ? "Checking…" : "Check message"}
            </button>
          </div>
        </form>
        </>
        )}

        <div aria-live="polite">
          <AnimatePresence mode="wait">
            {result && (
              <motion.div key={result.checkId} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-6">
                <OutcomeCard r={result} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

    </div>
  );
}

const OUTCOME: Record<CheckOutcome, { Icon: typeof ShieldCheck; tone: string; soft: string; label: string }> = {
  match: { Icon: ShieldCheck, tone: "text-confirmed", soft: "bg-confirmed-soft", label: "Verified" },
  contradict: { Icon: ShieldAlert, tone: "text-danger", soft: "bg-danger-soft", label: "Not true as told" },
  unverified: { Icon: ShieldQuestion, tone: "text-unverified", soft: "bg-unverified-soft", label: "Unconfirmed" },
};

function OutcomeCard({ r }: { r: CheckResponse }) {
  const o = OUTCOME[r.outcome];
  return (
    <article className="card overflow-hidden">
      <header className={cx("flex items-start gap-3 border-b border-line p-5", o.soft)}>
        <o.Icon className={cx("mt-0.5 h-6 w-6 shrink-0", o.tone)} strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <p className={cx("text-xs font-medium", o.tone)}>{o.label}</p>
          <h2 className="mt-0.5 text-lg font-semibold text-ink">{r.headline}</h2>
          <p className="mt-1 text-sm text-ink-soft">{r.summary}</p>
        </div>
        <EngineBadge engine={r.engine} />
      </header>

      <div className="space-y-5 p-5">
        {r.alert && (
          <blockquote className="rounded-lg border border-line bg-sunken px-4 py-3">
            <p className="text-sm font-medium text-ink">{r.alert.what}</p>
            <p className="mt-1 text-sm text-muted">
              {r.alert.where} · {timeOf(r.alert.createdAt)}
            </p>
          </blockquote>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          {r.known.length > 0 && <List title="What is known" items={r.known} />}
          {r.unknown.length > 0 && <List title="What is not known" items={r.unknown} />}
        </div>
        {r.guidance.length > 0 && <List title="What to do" items={r.guidance} strong />}

        {r.contact && (
          <div className="flex flex-col gap-3 rounded-lg border border-line p-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="text-xs text-muted">Contact for {r.contact.areaName}</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">{r.contact.name}</p>
              <p className="text-sm text-muted">{r.contact.role}</p>
            </div>
            <a href={`tel:${r.contact.phone.replace(/\s/g, "")}`} className="btn-ghost">
              <Phone className="h-4 w-4" /> {r.contact.phone}
            </a>
          </div>
        )}

        {r.followUp && (
          <p className={cx("flex items-start gap-2 rounded-lg p-3 text-sm", r.followUp.promised ? "bg-signal-soft text-ink ring-1 ring-inset ring-signal/20" : "bg-sunken text-muted")}>
            <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
            {r.followUp.message}
          </p>
        )}
      </div>
    </article>
  );
}

function List({ title, items, strong }: { title: string; items: string[]; strong?: boolean }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-ink">{title}</p>
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i} className={cx("flex gap-2 text-sm leading-relaxed", strong ? "text-ink" : "text-ink-soft")}>
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-current opacity-50" />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** First visit only: a phone number, so answers and follow-ups can reach this person. */
function ContactGate() {
  const { saveContact } = useMember();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await saveContact(phone);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach MaiGuard. Check your connection.");
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="card">
      <CardHeader title="Your phone number" description="Asked once. We use it to send you updates about what you check." />
      <div className="p-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0803 000 0000"
            aria-label="Phone number"
            className="field sm:max-w-xs"
            required
          />
          <button type="submit" className="btn-primary" disabled={sending || phone.replace(/\D/g, "").length < 10}>
            {sending ? <Spinner /> : <ArrowRight className="h-4 w-4" />}
            Continue
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-x-1 border-t border-line bg-sunken/60 px-5 py-3 text-xs text-muted">
        Want to choose your roads or use email?
        <Link to="/account" className="font-medium text-signal hover:underline">
          Create an account
        </Link>
        or
        <Link to="/account?mode=signin" className="font-medium text-signal hover:underline">
          sign in
        </Link>
        .
      </div>
    </form>
  );
}
