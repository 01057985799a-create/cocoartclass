"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const AGE_GROUPS = [
  "유아 (4~6세)",
  "초등 저학년 (7~9세)",
  "초등 고학년 (10~12세)",
  "중학생 (13~15세)",
  "고등학생 (16~18세)",
  "성인",
];

const SUBJECTS = [
  "소묘",
  "수채화",
  "아크릴화",
  "조소",
  "판화",
  "디자인",
  "공예",
  "혼합 미술",
];

const DURATIONS = ["30분", "45분", "60분", "90분", "120분"];

const SESSION_COUNTS = ["1회", "2회", "3회", "4회", "5회 이상"];

const MAX_IMAGES = 10;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type ReferenceImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type Stage = "uploading" | "analyzing" | "writing";

const STAGE_LABELS: Record<Stage, string> = {
  uploading: "이미지 업로드 중",
  analyzing: "참고 작품 분석 중",
  writing: "회차별 계획안 작성 중",
};

type ImageAnalysisItem = {
  order: number;
  subject: string;
  features: string;
  materials_guess: string;
  difficulty_notes: string;
};

type SessionPlan = {
  session_number: number;
  session_title: string;
  goal: string;
  materials: string;
  intro: string;
  main_activity: string;
  wrap_up: string;
  time_breakdown: string;
  teacher_tips: string;
  student_choice_elements: string;
  support_for_struggling_students: string;
  extra_activity_for_fast_finishers: string;
};

type LessonPlanResult = {
  title: string;
  objective: string;
  image_analysis: ImageAnalysisItem[];
  sessions: SessionPlan[];
  parent_summary: string;
  title_examples: string[];
};

type SavedPlanRow = {
  id: string;
  title: string | null;
  target_age: string | null;
  class_type: string | null;
  class_minutes: number | null;
  session_count: number | null;
  generated_plan: LessonPlanResult | null;
  created_at: string;
};

type PlanExportMeta = { ageGroup: string; subject: string; durationMinutes: number };

class UploadError extends Error {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "UploadError";
    this.details = details;
  }
}
class AiError extends Error {
  details?: unknown;
  response?: Response;
  constructor(message: string, details?: unknown, response?: Response) {
    super(message);
    this.name = "AiError";
    this.details = details;
    this.response = response;
  }
}
class SaveError extends Error {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "SaveError";
    this.details = details;
  }
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function getFileExtension(file: File): string {
  if (MIME_EXTENSIONS[file.type]) return MIME_EXTENSIONS[file.type];
  const match = file.name.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : "jpg";
}

// Supabase Storage rejects keys containing non-ASCII characters (e.g. Hangul)
// or spaces with a 400 "Invalid key" error, so uploaded filenames are
// replaced with an ASCII-safe name (timestamp + order + extension).
// The original filename is preserved separately in lesson_plan_images.original_filename.
function buildStorageFileName(order: number, file: File): string {
  return `${order}_${Date.now()}.${getFileExtension(file)}`;
}

// Vercel rejects function request bodies that are too large. Keep the
// original file in Supabase Storage, but send a compact analysis copy to AI.
async function compressForAnalysis(file: File, imageCount: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, 1200 / longest);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const budget = Math.max(180_000, Math.floor(3_200_000 / imageCount));
  let quality = 0.72;
  let blob: Blob | null = null;
  do {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    quality -= 0.1;
  } while (blob && blob.size > budget && quality >= 0.32);

  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}

function parseDurationMinutes(label: string): number {
  const match = label.match(/\d+/);
  return match ? parseInt(match[0], 10) : 60;
}

function parseSessionCountNumber(label: string): number {
  const match = label.match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
}

function buildPlainTextSummary(plan: LessonPlanResult): string {
  const lines: string[] = [];
  lines.push(`[${plan.title}]`);
  lines.push(`목표: ${plan.objective}`);
  lines.push("");
  plan.sessions.forEach((session) => {
    lines.push(`--- ${session.session_number}회차: ${session.session_title} ---`);
    lines.push(`목표: ${session.goal}`);
    lines.push(`준비물: ${session.materials}`);
    lines.push(`도입: ${session.intro}`);
    lines.push(`전개: ${session.main_activity}`);
    lines.push(`마무리: ${session.wrap_up}`);
    lines.push(`시간 배분: ${session.time_breakdown}`);
    lines.push(`교사 팁: ${session.teacher_tips}`);
    lines.push(`학생 선택 요소: ${session.student_choice_elements}`);
    lines.push(`어려움을 겪는 학생 지원: ${session.support_for_struggling_students}`);
    lines.push(`빠른 완료 학생 추가 활동: ${session.extra_activity_for_fast_finishers}`);
    lines.push("");
  });
  lines.push("[학부모 안내]");
  lines.push(plan.parent_summary);
  lines.push("");
  lines.push("[작품 제목 예시]");
  plan.title_examples.forEach((title, index) => {
    lines.push(`${index + 1}. ${title}`);
  });
  return lines.join("\n");
}

function canvasTextLines(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean); let line = "";
    for (const word of words) { const test = line ? `${line} ${word}` : word; if (context.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test; }
    if (line) lines.push(line);
  }
  return lines;
}

function drawFittedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, maxHeight: number, options?: {maxFont?:number;minFont?:number;bold?:boolean;color?:string}) {
  const maxFont=options?.maxFont??24; const minFont=options?.minFont??14; const weight=options?.bold?"700":"400"; let fontSize=maxFont; let lines:string[]=[]; let lineHeight=fontSize*1.3;
  while(fontSize>=minFont){context.font=`${weight} ${fontSize}px Arial, sans-serif`;lineHeight=fontSize*1.3;lines=canvasTextLines(context,text,maxWidth);if(lines.length<=Math.floor(maxHeight/lineHeight))break;fontSize-=1;}
  const maxLines=Math.max(1,Math.floor(maxHeight/lineHeight));if(lines.length>maxLines){lines=lines.slice(0,maxLines);let last=lines[maxLines-1];while(last.length>1&&context.measureText(`${last}…`).width>maxWidth)last=last.slice(0,-1);lines[maxLines-1]=`${last.trim()}…`;}
  context.fillStyle=options?.color??"#27272a";context.textBaseline="top";lines.forEach((line,index)=>context.fillText(line,x,y+index*lineHeight));context.textBaseline="alphabetic";
}

async function loadCanvasImage(source: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image load failed"));
    image.src = source;
  });
}

function drawCoverImage(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, radius = 22) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale; const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2; const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.save(); context.beginPath(); context.roundRect(x, y, width, height, radius); context.clip();
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height); context.restore();
}

function drawInfoBox(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string, icon: string, title: string, lines: string[]) {
  context.fillStyle = "#ffffff"; context.strokeStyle = color; context.lineWidth = 2; context.beginPath(); context.roundRect(x, y, width, height, 20); context.fill(); context.stroke();
  context.fillStyle = color; context.font = "700 30px Arial, sans-serif"; context.fillText(`${icon}  ${title}`, x + 22, y + 42);
  drawFittedText(context, lines.join("\n"), x + 22, y + 68, width - 44, height - 84, {maxFont:21,minFont:15});
}

async function downloadPlanImage(plan: LessonPlanResult, imageSources: string[], meta: PlanExportMeta) {
  const width = 1240;
  const height = 1754;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;
  const loadedImages = (await Promise.all(imageSources.slice(0, 7).map(source => loadCanvasImage(source).catch(() => null)))).filter((image): image is HTMLImageElement => image !== null);
  context.fillStyle = "#fffdfa"; context.fillRect(0, 0, width, height); context.strokeStyle = "#fb7185"; context.lineWidth = 3; context.beginPath(); context.roundRect(15, 15, width - 30, height - 30, 28); context.stroke();
  context.fillStyle = "#fb4f7b"; context.beginPath(); context.roundRect(34, 34, 158, 54, 27); context.fill(); context.fillStyle = "#ffffff"; context.font = "700 28px Arial, sans-serif"; context.fillText("수업제목", 58, 70);
  drawFittedText(context, plan.title, 215, 32, 980, 112, {maxFont:55,minFont:32,bold:true,color:"#18181b"});
  drawFittedText(context, plan.objective, 45, 145, 1150, 50, {maxFont:25,minFont:18,color:"#3f3f46"});

  drawInfoBox(context, 28, 205, 350, 120, "#2563eb", "👥", "대상", [meta.ageGroup || "대상 연령"]);
  drawInfoBox(context, 28, 340, 350, 120, "#f43f5e", "◷", "차시", [`${plan.sessions.length}차시 (${meta.durationMinutes}분)`]);
  const firstSession = plan.sessions[0];
  drawInfoBox(context, 28, 475, 350, 245, "#f59e0b", "◎", "학습 목표", [firstSession?.goal || plan.objective]);
  drawInfoBox(context, 28, 735, 350, 205, "#16a34a", "🎨", "준비물", [firstSession?.materials || "수업 준비물"]);
  drawInfoBox(context, 28, 955, 350, 345, "#2563eb", "💡", "수업 흐름", [`1. 도입  ${firstSession?.intro || "작품 관찰"}`, `2. 전개  ${firstSession?.main_activity || "작품 만들기"}`, `3. 마무리  ${firstSession?.wrap_up || "작품 감상"}`]);
  drawInfoBox(context, 28, 1315, 350, 390, "#8b5cf6", "★", "교사 TIP", [firstSession?.teacher_tips || "학생의 선택과 표현을 격려해주세요.", `확장 활동: ${firstSession?.extra_activity_for_fast_finishers || "완성 후 작품 제목 정하기"}`]);

  context.fillStyle = "#f8efe6"; context.strokeStyle = "#e7c9ad"; context.beginPath(); context.roundRect(400, 205, 810, 610, 24); context.fill(); context.stroke();
  if (loadedImages[0]) drawCoverImage(context, loadedImages[0], 416, 221, 778, 578, 18);
  else { context.fillStyle = "#a1a1aa"; context.font = "700 30px Arial, sans-serif"; context.fillText("대표 작품 이미지", 680, 520); }

  context.fillStyle = "#c49a6c"; context.beginPath(); context.roundRect(650, 830, 310, 52, 26); context.fill(); context.fillStyle = "#ffffff"; context.font = "700 29px Arial, sans-serif"; context.fillText("만드는 순서", 730, 866);
  const stepTexts = [firstSession?.intro, firstSession?.main_activity, firstSession?.wrap_up, firstSession?.student_choice_elements, firstSession?.support_for_struggling_students, firstSession?.extra_activity_for_fast_finishers].filter(Boolean) as string[];
  for (let index = 0; index < 6; index++) { const column=index%3; const row=Math.floor(index/3); const x=410+column*265; const y=900+row*330; context.fillStyle="#ffffff";context.strokeStyle="#ead8c5";context.beginPath();context.roundRect(x,y,245,300,18);context.fill();context.stroke();const stepImage=loadedImages[index+1]||loadedImages[0];if(stepImage)drawCoverImage(context,stepImage,x+10,y+10,225,180,12);context.fillStyle="#fb4f7b";context.beginPath();context.arc(x+30,y+30,24,0,Math.PI*2);context.fill();context.fillStyle="#ffffff";context.font="700 24px Arial, sans-serif";context.fillText(String(index+1),x+23,y+39);drawFittedText(context,stepTexts[index]||`${index+1}단계 작품 과정을 진행해요.`,x+14,y+205,217,82,{maxFont:18,minFont:13,color:"#27272a"}); }
  context.fillStyle="#fff1f2";context.strokeStyle="#fda4af";context.beginPath();context.roundRect(410,1575,790,130,20);context.fill();context.stroke();context.fillStyle="#be123c";context.font="700 27px Arial, sans-serif";context.fillText("핵심 포인트!",435,1615);drawFittedText(context,firstSession?.student_choice_elements||plan.parent_summary,435,1632,735,60,{maxFont:20,minFont:14,color:"#3f3f46"});

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("PNG image creation failed");
  const fileName = `${plan.title.replace(/[\\/:*?"<>|]/g, "_") || "수업계획안"}.png`;
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: plan.title });
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = fileName;
  link.href = url;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function copyTextWithFallback(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Some mobile in-app browsers expose Clipboard API but block writes.
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard copy failed");
}

export default function Home() {
  const [ageGroup, setAgeGroup] = useState("");
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState("");
  const [sessionCount, setSessionCount] = useState("");
  const [requestText, setRequestText] = useState("");
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [imageError, setImageError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [generationError, setGenerationError] = useState("");
  const [generatedPlan, setGeneratedPlan] = useState<LessonPlanResult | null>(null);
  const [generatedPlanImages, setGeneratedPlanImages] = useState<string[]>([]);
  const [planExportMeta, setPlanExportMeta] = useState<PlanExportMeta>({ ageGroup: "", subject: "", durationMinutes: 60 });
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [imageExportStatus, setImageExportStatus] = useState<"idle" | "working">("idle");
  const [savedPlans, setSavedPlans] = useState<SavedPlanRow[]>([]);
  const [savedPlansLoading, setSavedPlansLoading] = useState(true);
  const [savedPlanSearch, setSavedPlanSearch] = useState("");
  const [selectedSavedPlanId, setSelectedSavedPlanId] = useState<string | null>(null);
  const [deletingSavedPlanId, setDeletingSavedPlanId] = useState<string | null>(null);
  const [savedPlansError, setSavedPlansError] = useState("");

  const loadSavedPlans = async () => {
    const { data, error } = await supabase
      .from("lesson_plans")
      .select("id,title,target_age,class_type,class_minutes,session_count,generated_plan,created_at")
      .eq("status", "generated")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) setSavedPlansError("저장된 계획안을 불러오지 못했습니다.");
    else {
      setSavedPlans((data ?? []) as SavedPlanRow[]);
      setSavedPlansError("");
    }
    setSavedPlansLoading(false);
  };

  const visibleSavedPlans = savedPlans.filter((plan) =>
    [plan.title, plan.target_age, plan.class_type]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase("ko").includes(savedPlanSearch.trim().toLocaleLowerCase("ko"))),
  );

  const openSavedPlan = async (plan: SavedPlanRow) => {
    if (!plan.generated_plan) return;
    setGeneratedPlan(plan.generated_plan);
    setPlanExportMeta({ ageGroup: plan.target_age || "", subject: plan.class_type || "", durationMinutes: plan.class_minutes || 60 });
    setSelectedSavedPlanId(plan.id);
    const { data: imageRows } = await supabase.from("lesson_plan_images").select("storage_path,image_order").eq("lesson_plan_id",plan.id).order("image_order");
    const paths=(imageRows??[]).map(row=>row.storage_path).filter((path):path is string=>Boolean(path));
    if(paths.length){const {data:signed}=await supabase.storage.from("lesson-plan-images").createSignedUrls(paths,3600);setGeneratedPlanImages((signed??[]).map(item=>item.signedUrl).filter((url):url is string=>Boolean(url)))}else setGeneratedPlanImages([]);
    window.setTimeout(() => document.getElementById("generated-plan")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const deleteSavedPlan = async (plan: SavedPlanRow) => {
    if (!window.confirm(`“${plan.title || "제목 없는 계획안"}”을 삭제할까요?\n삭제한 계획안은 복구할 수 없습니다.`)) return;
    setDeletingSavedPlanId(plan.id);
    setSavedPlansError("");
    const { error } = await supabase.from("lesson_plans").delete().eq("id", plan.id);
    if (error) setSavedPlansError("계획안을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.");
    else {
      setSavedPlans((current) => current.filter((item) => item.id !== plan.id));
      if (selectedSavedPlanId === plan.id) {
        setSelectedSavedPlanId(null);
        setGeneratedPlan(null);
        setGeneratedPlanImages([]);
      }
    }
    setDeletingSavedPlanId(null);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSavedPlans(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      referenceImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";

    if (files.length === 0) return;

    const hasUnsupportedType = files.some(
      (file) => !ACCEPTED_IMAGE_TYPES.includes(file.type)
    );
    if (hasUnsupportedType) {
      setImageError(
        "지원하지 않는 이미지 형식입니다. JPG, PNG, WEBP 파일만 업로드해주세요."
      );
      return;
    }

    if (referenceImages.length + files.length > MAX_IMAGES) {
      setImageError("이미지는 최대 10장까지 업로드할 수 있습니다.");
      return;
    }

    const newImages: ReferenceImage[] = files.map((file) => ({
      id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setImageError("");
    setReferenceImages((prev) => [...prev, ...newImages]);
  };

  const handleRemoveImage = (id: string) => {
    setReferenceImages((prev) => {
      const target = prev.find((image) => image.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((image) => image.id !== id);
    });
  };

  const validate = (): string[] => {
    const errors: string[] = [];
    if (referenceImages.length === 0) errors.push("참고 이미지");
    if (!ageGroup) errors.push("대상 연령");
    if (!subject) errors.push("수업 분야");
    if (!duration) errors.push("수업 시간");
    if (!sessionCount) errors.push("수업 횟수");
    return errors;
  };

  const handleGenerate = async () => {
    const errors = validate();
    if (errors.length > 0) {
      setFormErrors(errors);
      setGenerationError("");
      return;
    }

    setFormErrors([]);
    setGenerationError("");
    setGeneratedPlan(null);
    setIsGenerating(true);
    setStage("uploading");

    try {
      const { data: draftRow, error: draftError } = await supabase
        .from("lesson_plans")
        .insert({
          target_age: ageGroup,
          class_type: subject,
          class_minutes: parseDurationMinutes(duration),
          session_count: parseSessionCountNumber(sessionCount),
          additional_request: requestText || null,
          status: "draft",
        })
        .select("id")
        .single();

      if (draftError || !draftRow) {
        throw new UploadError("lesson_plans insert failed", draftError);
      }
      const lessonPlanId = draftRow.id as string;

      const imageUrls: string[] = [];
      for (let i = 0; i < referenceImages.length; i++) {
        const image = referenceImages[i];
        const order = i + 1;
        const storagePath = `${lessonPlanId}/${buildStorageFileName(order, image.file)}`;

        const { error: uploadErr } = await supabase.storage
          .from("lesson-plan-images")
          .upload(storagePath, image.file);
        if (uploadErr) {
          const storageErr = uploadErr as {
            message?: string;
            name?: string;
            status?: number;
            statusCode?: string;
          };
          throw new UploadError("storage upload failed", {
            storagePath,
            message: storageErr.message,
            name: storageErr.name,
            status: storageErr.status,
            statusCode: storageErr.statusCode,
          });
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("lesson-plan-images").getPublicUrl(storagePath);
        imageUrls.push(publicUrl);

        const { error: imageRowError } = await supabase.from("lesson_plan_images").insert({
          lesson_plan_id: lessonPlanId,
          storage_path: storagePath,
          image_order: order,
          original_filename: image.file.name,
        });
        if (imageRowError) {
          throw new UploadError("lesson_plan_images insert failed", imageRowError);
        }
      }

      const { error: updateUrlsError } = await supabase
        .from("lesson_plans")
        .update({ reference_image_urls: imageUrls })
        .eq("id", lessonPlanId);
      if (updateUrlsError) {
        throw new UploadError("lesson_plans reference_image_urls update failed", updateUrlsError);
      }

      setStage("analyzing");
      // Images are sent as the original files (multipart), not the Storage
      // URL — the server base64-encodes them and passes them to Anthropic
      // Vision directly, so Claude never needs to fetch a URL itself.
      const generateFormData = new FormData();
      generateFormData.append("ageGroup", ageGroup);
      generateFormData.append("subject", subject);
      generateFormData.append("durationLabel", duration);
      generateFormData.append("sessionCountLabel", sessionCount);
      generateFormData.append("requestText", requestText);
      const analysisFiles = await Promise.all(
        referenceImages.map((image) =>
          compressForAnalysis(image.file, referenceImages.length)
        )
      );
      analysisFiles.forEach((file) => {
        generateFormData.append("images", file, file.name);
      });

      const response = await fetch("/api/lesson-plans/generate", {
        method: "POST",
        body: generateFormData,
      });

      if (!response.ok || !response.body) {
        throw new AiError("generate API request failed", undefined, response);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult: LessonPlanResult | null = null;
      let streamError = "";
      let streamErrorDebug: unknown;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "stage" && event.stage === "writing") {
              setStage("writing");
            } else if (event.type === "result") {
              finalResult = event.data;
            } else if (event.type === "error") {
              streamError = event.message;
              streamErrorDebug = event.debug;
            }
          } catch (parseErr) {
            streamError = "AI 응답을 처리하는 중 오류가 발생했습니다.";
            streamErrorDebug = { rawLine: line, parseErr };
          }
        }
      }

      if (streamError) throw new AiError(streamError, streamErrorDebug);
      if (!finalResult) throw new AiError("No result received from generate API");

      const { error: saveError } = await supabase
        .from("lesson_plans")
        .update({
          title: finalResult.title,
          generated_plan: finalResult,
          status: "generated",
        })
        .eq("id", lessonPlanId);
      if (saveError) throw new SaveError("lesson_plans final update failed", saveError);

      setGeneratedPlan(finalResult);
      setGeneratedPlanImages(referenceImages.map(image=>image.previewUrl));
      setPlanExportMeta({ ageGroup, subject, durationMinutes: parseDurationMinutes(duration) });
      setSelectedSavedPlanId(lessonPlanId);
      await loadSavedPlans();
    } catch (err) {
      console.error("=== FULL ERROR ===");
      console.error(err);

      if (err instanceof Error) {
        console.error(err.message);
        console.error(err.stack);
      }

      const details = (err as { details?: unknown } | null)?.details;
      if (details !== undefined) {
        console.error("=== ERROR DETAILS ===");
        console.error(details);
        const supa = details as {
          message?: unknown;
          details?: unknown;
          hint?: unknown;
          code?: unknown;
        };
        if (supa && typeof supa === "object" && ("code" in supa || "hint" in supa)) {
          console.error("supabase message:", supa.message);
          console.error("supabase details:", supa.details);
          console.error("supabase hint:", supa.hint);
          console.error("supabase code:", supa.code);
        }
      }

      const errResponse = (err as { response?: Response } | null)?.response;
      if (errResponse) {
        console.error("=== FETCH RESPONSE ===");
        console.error("status:", errResponse.status);
        console.error("statusText:", errResponse.statusText);
        try {
          console.error("response body:", await errResponse.clone().text());
        } catch (bodyReadErr) {
          console.error("failed to read response body:", bodyReadErr);
        }
      }

      if (err instanceof UploadError) {
        setGenerationError("이미지 업로드에 실패했습니다. 다시 시도해주세요.");
      } else if (err instanceof AiError) {
        setGenerationError("AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      } else if (err instanceof SaveError) {
        setGenerationError("결과 저장에 실패했습니다. 다시 시도해주세요.");
      } else if (err instanceof TypeError) {
        setGenerationError("네트워크 연결을 확인해주세요.");
      } else {
        setGenerationError("알 수 없는 오류가 발생했습니다. 다시 시도해주세요.");
      }
    } finally {
      setIsGenerating(false);
      setStage(null);
    }
  };

  const handleCopyAll = async () => {
    if (!generatedPlan) return;
    try {
      await copyTextWithFallback(buildPlainTextSummary(generatedPlan));
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setGenerationError("클립보드 복사에 실패했습니다.");
    }
  };

  const handleDownloadImage = async () => {
    if (!generatedPlan || imageExportStatus === "working") return;
    setImageExportStatus("working");
    setGenerationError("");
    try {
      await downloadPlanImage(generatedPlan, generatedPlanImages, planExportMeta);
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") {
        setGenerationError("이미지 저장 창을 열지 못했습니다. 다시 시도해주세요.");
      }
    } finally {
      setImageExportStatus("idle");
    }
  };

  return (
    <div className="flex flex-col flex-1 items-center bg-white px-4 py-10 sm:px-6 sm:py-16">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-bold text-blue-600 sm:text-4xl">
          🎨 미술수업 AI
        </h1>
        <p className="text-sm text-zinc-500 sm:text-base">
          이미지 분석으로 미술 수업 계획안을 자동 생성합니다.
        </p>
      </header>

      <main className="mt-10 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-lg ring-1 ring-zinc-100 sm:p-10">
        <section className="mb-8 border-b border-zinc-100 pb-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-zinc-900">저장된 수업 계획안</h2>
              <p className="mt-1 text-sm text-zinc-500">이전에 만든 계획안을 다시 열고 이미지로 저장할 수 있습니다.</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-600">
              {savedPlans.length}개
            </span>
          </div>
          {!savedPlansLoading && savedPlans.length > 0 && (
            <label className="mt-4 block">
              <span className="sr-only">저장된 계획안 검색</span>
              <input
                type="search"
                value={savedPlanSearch}
                onChange={(event) => setSavedPlanSearch(event.target.value)}
                placeholder="제목, 연령, 수업 유형으로 검색"
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          )}
          {savedPlansError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{savedPlansError}</p>}
          {savedPlansLoading ? (
            <p className="mt-4 text-sm text-zinc-400">불러오는 중...</p>
          ) : savedPlans.length === 0 ? (
            <p className="mt-4 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500">아직 저장된 계획안이 없습니다.</p>
          ) : visibleSavedPlans.length === 0 ? (
            <p className="mt-4 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500">검색 결과가 없습니다.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {visibleSavedPlans.map((plan) => (
                <article key={plan.id} className={`rounded-xl border p-4 transition ${selectedSavedPlanId === plan.id ? "border-blue-400 bg-blue-50 ring-2 ring-blue-100" : "border-zinc-200"}`}>
                  <button type="button" onClick={() => void openSavedPlan(plan)} className="w-full text-left disabled:cursor-not-allowed disabled:opacity-50" disabled={!plan.generated_plan}>
                    <span className="line-clamp-2 text-sm font-bold text-zinc-900">{plan.title || "제목 없는 계획안"}</span>
                    <span className="mt-2 block text-xs text-zinc-500">{plan.target_age || "연령 미입력"} · {plan.class_type || "유형 미입력"}</span>
                    <span className="mt-1 block text-xs text-zinc-400">{new Date(plan.created_at).toLocaleDateString("ko-KR")}</span>
                  </button>
                  <div className="mt-3 flex items-center justify-between border-t border-zinc-200/80 pt-3">
                    <button type="button" onClick={() => void openSavedPlan(plan)} disabled={!plan.generated_plan} className="text-xs font-bold text-blue-600 disabled:text-zinc-400">열기</button>
                    <button type="button" onClick={() => void deleteSavedPlan(plan)} disabled={deletingSavedPlanId === plan.id} className="text-xs font-bold text-red-600 disabled:text-zinc-400">{deletingSavedPlanId === plan.id ? "삭제 중..." : "삭제"}</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <div className="flex flex-col gap-8">
          {/* 1. 참고 이미지 업로드 */}
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              ① 작품·과정 이미지 업로드
            </h2>
            <p className="text-sm text-zinc-500">
              첫 사진은 대표 작품, 2번부터는 만드는 순서대로 올려주세요. 최대 10장
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />
            <button
              type="button"
              onClick={handleImageButtonClick}
              className="mt-1 flex w-full items-center justify-center rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 py-8 text-sm font-medium text-blue-500 transition-colors hover:bg-blue-100 sm:text-base"
            >
              + 이미지 업로드
            </button>
            {imageError && (
              <p className="text-xs text-red-500">{imageError}</p>
            )}
            {referenceImages.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {referenceImages.map((image, index) => (
                  <div
                    key={image.id}
                    tabIndex={0}
                    className="group relative aspect-square overflow-hidden rounded-xl ring-1 ring-zinc-200 outline-none"
                  >
                    <img
                      src={image.previewUrl}
                      alt={`참고 이미지 ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(image.id)}
                      aria-label="이미지 삭제"
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 group-active:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 2. 대상 연령 선택 */}
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              ② 대상 연령 선택
            </h2>
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:text-base"
            >
              <option value="">연령대를 선택하세요</option>
              {AGE_GROUPS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </section>

          {/* 3. 수업 분야 선택 */}
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              ③ 수업 분야 선택
            </h2>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:text-base"
            >
              <option value="">수업 분야를 선택하세요</option>
              {SUBJECTS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </section>

          {/* 4. 수업 시간 선택 */}
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              ④ 수업 시간 선택
            </h2>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:text-base"
            >
              <option value="">수업 시간을 선택하세요</option>
              {DURATIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </section>

          {/* 5. 수업 횟수 선택 */}
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              ⑤ 수업 횟수 선택
            </h2>
            <select
              value={sessionCount}
              onChange={(e) => setSessionCount(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:text-base"
            >
              <option value="">수업 횟수를 선택하세요</option>
              {SESSION_COUNTS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </section>

          {/* 6. 추가 요청사항 입력 */}
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              ⑥ 추가 요청사항 입력
            </h2>
            <textarea
              value={requestText}
              onChange={(e) => setRequestText(e.target.value)}
              placeholder="추가로 반영하고 싶은 요청사항을 입력하세요"
              rows={4}
              className="resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:text-base"
            />
          </section>

          {formErrors.length > 0 && (
            <p className="text-xs text-red-500">
              다음 항목을 확인해주세요: {formErrors.join(", ")}
            </p>
          )}

          {isGenerating && stage && (
            <p className="flex items-center gap-2 text-sm text-blue-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
              {STAGE_LABELS[stage]}
            </p>
          )}

          {generationError && (
            <p className="text-xs text-red-500">{generationError}</p>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="mt-2 w-full rounded-xl bg-blue-600 py-4 text-base font-semibold text-white shadow-md transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg"
          >
            {isGenerating ? "생성 중..." : "수업 계획안 생성하기"}
          </button>

          {generatedPlan && (
            <section id="generated-plan" className="scroll-mt-24 flex flex-col gap-6 border-t border-zinc-100 pt-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-zinc-900">
                  생성된 수업 계획안
                </h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDownloadImage()}
                    disabled={imageExportStatus === "working"}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                  >
                    {imageExportStatus === "working" ? "이미지 만드는 중..." : "이미지 계획안 PNG"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyAll}
                    className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
                  >
                    {copyStatus === "copied" ? "복사됨!" : "전체 복사"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold text-zinc-900">
                  {generatedPlan.title}
                </h3>
                <p className="text-sm text-zinc-600">{generatedPlan.objective}</p>
              </div>

              <div className="flex flex-col gap-3">
                {generatedPlan.sessions.map((session) => (
                  <div
                    key={session.session_number}
                    className="rounded-xl border border-zinc-200 p-4"
                  >
                    <h4 className="text-sm font-semibold text-blue-600">
                      {session.session_number}회차 · {session.session_title}
                    </h4>
                    <dl className="mt-2 flex flex-col gap-1.5 text-sm text-zinc-700">
                      <div>
                        <dt className="font-medium text-zinc-900">목표</dt>
                        <dd>{session.goal}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-zinc-900">준비물</dt>
                        <dd>{session.materials}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-zinc-900">도입</dt>
                        <dd>{session.intro}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-zinc-900">전개</dt>
                        <dd>{session.main_activity}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-zinc-900">마무리</dt>
                        <dd>{session.wrap_up}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-zinc-900">시간 배분</dt>
                        <dd>{session.time_breakdown}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-zinc-900">교사 팁</dt>
                        <dd>{session.teacher_tips}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-zinc-900">학생 선택 요소</dt>
                        <dd>{session.student_choice_elements}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-zinc-900">
                          어려움을 겪는 학생 지원
                        </dt>
                        <dd>{session.support_for_struggling_students}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-zinc-900">
                          빠른 완료 학생 추가 활동
                        </dt>
                        <dd>{session.extra_activity_for_fast_finishers}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-blue-50 p-4">
                <h4 className="text-sm font-semibold text-blue-700">
                  학부모 안내
                </h4>
                <p className="mt-1 text-sm text-zinc-700">
                  {generatedPlan.parent_summary}
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <h4 className="text-sm font-semibold text-zinc-900">
                  작품 제목 예시
                </h4>
                <ul className="list-disc pl-5 text-sm text-zinc-700">
                  {generatedPlan.title_examples.map((title, index) => (
                    <li key={index}>{title}</li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
