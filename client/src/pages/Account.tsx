import { AnimatePresence } from "motion/react";
import { Check, LogIn, LogOut, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { api, ApiError } from "../lib/api";
import { cx, useData } from "../lib/data";
import { useMember } from "../lib/member";
import type { Delivery } from "../lib/types";
import { SmsBubble } from "../components/Phone";
import { CardHeader, Logo, PageHeader, Spinner } from "../components/ui";

/** Community member accounts: optional, phone and/or email, no names. */
export function Account() {
  const { member, hasAccountSession, checking } = useMember();
  if (checking) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-muted">
        <Spinner />
      </div>
    );
  }
  return member && hasAccountSession ? <MyAccount /> : <SignUpOrIn />;
}

function SignUpOrIn() {
  const [params, setParams] = useSearchParams();
  const mode = params.get("mode") === "signin" ? "signin" : "signup";
  const setMode = (m: "signup" | "signin") => setParams(m === "signin" ? { mode: "signin" } : {}, { replace: true });

  return (
    <div className="mx-auto max-w-md py-4 sm:py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo className="h-10 w-10" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">{mode === "signup" ? "Create an account" : "Sign in"}</h1>
        <p className="mt-1.5 text-sm text-muted">
          Optional. An account lets you choose the roads you get alerts for and see them on any device.
        </p>
      </div>
      <div className="mb-4 inline-flex w-full rounded-lg border border-line bg-sunken p-0.5" role="tablist">
        {(["signup", "signin"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cx("flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition", mode === m ? "bg-surface text-ink shadow-card ring-1 ring-line" : "text-muted hover:text-ink")}
          >
            {m === "signup" ? "Create account" : "Sign in"}
          </button>
        ))}
      </div>
      {mode === "signup" ? <SignUpForm /> : <SignInForm />}
      <p className="mt-4 text-center text-xs text-muted">
        Are you a trusted voice?{" "}
        <Link to="/voice" className="font-medium text-signal hover:underline">
          Sign in to publish alerts
        </Link>
      </p>
    </div>
  );
}

function SignUpForm() {
  const { signUp } = useMember();
  const { meta } = useData();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signUp({ phone: phone || undefined, email: email || undefined, password, areaIds });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach MaiGuard. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <Field id="su-phone" label="Phone number" hint="For SMS alerts">
        <input id="su-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 000 0000" className="field" />
      </Field>
      <Field id="su-email" label="Email" hint="For email alerts">
        <input id="su-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="field" />
      </Field>
      <p className="-mt-2 text-xs text-muted">Enter a phone number, an email, or both.</p>
      <Field id="su-password" label="Password">
        <input
          id="su-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className="field"
          required
        />
      </Field>
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-ink-soft">Roads you want alerts for</p>
        <AreaPicker value={areaIds} onChange={setAreaIds} areas={meta?.areas ?? []} />
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={loading || (!phone && !email) || password.length < 8}>
        {loading ? <Spinner /> : <UserPlus className="h-4 w-4" />}
        Create account
      </button>
    </form>
  );
}

function SignInForm() {
  const { signIn } = useMember();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(identifier, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach MaiGuard. Check your connection.");
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <Field id="si-id" label="Phone number or email">
        <input id="si-id" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="field" required />
      </Field>
      <Field id="si-password" label="Password">
        <input id="si-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="field" required />
      </Field>
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={loading || !identifier || !password}>
        {loading ? <Spinner /> : <LogIn className="h-4 w-4" />}
        Sign in
      </button>
    </form>
  );
}

function MyAccount() {
  const { member, setAreas, signOut } = useMember();
  const { meta, deliveries } = useData();
  const [areaIds, setAreaIds] = useState<string[]>(member!.areaIds);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [messages, setMessages] = useState<Delivery[] | null>(null);

  // Reload the inbox whenever a new message goes out.
  const latestDelivery = deliveries[0]?.id;
  useEffect(() => {
    api.memberMessages().then(setMessages).catch(() => setMessages([]));
  }, [latestDelivery]);

  const dirty = [...areaIds].sort().join() !== [...member!.areaIds].sort().join();
  const save = async () => {
    setSaving(true);
    try {
      await setAreas(areaIds);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="My account"
        actions={
          <button onClick={signOut} className="btn-ghost">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        }
      >
        Where your alerts go and which roads they cover.
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <CardHeader title="Contact" />
            <dl className="divide-y divide-line px-5 text-sm">
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted">Phone</dt>
                <dd className="font-medium text-ink">{member!.phone ?? "Not added"}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted">Email</dt>
                <dd className="truncate font-medium text-ink">{member!.email ?? "Not added"}</dd>
              </div>
            </dl>
          </section>

          <section className="card">
            <CardHeader title="Roads" description="You get alerts for these. Roads you check rumours about are added automatically." />
            <div className="p-5">
              <AreaPicker value={areaIds} onChange={setAreaIds} areas={meta?.areas ?? []} />
              <div className="mt-4 flex items-center justify-end gap-3">
                {saved && (
                  <span className="inline-flex items-center gap-1 text-xs text-confirmed">
                    <Check className="h-3.5 w-3.5" /> Saved
                  </span>
                )}
                <button onClick={save} className="btn-primary" disabled={!dirty || saving}>
                  {saving && <Spinner />} Save roads
                </button>
              </div>
            </div>
          </section>
        </div>

        <section className="card lg:col-span-3">
          <CardHeader title="Messages" description="Alerts and updates sent to you." />
          <div className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto bg-sunken p-4">
            {messages === null ? (
              <div className="grid h-24 place-items-center text-muted">
                <Spinner />
              </div>
            ) : messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">No messages yet.</p>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((d) => (
                  <SmsBubble key={d.id} d={d} />
                ))}
              </AnimatePresence>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function AreaPicker({ value, onChange, areas }: { value: string[]; onChange: (v: string[]) => void; areas: { id: string; name: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {areas.map((a) => {
        const on = value.includes(a.id);
        return (
          <button
            type="button"
            key={a.id}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== a.id) : [...value, a.id])}
            className={cx("chip", on && "border-signal/40 bg-signal-soft text-signal hover:border-signal/60")}
          >
            {on && <Check className="h-3 w-3" />} {a.name}
          </button>
        );
      })}
    </div>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between text-[13px] font-medium text-ink-soft">
        {label}
        {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
