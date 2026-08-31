export async function extractPdfFromDataUrl(url: string): Promise<string> {
  const match = url.match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) return "";
  try {
    const bytes = Uint8Array.from(Buffer.from(match[2], "base64"));
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const result = await extractText(pdf, { mergePages: true });
    const text = result.text as string | string[];
    if (Array.isArray(text)) return text.join("\n").trim();
    return String(text ?? "").trim();
  } catch {
    return "";
  }
}

export function isPdfPart(filename: string | undefined, mediaType: string | undefined): boolean {
  const name = (filename ?? "").toLowerCase();
  const media = (mediaType ?? "").toLowerCase();
  return media === "application/pdf" || name.endsWith(".pdf");
}
