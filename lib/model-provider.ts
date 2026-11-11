import { createOpenAI } from "@ai-sdk/openai";
import type { LiveAttempt } from "./agent-stream.ts";

/**
 * Which live model answers, if any.
 *
 * - OPENAI_API_KEY alone: OpenAI (Responses API), MODEL then FALLBACK_MODEL.
 * - LLM_BASE_URL + LLM_API_KEY: any OpenAI-compatible Chat Completions endpoint (OpenRouter,
 *   Groq, Google's Gemini OpenAI endpoint, a self-hosted vLLM or Ollama). This is the low-cost
 *   path: point it at a free or cheap model without changing code.
 * - Neither: the deterministic rule-based agent, no model call at all.
 *
 * Provider-specific options (OpenAI reasoning effort) are only sent to OpenAI, because other
 * endpoints may reject unknown parameters.
 */

export const DEFAULT_OPENAI_MODEL = "gpt-5-mini";
export const DEFAULT_OPENAI_FALLBACK = "gpt-4.1-mini";

export type LiveConfig =
  | { mode: "demo" }
  | { mode: "live"; provider: string; models: string[]; attempts: () => LiveAttempt[] };

type Env = Record<string, string | undefined>;

export function liveConfig(env: Env = process.env): LiveConfig {
  const baseURL = env.LLM_BASE_URL?.trim();
  const compatibleKey = env.LLM_API_KEY?.trim();

  if (baseURL && compatibleKey) {
    const primary = env.MODEL?.trim();
    if (!primary) return { mode: "demo" };
    const models = unique([primary, env.FALLBACK_MODEL?.trim()]);
    const provider = providerName(baseURL);
    return {
      mode: "live",
      provider,
      models,
      attempts: () => {
        const client = createOpenAI({ baseURL, apiKey: compatibleKey, name: provider });
        return models.map((id) => ({ model: client.chat(id), label: `${provider}:${id}` }));
      },
    };
  }

  const openaiKey = env.OPENAI_API_KEY?.trim();
  if (!openaiKey) return { mode: "demo" };
  const models = unique([env.MODEL?.trim() || DEFAULT_OPENAI_MODEL, env.FALLBACK_MODEL?.trim() || DEFAULT_OPENAI_FALLBACK]);
  return {
    mode: "live",
    provider: "openai",
    models,
    attempts: () => {
      const client = createOpenAI({ apiKey: openaiKey });
      return models.map((id) => ({
        model: client(id),
        label: id,
        providerOptions: { openai: { reasoningEffort: "low" } },
      }));
    },
  };
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function providerName(baseURL: string): string {
  try {
    const host = new URL(baseURL).hostname;
    if (host.includes("openrouter")) return "openrouter";
    if (host.includes("groq")) return "groq";
    if (host.includes("googleapis")) return "gemini";
    if (host === "localhost" || host === "127.0.0.1") return "local";
    return host.split(".").slice(-2, -1)[0] || "compatible";
  } catch {
    return "compatible";
  }
}
