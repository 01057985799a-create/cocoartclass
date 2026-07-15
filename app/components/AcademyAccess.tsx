"use client";
import { createContext, useContext } from "react";

export type AcademyRole = "owner" | "teacher";
type AccessValue = { role: AcademyRole; displayName: string };
const AcademyAccessContext = createContext<AccessValue | null>(null);

export function AcademyAccessProvider({ value, children }: { value: AccessValue; children: React.ReactNode }) {
  return <AcademyAccessContext.Provider value={value}>{children}</AcademyAccessContext.Provider>;
}
export function useAcademyAccess() {
  const value = useContext(AcademyAccessContext);
  if (!value) throw new Error("AcademyAccessProvider가 필요합니다.");
  return value;
}
export function OwnerOnly({ children }: { children: React.ReactNode }) {
  const { role } = useAcademyAccess();
  if (role === "owner") return <>{children}</>;
  return <main className="flex min-h-[70vh] flex-1 items-center justify-center bg-stone-50 px-5"><section className="max-w-md rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-zinc-100"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-2xl">🔒</div><h1 className="mt-5 text-2xl font-black">원장 전용 메뉴입니다</h1><p className="mt-3 text-sm leading-6 text-zinc-500">재무 관리와 자료 저장은 원장 계정에서만 확인할 수 있습니다.</p></section></main>;
}
