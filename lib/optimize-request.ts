import type { UIMessage } from "ai";
import { parseWorkflowIntent, type WorkflowIntent } from "./agent-protocol.ts";
import { SUPPORTED_IMAGE_TYPES, TEXT_MEDIA_TYPES } from "./chat-attachments.ts";

/**
 * Request boundary for POST /api/optimize.
 *
 * The chat history arrives from the browser, so everything here is untrusted. The guard keeps
 * the route to what the UI can actually send: user and assistant turns, text and inline (data:)
 * attachments of the types the composer accepts, within limits that fit a Vercel function body.
 * Anything else is rejected before it reaches the demo agent, PDF parsing or a paid model.
 */

// Vercel caps a function request body at 4.5 MB; leave headroom for JSON overhead.
export const MAX_BODY_BYTES = 4_000_000;
export const MAX_MESSAGES = 40;
export const MAX_FILES_PER_REQUEST = 10;
export const MAX_TEXT_PART_CHARS = 20_000;
export const MAX_TOTAL_TEXT_CHARS = 80_000;

const TEXT_TYPES = new Set<string>(Object.values(TEXT_MEDIA_TYPES));
export const ALLOWED_ATTACHMENT_TYPES = new Set<string>([
  "application/pdf",
  ...TEXT_TYPES,
  ...SUPPORTED_IMAGE_TYPES,
]);

export type OptimizeRequest = { messages: UIMessage[]; intent: WorkflowIntent | null };

export type GuardResult =
  | { ok: true; value: OptimizeRequest }
  | { ok: false; status: 400 | 413 | 415; error: string };

const reject = (status: 400 | 413 | 415, error: string): GuardResult => ({ ok: false, status, error });

export async function readOptimizeRequest(req: Request): Promise<GuardResult> {
  const type = req.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(type)) return reject(415, "Send the conversation as JSON.");

  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return reject(413, "The conversation and attachments are too large. Remove a file and try again.");
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return reject(400, "The request body could not be read.");
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return reject(413, "The conversation and attachments are too large. Remove a file and try again.");
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reject(400, "The request body is not valid JSON.");
  }
  return validateOptimizeBody(body);
}

export function validateOptimizeBody(body: unknown): GuardResult {
  if (!isRecord(body)) return reject(400, "Expected a JSON object.");
  if (!Array.isArray(body.messages)) return reject(400, "Expected a messages array.");
  if (body.messages.length === 0) return reject(400, "Send at least one message.");
  if (body.messages.length > MAX_MESSAGES) {
    return reject(413, "This conversation is too long. Start a new one with the workflow you want mapped.");
  }

  const messages: UIMessage[] = [];
  let totalText = 0;
  let totalFiles = 0;

  for (const [index, candidate] of body.messages.entries()) {
    if (!isRecord(candidate) || typeof candidate.id !== "string" || !Array.isArray(candidate.parts)) {
      return reject(400, `Message ${index + 1} is malformed.`);
    }
    const role = candidate.role;
    if (role !== "user" && role !== "assistant") {
      return reject(400, `Message ${index + 1} has an unsupported role.`);
    }

    const parts: UIMessage["parts"] = [];
    for (const part of candidate.parts) {
      if (!isRecord(part) || typeof part.type !== "string") {
        return reject(400, `Message ${index + 1} has a malformed part.`);
      }

      if (part.type === "text") {
        if (typeof part.text !== "string") return reject(400, `Message ${index + 1} has a malformed text part.`);
        if (part.text.length > MAX_TEXT_PART_CHARS) {
          return reject(413, "One message is too long. Trim it or attach the notes as a file.");
        }
        totalText += part.text.length;
        parts.push({ type: "text", text: part.text });
        continue;
      }

      // Assistant turns only need their text as history; tool, reasoning and step markers are dropped.
      if (role === "assistant") continue;

      if (part.type === "file") {
        const file = readFilePart(part);
        if (!file.ok) return reject(file.status, `Message ${index + 1}: ${file.error}`);
        totalFiles += 1;
        parts.push(file.part);
        continue;
      }

      return reject(400, `Message ${index + 1} has an unsupported part type.`);
    }

    if (role === "user" && parts.length === 0) return reject(400, `Message ${index + 1} is empty.`);
    messages.push({ id: candidate.id, role, parts });
  }

  if (totalText > MAX_TOTAL_TEXT_CHARS) {
    return reject(413, "This conversation is too long. Start a new one with the workflow you want mapped.");
  }
  if (totalFiles > MAX_FILES_PER_REQUEST) {
    return reject(413, `Attach at most ${MAX_FILES_PER_REQUEST} files per conversation.`);
  }
  if (!messages.some((message) => message.role === "user")) {
    return reject(400, "Send at least one user message.");
  }

  return { ok: true, value: { messages, intent: parseWorkflowIntent(body.intent) ?? null } };
}

type FilePart = Extract<UIMessage["parts"][number], { type: "file" }>;

function readFilePart(
  part: Record<string, unknown>,
): { ok: true; part: FilePart } | { ok: false; status: 400 | 415; error: string } {
  if (typeof part.url !== "string" || typeof part.mediaType !== "string") {
    return { ok: false, status: 400, error: "an attachment is malformed." };
  }
  // Only inline uploads are accepted. A remote URL would make the server or the model
  // provider fetch an address the client chose.
  const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+)(?:;[^,]*)?,/i.exec(part.url);
  if (!match) return { ok: false, status: 400, error: "attachments must be uploaded, not linked." };

  const declared = part.mediaType.toLowerCase();
  const embedded = match[1].toLowerCase();
  if (!ALLOWED_ATTACHMENT_TYPES.has(declared) || !ALLOWED_ATTACHMENT_TYPES.has(embedded)) {
    return { ok: false, status: 415, error: "that attachment type is not supported." };
  }
  // Text attachments travel as text/plain whatever their declared text type.
  const textPayload = TEXT_TYPES.has(declared) && embedded === "text/plain";
  if (declared !== embedded && !textPayload) {
    return { ok: false, status: 400, error: "an attachment's type does not match its contents." };
  }

  const filename = typeof part.filename === "string" ? part.filename.slice(0, 200) : undefined;
  return { ok: true, part: { type: "file", mediaType: declared, url: part.url, ...(filename ? { filename } : {}) } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
