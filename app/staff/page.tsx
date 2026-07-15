"use client";

import { useCallback, useEffect, useState } from "react";
import { OwnerOnly } from "@/app/components/AcademyAccess";
import { supabase } from "@/lib/supabase";

type Member = {
  user_id: string;
  display_name: string;
  email: string | null;
  role: "owner" | "teacher";
  active: boolean;
  approval_status: "pending" | "approved" | "rejected";
  requested_at: string;
  approved_at: string | null;
};

function StaffContent() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("academy_users")
      .select("user_id,display_name,email,role,active,approval_status,requested_at,approved_at")
      .order("requested_at", { ascending: false });
    if (loadError) setError(loadError.message);
    else setMembers(data as Member[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(""), 2500);
  };

  const review = async (member: Member, decision: "approved" | "rejected") => {
    const { error: rpcError } = await supabase.rpc("owner_review_teacher", {
      target_user_id: member.user_id,
      decision,
    });
    if (rpcError) return setError(rpcError.message);
    flash(`${member.display_name} 강사를 ${decision === "approved" ? "승인" : "거절"}했습니다.`);
    await load();
  };

  const changeEmployment = async (member: Member) => {
    if (member.active && !window.confirm(`${member.display_name} 강사를 퇴사 처리할까요? 처리 즉시 학원 자료에 접근할 수 없습니다.`)) return;
    const { error: rpcError } = await supabase.rpc("owner_set_teacher_active", {
      target_user_id: member.user_id,
      enabled: !member.active,
    });
    if (rpcError) return setError(rpcError.message);
    flash(member.active ? `${member.display_name} 강사를 퇴사 처리했습니다.` : `${member.display_name} 강사를 재입사 처리했습니다.`);
    await load();
  };

  const reset = async (member: Member) => {
    if (!member.email) return setError("이메일이 없는 계정입니다.");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(member.email, {
      redirectTo: window.location.origin,
    });
    if (resetError) {
      const rateLimited = resetError.message.toLowerCase().includes("rate limit");
      return setError(rateLimited ? "이메일을 여러 번 요청해 잠시 발송이 제한됐습니다. 잠시 후 한 번만 다시 시도해 주세요." : resetError.message);
    }
    flash(`${member.email}로 비밀번호 재설정 링크를 보냈습니다.`);
  };

  const teachers = members.filter((member) => member.role === "teacher");
  const pending = teachers.filter((member) => member.approval_status === "pending");
  const working = teachers.filter((member) => member.approval_status === "approved" && member.active);
  const retired = teachers.filter((member) => member.approval_status !== "pending" && !member.active);

  return <main className="min-h-screen flex-1 bg-stone-50 px-4 py-8"><div className="mx-auto max-w-6xl">
    <header><p className="text-sm font-bold tracking-[.2em] text-emerald-600">STAFF ACCESS</p><h1 className="mt-2 text-3xl font-black">강사 가입·권한 관리</h1><p className="mt-2 text-sm text-zinc-500">가입 승인부터 퇴사 처리, 재입사와 비밀번호 재설정까지 관리합니다.</p></header>
    {notice && <div className="mt-4 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white">✓ {notice}</div>}
    {error && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {loading ? <div className="mt-6 rounded-2xl bg-white p-12 text-center">불러오는 중...</div> : <div className="mt-6 grid gap-5">
      <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-xl font-black">승인 대기 <span className="text-emerald-600">{pending.length}</span></h2><div className="mt-4 grid gap-3">
        {pending.map((member) => <article key={member.user_id} className="flex flex-wrap items-center gap-3 rounded-xl border p-4"><div className="min-w-52 flex-1"><b>{member.display_name}</b><p className="text-sm text-zinc-500">{member.email} · {new Date(member.requested_at).toLocaleDateString("ko-KR")} 신청</p></div><button onClick={() => void review(member, "rejected")} className="rounded-lg bg-red-50 px-4 py-2 text-sm font-bold text-red-700">거절</button><button onClick={() => void review(member, "approved")} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">승인</button></article>)}
        {pending.length === 0 && <p className="rounded-xl bg-zinc-50 p-8 text-center text-sm text-zinc-400">승인을 기다리는 강사가 없습니다.</p>}
      </div></section>
      <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-xl font-black">재직 강사 <span className="text-emerald-600">{working.length}</span></h2><div className="mt-4 grid gap-3">
        {working.map((member) => <article key={member.user_id} className="flex flex-wrap items-center gap-3 rounded-xl border p-4"><div className="min-w-52 flex-1"><b>{member.display_name}</b><p className="text-sm text-zinc-500">{member.email}</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">재직 중</span><button onClick={() => void reset(member)} className="rounded-lg border px-3 py-2 text-sm font-bold">비밀번호 재설정</button><button onClick={() => void changeEmployment(member)} className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700">퇴사 처리</button></article>)}
        {working.length === 0 && <p className="rounded-xl bg-zinc-50 p-8 text-center text-sm text-zinc-400">현재 재직 중인 강사가 없습니다.</p>}
      </div></section>
      <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-xl font-black">퇴사·이용 중지 <span className="text-zinc-400">{retired.length}</span></h2><div className="mt-4 grid gap-3">
        {retired.map((member) => <article key={member.user_id} className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4"><div className="min-w-52 flex-1"><b>{member.display_name}</b><p className="text-sm text-zinc-500">{member.email}</p></div><span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-bold text-zinc-600">접근 차단</span><button onClick={() => void changeEmployment(member)} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white">재입사</button></article>)}
        {retired.length === 0 && <p className="rounded-xl bg-zinc-50 p-8 text-center text-sm text-zinc-400">퇴사 처리된 강사가 없습니다.</p>}
      </div></section>
      <section className="rounded-2xl bg-amber-50 p-5 text-sm leading-6 text-amber-900"><b>퇴사 처리 안내</b><p>퇴사 처리 즉시 해당 강사는 학생·수업·재무 자료에 접근할 수 없습니다. 계정 기록은 보관되며, 다시 근무할 때 ‘재입사’를 누르면 이용 권한이 복구됩니다.</p></section>
    </div>}
  </div></main>;
}

export default function StaffPage() {
  return <OwnerOnly><StaffContent /></OwnerOnly>;
}
