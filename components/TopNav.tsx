"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home" },
  { href: "/stats", label: "Stats" },
  { href: "/settings", label: "Settings" },
];

interface Props {
  onAdd?: () => void;
}

export default function TopNav({ onAdd }: Props) {
  const pathname = usePathname();

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

      <div className="flex items-center gap-3 flex-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={
                active
                  ? { background: "#dc2626", color: "#fff", fontWeight: 500 }
                  : { color: "var(--muted)" }
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {onAdd && (
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: "#dc2626", color: "#fff" }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add
        </button>
      )}
    </nav>
  );
}
