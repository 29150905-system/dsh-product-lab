"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function IconStudents() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
      <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
      <circle cx="10" cy="8" r="3.5" />
      <path d="M20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35" />
      <path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8" />
    </svg>
  );
}

function IconClassroom() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M12 16v4" />
      <path d="M8 20h8" />
      <path d="M7 9h6" />
      <path d="M7 12h4" />
    </svg>
  );
}

function IconGrowth() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
      <path d="M12 21v-7" />
      <path d="M12 14c0-3.5 2.5-6 6-6 0 3.5-2.5 6-6 6Z" />
      <path d="M12 14c0-2.8-2-4.8-5-4.8 0 2.8 2 4.8 5 4.8Z" />
      <path d="M8 21h8" />
    </svg>
  );
}

const tabs = [
  { href: "/app", label: "学情", icon: <IconStudents /> },
  { href: "/app/classroom", label: "课堂", icon: <IconClassroom /> },
  { href: "/app/growth", label: "成长", icon: <IconGrowth /> },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/95 backdrop-blur">
      <div
        className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-2"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        {tabs.map((tab) => {
          const active =
            tab.href === "/app"
              ? pathname === "/app" || pathname.startsWith("/app/classes")
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-1.5 text-[11px] transition ${
                active ? "text-zinc-900" : "text-zinc-400"
              }`}
            >
              <span className={active ? "text-zinc-900" : "text-zinc-400"}>{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
