import { Lock, LogIn } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Logo, Spinner } from "../components/ui";

/** Renders its children only for a signed-in trusted voice; everyone else gets the sign-in form. */
export function RequireTrustedVoice({ children }: { children: ReactNode }) {
  const { voice, checking } = useAuth();
  if (checking) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-muted">
        <Spinner />
      </div>
    );
  }
  return voice ? <>{children}</> : <SignIn />;
}

function SignIn() {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [secret, setSecret] = useState("");
  const isEmail = identifier.includes("@");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(identifier, secret);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach MaiGuard. Check your connection.");
      setSecret("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm py-8 sm:py-16">
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo className="h-10 w-10" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">Trusted voice sign in</h1>
        <p className="mt-1.5 text-sm text-muted">Only verified community contacts can publish alerts.</p>
      </div>

      <form onSubmit={submit} className="card space-y-4 p-6">
        <div>
          <label htmlFor="identifier" className="mb-1.5 block text-[13px] font-medium text-ink-soft">
            Phone number or email
          </label>
          <input
            id="identifier"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="0803 000 0000 or you@example.com"
            className="field"
            required
          />
        </div>
        <div>
          <label htmlFor="secret" className="mb-1.5 block text-[13px] font-medium text-ink-soft">
            {isEmail ? "Password" : "PIN"}
          </label>
          <input
            id="secret"
            type="password"
            inputMode={isEmail ? "text" : "numeric"}
            autoComplete="current-password"
            value={secret}
            onChange={(e) => setSecret(isEmail ? e.target.value : e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder={isEmail ? "Password" : "••••••"}
            className={isEmail ? "field" : "field tracking-widest"}
            required
          />
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={loading || !identifier || secret.length < 4}>
          {loading ? <Spinner /> : <LogIn className="h-4 w-4" />}
          Sign in
        </button>
      </form>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted">
        <Lock className="h-3.5 w-3.5" /> Access is issued by your community coordinator.
      </p>
    </div>
  );
}
