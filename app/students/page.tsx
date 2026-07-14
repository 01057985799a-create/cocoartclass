"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const DAYS = ["월", "화", "수", "목", "금", "토"];
const AGE_GROUPS = ["유치부", "초등 저학년", "초등 고학년", "중고등"];

type ClassRow = {
  id: string;
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  age_group: string;
  capacity: number;
  teacher_name: string | null;
};

type StudentRow = {
  id: string;
  name: string;
  birth_date: string | null;
  school_name: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  notes: string | null;
};

type EnrollmentRow = { id: string; class_id: string; student_id: string };
type Tab = "schedule" | "students";

const emptyClass = {
  name: "",
  day_of_week: 1,
  start_time: "14:00",
  end_time: "15:00",
  age_group: "유치부",
  capacity: 4,
  teacher_name: "",
};

const emptyStudent = {
  name: "",
  birth_date: "",
  school_name: "",
  guardian_name: "",
  guardian_phone: "",
  notes: "",
};

function shortTime(value: string) {
  return value.slice(0, 5);
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full bg-zinc-100 px-3 py-1.5 text-zinc-600">닫기</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const [tab, setTab] = useState<Tab>("schedule");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [search, setSearch] = useState("");
  const [dayFilter, setDayFilter] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [classModal, setClassModal] = useState(false);
  const [studentModal, setStudentModal] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [classForm, setClassForm] = useState(emptyClass);
  const [studentForm, setStudentForm] = useState(emptyStudent);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [classResult, studentResult, enrollmentResult] = await Promise.all([
      supabase.from("classes").select("*").eq("active", true).order("day_of_week").order("start_time"),
      supabase.from("students").select("*").eq("active", true).order("name"),
      supabase.from("class_enrollments").select("id,class_id,student_id"),
    ]);

    const firstError = classResult.error || studentResult.error || enrollmentResult.error;
    if (firstError) {
      setError(
        firstError.code === "PGRST205"
          ? "학생관리용 데이터베이스를 먼저 설치해야 합니다."
          : `정보를 불러오지 못했습니다: ${firstError.message}`
      );
    } else {
      setClasses((classResult.data ?? []) as ClassRow[]);
      setStudents((studentResult.data ?? []) as StudentRow[]);
      setEnrollments((enrollmentResult.data ?? []) as EnrollmentRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const countForClass = (classId: string) =>
    enrollments.filter((item) => item.class_id === classId).length;

  const studentsForClass = (classId: string) => {
    const ids = new Set(
      enrollments.filter((item) => item.class_id === classId).map((item) => item.student_id)
    );
    return students.filter((student) => ids.has(student.id));
  };

  const classesForStudent = (studentId: string) => {
    const ids = new Set(
      enrollments.filter((item) => item.student_id === studentId).map((item) => item.class_id)
    );
    return classes.filter((item) => ids.has(item.id));
  };

  const visibleClasses = useMemo(
    () => classes.filter((item) => item.day_of_week === dayFilter + 1),
    [classes, dayFilter]
  );

  const visibleStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) =>
      [student.name, student.school_name, student.guardian_name, student.guardian_phone]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    );
  }, [search, students]);

  const openNewStudent = () => {
    setEditingStudentId(null);
    setStudentForm(emptyStudent);
    setSelectedClassIds([]);
    setStudentModal(true);
  };

  const openEditStudent = (student: StudentRow) => {
    setEditingStudentId(student.id);
    setStudentForm({
      name: student.name,
      birth_date: student.birth_date ?? "",
      school_name: student.school_name ?? "",
      guardian_name: student.guardian_name ?? "",
      guardian_phone: student.guardian_phone ?? "",
      notes: student.notes ?? "",
    });
    setSelectedClassIds(classesForStudent(student.id).map((item) => item.id));
    setStudentModal(true);
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2500);
  };

  const saveClass = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const { error: saveError } = await supabase.from("classes").insert({
      ...classForm,
      teacher_name: classForm.teacher_name || null,
    });
    setSaving(false);
    if (saveError) return setError(`수업반을 저장하지 못했습니다: ${saveError.message}`);
    setClassModal(false);
    setClassForm(emptyClass);
    showNotice("수업반을 만들었습니다.");
    await loadData();
  };

  const toggleClass = (classId: string) => {
    setSelectedClassIds((current) =>
      current.includes(classId)
        ? current.filter((id) => id !== classId)
        : [...current, classId]
    );
  };

  const saveStudent = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const overCapacity = selectedClassIds.find((classId) => {
      const alreadyEnrolled = editingStudentId
        ? enrollments.some((e) => e.class_id === classId && e.student_id === editingStudentId)
        : false;
      const target = classes.find((item) => item.id === classId);
      return target && !alreadyEnrolled && countForClass(classId) >= target.capacity;
    });
    if (overCapacity) {
      setSaving(false);
      return setError("정원이 찬 수업반은 선택할 수 없습니다.");
    }

    const payload = {
      name: studentForm.name.trim(),
      birth_date: studentForm.birth_date || null,
      school_name: studentForm.school_name.trim() || null,
      guardian_name: studentForm.guardian_name.trim() || null,
      guardian_phone: studentForm.guardian_phone.trim() || null,
      notes: studentForm.notes.trim() || null,
    };

    let studentId = editingStudentId;
    if (editingStudentId) {
      const { error: updateError } = await supabase
        .from("students").update(payload).eq("id", editingStudentId);
      if (updateError) {
        setSaving(false);
        return setError(`학생 정보를 수정하지 못했습니다: ${updateError.message}`);
      }
      await supabase.from("class_enrollments").delete().eq("student_id", editingStudentId);
    } else {
      const { data, error: insertError } = await supabase
        .from("students").insert(payload).select("id").single();
      if (insertError || !data) {
        setSaving(false);
        return setError(`학생을 등록하지 못했습니다: ${insertError?.message ?? "저장 오류"}`);
      }
      studentId = data.id as string;
    }

    if (selectedClassIds.length > 0 && studentId) {
      const { error: enrollmentError } = await supabase.from("class_enrollments").insert(
        selectedClassIds.map((classId) => ({ class_id: classId, student_id: studentId }))
      );
      if (enrollmentError) {
        setSaving(false);
        return setError(`수업반 배정을 저장하지 못했습니다: ${enrollmentError.message}`);
      }
    }

    setSaving(false);
    setStudentModal(false);
    showNotice(editingStudentId ? "학생 정보를 수정했습니다." : "학생을 등록했습니다.");
    await loadData();
  };

  return (
    <div className="min-h-screen bg-emerald-50/50 px-4 py-8 sm:px-6">
      <header className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-600">코코미술학원</p>
            <h1 className="mt-1 text-3xl font-bold text-zinc-900">학생 관리</h1>
            <p className="mt-2 text-sm text-zinc-500">학생 검색과 반별 정원을 한눈에 확인하세요.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setClassModal(true)} className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm">+ 수업반</button>
            <button onClick={openNewStudent} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm">+ 학생 등록</button>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-7 max-w-5xl">
        {notice && <div className="mb-4 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white">{notice}</div>}
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mb-5 grid grid-cols-2 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-zinc-100">
          <button onClick={() => setTab("schedule")} className={`rounded-xl py-3 text-sm font-bold ${tab === "schedule" ? "bg-emerald-600 text-white" : "text-zinc-500"}`}>반별 시간표</button>
          <button onClick={() => setTab("students")} className={`rounded-xl py-3 text-sm font-bold ${tab === "students" ? "bg-emerald-600 text-white" : "text-zinc-500"}`}>전체 학생 {students.length}명</button>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-12 text-center text-zinc-500">불러오는 중...</div>
        ) : tab === "schedule" ? (
          <section>
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {DAYS.map((day, index) => (
                <button key={day} onClick={() => setDayFilter(index)} className={`min-w-12 rounded-xl px-4 py-2.5 text-sm font-bold ${dayFilter === index ? "bg-zinc-900 text-white" : "bg-white text-zinc-500 ring-1 ring-zinc-200"}`}>{day}</button>
              ))}
            </div>
            {visibleClasses.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-white p-10 text-center">
                <p className="font-semibold text-zinc-700">등록된 {DAYS[dayFilter]}요일 수업반이 없습니다.</p>
                <button onClick={() => { setClassForm({ ...emptyClass, day_of_week: dayFilter + 1 }); setClassModal(true); }} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white">수업반 만들기</button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {visibleClasses.map((item) => {
                  const enrolled = studentsForClass(item.id);
                  const count = enrolled.length;
                  const full = count >= item.capacity;
                  return (
                    <article key={item.id} className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ${full ? "ring-red-200" : "ring-zinc-100"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-bold text-zinc-900">{shortTime(item.start_time)} · {item.name}</p>
                          <p className="mt-1 text-sm text-zinc-500">{item.age_group} · {item.teacher_name || "담당 미정"}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-sm font-bold ${full ? "bg-red-100 text-red-700" : count >= item.capacity - 1 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{count}/{item.capacity}{full ? " 마감" : ""}</span>
                      </div>
                      <div className="mt-4 flex min-h-12 flex-wrap gap-2 border-t border-zinc-100 pt-4">
                        {enrolled.length ? enrolled.map((student) => (
                          <button key={student.id} onClick={() => openEditStudent(student)} className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-emerald-50 hover:text-emerald-700">{student.name}</button>
                        )) : <p className="text-sm text-zinc-400">아직 배정된 학생이 없습니다.</p>}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <section>
            <div className="mb-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-100">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="학생 이름, 학교, 학부모 연락처 검색" className="w-full rounded-xl bg-zinc-50 px-4 py-3 text-base outline-none ring-emerald-200 focus:ring-2" />
            </div>
            <div className="grid gap-3">
              {visibleStudents.map((student) => (
                <button key={student.id} onClick={() => openEditStudent(student)} className="rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-zinc-100 transition hover:ring-emerald-300">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-zinc-900">{student.name}</p>
                      <p className="mt-1 text-sm text-zinc-500">{student.school_name || "학교 미입력"}{student.birth_date ? ` · ${student.birth_date.replaceAll("-", ".")}` : ""}</p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-700">수정 ›</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {classesForStudent(student.id).map((item) => <span key={item.id} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">{DAYS[item.day_of_week - 1]} {shortTime(item.start_time)} {item.name}</span>)}
                  </div>
                </button>
              ))}
              {visibleStudents.length === 0 && <div className="rounded-2xl bg-white p-10 text-center text-zinc-500">검색된 학생이 없습니다.</div>}
            </div>
          </section>
        )}
      </main>

      {classModal && (
        <Modal title="수업반 만들기" onClose={() => setClassModal(false)}>
          <form onSubmit={saveClass} className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-semibold">반 이름<input required value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} placeholder="예: 유치 창의반" className="rounded-xl border border-zinc-200 px-4 py-3 font-normal" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-sm font-semibold">요일<select value={classForm.day_of_week} onChange={(e) => setClassForm({ ...classForm, day_of_week: Number(e.target.value) })} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 font-normal">{DAYS.map((day, i) => <option key={day} value={i + 1}>{day}요일</option>)}</select></label>
              <label className="grid gap-1.5 text-sm font-semibold">연령 구분<select value={classForm.age_group} onChange={(e) => setClassForm({ ...classForm, age_group: e.target.value, capacity: e.target.value === "유치부" ? 4 : 6 })} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 font-normal">{AGE_GROUPS.map((group) => <option key={group}>{group}</option>)}</select></label>
              <label className="grid gap-1.5 text-sm font-semibold">시작<input required type="time" value={classForm.start_time} onChange={(e) => setClassForm({ ...classForm, start_time: e.target.value })} className="rounded-xl border border-zinc-200 px-4 py-3 font-normal" /></label>
              <label className="grid gap-1.5 text-sm font-semibold">종료<input required type="time" value={classForm.end_time} onChange={(e) => setClassForm({ ...classForm, end_time: e.target.value })} className="rounded-xl border border-zinc-200 px-4 py-3 font-normal" /></label>
              <label className="grid gap-1.5 text-sm font-semibold">정원<input required min="1" type="number" value={classForm.capacity} onChange={(e) => setClassForm({ ...classForm, capacity: Number(e.target.value) })} className="rounded-xl border border-zinc-200 px-4 py-3 font-normal" /></label>
              <label className="grid gap-1.5 text-sm font-semibold">담당 선생님<input value={classForm.teacher_name} onChange={(e) => setClassForm({ ...classForm, teacher_name: e.target.value })} className="rounded-xl border border-zinc-200 px-4 py-3 font-normal" /></label>
            </div>
            <button disabled={saving} className="mt-2 rounded-xl bg-emerald-600 py-4 font-bold text-white disabled:opacity-50">{saving ? "저장 중..." : "수업반 저장"}</button>
          </form>
        </Modal>
      )}

      {studentModal && (
        <Modal title={editingStudentId ? "학생 정보 수정" : "학생 등록"} onClose={() => setStudentModal(false)}>
          <form onSubmit={saveStudent} className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-semibold">학생 이름<input required value={studentForm.name} onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })} className="rounded-xl border border-zinc-200 px-4 py-3 font-normal" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-sm font-semibold">생년월일<input type="date" value={studentForm.birth_date} onChange={(e) => setStudentForm({ ...studentForm, birth_date: e.target.value })} className="rounded-xl border border-zinc-200 px-3 py-3 font-normal" /></label>
              <label className="grid gap-1.5 text-sm font-semibold">학교·유치원<input value={studentForm.school_name} onChange={(e) => setStudentForm({ ...studentForm, school_name: e.target.value })} className="rounded-xl border border-zinc-200 px-4 py-3 font-normal" /></label>
              <label className="grid gap-1.5 text-sm font-semibold">학부모 성함<input value={studentForm.guardian_name} onChange={(e) => setStudentForm({ ...studentForm, guardian_name: e.target.value })} className="rounded-xl border border-zinc-200 px-4 py-3 font-normal" /></label>
              <label className="grid gap-1.5 text-sm font-semibold">연락처<input inputMode="tel" value={studentForm.guardian_phone} onChange={(e) => setStudentForm({ ...studentForm, guardian_phone: e.target.value })} className="rounded-xl border border-zinc-200 px-4 py-3 font-normal" /></label>
            </div>
            <label className="grid gap-1.5 text-sm font-semibold">메모<textarea rows={2} value={studentForm.notes} onChange={(e) => setStudentForm({ ...studentForm, notes: e.target.value })} className="resize-none rounded-xl border border-zinc-200 px-4 py-3 font-normal" /></label>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-bold">수업반 선택 · 주 2회는 두 개 선택</legend>
              {classes.length === 0 ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">먼저 수업반을 만들어주세요.</p> : classes.map((item) => {
                const selected = selectedClassIds.includes(item.id);
                const already = editingStudentId ? enrollments.some((e) => e.class_id === item.id && e.student_id === editingStudentId) : false;
                const full = countForClass(item.id) >= item.capacity && !already;
                return <label key={item.id} className={`flex items-center justify-between rounded-xl border p-3 ${selected ? "border-emerald-500 bg-emerald-50" : full ? "border-red-100 bg-red-50 opacity-60" : "border-zinc-200"}`}><span className="text-sm font-semibold">{DAYS[item.day_of_week - 1]} {shortTime(item.start_time)} · {item.name}<small className="ml-2 font-normal text-zinc-500">{countForClass(item.id)}/{item.capacity}</small></span><input type="checkbox" checked={selected} disabled={full} onChange={() => toggleClass(item.id)} className="h-5 w-5 accent-emerald-600" /></label>;
              })}
            </fieldset>
            <button disabled={saving} className="mt-2 rounded-xl bg-emerald-600 py-4 font-bold text-white disabled:opacity-50">{saving ? "저장 중..." : editingStudentId ? "수정 완료" : "학생 등록"}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
