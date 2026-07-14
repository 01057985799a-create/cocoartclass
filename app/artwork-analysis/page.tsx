"use client";
/* A local blob URL is used only for the user's temporary upload preview. */
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { downloadArtworkPdf } from "@/lib/artworkPdf";
import { supabase } from "@/lib/supabase";

type Student = {
  id: string;
  name: string;
  birth_date: string | null;
  school_name: string | null;
};
type AnalysisResult = {
  lowenfeld_stage: string;
  stage_comparison: string;
  expressive_tendencies: string;
  body_form_expression: string;
  color_pattern_materials: string;
  composition_space: string;
  visible_strengths: string;
  growth_points: string;
  parent_summary: string;
  caution_note: string;
};
type SavedAnalysis = AnalysisResult & {
  id: string;
  student_id: string;
  analysis_date: string;
  child_age: number;
  artwork_title: string;
  teacher_context: string;
  image_path: string | null;
  created_at: string;
};
const today = () => new Date().toLocaleDateString("sv-SE");
const sections: [keyof AnalysisResult, string][] = [
  ["stage_comparison", "로웬펠드 발달 단계 비교"],
  ["expressive_tendencies", "그림에서 보이는 표현 경향"],
  ["body_form_expression", "신체·형태 표현"],
  ["color_pattern_materials", "색채·패턴·재료 사용"],
  ["composition_space", "화면 구성과 공간 표현"],
  ["visible_strengths", "눈에 보이는 강점"],
  ["growth_points", "다음 수업의 성장 포인트"],
  ["parent_summary", "학부모 상담용 종합 코멘트"],
];
export default function ArtworkAnalysisPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [history, setHistory] = useState<SavedAnalysis[]>([]);
  const [studentId, setStudentId] = useState("");
  const [age, setAge] = useState("");
  const [date, setDate] = useState(today());
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfSaving, setPdfSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    const [studentResult, analysisResult] = await Promise.all([
      supabase
        .from("students")
        .select("id,name,birth_date,school_name")
        .eq("active", true)
        .order("name"),
      supabase
        .from("artwork_analyses")
        .select("*")
        .order("analysis_date", { ascending: false })
        .limit(50),
    ]);
    if (studentResult.error || analysisResult.error)
      setError(
        analysisResult.error?.code === "PGRST205"
          ? "그림 분석 데이터베이스 설정이 필요합니다."
          : studentResult.error?.message ||
              analysisResult.error?.message ||
              "자료를 불러오지 못했습니다.",
      );
    else {
      setStudents(studentResult.data as Student[]);
      setHistory(analysisResult.data as SavedAnalysis[]);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const selected = students.find((item) => item.id === studentId);
  const selectedHistory = useMemo(
    () => history.filter((item) => !studentId || item.student_id === studentId),
    [history, studentId],
  );
  const chooseStudent = (id: string) => {
    setStudentId(id);
    const student = students.find((item) => item.id === id);
    if (student?.birth_date) {
      const birth = new Date(`${student.birth_date}T12:00:00`),
        nowDate = new Date();
      let years = nowDate.getFullYear() - birth.getFullYear();
      if (
        nowDate.getMonth() < birth.getMonth() ||
        (nowDate.getMonth() === birth.getMonth() &&
          nowDate.getDate() < birth.getDate())
      )
        years--;
      setAge(String(years));
    }
  };
  const chooseFile = (next: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : "");
    setResult(null);
  };
  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2500);
  };
  const analyze = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !file || !age)
      return setError("학생, 나이, 그림을 모두 입력해주세요.");
    setAnalyzing(true);
    setError("");
    const form = new FormData();
    form.append("image", file);
    form.append("studentName", selected.name);
    form.append("age", age);
    form.append("title", title);
    form.append("context", context);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    try {
      const response = await fetch("/api/artwork-analysis/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data as AnalysisResult);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "그림을 분석하지 못했습니다.",
      );
    } finally {
      setAnalyzing(false);
    }
  };
  const updateResult = (key: keyof AnalysisResult, value: string) =>
    setResult((current) => (current ? { ...current, [key]: value } : current));
  const save = async () => {
    if (!result || !selected || !file) return;
    setSaving(true);
    setError("");
    const extension = (file.name.split(".").pop() || "jpg").replace(
      /[^a-zA-Z0-9]/g,
      "",
    );
    const path = `${selected.id}/${Date.now()}.${extension}`;
    const uploaded = await supabase.storage
      .from("artwork-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploaded.error) {
      setSaving(false);
      return setError(uploaded.error.message);
    }
    const inserted = await supabase.from("artwork_analyses").insert({
      student_id: selected.id,
      analysis_date: date,
      child_age: Number(age),
      artwork_title: title,
      teacher_context: context,
      image_path: path,
      ...result,
    });
    setSaving(false);
    if (inserted.error) return setError(inserted.error.message);
    flash("그림 분석 기록을 저장했습니다.");
    setResult(null);
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
    setTitle("");
    setContext("");
    await load();
  };
  const downloadCurrent = async () => {
    if (!result || !selected) return;
    setPdfSaving(true);
    try {
      await downloadArtworkPdf(
        [
          {
            ...result,
            student_name: selected.name,
            analysis_date: date,
            child_age: Number(age),
            artwork_title: title,
            image_url: preview,
          },
        ],
        `코코미술_${selected.name}_${date}_그림분석.pdf`,
      );
      flash("PDF 파일을 저장했습니다.");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "PDF를 저장하지 못했습니다.",
      );
    } finally {
      setPdfSaving(false);
    }
  };
  const downloadSaved = async (item: SavedAnalysis) => {
    setPdfSaving(true);
    let imageUrl = "";
    if (item.image_path) {
      const { data } = await supabase.storage
        .from("artwork-images")
        .createSignedUrl(item.image_path, 300);
      imageUrl = data?.signedUrl || "";
    }
    const name =
      students.find((student) => student.id === item.student_id)?.name ||
      "학생";
    try {
      await downloadArtworkPdf(
        [{ ...item, student_name: name, image_url: imageUrl }],
        `코코미술_${name}_${item.analysis_date}_그림분석.pdf`,
      );
      flash("PDF 파일을 저장했습니다.");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "PDF를 저장하지 못했습니다.",
      );
    } finally {
      setPdfSaving(false);
    }
  };
  return (
    <main className="min-h-screen flex-1 bg-emerald-50/40 px-3 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header>
          <p className="text-sm font-bold tracking-[.2em] text-emerald-600">
            ARTWORK DEVELOPMENT
          </p>
          <h1 className="mt-1 text-3xl font-black">그림 발달 분석</h1>
          <p className="mt-2 text-sm text-zinc-500">
            아이 그림을 로웬펠드 발달 단계와 미술교육 관점으로 관찰하고
            기록합니다.
          </p>
        </header>
        {notice && (
          <div className="mt-4 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">
            {notice}
          </div>
        )}
        {error && (
          <div className="mt-4 flex justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button onClick={() => setError("")}>×</button>
          </div>
        )}
        {loading ? (
          <div className="mt-6 rounded-3xl bg-white p-14 text-center">
            자료를 불러오는 중...
          </div>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
            <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
              <h2 className="text-xl font-black">새 그림 분석</h2>
              <form onSubmit={analyze} className="mt-5 grid gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="col-span-2 grid gap-1 text-sm font-bold sm:col-span-1">
                    학생
                    <select
                      required
                      value={studentId}
                      onChange={(event) => chooseStudent(event.target.value)}
                      className="rounded-xl border bg-white px-4 py-3 font-normal"
                    >
                      <option value="">선택하세요</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name}
                          {student.school_name
                            ? ` · ${student.school_name}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-bold">
                    만 나이
                    <input
                      required
                      type="number"
                      min="2"
                      max="19"
                      step="0.5"
                      value={age}
                      onChange={(event) => setAge(event.target.value)}
                      className="rounded-xl border px-4 py-3 font-normal"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-bold">
                    분석 날짜
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      className="rounded-xl border px-4 py-3 font-normal"
                    />
                  </label>
                </div>
                <label className="grid gap-1 text-sm font-bold">
                  작품 제목·주제
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="예: 나와 반려동물"
                    className="rounded-xl border px-4 py-3 font-normal"
                  />
                </label>
                <label className="grid gap-1 text-sm font-bold">
                  선생님 관찰 메모
                  <textarea
                    rows={3}
                    value={context}
                    onChange={(event) => setContext(event.target.value)}
                    placeholder="아이가 설명한 내용, 사용한 재료, 작업 과정만 적어주세요."
                    className="rounded-xl border px-4 py-3 font-normal"
                  />
                </label>
                <label className="grid cursor-pointer gap-2 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-4 text-center">
                  <span className="font-bold text-emerald-800">
                    📷 그림 촬영·업로드
                  </span>
                  <span className="text-xs text-zinc-500">
                    그림 전체가 밝고 선명하게 보이도록 촬영해주세요.
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={(event) =>
                      chooseFile(event.target.files?.[0] || null)
                    }
                    className="text-sm"
                  />
                </label>
                {preview && (
                  <img
                    src={preview}
                    alt="분석할 아이 그림"
                    className="max-h-96 w-full rounded-2xl bg-zinc-50 object-contain"
                  />
                )}
                <button
                  disabled={analyzing}
                  className="rounded-xl bg-emerald-600 py-4 font-black text-white disabled:opacity-50"
                >
                  {analyzing
                    ? "그림을 자세히 살펴보는 중..."
                    : "AI 그림 발달 분석하기"}
                </button>
              </form>
              {result && (
                <div className="mt-7 grid gap-4 border-t pt-6">
                  <div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-bold text-emerald-800">
                      {result.lowenfeld_stage}
                    </span>
                    <p className="mt-2 text-xs text-zinc-400">
                      결과를 직접 수정한 뒤 저장할 수 있습니다.
                    </p>
                  </div>
                  {sections.map(([key, label]) => (
                    <label key={key} className="grid gap-1 text-sm font-bold">
                      {label}
                      <textarea
                        rows={key === "parent_summary" ? 6 : 4}
                        value={result[key]}
                        onChange={(event) =>
                          updateResult(key, event.target.value)
                        }
                        className="rounded-xl border px-4 py-3 font-normal leading-6"
                      />
                    </label>
                  ))}
                  <div className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                    {result.caution_note}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={pdfSaving}
                      onClick={() => void downloadCurrent()}
                      className="rounded-xl bg-violet-600 py-3 font-bold text-white disabled:opacity-50"
                    >
                      {pdfSaving ? "PDF 만드는 중..." : "PDF 파일로 바로 저장"}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void save()}
                      className="rounded-xl bg-zinc-900 py-3 font-bold text-white"
                    >
                      {saving ? "저장 중..." : "기록 저장"}
                    </button>
                  </div>
                </div>
              )}
            </section>
            <aside className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-xl font-black">저장된 분석 기록</h2>
              <p className="mt-1 text-sm text-zinc-500">
                학생을 선택하면 해당 학생 기록만 표시됩니다.
              </p>
              <div className="mt-4 grid gap-3">
                {selectedHistory.map((item) => (
                  <article key={item.id} className="rounded-2xl border p-4">
                    <div className="flex justify-between gap-3">
                      <div>
                        <b>
                          {students.find(
                            (student) => student.id === item.student_id,
                          )?.name || "학생"}
                        </b>
                        <p className="mt-1 text-xs text-zinc-400">
                          {item.analysis_date} · 만 {item.child_age}세 ·{" "}
                          {item.artwork_title || "제목 없음"}
                        </p>
                      </div>
                      <span className="h-fit rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                        {item.lowenfeld_stage}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                      {item.parent_summary}
                    </p>
                    <button
                      disabled={pdfSaving}
                      onClick={() => void downloadSaved(item)}
                      className="mt-3 w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {pdfSaving ? "PDF 만드는 중..." : "PDF 파일로 바로 저장"}
                    </button>
                  </article>
                ))}
                {selectedHistory.length === 0 && (
                  <div className="rounded-xl bg-zinc-50 p-8 text-center text-sm text-zinc-400">
                    저장된 분석이 없습니다.
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
        <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-xs leading-6 text-amber-800">
          <b>안내:</b> 로웬펠드 단계는 아이마다 다르게 나타날 수 있는 참고
          기준입니다. 이 기능은 미술 수업을 위한 관찰 도구이며 심리검사나 발달
          진단을 대신하지 않습니다.
        </div>
      </div>
    </main>
  );
}
