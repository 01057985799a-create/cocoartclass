"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("새 비밀번호가 서로 일치하지 않습니다.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setSubmitting(false);
      return;
    }

    await supabase.auth.signOut();
    window.alert("비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해 주세요.");
    router.replace("/");
    router.refresh();
  };

  return (
    <main className="min-h-[calc(100vh-73px)] bg-gradient-to-br from-[#fffdf9] to-[#f8d9d1] px-5 py-16">
      <section className="mx-auto max-w-md rounded-[2rem] bg-white p-7 shadow-xl ring-1 ring-[#eadfd6] sm:p-9">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f8d0c6] text-3xl">🔐</div>
          <p className="mt-5 text-sm font-bold tracking-wider text-[#52796f]">ACCOUNT SECURITY</p>
          <h1 className="mt-1 text-2xl font-black text-[#283c37]">내 비밀번호 변경</h1>
          <p className="mt-2 text-sm text-zinc-500">메일 인증 없이 지금 로그인한 계정의 비밀번호를 변경합니다.</p>
        </div>

        <form onSubmit={submit} className="mt-8 grid gap-5">
          <label className="grid gap-1.5 text-sm font-semibold text-[#283c37]">
            새 비밀번호
            <input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8자 이상 입력" className="rounded-xl border border-[#dfd5cc] px-4 py-3.5 font-normal outline-none focus:border-[#ee806c]" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-[#283c37]">
            새 비밀번호 확인
            <input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="한 번 더 입력" className="rounded-xl border border-[#dfd5cc] px-4 py-3.5 font-normal outline-none focus:border-[#ee806c]" />
          </label>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
          <button disabled={submitting} className="rounded-xl bg-[#52796f] py-4 font-bold text-white disabled:opacity-50">{submitting ? "변경 중..." : "비밀번호 변경"}</button>
          <button type="button" onClick={() => router.back()} className="py-2 text-sm font-semibold text-[#52796f]">돌아가기</button>
        </form>
      </section>
    </main>
  );
}
