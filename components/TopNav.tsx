"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/auth/actions";

const HIDDEN_PATHS = ['/login', '/setup'];

const ALL_TABS = [
  { href: "/", label: "Home" },
  { href: "/review", label: "Review", showBadge: true },
  { href: "/stats", label: "Stats" },
  { href: "/accounts", label: "Accounts" },
  { href: "/settings", label: "Settings" },
];

interface Props {
  pendingCount?: number;
}

export default function TopNav({ pendingCount = 0 }: Props) {
  const pathname = usePathname();

  if (HIDDEN_PATHS.includes(pathname)) return null;

  return (
    <nav
      className="hidden md:flex fixed top-0 left-0 right-0 z-40 h-[66px] items-center px-6"
      style={{
        background: "var(--pb-surface)",
        borderBottom: "1px solid var(--pb-line)",
        gap: 0,
      }}
    >
      {/* Wordmark */}
      <div className="flex items-center shrink-0 mr-6" style={{ gap: 8 }}>
        <svg width="26" height="26" viewBox="0 0 64 64" fill="none">
          <path d="M32 13 C 32 6, 26 3, 23 6 C 21 9, 26 13, 32 13 Z" fill="#1A936F" />
          <path d="M32 13 C 32 7, 38 5, 40 8 C 41 11, 37 14, 32 13 Z" fill="#2BA77F" />
          <path d="M32 16 L 32 11" stroke="#0F5132" strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="36" r="22" fill="#E4F1EA" stroke="#1A936F" strokeWidth="2.5" />
          <circle cx="32" cy="36" r="17" stroke="#1A936F" strokeWidth="1.5" strokeOpacity="0.3" />
          <circle cx="22" cy="40" r="3.2" fill="#F4B8A8" fillOpacity="0.7" />
          <circle cx="42" cy="40" r="3.2" fill="#F4B8A8" fillOpacity="0.7" />
          <circle cx="25.5" cy="34" r="2.6" fill="#0F5132" />
          <circle cx="38.5" cy="34" r="2.6" fill="#0F5132" />
          <path d="M25 41 Q32 47 39 41" stroke="#0F5132" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        </svg>
        <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.02em", color: "var(--pb-ink)" }}>
          Paisa <span style={{ color: "var(--pb-brand)" }}>Buddy</span>
        </span>
      </div>

      <div className="flex items-center gap-1 flex-1">
        {ALL_TABS.filter((t) => t.href !== '/review' || pendingCount > 0).map((tab) => {
          const active = pathname === tab.href;
          const badge = tab.showBadge && pendingCount > 0 ? pendingCount : null;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative px-4 py-2 rounded-xl text-sm transition-colors"
              style={
                active
                  ? {
                      background: "var(--pb-brand-pale)",
                      color: "var(--pb-brand-deep)",
                      fontWeight: 700,
                    }
                  : { color: "var(--pb-ink-2)", fontWeight: 600 }
              }
            >
              {tab.label}
              {badge != null && (
                <span
                  className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full text-[10px] font-bold flex items-center justify-center px-1"
                  style={{
                    background: active ? "var(--pb-brand-deep)" : "var(--pb-neg)",
                    color: "#fff",
                  }}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <form action={logout}>
        <button
          type="submit"
          className="px-3 py-1.5 rounded-lg text-sm transition-opacity hover:opacity-70"
          style={{ color: "var(--pb-ink-3)", fontWeight: 600 }}
        >
          Sign out
        </button>
      </form>
    </nav>
  );
}
