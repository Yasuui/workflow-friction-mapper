"use client";

import { jsPDF } from "jspdf";
import { BRIEF_MARKDOWN_FILENAME, BRIEF_PDF_FILENAME } from "@/lib/agent-protocol";

export function downloadTextFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadBriefMarkdown(markdown: string) {
  downloadTextFile(markdown, BRIEF_MARKDOWN_FILENAME, "text/markdown");
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
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = BRIEF_PDF_FILENAME;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
