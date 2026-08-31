"use client";

import { jsPDF } from "jspdf";
import { BRIEF_MARKDOWN_FILENAME, BRIEF_PDF_FILENAME } from "@/lib/agent-protocol";

/**
 * Chrome names blob: downloads after the UUID in the URL and ignores
 * <a download>. Navigate a same-origin POST whose Content-Disposition
 * carries the real filename — that is what the download shelf reads.
 */
export function triggerNamedDownload(body: string, filename: string, encoding: "utf8" | "base64" = "utf8") {
  const frameName = "brief-download-frame";
  let frame = document.getElementById(frameName) as HTMLIFrameElement | null;
  if (!frame) {
    frame = document.createElement("iframe");
    frame.id = frameName;
    frame.name = frameName;
    frame.setAttribute("aria-hidden", "true");
    frame.style.display = "none";
    document.body.appendChild(frame);
  }

  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/brief-download";
  form.target = frameName;
  form.style.display = "none";

  const fields: Array<[string, string]> = [
    ["filename", filename],
    ["body", body],
    ["encoding", encoding],
  ];
  for (const [name, value] of fields) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
  window.setTimeout(() => form.remove(), 4000);
}

export function downloadBriefMarkdown(markdown: string) {
  triggerNamedDownload(markdown, BRIEF_MARKDOWN_FILENAME, "utf8");
}

export function downloadBriefPdf(title: string, body: string) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 56;
  const width = 612 - margin * 2;
  let y = 64;
  doc.setTextColor(21, 21, 21);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, margin, y);
  y += 28;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(body, width) as string[];
  for (const line of lines) {
    if (y > 734) {
      doc.addPage();
      y = 64;
    }
    doc.text(line, margin, y);
    y += 16;
  }
  triggerNamedDownload(doc.output("datauristring").split(",")[1] ?? "", BRIEF_PDF_FILENAME, "base64");
}
