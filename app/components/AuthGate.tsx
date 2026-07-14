"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setChecking(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    if (loginError) {
      setError("이메일 또는 비밀번호를 확인해주세요.");
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-emerald-50 text-sm font-semibold text-emerald-700">
        로그인 확인 중...
      </div>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 to-white px-5 py-12">
        <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-xl ring-1 ring-emerald-100 sm:p-9">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-3xl">🎨</div>
            <p className="mt-5 text-sm font-bold text-emerald-600">COCO ART ACADEMY</p>
            <h1 className="mt-1 text-2xl font-bold text-zinc-900">코코미술학원 AI</h1>
            <p className="mt-2 text-sm text-zinc-500">원장·강사 전용 관리 화면입니다.</p>
          </div>

          <form onSubmit={login} className="mt-7 grid gap-4">
            <label className="grid gap-1.5 text-sm font-semibold text-zinc-700">
              이메일
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="이메일을 입력하세요"
                className="rounded-xl border border-zinc-200 px-4 py-3.5 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-zinc-700">
              비밀번호
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="rounded-xl border border-zinc-200 px-4 py-3.5 font-normal outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
            <button
              disabled={submitting}
              className="mt-1 rounded-xl bg-emerald-600 py-4 font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? "로그인 중..." : "로그인"}
            </button>
          </form>
          <p className="mt-5 text-center text-xs leading-5 text-zinc-400">
            강사 계정은 원장님이 허용한 경우에만 사용할 수 있습니다.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
