"use client";

import { jsPDF } from "jspdf";
import { BRIEF_MARKDOWN_FILENAME, BRIEF_PDF_FILENAME } from "@/lib/agent-protocol";

/**
 * Safari and some Chromium builds save blob: URLs as a bare UUID when:
 * the <a> is removed before the download starts, the Blob has a renderable
 * MIME type, or download is only set as a property. Name the File, force
 * octet-stream, setAttribute("download"), and delay both remove and revoke.
 */
export function triggerNamedDownload(data: BlobPart, filename: string) {
  const file = new File([data], filename, { type: "application/octet-stream" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.setAttribute("rel", "noopener");
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 2500);
}

export function downloadBriefMarkdown(markdown: string) {
  triggerNamedDownload(markdown, BRIEF_MARKDOWN_FILENAME);
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
  triggerNamedDownload(doc.output("arraybuffer"), BRIEF_PDF_FILENAME);
}
