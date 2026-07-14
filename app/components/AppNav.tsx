"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "수업 계획안", icon: "🎨" },
  { href: "/students", label: "학생 관리", icon: "👧" },
];

export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 border-b border-emerald-100 bg-white/95 px-4 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 py-3">
        <Link href="/" className="shrink-0 font-bold text-emerald-700">
          COCO AI
        </Link>
        <div className="flex gap-1 rounded-xl bg-emerald-50 p-1">
          {items.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
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
        </div>
      </div>
    </nav>
  );
}
