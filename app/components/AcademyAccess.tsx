"use client";

import { createContext, useContext } from "react";

export type AcademyRole = "super_admin" | "owner" | "teacher";
type AccessValue = { role: AcademyRole; displayName: string; academyId?: string | null };
const AcademyAccessContext = createContext<AccessValue | null>(null);

export function AcademyAccessProvider({ value, children }: { value: AccessValue; children: React.ReactNode }) {
  return <AcademyAccessContext.Provider value={value}>{children}</AcademyAccessContext.Provider>;
}

export function useAcademyAccess() {
  const value = useContext(AcademyAccessContext);
  if (!value) throw new Error("로그인 권한 정보가 필요합니다.");
  return value;
}

export function OwnerOnly({ children }: { children: React.ReactNode }) {
  const { role } = useAcademyAccess();
  if (role === "owner" || role === "super_admin") return <>{children}</>;
  return <AccessDenied title="원장 전용 메뉴입니다" description="재무 관리와 강사 관리는 원장 계정에서만 이용할 수 있습니다." />;
}

export function SuperAdminOnly({ children }: { children: React.ReactNode }) {
  const { role } = useAcademyAccess();
  if (role === "super_admin") return <>{children}</>;
  return <AccessDenied title="최고관리자 전용 메뉴입니다" description="전체 학원 현황은 사이트 최고관리자만 확인할 수 있습니다." />;
}

function AccessDenied({ title, description }: { title: string; description: string }) {
  return <main className="flex min-h-[70vh] flex-1 items-center justify-center bg-stone-50 px-5"><section className="max-w-md rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-zinc-100"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-2xl">🔒</div><h1 className="mt-5 text-2xl font-black">{title}</h1><p className="mt-3 text-sm leading-6 text-zinc-500">{description}</p></section></main>;
}
