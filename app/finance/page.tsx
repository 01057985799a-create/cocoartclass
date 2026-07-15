"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { downloadTuitionCertificate } from "@/lib/tuitionCertificatePdf";

type Tab = "ledger" | "year" | "overdue";
type Student = { id: string; name: string };
type Enrollment = { id: string; student_id: string; monthly_fee: number };
type Payment = { id: string; student_id: string; billing_month: string; amount: number; paid: boolean; paid_at: string | null };
type Transaction = { id: string; transaction_date: string; transaction_type: "income" | "expense"; category: string; description: string; payment_method: string; amount: number };
type TransactionForm = { transaction_date: string; transaction_type: "income" | "expense"; category: string; description: string; payment_method: string; amount: string };
const won = (value: number) => `${value.toLocaleString("ko-KR")}원`;
const today = () => new Date().toLocaleDateString("sv-SE");
const emptyForm: TransactionForm = { transaction_date: today(), transaction_type: "expense", category: "재료비", description: "", payment_method: "card", amount: "" };
const categories = { income: ["원비", "특강비", "재료비 수입", "기타 수입"], expense: ["재료비", "임대료", "공과금", "차량비", "인건비", "기타 지출"] };

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>("ledger");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TransactionForm>(emptyForm);
  const monthDate = `${month}-01`;

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.all([
      supabase.from("students").select("id,name").eq("active", true).order("name"),
      supabase.from("class_enrollments").select("id,student_id,monthly_fee"),
      supabase.from("tuition_payments").select("*").order("billing_month", { ascending: false }),
      supabase.from("finance_transactions").select("*").order("transaction_date", { ascending: false }),
    ]);
    const failed = results.find((result) => result.error)?.error;
    if (failed) setError(failed.message);
    else {
      setStudents(results[0].data as Student[]);
      setEnrollments(results[1].data as Enrollment[]);
      setPayments(results[2].data as Payment[]);
      setTransactions(results[3].data as Transaction[]);
    }
    setLoading(false);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };
  const monthlyPayments = payments.filter((p) => p.billing_month === monthDate && p.paid);
  const monthlyTransactions = transactions.filter((t) => t.transaction_date.startsWith(month));
  const income = monthlyPayments.reduce((sum, p) => sum + p.amount, 0) + monthlyTransactions.filter((t) => t.transaction_type === "income").reduce((sum, t) => sum + t.amount, 0);
  const expense = monthlyTransactions.filter((t) => t.transaction_type === "expense").reduce((sum, t) => sum + t.amount, 0);
  const feeRows = students.map((student) => ({ student, enrollment: enrollments.find((e) => e.student_id === student.id), payment: payments.find((p) => p.student_id === student.id && p.billing_month === monthDate) })).filter((row) => row.enrollment);
  const overdue = feeRows.filter((row) => !row.payment?.paid);
  const overdueTotal = overdue.reduce((sum, row) => sum + (row.enrollment?.monthly_fee || 0), 0);
  const year = Number(month.slice(0, 4));
  const yearRows = useMemo(() => Array.from({ length: 12 }, (_, index) => { const key = `${year}-${String(index + 1).padStart(2, "0")}`; const paid = payments.filter((p) => p.billing_month === `${key}-01` && p.paid).reduce((s, p) => s + p.amount, 0); const tx = transactions.filter((t) => t.transaction_date.startsWith(key)); const inc = paid + tx.filter((t) => t.transaction_type === "income").reduce((s, t) => s + t.amount, 0); const out = tx.filter((t) => t.transaction_type === "expense").reduce((s, t) => s + t.amount, 0); return { month: index + 1, income: inc, expense: out, net: inc - out }; }), [payments, transactions, year]);

  const certificate = async (payment: Payment) => {
    const student = students.find((s) => s.id === payment.student_id);
    if (!student) return;
    await downloadTuitionCertificate({
      academyName: "코코미술학원",
      academyAddress: "경기도 의정부시 세석로 20, 폴리프라자1 7층",
      representative: "이슬기",
      businessNumber: "523-95-01492",
      studentName: student.name,
      billingMonth: payment.billing_month.slice(0, 7),
      amount: payment.amount,
      paidAt: payment.paid_at,
      paymentId: payment.id,
    });
    flash(`${student.name} 학생의 납입증명서를 저장했습니다.`);
  };
  const togglePaid = async (student: Student, enrollment: Enrollment, payment?: Payment) => {
    const paid = !payment?.paid;
    const { error: saveError } = await supabase.from("tuition_payments").upsert({ student_id: student.id, billing_month: monthDate, amount: enrollment.monthly_fee, paid, paid_at: paid ? new Date().toISOString() : null }, { onConflict: "student_id,billing_month" });
    if (saveError) return setError(saveError.message);
    flash(paid ? `${student.name} 학생을 납입 완료 처리했습니다.` : `${student.name} 학생을 미납으로 변경했습니다.`);
    await load();
  };
  const saveTransaction = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    const { error: saveError } = await supabase.from("finance_transactions").insert({ ...form, amount: Number(form.amount) });
    setSaving(false); if (saveError) return setError(saveError.message);
    setModal(false); setForm({ ...emptyForm, transaction_date: today() }); flash("수입·지출 내역을 저장했습니다."); await load();
  };
  const deleteTransaction = async (id: string) => {
    if (!window.confirm("이 내역을 삭제할까요?")) return;
    const { error: deleteError } = await supabase.from("finance_transactions").delete().eq("id", id);
    if (deleteError) return setError(deleteError.message); flash("내역을 삭제했습니다."); await load();
  };
  const updateFee = async (enrollment: Enrollment, monthlyFee: number) => {
    const { error: updateError } = await supabase.from("class_enrollments").update({ monthly_fee: monthlyFee }).eq("id", enrollment.id);
    if (updateError) return setError(updateError.message); flash("월 원비를 저장했습니다."); await load();
  };

  return <main className="min-h-screen flex-1 bg-[#f8f4ed] px-4 py-8"><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold tracking-[.25em] text-rose-700">FINANCE</p><h1 className="mt-2 text-3xl font-black">재무 관리</h1><p className="mt-2 text-sm text-zinc-500">월별 장부와 원비 납부 현황, 납입증명서를 한곳에서 관리합니다.</p></div><button onClick={() => setModal(true)} className="rounded-2xl bg-rose-700 px-5 py-3 font-bold text-white">＋ 내역 등록</button></header>
    {notice && <div className="mt-4 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white">✓ {notice}</div>}{error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><nav className="flex rounded-2xl bg-[#eadfd3] p-1.5">{([["ledger", "월별 장부"], ["year", "1년 현황"], ["overdue", "미납 관리"]] as [Tab, string][]).map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${tab === key ? "bg-white text-rose-700 shadow-sm" : "text-zinc-600"}`}>{label}</button>)}</nav><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-xl border border-[#dfd3c7] bg-white px-4 py-3 font-bold" /></div>
    {loading ? <div className="mt-5 rounded-2xl bg-white p-12 text-center">자료를 불러오는 중...</div> : <>
      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["이번 달 수입", income], ["이번 달 지출", expense], ["순이익", income - expense], ["미납금", overdueTotal]].map(([label, value], i) => <article key={String(label)} className={`rounded-2xl border border-[#e7ddd3] p-5 ${i === 2 ? "bg-emerald-800 text-white" : "bg-white"}`}><p className={`text-sm ${i === 2 ? "text-emerald-100" : "text-zinc-500"}`}>{label}</p><p className={`mt-3 text-2xl font-black ${i === 3 ? "text-red-600" : ""}`}>{won(Number(value))}</p>{i === 3 && <p className="mt-2 text-xs text-zinc-500">{overdue.length}명 미납</p>}</article>)}</section>
      {tab === "ledger" && <section className="mt-5 overflow-hidden rounded-2xl border border-[#e7ddd3] bg-white"><div className="p-5"><h2 className="text-xl font-black">수입·지출 내역</h2><p className="mt-1 text-sm text-zinc-500">납입 완료 건에서 바로 증명서를 발급할 수 있습니다.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-zinc-50 text-left text-xs text-zinc-500"><tr><th className="p-4">날짜</th><th className="p-4">구분</th><th className="p-4">내용</th><th className="p-4">결제</th><th className="p-4 text-right">금액</th><th className="p-4 text-right">증명서·관리</th></tr></thead><tbody>{monthlyPayments.map((p) => <tr key={p.id} className="border-t"><td className="p-4">{p.paid_at ? new Date(p.paid_at).toLocaleDateString("ko-KR") : `${Number(month.slice(5))}월`}</td><td className="p-4 text-emerald-700">수입</td><td className="p-4 font-bold">{students.find((s) => s.id === p.student_id)?.name} 원비</td><td className="p-4">원비 납부</td><td className="p-4 text-right font-bold text-emerald-700">＋ {won(p.amount)}</td><td className="p-4 text-right"><button onClick={() => void certificate(p)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">납입증명서</button></td></tr>)}{monthlyTransactions.map((t) => <tr key={t.id} className="border-t"><td className="p-4">{t.transaction_date}</td><td className={`p-4 ${t.transaction_type === "income" ? "text-emerald-700" : "text-rose-600"}`}>{t.transaction_type === "income" ? "수입" : "지출"}</td><td className="p-4 font-bold">{t.description}</td><td className="p-4">{t.payment_method}</td><td className="p-4 text-right font-bold">{t.transaction_type === "income" ? "+" : "-"} {won(t.amount)}</td><td className="p-4 text-right"><button onClick={() => void deleteTransaction(t.id)} className="text-xs text-zinc-400 hover:text-red-600">삭제</button></td></tr>)}{monthlyPayments.length + monthlyTransactions.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-zinc-400">등록된 내역이 없습니다.</td></tr>}</tbody></table></div></section>}
      {tab === "year" && <section className="mt-5 rounded-2xl border border-[#e7ddd3] bg-white p-5"><h2 className="text-xl font-black">{year}년 현황</h2><div className="mt-5 grid gap-3">{yearRows.map((row) => <div key={row.month} className="grid grid-cols-[44px_1fr_auto] items-center gap-3"><b>{row.month}월</b><div className="h-3 overflow-hidden rounded-full bg-zinc-100"><div className="h-full bg-emerald-600" style={{ width: `${Math.min(100, row.income ? 20 + row.income / Math.max(1, ...yearRows.map((r) => r.income)) * 80 : 0)}%` }} /></div><span className="min-w-28 text-right font-bold">{won(row.net)}</span></div>)}</div></section>}
      {tab === "overdue" && <section className="mt-5 rounded-2xl border border-[#e7ddd3] bg-white p-5"><h2 className="text-xl font-black">{Number(month.slice(5))}월 원비·미납 관리</h2><p className="mt-1 text-sm text-zinc-500">납입 완료 처리 후 증명서 버튼이 바로 표시됩니다.</p><div className="mt-5 grid gap-3">{feeRows.map(({ student, enrollment, payment }) => <div key={student.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-4"><b className="min-w-28 flex-1">{student.name}</b><input aria-label={`${student.name} 월 원비`} type="number" min="0" step="10000" defaultValue={enrollment?.monthly_fee || 0} onBlur={(e) => void updateFee(enrollment!, Number(e.target.value))} className="w-32 rounded-lg border px-3 py-2 text-right text-sm" /><button onClick={() => void togglePaid(student, enrollment!, payment)} className={`rounded-lg px-4 py-2 text-sm font-bold ${payment?.paid ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-600"}`}>{payment?.paid ? "납입 완료" : "미납"}</button>{payment?.paid && <button onClick={() => void certificate(payment)} className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-bold text-emerald-800">증명서 발급</button>}</div>)}</div></section>}
    </>}
  </div>{modal && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"><div className="w-full max-w-lg rounded-t-3xl bg-white p-6 sm:rounded-3xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-black">수입·지출 등록</h2><button onClick={() => setModal(false)} className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm">닫기</button></div><form onSubmit={saveTransaction} className="grid gap-4"><div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-sm font-bold">날짜<input required type="date" value={form.transaction_date} onChange={(e) => setForm({ ...form, transaction_date: e.target.value })} className="rounded-xl border px-3 py-3 font-normal" /></label><label className="grid gap-1 text-sm font-bold">구분<select value={form.transaction_type} onChange={(e) => { const type = e.target.value as "income" | "expense"; setForm({ ...form, transaction_type: type, category: categories[type][0] }); }} className="rounded-xl border bg-white px-3 py-3 font-normal"><option value="income">수입</option><option value="expense">지출</option></select></label></div><label className="grid gap-1 text-sm font-bold">항목<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-xl border bg-white px-3 py-3 font-normal">{categories[form.transaction_type].map((category) => <option key={category}>{category}</option>)}</select></label><label className="grid gap-1 text-sm font-bold">내용<input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-xl border px-4 py-3 font-normal" /></label><div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-sm font-bold">결제 방법<select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="rounded-xl border bg-white px-3 py-3 font-normal"><option value="card">카드</option><option value="cash">현금</option><option value="transfer">계좌이체</option><option value="other">기타</option></select></label><label className="grid gap-1 text-sm font-bold">금액<input required type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="rounded-xl border px-4 py-3 text-right font-normal" /></label></div><button disabled={saving} className="rounded-xl bg-rose-700 py-4 font-bold text-white disabled:opacity-50">{saving ? "저장 중..." : "저장"}</button></form></div></div>}</main>;
}
