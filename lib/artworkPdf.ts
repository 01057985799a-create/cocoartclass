export type ArtworkPdfRecord = {
  student_name: string;
  analysis_date: string;
  child_age: number;
  artwork_title: string;
  image_url?: string;
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

const sectionRows: [keyof ArtworkPdfRecord, string][] = [
  ["stage_comparison", "로웬펠드 발달 단계 비교"],
  ["expressive_tendencies", "그림에서 보이는 표현 경향"],
  ["body_form_expression", "신체·형태 표현"],
  ["color_pattern_materials", "색채·패턴·재료 사용"],
  ["composition_space", "화면 구성과 공간 표현"],
  ["visible_strengths", "눈에 보이는 강점"],
  ["growth_points", "다음 수업의 성장 포인트"],
  ["parent_summary", "학부모 상담용 종합 코멘트"],
];

function textElement(tag: string, value: string, style = "") {
  const element = document.createElement(tag);
  element.textContent = value;
  if (style) element.setAttribute("style", style);
  return element;
}

async function createReport(record: ArtworkPdfRecord) {
  const report = document.createElement("article");
  report.style.cssText =
    "width:794px;min-height:1123px;box-sizing:border-box;padding:48px;background:#fff;color:#27272a;font-family:Arial,'Malgun Gothic',sans-serif;";
  const header = document.createElement("header");
  header.style.cssText = "border-bottom:4px solid #10b981;padding-bottom:18px;";
  header.append(
    textElement(
      "h1",
      "그림 발달 분석",
      "margin:0;color:#065f46;font-size:32px;",
    ),
  );
  header.append(
    textElement(
      "p",
      `${record.analysis_date} · ${record.student_name} · 만 ${record.child_age}세 · ${record.artwork_title || "제목 없음"}`,
      "margin:8px 0 12px;color:#71717a;font-size:14px;",
    ),
  );
  header.append(
    textElement(
      "span",
      record.lowenfeld_stage,
      "display:inline-block;background:#d1fae5;color:#065f46;padding:8px 13px;border-radius:999px;font-weight:700;font-size:14px;",
    ),
  );
  report.append(header);
  if (record.image_url) {
    const image = document.createElement("img");
    image.crossOrigin = "anonymous";
    image.src = record.image_url;
    image.style.cssText =
      "display:block;width:100%;height:285px;object-fit:contain;background:#fafafa;border-radius:16px;margin:20px 0;";
    await new Promise<void>((resolve) => {
      image.onload = () => resolve();
      image.onerror = () => resolve();
      window.setTimeout(resolve, 5000);
    });
    report.append(image);
  }
  for (const [key, label] of sectionRows) {
    const section = document.createElement("section");
    section.style.cssText = "border-bottom:1px solid #e4e4e7;padding:12px 0;";
    section.append(
      textElement("h2", label, "font-size:15px;color:#047857;margin:0 0 7px;"),
    );
    section.append(
      textElement(
        "p",
        String(record[key] ?? ""),
        "white-space:pre-wrap;line-height:1.65;margin:0;font-size:14px;",
      ),
    );
    report.append(section);
  }
  report.append(
    textElement(
      "div",
      record.caution_note,
      "margin-top:18px;background:#fffbeb;color:#92400e;padding:13px;border-radius:12px;font-size:12px;line-height:1.55;",
    ),
  );
  return report;
}

export async function downloadArtworkPdf(
  records: ArtworkPdfRecord[],
  filename: string,
) {
  if (!records.length) throw new Error("저장할 그림 분석 기록이 없습니다.");
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const holder = document.createElement("div");
  holder.style.cssText =
    "position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1;";
  document.body.append(holder);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [794, 1123],
    hotfixes: ["px_scaling"],
  });
  let firstPage = true;
  try {
    await document.fonts.ready;
    for (const record of records) {
      const report = await createReport(record);
      holder.append(report);
      const canvas = await html2canvas(report, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const sliceHeight = Math.floor((1123 / 794) * canvas.width);
      for (let y = 0; y < canvas.height; y += sliceHeight) {
        if (!firstPage) pdf.addPage([794, 1123], "portrait");
        firstPage = false;
        const part = document.createElement("canvas");
        part.width = canvas.width;
        part.height = Math.min(sliceHeight, canvas.height - y);
        part
          .getContext("2d")
          ?.drawImage(
            canvas,
            0,
            y,
            canvas.width,
            part.height,
            0,
            0,
            canvas.width,
            part.height,
          );
        const renderedHeight = (part.height / part.width) * 794;
        pdf.addImage(
          part.toDataURL("image/jpeg", 0.92),
          "JPEG",
          0,
          0,
          794,
          renderedHeight,
        );
      }
      report.remove();
    }
    pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  } finally {
    holder.remove();
  }
}
