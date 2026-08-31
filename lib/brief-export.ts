"use client";

import { jsPDF } from "jspdf";
import { BRIEF_MARKDOWN_FILENAME, BRIEF_PDF_FILENAME } from "@/lib/agent-protocol";

type SavePicker = (options: {
  suggestedName: string;
  types: Array<{ description: string; accept: Record<string, string[]> }>;
}) => Promise<{
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
}>;

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function bytesFromBody(body: string, encoding: "utf8" | "base64"): Uint8Array {
  if (encoding === "base64") {
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  return new TextEncoder().encode(body);
}

/**
 * Chrome ignores <a download> on blob: URLs (UUID), cancels hidden-frame
 * downloads (UUID + Deleted), and popup-blocks extra named windows.
 * The File System Access picker writes a named file from the click itself.
 */
export async function saveNamedFile(body: string, filename: string, encoding: "utf8" | "base64" = "utf8") {
  const bytes = bytesFromBody(body, encoding);
  const blob = new Blob([bytes as BlobPart], { type: "application/octet-stream" });
  const ext = filename.toLowerCase().endsWith(".pdf") ? ".pdf" : ".md";
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;

  if (typeof picker === "function") {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [{ description: "Workflow brief", accept: { "application/octet-stream": [ext] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }

  const href = `data:application/octet-stream;base64,${encoding === "base64" ? body : utf8ToBase64(body)}`;
  const link = document.createElement("a");
  link.setAttribute("href", href);
  link.setAttribute("download", filename);
  link.rel = "noopener";
  document.body.appendChild(link);
  link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  window.setTimeout(() => link.remove(), 2000);
}

export function downloadBriefMarkdown(markdown: string) {
  void saveNamedFile(markdown, BRIEF_MARKDOWN_FILENAME, "utf8");
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
  void saveNamedFile(doc.output("datauristring").split(",")[1] ?? "", BRIEF_PDF_FILENAME, "base64");
}
