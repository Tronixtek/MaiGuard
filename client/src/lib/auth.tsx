import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setAuthToken, setOnUnauthorized } from "./api";
import type { TrustedVoice } from "./types";

interface Auth {
  voice: TrustedVoice | null;
  token: string | null;
  /** True until a stored session has been checked with the server. */
  checking: boolean;
  signIn: (identifier: string, secret: string) => Promise<void>;
  signOut: () => void;
}

const KEY = "maiguard.session";
const AuthContext = createContext<Auth | null>(null);

// Storage can be unavailable (private windows, blocked site data); the app still works, you just sign in again.
const readStored = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const writeStored = (token: string | null) => {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(readStored);
  const [voice, setVoice] = useState<TrustedVoice | null>(null);
  const [checking, setChecking] = useState(Boolean(readStored()));

  const signOut = useCallback(() => {
    setAuthToken("voice", null);
    writeStored(null);
    setToken(null);
    setVoice(null);
  }, []);

  useEffect(() => {
    setOnUnauthorized("voice", signOut);
    const stored = readStored();
    if (!stored) return;
    setAuthToken("voice", stored);
    api
      .me()
      .then((r) => setVoice(r.voice))
      .catch(signOut)
      .finally(() => setChecking(false));
  }, [signOut]);

  const signIn = useCallback(async (identifier: string, secret: string) => {
    const r = await api.login(identifier, secret);
    setAuthToken("voice", r.token);
    writeStored(r.token);
    setToken(r.token);
    setVoice(r.voice);
  }, []);

  const value = useMemo(() => ({ voice, token, checking, signIn, signOut }), [voice, token, checking, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
