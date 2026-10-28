import type { UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { parseWorkflowIntent, SYSTEM_PROMPT } from "@/lib/agent-protocol";
import { buildDemoReply, collectUserMaterial, readMaterialIntent } from "@/lib/demo-agent";
import { extractPdfFromDataUrl, isPdfPart } from "@/lib/pdf-text";
import { analyzeWorkflow } from "@/lib/workflow-analysis";
import { extractFacts } from "@/lib/workflow-intake";
import { readOptimizeRequest } from "@/lib/optimize-request";
import { streamAgentReply } from "@/lib/agent-stream";

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
  const request = await readOptimizeRequest(req);
  if (!request.ok) {
    return Response.json({ error: request.error }, { status: request.status });
  }
  const { messages } = request.value;
  const intent = readMaterialIntent(messages, request.value.intent);
  const material = await collectUserMaterial(messages, extractPdfFromDataUrl);
  const demoReply = async () => buildDemoReply(material, intent);

  if (!process.env.OPENAI_API_KEY) {
    return streamAgentReply({ attempts: [], system: "", messages, demoReply });
  }

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
  const intentNote = ` Active intent: ${parseWorkflowIntent(intent) ?? "improve"}.`;

  return streamAgentReply({
    attempts: [
      { model: openai(LIVE_MODEL), label: LIVE_MODEL },
      { model: openai(FALLBACK_MODEL), label: FALLBACK_MODEL },
    ],
    system: `${SYSTEM_PROMPT}${intentNote}${localNote}`,
    messages: await prepareMessages(messages),
    demoReply,
    onModelError: (label, error) => console.error(`[optimize] ${label} failed`, error),
  });
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
