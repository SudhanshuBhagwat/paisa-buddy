"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/auth/actions";

const HIDDEN_PATHS = ['/login', '/setup'];

const ALL_TABS = [
  { href: "/", label: "Home" },
  { href: "/review", label: "Review", showBadge: true },
  { href: "/stats", label: "Stats" },
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
      className="hidden md:flex fixed top-0 left-0 right-0 z-40 h-14 items-center px-6 gap-10"
      style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span className="font-semibold text-sm tracking-tight mr-4">
        Paisa Buddy
      </span>

      <div className="flex items-center gap-1 flex-1">
        {ALL_TABS.filter((t) => t.href !== '/review' || pendingCount > 0).map((tab) => {
          const active = pathname === tab.href;
          const badge = tab.showBadge && pendingCount > 0 ? pendingCount : null;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={
                active
                  ? { background: "#dc2626", color: "#fff", fontWeight: 500 }
                  : { color: "var(--muted)" }
              }
            >
              {tab.label}
              {badge != null && (
                <span
                  className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full text-[10px] font-bold flex items-center justify-center px-1"
                  style={{ background: active ? '#fff' : '#dc2626', color: active ? '#dc2626' : '#fff' }}
                >
                  {badge > 99 ? '99+' : badge}
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
          style={{ color: "var(--muted)" }}
        >
          Sign out
        </button>
      </form>
    </nav>
  );
}
