import { BRIEF_MARKDOWN_FILENAME, BRIEF_PDF_FILENAME } from "@/lib/agent-protocol";

const ALLOWED = new Set([BRIEF_MARKDOWN_FILENAME, BRIEF_PDF_FILENAME]);

export async function POST(request: Request) {
  const form = await request.formData();
  const filename = String(form.get("filename") ?? "");
  const body = String(form.get("body") ?? "");
  const encoding = String(form.get("encoding") ?? "utf8");

  if (!ALLOWED.has(filename) || !body) {
    return new Response("Unsupported brief download.", { status: 400 });
  }

  const bytes = encoding === "base64" ? Buffer.from(body, "base64") : Buffer.from(body, "utf8");
  const mime = filename.endsWith(".pdf") ? "application/pdf" : "text/markdown; charset=utf-8";

  return new Response(bytes, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
