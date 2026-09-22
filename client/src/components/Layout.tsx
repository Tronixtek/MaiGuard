import { Link, NavLink, Outlet } from "react-router";
import { LogOut, UserRound } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useMember } from "../lib/member";
import { cx } from "../lib/data";
import { Logo } from "./ui";
import { FloatingWhatsApp } from "./FloatingWhatsApp";

const NAV = [
  { to: "/voice", label: "Trusted voice" },
  { to: "/check", label: "Check a rumour" },
];

export function Layout() {
  const { voice, signOut } = useAuth();
  const { member, hasAccountSession } = useMember();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-8 px-4 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2">
            <Logo className="h-6 w-6" />
            <span className="text-[15px] font-semibold tracking-tight text-ink">MaiGuard</span>
          </NavLink>
          <nav className="hidden h-full items-stretch gap-6 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cx(
                    "-mb-px flex items-center border-b-2 text-sm font-medium transition",
                    isActive ? "border-signal text-ink" : "border-transparent text-muted hover:text-ink",
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          {!voice && (
            <Link to="/account" className="btn-ghost ml-auto px-3 py-1.5 text-sm">
              <UserRound className="h-4 w-4" />
              {member && hasAccountSession ? "My account" : "Sign in"}
            </Link>
          )}
          {voice && (
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden text-right leading-tight sm:block">
                <p className="text-sm font-medium text-ink">{voice.name}</p>
                <p className="text-xs text-muted">{voice.role}</p>
              </div>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-signal-soft text-sm font-semibold text-signal sm:hidden">{voice.name[0]}</span>
              <button onClick={signOut} className="btn-ghost px-2.5 py-1.5 text-xs" title="Sign out">
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          )}
        </div>
        <nav className="flex gap-5 overflow-x-auto px-4 md:hidden">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cx("-mb-px shrink-0 border-b-2 pb-2.5 text-sm font-medium", isActive ? "border-signal text-ink" : "border-transparent text-muted")
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>
      <FloatingWhatsApp />
    </div>
  );
}
