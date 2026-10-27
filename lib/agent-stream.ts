import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type LanguageModel,
  type UIMessage,
  type UIMessageStreamWriter,
} from "ai";

/**
 * Streams the agent reply with a guaranteed answer.
 *
 * Live models are tried in order. If one fails before it has written any text, the next is
 * tried, and if every model fails the deterministic demo brief is streamed with a one-line
 * notice, so the person never sees an empty or broken reply. A failure after text has started
 * cannot be replaced cleanly, so it ends the turn with an error the chat shows.
 */

export type LiveAttempt = { model: LanguageModel; label: string };

export type AgentStreamOptions = {
  attempts: LiveAttempt[];
  system: string;
  messages: UIMessage[];
  demoReply: () => Promise<string>;
  onModelError?: (label: string, error: unknown) => void;
  delayMs?: number;
};

// The fenced JSON brief alone runs 800–1,500 tokens, and reasoning tokens count against this cap.
export const LIVE_MAX_OUTPUT_TOKENS = 6000;
export const LIVE_FALLBACK_NOTICE = "The live model is unavailable right now, so this is the rule-based demo brief.";

export function streamAgentReply(options: AgentStreamOptions): Response {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      let started = false;
      for (const attempt of options.attempts) {
        const outcome = await pipeLiveAttempt(attempt, options, writer, started);
        started = started || outcome.started;
        if (outcome.status === "done") return;
        if (outcome.status === "failed-midstream") {
          writer.write({ type: "error", errorText: "The reply was interrupted. Try again." });
          return;
        }
      }
      const demo = await options.demoReply();
      const notice = options.attempts.length > 0 ? `${LIVE_FALLBACK_NOTICE} ` : "";
      await writeText(writer, `${notice}${demo}`, { started, delayMs: options.delayMs ?? 11 });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

async function pipeLiveAttempt(
  attempt: LiveAttempt,
  options: AgentStreamOptions,
  writer: UIMessageStreamWriter,
  alreadyStarted: boolean,
): Promise<{ status: "done" | "failed-early" | "failed-midstream"; started: boolean }> {
  let started = alreadyStarted;
  let wroteText = false;
  try {
    const result = streamText({
      model: attempt.model,
      system: options.system,
      messages: await convertToModelMessages(options.messages),
      maxOutputTokens: LIVE_MAX_OUTPUT_TOKENS,
      // One retry per model keeps the worst case (both models down) to a few seconds before the demo.
      maxRetries: 1,
      providerOptions: { openai: { reasoningEffort: "low" } },
      onError: () => {
        // Reported through the error chunk below; avoids a duplicate unhandled log.
      },
    });
    // Hold everything until the first real token, so a model that fails early leaves nothing
    // half-written (no dangling start or text-start) before the next attempt or the demo.
    const pending: Parameters<UIMessageStreamWriter["write"]>[0][] = [];
    for await (const chunk of result.toUIMessageStream({ onError: describeError })) {
      if (chunk.type === "error") throw new Error(chunk.errorText);
      if (chunk.type === "start" && started) continue;
      if (!wroteText) {
        pending.push(chunk);
        if (chunk.type !== "text-delta" || !chunk.delta) continue;
        wroteText = true;
        for (const held of pending.splice(0)) {
          if (held.type === "start") started = true;
          writer.write(held);
        }
        continue;
      }
      writer.write(chunk);
    }
    if (!wroteText) throw new Error("The model returned no text.");
    return { status: "done", started };
  } catch (error) {
    options.onModelError?.(attempt.label, error);
    return { status: wroteText ? "failed-midstream" : "failed-early", started };
  }
}

async function writeText(
  writer: UIMessageStreamWriter,
  text: string,
  { started, delayMs }: { started: boolean; delayMs: number },
) {
  const id = "demo-text";
  if (!started) writer.write({ type: "start" });
  writer.write({ type: "text-start", id });
  for (let index = 0; index < text.length; index += 5) {
    writer.write({ type: "text-delta", id, delta: text.slice(index, index + 5) });
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  writer.write({ type: "text-end", id });
  writer.write({ type: "finish" });
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
