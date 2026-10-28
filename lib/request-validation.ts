import { z } from "zod";

// A request may contain several attachments. Limits apply before parsing and again
// to each part so direct callers cannot bypass the browser's file picker.
export const MAX_REQUEST_BYTES = 4_000_000;
const dataUrl = /^data:(?:text\/(?:plain|markdown|csv)|application\/(?:json|pdf)|image\/(?:png|jpeg|gif|webp));base64,[a-z0-9+/]+={0,2}$/i;
const part = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().max(40_000) }).passthrough(),
  z.object({
    type: z.literal("file"),
    filename: z.string().max(255).optional(),
    mediaType: z.string().max(100),
    url: z.string().max(2_700_000).regex(dataUrl),
  }).passthrough().superRefine((value, ctx) => {
    const declared = value.mediaType.toLowerCase();
    const actual = value.url.slice(5, value.url.indexOf(";")).toLowerCase();
    if (declared !== actual) ctx.addIssue({ code: "custom", message: "File type does not match content." });
  }),
]);

export const requestSchema = z.object({
  messages: z.array(z.object({
    id: z.string().max(200),
    role: z.enum(["user", "assistant"]),
    parts: z.array(part).min(1).max(8),
  }).passthrough()).min(1).max(30),
  intent: z.enum(["create", "improve", "diagnose"]).optional(),
}).passthrough().superRefine((value, ctx) => {
  if (!value.messages.some((message) => message.role === "user")) {
    ctx.addIssue({ code: "custom", message: "A user message is required." });
  }
  if (value.messages.flatMap((message) => message.parts).filter((item) => item.type === "file").length > 5) {
    ctx.addIssue({ code: "custom", message: "Too many files." });
  }
});

export async function readLimitedJson(request: Request): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_REQUEST_BYTES)) throw new Error("too_large");
  if (!request.body) throw new Error("invalid_json");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new Error("too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Error("invalid_json"); }
}
