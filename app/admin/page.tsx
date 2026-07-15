"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SuperAdminOnly } from "@/app/components/AcademyAccess";
import { supabase } from "@/lib/supabase";

type Academy = { id: string; name: string; code: string; active: boolean; created_at: string };
type Member = { academy_id: string; display_name: string; email: string | null; role: "super_admin" | "owner" | "teacher"; active: boolean; approval_status: string };

function AdminContent() {
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [academyResult, memberResult] = await Promise.all([
      supabase.from("academies").select("id,name,code,active,created_at").order("created_at"),
      supabase.from("academy_users").select("academy_id,display_name,email,role,active,approval_status"),
    ]);
    if (academyResult.error || memberResult.error) setError(academyResult.error?.message || memberResult.error?.message || "불러오지 못했습니다.");
    else { setAcademies(academyResult.data as Academy[]); setMembers(memberResult.data as Member[]); }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const totals = useMemo(() => ({ owners: members.filter((m) => m.role === "owner" || m.role === "super_admin").length, teachers: members.filter((m) => m.role === "teacher" && m.active).length, pending: members.filter((m) => m.role === "teacher" && m.approval_status === "pending").length }), [members]);

  return <main className="min-h-screen flex-1 bg-slate-950 px-4 py-8 text-white"><div className="mx-auto max-w-7xl"><header><p className="text-sm font-bold tracking-[.22em] text-cyan-400">PLATFORM CONTROL</p><h1 className="mt-2 text-3xl font-black">전체 학원 최고관리자</h1><p className="mt-2 text-sm text-slate-400">등록된 학원과 원장·강사 계정을 한곳에서 확인합니다.</p></header>
    {error && <p className="mt-5 rounded-xl bg-red-950 px-4 py-3 text-sm text-red-200">{error}</p>}
    {loading ? <div className="mt-6 rounded-2xl bg-slate-900 p-12 text-center text-slate-400">전체 학원을 불러오는 중...</div> : <>
      <section className="mt-6 grid gap-4 sm:grid-cols-4">{[["등록 학원",academies.length],["원장",totals.owners],["재직 강사",totals.teachers],["승인 대기",totals.pending]].map(([label,value]) => <article key={String(label)} className="rounded-2xl bg-slate-900 p-5 ring-1 ring-white/10"><p className="text-sm text-slate-400">{label}</p><strong className="mt-2 block text-3xl">{value}</strong></article>)}</section>
      <section className="mt-6 grid gap-4">{academies.map((academy) => { const academyMembers=members.filter((m) => m.academy_id===academy.id); const owners=academyMembers.filter((m) => m.role==="owner"||m.role==="super_admin"); const teachers=academyMembers.filter((m) => m.role==="teacher"); return <article key={academy.id} className="rounded-2xl bg-slate-900 p-6 ring-1 ring-white/10"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="text-xl font-black">{academy.name}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${academy.active?"bg-emerald-400/15 text-emerald-300":"bg-slate-700 text-slate-400"}`}>{academy.active?"운영 중":"이용 중지"}</span></div><p className="mt-1 text-sm text-slate-400">학원 코드 {academy.code}</p></div><div className="text-right text-sm text-slate-300"><p>원장 {owners.length}명 · 강사 {teachers.filter((m)=>m.active).length}명</p><p className="mt-1 text-amber-300">승인 대기 {teachers.filter((m)=>m.approval_status==="pending").length}명</p></div></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{owners.map((owner)=><div key={owner.email||owner.display_name} className="rounded-xl bg-slate-800 px-4 py-3"><b>{owner.display_name}</b><p className="text-xs text-slate-400">{owner.email} · {owner.role==="super_admin"?"최고관리자":"원장"}</p></div>)}</div></article>; })}</section>
    </>}
  </div></main>;
}

export default function AdminPage() { return <SuperAdminOnly><AdminContent /></SuperAdminOnly>; }
