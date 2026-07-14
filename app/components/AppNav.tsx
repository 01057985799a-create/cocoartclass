"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const items = [
  { href: "/today", label: "오늘 수업", icon: "🏠" },
  { href: "/attendance", label: "출결·보강", icon: "✅" },
  { href: "/", label: "수업 계획안", icon: "🎨" },
  { href: "/students", label: "학생 관리", icon: "👧" },
  { href: "/feedback", label: "학생 피드백", icon: "💬" },
  { href: "/finance", label: "재무 관리", icon: "💰" },
];

export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 border-b border-emerald-100 bg-white/95 px-4 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 py-3">
        <Link href="/" className="shrink-0 font-bold text-emerald-700">
          COCO AI
        </Link>
        <div className="flex max-w-[calc(100vw-110px)] items-center gap-1 overflow-x-auto rounded-xl bg-emerald-50 p-1">
          {items.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-zinc-500 hover:text-emerald-700"
                }`}
              >
                <span className="mr-1" aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => void supabase.auth.signOut()}
            className="shrink-0 rounded-lg px-2 py-2 text-xs font-semibold text-zinc-400 hover:text-red-600 sm:px-3"
          >
            로그아웃
          </button>
        </div>
      </div>
    </nav>
  );
}
