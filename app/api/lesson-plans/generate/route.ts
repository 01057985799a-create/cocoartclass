import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

const LANGUAGE_INSTRUCTION =
  "모든 응답은 반드시 자연스럽고 현대적인 한국어로만 작성하세요. 중국어, 일본어, 한자를 절대 사용하지 마세요. 순수 한글 문장으로 작성하고, 필요한 경우에만 영어로 된 재료명 등 고유명사를 사용할 수 있습니다.";

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

const IMAGE_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    image_analysis: {
      type: "array",
      items: {
        type: "object",
        properties: {
          order: { type: "integer" },
          subject: { type: "string" },
          features: { type: "string" },
          materials_guess: { type: "string" },
          difficulty_notes: { type: "string" },
        },
        required: ["order", "subject", "features", "materials_guess", "difficulty_notes"],
        additionalProperties: false,
      },
    },
  },
  required: ["image_analysis"],
  additionalProperties: false,
};

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    objective: { type: "string" },
    sessions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          session_number: { type: "integer" },
          session_title: { type: "string" },
          goal: { type: "string" },
          materials: { type: "string" },
          intro: { type: "string" },
          main_activity: { type: "string" },
          wrap_up: { type: "string" },
          time_breakdown: { type: "string" },
          teacher_tips: { type: "string" },
          student_choice_elements: { type: "string" },
          support_for_struggling_students: { type: "string" },
          extra_activity_for_fast_finishers: { type: "string" },
        },
        required: [
          "session_number",
          "session_title",
          "goal",
          "materials",
          "intro",
          "main_activity",
          "wrap_up",
          "time_breakdown",
          "teacher_tips",
          "student_choice_elements",
          "support_for_struggling_students",
          "extra_activity_for_fast_finishers",
        ],
        additionalProperties: false,
      },
    },
    parent_summary: { type: "string" },
    title_examples: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["title", "objective", "sessions", "parent_summary", "title_examples"],
  additionalProperties: false,
};

const SUPPORTED_IMAGE_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

type Base64MediaType = Anthropic.Base64ImageSource["media_type"];

// Anthropic Vision — official base64 image format. Files are read from the
// browser's multipart upload and base64-encoded here on the server; no
// image URL (localhost or Storage) is ever sent to the Anthropic API.
async function fileToImageBlock(file: File): Promise<Anthropic.ImageBlockParam> {
  const mediaType: Base64MediaType = SUPPORTED_IMAGE_MEDIA_TYPES.has(file.type)
    ? (file.type as Base64MediaType)
    : "image/jpeg";
  const arrayBuffer = await file.arrayBuffer();
  const data = Buffer.from(arrayBuffer).toString("base64");
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: mediaType,
      data,
    },
  };
}

function parseDurationMinutes(label: string): number {
  const match = label.match(/\d+/);
  return match ? parseInt(match[0], 10) : 60;
}

function parseSessionsToGenerate(label: string): number {
  const match = label.match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
}

function extractJsonText(message: Anthropic.Message): string {
  const textBlock = message.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  if (!textBlock) {
    throw new Error("Claude response did not include a text block");
  }
  const text = textBlock.text.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

async function runImageAnalysis(
  imageBlocks: Anthropic.ImageBlockParam[],
  ageGroup: string,
  subject: string
): Promise<ImageAnalysisItem[]> {
  const message = await anthropic.messages
    .stream({
      model: MODEL,
      max_tokens: 4096,
      system: `당신은 한국 미술 학원의 수업 준비를 돕는 보조 AI입니다. ${LANGUAGE_INSTRUCTION} Return only valid JSON with this JSON Schema: ${JSON.stringify(IMAGE_ANALYSIS_SCHEMA)}`,
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            {
              type: "text",
              text: [
                `다음은 학생이 참고할 미술 작품 이미지 ${imageBlocks.length}장입니다. 각 이미지를 순서(1부터)대로 분석하세요.`,
                `대상 연령: ${ageGroup}`,
                `수업 분야: ${subject}`,
                "사진만으로 재료나 기법을 확정할 수 없는 경우 '추정됩니다', '~일 가능성이 있습니다' 와 같은 표현을 사용하고 단정하지 마세요.",
                "각 이미지에 대해 order(순번), subject(작품 주제/소재), features(시각적 특징), materials_guess(추정 재료 및 기법), difficulty_notes(해당 연령대 기준 난이도 참고사항)를 작성하세요.",
              ].join("\n"),
            },
          ],
        },
      ],
    })
    .finalMessage();

  const parsed = JSON.parse(extractJsonText(message)) as {
    image_analysis: ImageAnalysisItem[];
  };
  return parsed.image_analysis;
}

async function runPlanGeneration(params: {
  ageGroup: string;
  subject: string;
  durationLabel: string;
  sessionCountLabel: string;
  requestText: string;
  imageAnalysis: ImageAnalysisItem[];
}): Promise<{
  title: string;
  objective: string;
  sessions: SessionPlan[];
  parent_summary: string;
  title_examples: string[];
}> {
  const classMinutes = parseDurationMinutes(params.durationLabel);
  const sessionsToGenerate = parseSessionsToGenerate(params.sessionCountLabel);

  const message = await anthropic.messages
    .stream({
      model: MODEL,
      max_tokens: 12000,
      system: `당신은 한국 미술 학원의 수업 계획안을 작성하는 보조 AI입니다. ${LANGUAGE_INSTRUCTION} Return only valid JSON with this JSON Schema: ${JSON.stringify(PLAN_SCHEMA)}`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "다음 조건과 참고 이미지 분석 결과를 바탕으로 미술 수업 계획안을 작성하세요.",
                "",
                "[수업 조건]",
                `- 대상 연령: ${params.ageGroup}`,
                `- 수업 분야: ${params.subject}`,
                `- 1회당 수업 시간: ${params.durationLabel} (${classMinutes}분)`,
                `- 총 수업 횟수: ${params.sessionCountLabel} (정확히 ${sessionsToGenerate}개 회차의 계획을 작성하세요)`,
                `- 추가 요청사항: ${params.requestText || "없음"}`,
                "",
                "[참고 이미지 분석 결과]",
                JSON.stringify(params.imageAnalysis, null, 2),
                "",
                "[작성 지침]",
                `- sessions 배열은 정확히 ${sessionsToGenerate}개의 항목으로 작성하세요.`,
                `- 각 회차의 time_breakdown에는 활동별 시간 배분을 구체적으로 적되, 합계가 반드시 ${classMinutes}분이 되도록 하세요.`,
                "- 사진만으로 확정할 수 없는 재료나 기법에 대해서는 '추정됩니다', '가능성이 있습니다' 와 같은 표현을 사용하세요.",
                "- parent_summary는 학부모에게 이 수업을 소개하는 문구로 작성하세요.",
                "- title_examples는 학생 작품에 붙일 수 있는 제목 예시 정확히 5개로 작성하세요.",
              ].join("\n"),
            },
          ],
        },
      ],
    })
    .finalMessage();

  return JSON.parse(extractJsonText(message));
}

export async function POST(request: Request) {
  const encoder = new TextEncoder();
  let controllerRef!: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
    },
  });

  const write = (obj: unknown) => {
    controllerRef.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
  };

  (async () => {
    try {
      const formData = await request.formData();
      const ageGroup = String(formData.get("ageGroup") ?? "");
      const subject = String(formData.get("subject") ?? "");
      const durationLabel = String(formData.get("durationLabel") ?? "");
      const sessionCountLabel = String(formData.get("sessionCountLabel") ?? "");
      const requestText = String(formData.get("requestText") ?? "");
      const imageFiles = formData.getAll("images").filter((v): v is File => v instanceof File);

      if (imageFiles.length === 0) {
        throw new Error("No image files provided");
      }

      const imageBlocks = await Promise.all(imageFiles.map(fileToImageBlock));

      write({ type: "stage", stage: "analyzing" });
      const imageAnalysis = await runImageAnalysis(imageBlocks, ageGroup, subject);

      write({ type: "stage", stage: "writing" });
      const plan = await runPlanGeneration({
        ageGroup,
        subject,
        durationLabel,
        sessionCountLabel,
        requestText,
        imageAnalysis,
      });

      write({
        type: "result",
        data: {
          title: plan.title,
          objective: plan.objective,
          image_analysis: imageAnalysis,
          sessions: plan.sessions,
          parent_summary: plan.parent_summary,
          title_examples: plan.title_examples,
        },
      });
    } catch (error) {
      console.error("Lesson plan generation failed:", error);

      write({
        type: "error",
        message: "AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      });
    } finally {
      controllerRef.close();
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
