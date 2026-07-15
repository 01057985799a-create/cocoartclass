"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAcademyAccess } from "./AcademyAccess";

const items = [
  { href: "/today", label: "오늘 수업", icon: "🏠" },
  { href: "/attendance", label: "출결·보강", icon: "✅" },
  { href: "/vehicle", label: "차량 명단", icon: "🚌" },
  { href: "/", label: "수업 계획안", icon: "🎨" },
  { href: "/students", label: "학생 관리", icon: "👧" },
  { href: "/feedback", label: "학생 피드백", icon: "💬" },
  { href: "/artwork-analysis", label: "그림 분석", icon: "🖼️" },
  { href: "/finance", label: "재무 관리", icon: "💰", ownerOnly: true },
  { href: "/downloads", label: "자료 저장", icon: "📥", ownerOnly: true },
  { href: "/staff", label: "강사 관리", icon: "👩‍🏫", ownerOnly: true },
  { href: "/admin", label: "전체 학원", icon: "🛡️", superAdminOnly: true },
];

export default function AppNav() {
  const pathname = usePathname();
  const { role, displayName } = useAcademyAccess();
  const visible = items.filter((item) => (!item.ownerOnly || role === "owner" || role === "super_admin") && (!item.superAdminOnly || role === "super_admin"));
  const roleLabel = role === "super_admin" ? "최고관리자" : role === "owner" ? "원장" : "강사";
  return <nav className="sticky top-0 z-40 border-b border-[#eadfd6] bg-[#fffdf9]/95 px-4 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 py-3"><Link href="/" className="shrink-0 font-black text-[#3f655d]">COCO AI</Link><div className="flex max-w-[calc(100vw-110px)] items-center gap-1 overflow-x-auto rounded-xl bg-[#f7f1e8] p-1">{visible.map((item) => { const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${active ? "bg-[#f8d0c6] text-[#9f4939] shadow-sm" : "text-zinc-500 hover:text-[#3f655d]"}`}><span className="mr-1">{item.icon}</span>{item.label}</Link>; })}<span className="shrink-0 px-2 text-xs text-zinc-400">{displayName} · {roleLabel}</span><Link href="/change-password" className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${pathname === "/change-password" ? "bg-white text-[#9f4939] shadow-sm" : "text-[#3f655d]"}`}>내 비밀번호 변경</Link><button onClick={() => void supabase.auth.signOut()} className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-red-600">로그아웃</button></div></div></nav>;
}
