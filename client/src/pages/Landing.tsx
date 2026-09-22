import { ArrowRight, BellRing, Check, MessageCircle, Mic, Phone, Search, ShieldQuestion, Smartphone, X } from "lucide-react";
import { Link } from "react-router";
import { WHATSAPP_NUMBER, whatsappLink } from "../lib/whatsapp";

const STEPS = [
  {
    to: "/voice",
    Icon: Mic,
    title: "Trusted voice",
    body: "A market leader or union rep records a short report. MaiGuard drafts a structured alert from their words and picks the affected roads.",
  },
  {
    to: "/voice#delivery",
    Icon: Smartphone,
    title: "Targeted delivery",
    body: "Alerts go by SMS only to people linked to those roads. Urgent alerts notify immediately; the rest arrive silently.",
  },
  {
    to: "/check",
    Icon: Search,
    title: "Rumour check",
    body: "Residents forward a message and get a clear answer: confirmed, contradicted, or not yet verified, with a named contact.",
  },
];


const DOES = [
  "Structures spoken reports and links every line to the speaker's words",
  "Routes each alert to the roads it affects, not the whole town",
  "Decides whether an alert should notify now or wait",
  "Compares rumours with alerts published by trusted voices",
];

const NEVER = [
  "Publishes anything without a trusted voice's approval",
  "Says a road is safe without a verified alert behind it",
  "Leaves a question unanswered: it says what is unknown and who to ask",
];

export function Landing() {
  return (
    <div className="mx-auto max-w-6xl">
      <section className="grid items-center gap-12 py-6 lg:grid-cols-2 lg:py-12">
        <div>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl">
            Verified safety alerts, delivered in seconds.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted">
            Trusted local people publish alerts by speaking. Residents receive them by SMS and can check any rumour against what has been
            verified.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/voice" className="btn-primary px-5 py-2.5">
              Publish an alert <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/check" className="btn-ghost px-5 py-2.5">
              Check a rumour
            </Link>
            {whatsappLink && (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn border border-[#25D366]/40 bg-[#25D366]/10 px-5 py-2.5 text-[#128C4B] hover:bg-[#25D366]/15">
                <MessageCircle className="h-4 w-4" /> Chat MaiGuard AI
              </a>
            )}
          </div>
        </div>
        <Preview />
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <Link key={s.to} to={s.to} className="card group p-6 transition hover:border-line-strong hover:shadow-md">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-signal-soft text-signal">
              <s.Icon className="h-[18px] w-[18px]" />
            </span>
            <h2 className="mt-5 text-base font-semibold text-ink">{s.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-signal">
              Open <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </section>

      {whatsappLink && <WhatsAppBand />}

      <section className="mt-16 grid gap-4 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-base font-semibold text-ink">What the AI does</h2>
          <ul className="mt-4 space-y-3">
            {DOES.map((d) => (
              <li key={d} className="flex gap-3 text-sm text-ink-soft">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-confirmed" /> {d}
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="text-base font-semibold text-ink">What it never does</h2>
          <ul className="mt-4 space-y-3">
            {NEVER.map((d) => (
              <li key={d} className="flex gap-3 text-sm text-ink-soft">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" /> {d}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

/** Invite residents to check rumours with MaiGuard's AI on WhatsApp, where rumours spread. */
function WhatsAppBand() {
  return (
    <section className="card mt-16 grid items-center gap-8 overflow-hidden p-6 sm:p-8 md:grid-cols-2">
      <div>
        <span className="inline-grid h-10 w-10 place-items-center rounded-xl bg-[#25D366]/15 text-[#128C4B]">
          <MessageCircle className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink">Heard something? Ask MaiGuard on WhatsApp.</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Forward the message to MaiGuard's AI assistant, or type what you heard and where. It checks it against what trusted local people have
          confirmed and replies in seconds. If nothing is verified yet, it tells you who to ask and messages you when there's news.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn bg-[#25D366] px-5 py-2.5 text-white shadow-card hover:bg-[#1FBE5C]">
            <MessageCircle className="h-4 w-4" /> Chat MaiGuard AI
          </a>
          <span className="font-mono text-sm text-ink-soft">{WHATSAPP_NUMBER}</span>
        </div>
        <p className="mt-3 text-xs text-muted">Prototype: the demo number replies only to phone numbers registered for testing.</p>
      </div>

      <div className="rounded-xl bg-[#EFEAE2] p-4" aria-hidden>
        <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-[#D9FDD3] px-3 py-2 text-[13px] text-[#111B21] shadow-sm">
          <p className="text-[11px] italic text-[#667781]">Forwarded</p>
          They are shooting at the market now, everybody run home!!
        </div>
        <div className="mt-3 max-w-[90%] rounded-lg rounded-tl-sm bg-white px-3 py-2 text-[13px] leading-snug text-[#111B21] shadow-sm">
          <p className="font-semibold">❌ Not true as told</p>
          <p className="mt-1">Latest verified word: the bangs on Market Road were a generator explosion. Nobody was hurt and there is no shooting.</p>
          <p className="mt-1 text-[11px] italic text-[#667781]">Verified by Hauwa Danjuma, Market women's leader</p>
        </div>
      </div>
    </section>
  );
}

/** Static illustration of the two things a resident sees. */
function Preview() {
  return (
    <div className="relative mx-auto w-full max-w-md pb-14 sm:pb-20" aria-hidden>
      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line bg-unverified-soft px-5 py-4">
          <ShieldQuestion className="h-6 w-6 text-unverified" />
          <div>
            <p className="text-xs font-medium text-unverified">Unconfirmed</p>
            <p className="text-[15px] font-semibold text-ink">Nothing verified yet</p>
          </div>
        </div>
        <div className="space-y-4 px-5 py-4 text-sm">
          <p className="text-ink-soft">No trusted voice has confirmed or denied this. That does not mean the road is safe.</p>
          <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
            <div>
              <p className="text-xs text-muted">Contact for Old Bridge Road</p>
              <p className="font-medium text-ink">Musa Bello</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-signal-soft px-2 py-1 text-xs font-medium text-signal">
              <Phone className="h-3.5 w-3.5" /> Call
            </span>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted">
            <BellRing className="h-3.5 w-3.5 text-signal" /> We'll text you when there is verified news.
          </p>
        </div>
      </div>
      <div className="card absolute bottom-0 -left-4 hidden w-64 p-3 text-xs shadow-lg sm:block lg:-left-10">
        <p className="font-semibold text-ink">MaiGuard ALERT · North Gate Road</p>
        <p className="mt-1 text-ink-soft">Armed men were seen near the checkpoint. Avoid North Gate Road after dark.</p>
        <p className="mt-1.5 text-[11px] text-muted">Verified by Grace Adeyemi · 18:02</p>
      </div>
    </div>
  );
}
