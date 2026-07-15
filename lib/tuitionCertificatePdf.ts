export type TuitionCertificate = {
  academyName: string;
  academyPhone?: string;
  academyAddress?: string;
  representative?: string;
  businessNumber?: string;
  studentName: string;
  billingMonth: string;
  amount: number;
  paidAt: string | null;
  paymentId: string;
};

const addText = (tag: string, text: string, style = "") => {
  const node = document.createElement(tag);
  node.textContent = text;
  node.setAttribute("style", style);
  return node;
};

const formatDate = (value: string | null) => {
  const date = value ? new Date(value) : new Date();
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
};

export async function downloadTuitionCertificate(data: TuitionCertificate) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const certificate = document.createElement("article");
  certificate.style.cssText = "width:794px;height:1123px;box-sizing:border-box;padding:54px;background:#fff;color:#1f2937;font-family:Arial,'Malgun Gothic',sans-serif;";
  const frame = document.createElement("div");
  frame.style.cssText = "height:100%;box-sizing:border-box;border:2px solid #174d3d;padding:54px;position:relative;";
  const certificateNo = `GS-${data.billingMonth.replace(/-/g, "")}-${data.paymentId.slice(0, 8).toUpperCase()}`;
  frame.append(
    addText("p", "그림새봄 · ART ACADEMY", "margin:0;color:#397d68;font-size:12px;font-weight:700;letter-spacing:2px;"),
    addText("h1", "교육비 납입증명서", "margin:72px 0 14px;text-align:center;font-size:38px;letter-spacing:8px;"),
    addText("p", "TUITION PAYMENT CERTIFICATE", "margin:0 0 68px;text-align:center;color:#6b7280;font-size:11px;letter-spacing:3px;"),
  );
  const table = document.createElement("div");
  table.style.cssText = "border-top:2px solid #334155;border-bottom:1px solid #cbd5e1;";
  const rows = [
    ["학생 성명", data.studentName],
    ["납입 대상월", `${Number(data.billingMonth.slice(5, 7))}월 교육비`],
    ["납입 금액", `금 ${data.amount.toLocaleString("ko-KR")}원정 (₩${data.amount.toLocaleString("ko-KR")})`],
    ["납입 일자", formatDate(data.paidAt)],
    ["납입 목적", "미술교육 수강료"],
    ["발급 번호", certificateNo],
  ];
  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.style.cssText = "display:grid;grid-template-columns:150px 1fr;border-top:1px solid #cbd5e1;min-height:64px;align-items:stretch;";
    row.append(
      addText("b", label, "display:flex;align-items:center;padding:0 20px;background:#f3f6f4;font-size:14px;"),
      addText("span", value, "display:flex;align-items:center;padding:0 24px;font-size:15px;"),
    );
    table.append(row);
  });
  frame.append(table);
  frame.append(
    addText("p", "위와 같이 교육비를 납입하였음을 증명합니다.", "margin:70px 0 38px;text-align:center;font-size:17px;"),
    addText("p", formatDate(new Date().toISOString()), "text-align:center;font-size:16px;"),
  );
  const issuer = document.createElement("div");
  issuer.style.cssText = "margin-top:58px;text-align:right;padding-right:32px;";
  issuer.append(
    addText("p", data.academyName, "margin:0 0 9px;font-size:23px;font-weight:800;"),
    addText("p", data.academyAddress || "", "margin:0 0 5px;color:#6b7280;font-size:12px;"),
    addText("p", data.representative ? `대표자 ${data.representative}` : "", "margin:0 0 5px;color:#6b7280;font-size:12px;"),
    addText("p", data.businessNumber ? `사업자등록번호 ${data.businessNumber}` : "", "margin:0 0 5px;color:#6b7280;font-size:12px;"),
    addText("p", data.academyPhone ? `연락처 ${data.academyPhone}` : "", "margin:0;color:#6b7280;font-size:12px;"),
  );
  const stamp = addText("span", "직인", "position:absolute;right:52px;bottom:190px;width:58px;height:58px;border:3px solid #b91c1c;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#b91c1c;font-weight:800;transform:rotate(-10deg);opacity:.8;");
  frame.append(issuer, stamp, addText("p", "본 증명서는 그림새봄 재무관리 시스템에서 전자 발급되었습니다.", "position:absolute;left:54px;right:54px;bottom:42px;margin:0;padding-top:14px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:10px;"));
  certificate.append(frame);
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;";
  holder.append(certificate);
  document.body.append(holder);
  try {
    await document.fonts.ready;
    const canvas = await html2canvas(certificate, { scale: 2, backgroundColor: "#fff", useCORS: true });
    const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [794, 1123], hotfixes: ["px_scaling"] });
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, 794, 1123);
    pdf.save(`납입증명서_${data.studentName}_${data.billingMonth}.pdf`);
  } finally {
    holder.remove();
  }
}
