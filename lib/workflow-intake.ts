import type { Sensitivity, WorkflowInput } from "@/lib/workflow-analysis";
import type { ParsedAttachment } from "@/lib/local-attachments";

export type MissingIntakeField = "volume" | "sensitivity";

export interface ConversationTurn {
  role: "user" | "agent";
  text: string;
}

export interface ExtractedFacts {
  minutesPerRun: number | null;
  runsPerWeek: number | null;
  handoffs: number | null;
  sensitivity: Sensitivity | null;
}

export interface IntakeResult {
  input: WorkflowInput;
  extracted: ExtractedFacts;
  missing: MissingIntakeField[];
  description: string;
}

export const INTAKE_DEFAULTS: Pick<WorkflowInput, "minutesPerRun" | "runsPerWeek" | "handoffs" | "sensitivity"> = {
  minutesPerRun: 20,
  runsPerWeek: 5,
  handoffs: 2,
  sensitivity: "internal",
};

const MAX_DESCRIPTION_CHARS = 8_000;

export function prepareDescription(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function extractMinutesPerRun(text: string): number | null {
  const normalized = text.toLowerCase();
  const hours = normalized.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr)\b/);
  if (hours) return clampInt(Number(hours[1]) * 60, 0, 1440);

  if (/\bhalf[-\s]?an?[-\s]?hour\b|\bhalf[-\s]?hour\b/.test(normalized)) return 30;
  if (/\b(?:about|around|roughly)?\s*(?:an|one)\s+hour\b/.test(normalized)) return 60;

  const minutes = normalized.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min)\b/);
  if (minutes) return clampInt(Number(minutes[1]), 0, 1440);
  return null;
}

export function extractRunsPerWeek(text: string): number | null {
  const normalized = text.toLowerCase();
  const perDay = normalized.match(/(\d+(?:\.\d+)?)\s*(?:times?|runs?|cycles?)\s*(?:a|per|each)\s*day\b/);
  if (perDay) return clampInt(Number(perDay[1]) * 5, 0, 1000);

  const perWeek = normalized.match(/(\d+(?:\.\d+)?)\s*(?:x|times?|runs?|cycles?)?\s*(?:a|per|\/)\s*week\b/);
  if (perWeek) return clampInt(Number(perWeek[1]), 0, 1000);

  const weeklyCount = normalized.match(/(\d+(?:\.\d+)?)\s*(?:weekly\s+runs?|runs?\s+weekly)\b/);
  if (weeklyCount) return clampInt(Number(weeklyCount[1]), 0, 1000);

  if (/\b(every day|each day|daily|weekdays?)\b/.test(normalized)) return 5;
  if (/\btwice(?:\s+a|\s+per)?\s+week\b/.test(normalized)) return 2;
  if (/\b(once a week|once per week|weekly)\b/.test(normalized)) return 1;
  return null;
}

export function extractHandoffs(text: string): number | null {
  const normalized = text.toLowerCase();
  const explicit = normalized.match(/(\d+)\s*(?:people(?:\s*\/\s*|\s+)?(?:team)?\s*)?handoffs?\b/);
  if (explicit) return clampInt(Number(explicit[1]), 0, 20);

  const people = normalized.match(/(\d+)\s*(?:people|persons|teams)\b(?:\s+(?:involved|touch|handoffs?))?/);
  if (people) return clampInt(Number(people[1]), 0, 20);

  const verbs = normalized.match(/\b(?:send(?:s|ing)? (?:it |them )?(?:to|back)|hand[-\s]?offs?|escalate(?:s|d|ing)?|assign(?:s|ed|ing)?|pass(?:es|ed|ing)? (?:it |them )?to|notify|notifies)\b/g);
  if (verbs && verbs.length > 0) return clampInt(verbs.length, 1, 20);
  return null;
}

export function extractSensitivity(text: string): Sensitivity | null {
  const normalized = text.toLowerCase();
  if (/\b(sensitive|personal data|personally identifiable|pii|confidential|regulated|taxpayer|social insurance|sin\b|ssn|medical|protected health|employer-owned)\b/.test(normalized)) {
    return "sensitive";
  }
  if (/\b(public|synthetic|anonymized|anonymised|sanitized|sanitised)\b/.test(normalized)) return "public";
  if (/\b(internal|workplace|company data|staff only|in-house)\b/.test(normalized)) return "internal";
  return null;
}

export function composeDescription(conversation: ConversationTurn[], attachments: ParsedAttachment[]): string {
  const userText = conversation
    .filter((turn) => turn.role === "user")
    .map((turn) => turn.text.trim())
    .filter(Boolean)
    .join("\n");
  const attachmentText = attachments
    .map((attachment) => `Attachment ${attachment.name}:\n${attachment.text}`)
    .join("\n\n");
  return prepareDescription([userText, attachmentText].filter(Boolean).join("\n\n")).slice(0, MAX_DESCRIPTION_CHARS);
}

export function hasUsableDescription(conversation: ConversationTurn[], attachments: ParsedAttachment[]): boolean {
  const userText = conversation
    .filter((turn) => turn.role === "user")
    .map((turn) => turn.text.trim())
    .join(" ")
    .trim();
  if (userText.length >= 24) return true;
  return attachments.some((attachment) => attachment.parsed && attachment.text.trim().length >= 24);
}

export function extractFacts(text: string): ExtractedFacts {
  return {
    minutesPerRun: extractMinutesPerRun(text),
    runsPerWeek: extractRunsPerWeek(text),
    handoffs: extractHandoffs(text),
    sensitivity: extractSensitivity(text),
  };
}

export function buildIntake(conversation: ConversationTurn[], attachments: ParsedAttachment[]): IntakeResult {
  const description = composeDescription(conversation, attachments);
  const extracted = extractFacts(description);
  const missing: MissingIntakeField[] = [];
  if (extracted.minutesPerRun == null || extracted.runsPerWeek == null) missing.push("volume");
  if (extracted.sensitivity == null) missing.push("sensitivity");

  return {
    description,
    extracted,
    missing,
    input: {
      description,
      minutesPerRun: extracted.minutesPerRun ?? INTAKE_DEFAULTS.minutesPerRun,
      runsPerWeek: extracted.runsPerWeek ?? INTAKE_DEFAULTS.runsPerWeek,
      handoffs: extracted.handoffs ?? INTAKE_DEFAULTS.handoffs,
      sensitivity: extracted.sensitivity ?? INTAKE_DEFAULTS.sensitivity,
    },
  };
}

export function nextClarifyingPrompt(missing: MissingIntakeField[]): string | null {
  const needsVolume = missing.includes("volume");
  const needsSensitivity = missing.includes("sensitivity");
  if (needsVolume && needsSensitivity) {
    return "I can map that locally. Two details I still need: about how many minutes one run takes and how many times it happens each week; and whether the data is public/synthetic, internal, or sensitive.";
  }
  if (needsVolume) {
    return "About how many minutes does one run take, and how many times does it happen in a typical week?";
  }
  if (needsSensitivity) {
    return "What kind of data does this handle — public/synthetic, internal, or sensitive?";
  }
  return null;
}

function clampInt(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}
