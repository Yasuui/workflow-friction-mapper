import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { SYSTEM_PROMPT } from "@/lib/agent-protocol";
import { buildDemoReply, collectUserMaterial } from "@/lib/demo-agent";
import { extractPdfFromDataUrl, isPdfPart } from "@/lib/pdf-text";
import { analyzeWorkflow } from "@/lib/workflow-analysis";
import { extractFacts } from "@/lib/workflow-intake";

export const runtime = "nodejs";
export const maxDuration = 60;

const LIVE_MODEL = process.env.MODEL || "gpt-5-mini";
const FALLBACK_MODEL = "gpt-4.1-mini";

export async function GET() {
  return Response.json({
    mode: process.env.OPENAI_API_KEY ? "live" : "demo",
    model: LIVE_MODEL,
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { messages?: UIMessage[] };
  const messages = Array.isArray(body.messages) ? body.messages : [];

  if (!process.env.OPENAI_API_KEY) {
    return streamDemo(messages);
  }

  try {
    return await streamLive(messages, LIVE_MODEL);
  } catch {
    return streamLive(messages, FALLBACK_MODEL);
  }
}

async function streamDemo(messages: UIMessage[]) {
  const material = await collectUserMaterial(messages, extractPdfFromDataUrl);
  const reply = buildDemoReply(material);
  const chunks = chunkString(reply, 5);
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const id = "demo-text";
      writer.write({ type: "start" });
      writer.write({ type: "text-start", id });
      for (const delta of chunks) {
        writer.write({ type: "text-delta", id, delta });
        await delay(11);
      }
      writer.write({ type: "text-end", id });
      writer.write({ type: "finish" });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

async function streamLive(messages: UIMessage[], modelId: string) {
  const prepared = await prepareMessages(messages);
  const material = await collectUserMaterial(messages, extractPdfFromDataUrl);
  const facts = extractFacts(material);
  const localNote =
    facts.minutesPerRun != null && facts.runsPerWeek != null
      ? ` User-stated volume arithmetic only: ${analyzeWorkflow({
          description: material,
          minutesPerRun: facts.minutesPerRun,
          runsPerWeek: facts.runsPerWeek,
          handoffs: facts.handoffs ?? 0,
          sensitivity: facts.sensitivity ?? "internal",
        }).annualManualHours} hours/year. Use only if those figures were provided.`
      : " No volume was stated. Do not invent hours.";

  const result = streamText({
    model: openai(modelId),
    system: `${SYSTEM_PROMPT}${localNote}`,
    messages: await convertToModelMessages(prepared),
    maxOutputTokens: 700,
    temperature: 0.3,
  });

  return result.toUIMessageStreamResponse();
}

async function prepareMessages(messages: UIMessage[]): Promise<UIMessage[]> {
  const next: UIMessage[] = [];
  for (const message of messages) {
    const parts: UIMessage["parts"] = [];
    for (const part of message.parts) {
      if (part.type === "file" && isPdfPart(part.filename, part.mediaType)) {
        const text = await extractPdfFromDataUrl(part.url);
        parts.push({
          type: "text" as const,
          text: text
            ? `PDF ${part.filename ?? "attachment"}:\n${text.slice(0, 12000)}`
            : `A PDF named ${part.filename ?? "attachment"} was attached but text could not be extracted. Ask the user to paste the relevant steps.`,
        });
        continue;
      }
      parts.push(part);
    }
    next.push({ ...message, parts });
  }
  return next;
}

function chunkString(value: string, size: number): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += size) chunks.push(value.slice(index, index + size));
  return chunks;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
