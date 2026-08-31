import type { UIMessage } from "ai";
import { extractSteps } from "@/lib/workflow-analysis";
import { extractFacts } from "@/lib/workflow-intake";
import { type AgentReport, type EvidenceItem, type OpportunityItem } from "@/lib/agent-protocol";

const MAX_FILE_CHARS = 12_000;

export async function collectUserMaterial(
  messages: UIMessage[],
  extractPdf?: (dataUrl: string) => Promise<string>,
): Promise<string> {
  const chunks: string[] = [];
  for (const message of messages) {
    if (message.role !== "user") continue;
    for (const part of message.parts) {
      if (part.type === "text" && part.text.trim()) chunks.push(part.text.trim());
      if (part.type === "file") {
        const name = part.filename ?? "attachment";
        const media = part.mediaType ?? "";
        if (media.startsWith("image/")) {
          chunks.push(`Image attached: ${name}. Pixels are available to the live model; in demo, describe the steps shown.`);
          continue;
        }
        if (media === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
          const text = extractPdf ? await extractPdf(part.url) : "";
          chunks.push(text.trim() ? `Attachment ${name}:\n${text.slice(0, MAX_FILE_CHARS)}` : `PDF ${name} was attached.`);
          continue;
        }
        if (media.startsWith("text/") || /\.(txt|md|csv|json)$/i.test(name) || part.url.startsWith("data:text") || part.url.startsWith("data:application/json")) {
          const decoded = decodeDataUrl(part.url);
          if (decoded.trim()) chunks.push(`Attachment ${name}:\n${decoded.slice(0, MAX_FILE_CHARS)}`);
        }
      }
    }
  }
  return chunks.join("\n\n").trim();
}

export function buildDemoReply(material: string): string {
  const text = material.trim();
  if (text.length < 24) {
    return "I need the actual process — a trigger and the steps in order. Type it, attach a .txt, .md, .csv, .json, or .pdf, or tap a starter.";
  }

  const steps = extractSteps(text);
  const usableSteps = steps.length ? steps : [text.split(/[.?\n]/)[0]?.trim() || "The current process you described"];
  const facts = extractFacts(text);
  const friction = detectFriction(text, usableSteps);
  const bottlenecks = detectBottlenecks(text, usableSteps, friction);
  const opportunities = detectOpportunities(text, usableSteps);
  const missing: string[] = [];
  if (facts.minutesPerRun == null || facts.runsPerWeek == null) missing.push("volume");
  if (facts.sensitivity == null) missing.push("data-class");

  const annual =
    facts.minutesPerRun != null && facts.runsPerWeek != null
      ? Math.round(((facts.minutesPerRun / 60) * facts.runsPerWeek * 52) * 10) / 10
      : null;

  const question =
    missing.includes("volume")
      ? "About how many minutes does one run take, and how many times does it happen in a typical week?"
      : null;

  const firstMove =
    opportunities[0]
      ? `Start with ${opportunities[0].title.toLowerCase()}. Run it beside the current process and measure exceptions before expanding.`
      : `Write the ${usableSteps[0].toLowerCase()} step as a checklist with a named owner, then measure one week of exceptions.`;

  const summary = annual
    ? `This process has ${usableSteps.length} visible steps and ${friction.length} friction points I can name from your description. From the volume you stated, that is about ${annual} manual hours per year. First move: ${firstMove}`
    : `This process has ${usableSteps.length} visible steps and ${friction.length} friction points I can name from your description. I did not estimate hours because volume was not stated. First move: ${firstMove}`;

  const report: AgentReport = {
    summary,
    steps: usableSteps,
    friction,
    bottlenecks,
    opportunities,
    firstMove,
    assumptions: [
      ...(annual == null ? ["Hour and dollar impact is unknown until volume is stated."] : []),
      "Automation fit is inferred from the verbs and systems you named, not from a live systems audit.",
    ],
    missing,
    question,
    hours: {
      annualManual: annual,
      basis: annual != null ? `${facts.minutesPerRun} minutes × ${facts.runsPerWeek} runs/week × 52` : null,
      kind: "fact",
    },
  };

  const spoken = question
    ? `${summary}\n\n${question}`
    : summary;

  return `${spoken}\n\n\`\`\`workflow-report\n${JSON.stringify(report, null, 2)}\n\`\`\``;
}

function detectFriction(text: string, steps: string[]): EvidenceItem[] {
  const lower = text.toLowerCase();
  const items: EvidenceItem[] = [];
  const push = (step: string, issue: string, evidence: string, kind: EvidenceItem["kind"] = "fact") => {
    if (!items.some((item) => item.issue === issue)) items.push({ step, issue, evidence, kind });
  };
  const stepFor = (re: RegExp, fallback: string) => steps.find((step) => re.test(step)) ?? fallback;

  if (/excel|spreadsheet|csv|copy|paste|row/i.test(lower)) {
    push(stepFor(/excel|export|row|field|spreadsheet/i, steps[0] ?? "Intake"), "Manual data cleanup before work can start", "You mentioned spreadsheet, export, copy/paste, or row checks.");
  }
  if (/send|handoff|escalate|assign|notify/i.test(lower)) {
    push(stepFor(/send|escalat|assign|notify|hand/i, steps[1] ?? steps[0] ?? "Handoff"), "Work waits on a person-to-person handoff", "You named send, assign, notify, or escalate steps.");
  }
  if (/remind|follow[- ]up|due date/i.test(lower)) {
    push(stepFor(/remind|follow|due/i, "Reminders"), "Reminders depend on someone remembering to nudge", "You described reminders, follow-up, or due dates.");
  }
  if (/review|approv|check required|incomplete/i.test(lower)) {
    push(stepFor(/review|approv|check|incomplete/i, "Review"), "A human review gate sits on the critical path", "You described review, approval, or incomplete-item checks.");
  }
  if (/each day|daily|monitor|status/i.test(lower)) {
    push(stepFor(/monitor|status|day|daily/i, "Monitoring"), "Status is polled instead of exception-based", "You described daily checks, monitoring, or status lookups.");
  }
  if (items.length === 0 && steps.length) {
    push(steps[0], "The process is still held together by memory and sequential effort", "Ordered steps were provided without a system of record for state.", "inference");
  }
  return items.slice(0, 4);
}

function detectBottlenecks(text: string, steps: string[], friction: EvidenceItem[]): EvidenceItem[] {
  if (/excel|spreadsheet|row|duplicate/i.test(text)) {
    return [
      {
        step: steps.find((step) => /excel|export|row|field/i.test(step)) ?? steps[0] ?? "Intake",
        issue: "Intake quality sets the pace for every later handoff",
        evidence: "Cleanup or validation is required before downstream steps.",
        kind: "fact",
      },
    ];
  }
  if (/monitor|status|each day|daily/i.test(text)) {
    return [
      {
        step: steps.find((step) => /monitor|status|day/i.test(step)) ?? "Monitoring",
        issue: "Daily status checks cap throughput at human polling speed",
        evidence: "You described recurring status checks rather than exception alerts.",
        kind: "fact",
      },
    ];
  }
  return friction.slice(0, 1);
}

function detectOpportunities(text: string, steps: string[]): OpportunityItem[] {
  const lower = text.toLowerCase();
  const items: OpportunityItem[] = [];
  if (/excel|spreadsheet|csv|row|field/i.test(lower)) {
    items.push({
      title: "Validate incoming rows at the source",
      rationale: "Flag missing fields and duplicates before anyone re-exports the sheet.",
      evidence: quote(text, /excel|spreadsheet|csv|row|duplicate|field/i, steps[0]),
      kind: "fact",
    });
  }
  if (/meeting|notes|action items/i.test(lower)) {
    items.push({
      title: "Capture notes and actions once",
      rationale: "One structured action list removes re-typing after the meeting.",
      evidence: quote(text, /meeting|notes|action/i, steps[0]),
      kind: "fact",
    });
  }
  if (/remind|follow[- ]up|notify|teams/i.test(lower)) {
    items.push({
      title: "Trigger reminders from due dates",
      rationale: "Send the next nudge only when an owner or date requires it.",
      evidence: quote(text, /remind|follow|notify|teams/i, "Reminders"),
      kind: "fact",
    });
  }
  if (/case|ticket|queue|monitor|status/i.test(lower)) {
    items.push({
      title: "Watch cases by exception",
      rationale: "Surface only items near a deadline or stuck in a state — not every row, every day.",
      evidence: quote(text, /case|ticket|monitor|status|queue/i, "Case monitoring"),
      kind: "fact",
    });
  }
  if (/onboarding|new employee|course|access/i.test(lower)) {
    items.push({
      title: "Orchestrate onboarding from one checklist",
      rationale: "Sequence access and training from a shared state instead of separate chases.",
      evidence: quote(text, /onboarding|employee|course|access/i, "Onboarding"),
      kind: "fact",
    });
  }
  if (items.length === 0) {
    items.push({
      title: "Normalize the intake",
      rationale: "Give the first step a consistent format so later work is comparable.",
      evidence: steps[0] ?? "The opening step you described.",
      kind: "inference",
    });
  }
  return items.slice(0, 3);
}

function quote(text: string, re: RegExp, fallback: string): string {
  const match = text.match(re);
  if (!match) return fallback;
  const index = match.index ?? 0;
  const slice = text.slice(Math.max(0, index - 18), Math.min(text.length, index + 42)).replace(/\s+/g, " ").trim();
  return `“${slice}”`;
}

function decodeDataUrl(url: string): string {
  const match = url.match(/^data:([^;]+)(;base64)?,(.*)$/);
  if (!match) return "";
  try {
    if (match[2]) {
      if (typeof Buffer !== "undefined") return Buffer.from(match[3], "base64").toString("utf8");
      return decodeURIComponent(escape(atob(match[3])));
    }
    return decodeURIComponent(match[3]);
  } catch {
    return "";
  }
}
