"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/auth/actions";
import { useStore } from "@/lib/store";
import BuddySVG from "@/components/BuddySVG";

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
  const { state } = useStore();

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
        <BuddySVG size={26} mood={state.buddyMood} />
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
          style={{ color: "var(--pb-ink-3)", fontWeight: 600, cursor: 'pointer' }}
        >
          Sign out
        </button>
      </form>
    </nav>
  );
}
