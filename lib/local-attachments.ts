export type AttachmentAnalyticsType = "txt" | "md" | "csv" | "json" | "image" | "other";

export interface ParsedAttachment {
  name: string;
  analyticsType: AttachmentAnalyticsType;
  text: string;
  parsed: boolean;
}

const TEXT_TYPES = new Set<AttachmentAnalyticsType>(["txt", "md", "csv", "json"]);
const MAX_TEXT_BYTES = 400_000;
const MAX_SUMMARY_CHARS = 4_000;

export function isPdfFile(fileName: string, mimeType = ""): boolean {
  const name = fileName.toLowerCase();
  const mime = mimeType.toLowerCase();
  return name.endsWith(".pdf") || mime === "application/pdf";
}

export function classifyAttachment(fileName: string, mimeType = ""): AttachmentAnalyticsType {
  const name = fileName.toLowerCase();
  const mime = mimeType.toLowerCase();

  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)) return "image";
  if (name.endsWith(".txt") || mime === "text/plain") return "txt";
  if (name.endsWith(".md") || mime === "text/markdown" || mime === "text/x-markdown") return "md";
  if (name.endsWith(".csv") || mime === "text/csv") return "csv";
  if (name.endsWith(".json") || mime === "application/json") return "json";
  return "other";
}

export function summarizeCsv(raw: string): string {
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return "Empty CSV attachment.";
  const header = lines[0];
  const sample = lines.slice(1, 6);
  return [`CSV columns: ${header}.`, sample.length ? `Sample rows:\n${sample.join("\n")}` : "No data rows."].join(" ");
}

export function summarizeJson(raw: string): string {
  try {
    const data = JSON.parse(raw) as unknown;
    if (Array.isArray(data)) {
      const first = data[0];
      const keys = first && typeof first === "object" ? Object.keys(first as object).join(", ") : "";
      const preview = JSON.stringify(data.slice(0, 3));
      return `JSON list (${data.length} items)${keys ? ` with fields: ${keys}` : ""}. ${preview}`;
    }
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const nested = record.steps ?? record.process ?? record.workflow ?? record.description;
      if (typeof nested === "string") return nested;
      if (Array.isArray(nested)) return nested.map(String).join(". ");
      return JSON.stringify(data);
    }
    return String(data);
  } catch {
    return raw.slice(0, MAX_SUMMARY_CHARS);
  }
}

export function parseLocalAttachment(fileName: string, mimeType: string, rawText: string | null): ParsedAttachment {
  const analyticsType = classifyAttachment(fileName, mimeType);

  if (analyticsType === "image") {
    return {
      name: fileName,
      analyticsType,
      text: `Image ${fileName} (pixels are not read; use the filename and any caption).`,
      parsed: false,
    };
  }

  if (isPdfFile(fileName, mimeType)) {
    return {
      name: fileName,
      analyticsType: "other",
      text: `PDF ${fileName} is attached but not parsed in the browser. Describe what it contains.`,
      parsed: false,
    };
  }

  if (!TEXT_TYPES.has(analyticsType) || rawText == null) {
    return {
      name: fileName,
      analyticsType,
      text: rawText == null && TEXT_TYPES.has(analyticsType)
        ? `File ${fileName} was too large to read locally. Paste the relevant steps instead.`
        : `File ${fileName} is not a supported local text format. Describe what it contains.`,
      parsed: false,
    };
  }

  const trimmed = rawText.replace(/^\uFEFF/, "").trim();
  let text = trimmed;
  if (analyticsType === "csv") text = summarizeCsv(trimmed);
  if (analyticsType === "json") text = summarizeJson(trimmed);
  if (text.length > MAX_SUMMARY_CHARS) text = `${text.slice(0, MAX_SUMMARY_CHARS)}…`;

  return { name: fileName, analyticsType, text, parsed: text.length > 0 };
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsText(file);
  });
}

export async function readLocalFile(file: File): Promise<ParsedAttachment> {
  const analyticsType = classifyAttachment(file.name, file.type);
  if (analyticsType === "image" || isPdfFile(file.name, file.type) || !TEXT_TYPES.has(analyticsType)) {
    return parseLocalAttachment(file.name, file.type, null);
  }
  if (file.size > MAX_TEXT_BYTES) {
    return parseLocalAttachment(file.name, file.type, null);
  }
  const rawText = await readFileAsText(file);
  return parseLocalAttachment(file.name, file.type, rawText);
}
