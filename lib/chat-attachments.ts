import type { FileUIPart } from "ai";

export const FILE_ACCEPT = ".txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg,.gif,.webp,image/*,text/plain,text/markdown,text/csv,application/json,application/pdf";
export const MAX_FILES = 5;
export const ATTACH_HINT =
  "Attach a SOP PDF, process notes (.txt / .md), a CSV export, or a screenshot of the queue/sheet. Excel: export CSV. Word and Excel files (.docx / .xlsx) are not read.";
const MAX_TEXT_BYTES = 400_000;
/** Base64 adds a third, so 2.5 MB of PDF or image stays under the API's 4 MB request limit. */
export const MAX_BINARY_BYTES = 2_500_000;

/** Image types the live model accepts. Shared with the API guard in lib/optimize-request.ts. */
export const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;

/** Text attachments are sent as UTF-8 text/plain data URLs and labelled with a normalized type. */
export const TEXT_MEDIA_TYPES = {
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
} as const;
const MAX_TEXT_CHARS = 12_000;

export type ChatFileKind = "txt" | "md" | "csv" | "json" | "pdf" | "image" | "other";

export function classifyChatFile(name: string, mime = ""): ChatFileKind {
  const lower = name.toLowerCase();
  const type = mime.toLowerCase();
  if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lower)) return "image";
  if (lower.endsWith(".pdf") || type === "application/pdf") return "pdf";
  if (lower.endsWith(".txt") || type === "text/plain") return "txt";
  if (lower.endsWith(".md") || type.includes("markdown")) return "md";
  if (lower.endsWith(".csv") || type === "text/csv") return "csv";
  if (lower.endsWith(".json") || type === "application/json") return "json";
  return "other";
}

export async function filesToChatParts(files: File[]): Promise<{ parts: FileUIPart[]; note: string }> {
  const parts: FileUIPart[] = [];
  const notes: string[] = [];
  for (const file of files.slice(0, MAX_FILES)) {
    const kind = classifyChatFile(file.name, file.type);
    if (kind === "other") {
      notes.push(`${file.name} is not a supported type. Use .txt, .md, .csv, .json, .pdf, or an image.`);
      continue;
    }
    if (kind === "image" || kind === "pdf") {
      const mediaType = kind === "pdf" ? "application/pdf" : file.type.toLowerCase();
      if (kind === "image" && !(SUPPORTED_IMAGE_TYPES as readonly string[]).includes(mediaType)) {
        notes.push(`${file.name} is not a supported image. Use PNG, JPEG, GIF, or WebP.`);
        continue;
      }
      if (file.size > MAX_BINARY_BYTES) {
        notes.push(`${file.name} is over 2.5 MB. Attach a smaller export or paste the relevant steps.`);
        continue;
      }
      const dataUrl = await readDataUrl(file);
      parts.push({
        type: "file",
        filename: file.name,
        mediaType,
        // FileReader may label the payload differently (or as octet-stream); align it with mediaType.
        url: dataUrl.replace(/^data:[^;,]*/, `data:${mediaType}`),
      });
      continue;
    }
    if (file.size > MAX_TEXT_BYTES) {
      notes.push(`${file.name} is too large to attach. Paste the relevant steps.`);
      continue;
    }
    const text = (await file.text()).slice(0, MAX_TEXT_CHARS);
    parts.push({
      type: "file",
      filename: file.name,
      mediaType: TEXT_MEDIA_TYPES[kind],
      url: `data:text/plain;base64,${utf8ToBase64(text)}`,
    });
  }
  return { parts, note: notes.join(" ") };
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}
