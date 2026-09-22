import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setAuthToken, setOnUnauthorized } from "./api";
import type { Member } from "./types";

/**
 * A community member's session. Two ways in:
 * - quick path: a phone number, once; remembered on this device;
 * - account: phone and/or email + password, usable on any device.
 */
interface MemberSession {
  member: Member | null;
  /** True when signed in to an account (not just the quick path). */
  hasAccountSession: boolean;
  checking: boolean;
  saveContact: (phone: string) => Promise<void>;
  signUp: (body: { phone?: string; email?: string; password: string; areaIds: string[] }) => Promise<void>;
  signIn: (identifier: string, password: string) => Promise<void>;
  setAreas: (areaIds: string[]) => Promise<void>;
  signOut: () => void;
}

const KEY = "maiguard.member";
type Stored = { token: string; account: boolean };

const readStored = (): Stored | null => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
};
const writeStored = (s: Stored | null) => {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the session lasts until the tab closes */
  }
};

const MemberContext = createContext<MemberSession | null>(null);

export function MemberProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [account, setAccount] = useState(false);
  const [checking, setChecking] = useState(Boolean(readStored()));

  const signOut = useCallback(() => {
    setAuthToken("member", null);
    writeStored(null);
    setMember(null);
    setAccount(false);
  }, []);

  useEffect(() => {
    setOnUnauthorized("member", signOut);
    const stored = readStored();
    if (!stored) return;
    setAuthToken("member", stored.token);
    setAccount(stored.account);
    api
      .memberMe()
      .then((r) => setMember(r.member))
      .catch(signOut)
      .finally(() => setChecking(false));
  }, [signOut]);

  const start = useCallback((token: string, m: Member, isAccount: boolean) => {
    setAuthToken("member", token);
    writeStored({ token, account: isAccount });
    setMember(m);
    setAccount(isAccount);
  }, []);

  const saveContact = useCallback(async (phone: string) => {
    const r = await api.memberContact(phone);
    start(r.token, r.member, false);
  }, [start]);
  const signUp = useCallback(async (body: Parameters<MemberSession["signUp"]>[0]) => {
    const r = await api.memberSignup(body);
    start(r.token, r.member, true);
  }, [start]);
  const signIn = useCallback(async (identifier: string, password: string) => {
    const r = await api.memberLogin(identifier, password);
    start(r.token, r.member, true);
  }, [start]);
  const setAreas = useCallback(async (areaIds: string[]) => {
    const r = await api.memberSetAreas(areaIds);
    setMember(r.member);
  }, []);

  const value = useMemo(
    () => ({ member, hasAccountSession: account, checking, saveContact, signUp, signIn, setAreas, signOut }),
    [member, account, checking, saveContact, signUp, signIn, setAreas, signOut],
  );
  return <MemberContext.Provider value={value}>{children}</MemberContext.Provider>;
}

export function useMember() {
  const ctx = useContext(MemberContext);
  if (!ctx) throw new Error("useMember must be used inside MemberProvider");
  return ctx;
}

/** Short label for a member's contact, e.g. "+234 ••• ••• 0199" or "a•••@example.com". */
export const contactOf = (m: Member) => [m.phone, m.email].filter(Boolean).join(" · ");
