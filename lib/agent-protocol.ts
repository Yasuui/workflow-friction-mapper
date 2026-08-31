export const PRODUCT_NAME = "Workflow Friction Mapper";
export const PRODUCT_LINE = "Workflow optimizer";
export const BRIEF_MARKDOWN_FILENAME = "workflow-optimization-brief.md";
export const BRIEF_PDF_FILENAME = "workflow-optimization-brief.pdf";

export const AGENT_GREETING =
  "Paste a workflow, attach a SOP or notes, or tap a starter. I’ll map the real steps, name the friction, and suggest a first move — only from what you share. If volume or constraints are missing, I’ll ask once instead of inventing numbers.";

export const SYSTEM_PROMPT = `You are a senior workflow optimizer.

Ground every claim in the user's messages and files. Label inferences. Never invent hours, dollars, headcount, tools, or SLAs that were not in the material. If volume or constraints are missing, ask one precise question instead of fabricating. Be specific: name the step, the handoff, and the failure mode. No generic "consider RPA" filler.

Reply in 2–5 short spoken sentences. When you can analyze the process, append exactly one fenced block tagged workflow-report with this JSON:
{"summary":"spoken paragraph","steps":["ordered current steps"],"friction":[{"step":"","issue":"","evidence":"","kind":"fact"}],"bottlenecks":[{"step":"","issue":"","evidence":"","kind":"fact"}],"opportunities":[{"title":"","rationale":"","evidence":"","kind":"fact"}],"firstMove":"one concrete next action","assumptions":[],"missing":[],"question":null,"hours":{"annualManual":null,"basis":null,"kind":"fact"}}
kind must be "fact" or "inference". If you must clarify first, omit the fenced block.`;

export const WORKFLOW_STARTERS: Array<{
  label: string;
  analyticsLabel: "data_review" | "meeting_follow_up" | "case_monitoring" | "onboarding";
  prompt: string;
}> = [
  {
    label: "Data review",
    analyticsLabel: "data_review",
    prompt:
      "Export requests from Excel. Check required fields and remove duplicates. Send incomplete rows back to the owner. Add valid requests to the case queue. It takes about 30 minutes, 10 times a week, with 2 handoffs. Data is internal.",
  },
  {
    label: "Meeting follow-up",
    analyticsLabel: "meeting_follow_up",
    prompt:
      "After a project meeting, write notes and action items. Confirm owners and due dates. Send reminders in Teams. Escalate overdue actions to the project lead. About 25 minutes, 4 times a week, 3 handoffs. Internal data.",
  },
  {
    label: "Case monitoring",
    analyticsLabel: "case_monitoring",
    prompt:
      "A new IT case enters the queue. Review its priority and assign an owner. Check the status each day. Notify the owner near the service deadline. Close the case after confirmation. 15 minutes, 20 times a week, 3 handoffs. Internal.",
  },
  {
    label: "Onboarding",
    analyticsLabel: "onboarding",
    prompt:
      "When a new employee starts, assign required courses and access tasks. Remind each owner before the due date. Check completion weekly. Escalate missing items before onboarding closes. 40 minutes, 3 times a week, 4 handoffs. Internal data.",
  },
];

export type EvidenceKind = "fact" | "inference";

export interface EvidenceItem {
  step: string;
  issue: string;
  evidence: string;
  kind: EvidenceKind;
}

export interface OpportunityItem {
  title: string;
  rationale: string;
  evidence: string;
  kind: EvidenceKind;
}

export interface AgentReport {
  summary: string;
  steps: string[];
  friction: EvidenceItem[];
  bottlenecks: EvidenceItem[];
  opportunities: OpportunityItem[];
  firstMove: string;
  assumptions: string[];
  missing: string[];
  question: string | null;
  hours: {
    annualManual: number | null;
    basis: string | null;
    kind: EvidenceKind;
  };
}

const FENCE = /```(?:workflow-report|json)\s*([\s\S]*?)```/i;

export function splitAgentOutput(raw: string): {
  prose: string;
  report: AgentReport | null;
  streamingFence: boolean;
} {
  const fenceOpen = raw.search(/```(?:workflow-report|json)\b/i);
  if (fenceOpen === -1) {
    return { prose: raw.trim(), report: null, streamingFence: false };
  }
  const prose = raw.slice(0, fenceOpen).trim();
  const closed = FENCE.exec(raw);
  if (!closed) return { prose, report: null, streamingFence: true };
  return { prose, report: parseReportJson(closed[1]), streamingFence: false };
}

export function parseReportJson(source: string): AgentReport | null {
  try {
    const data = JSON.parse(source) as Partial<AgentReport>;
    if (!data || typeof data !== "object") return null;
    const steps = asStringArray(data.steps);
    const friction = asEvidence(data.friction);
    const firstMove = typeof data.firstMove === "string" ? data.firstMove.trim() : "";
    if (!firstMove && friction.length === 0 && steps.length === 0) return null;
    const hours = data.hours ?? { annualManual: null, basis: null, kind: "fact" as const };
    return {
      summary: typeof data.summary === "string" ? data.summary.trim() : "",
      steps,
      friction,
      bottlenecks: asEvidence(data.bottlenecks),
      opportunities: asOpportunities(data.opportunities),
      firstMove,
      assumptions: asStringArray(data.assumptions),
      missing: asStringArray(data.missing),
      question: typeof data.question === "string" && data.question.trim() ? data.question.trim() : null,
      hours: {
        annualManual: typeof hours.annualManual === "number" ? hours.annualManual : null,
        basis: typeof hours.basis === "string" ? hours.basis : null,
        kind: hours.kind === "inference" ? "inference" : "fact",
      },
    };
  } catch {
    return null;
  }
}

export function reportToMarkdown(report: AgentReport): string {
  const hoursLine =
    report.hours.annualManual != null
      ? `- Manual time (from stated volume only): ${report.hours.annualManual} hours/year — ${report.hours.basis ?? "user-stated"} (${report.hours.kind})`
      : "- Manual time: not stated. Do not treat any hour figure as known.";
  const friction = report.friction.map((item) => `- **${item.step}** — ${item.issue} (${item.kind}: ${item.evidence})`).join("\n");
  const bottlenecks = report.bottlenecks.map((item) => `- **${item.step}** — ${item.issue} (${item.kind}: ${item.evidence})`).join("\n");
  const opportunities = report.opportunities
    .map((item) => `- **${item.title}** — ${item.rationale} (${item.kind}: ${item.evidence})`)
    .join("\n");
  return `# Workflow optimization brief

${report.summary}

${hoursLine}

## Current steps
${report.steps.map((step, index) => `${index + 1}. ${step}`).join("\n") || "- Not enough ordered steps were provided."}

## Friction
${friction || "- None named from the material."}

## Bottlenecks
${bottlenecks || "- None named from the material."}

## Facts vs assumptions
${report.assumptions.length ? report.assumptions.map((item) => `- Inference: ${item}`).join("\n") : "- No extra assumptions were added."}

## First moves
- ${report.firstMove}
${opportunities ? `\n## Opportunities\n${opportunities}` : ""}
${report.question ? `\n## Open question\n${report.question}` : ""}

Grounded only in what was shared. Generated with Workflow Friction Mapper.
`;
}

export function reportToPlainText(report: AgentReport): string {
  return reportToMarkdown(report)
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*/g, "")
    .trim();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function asEvidence(value: unknown): EvidenceItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as Partial<EvidenceItem>;
      return {
        step: String(row.step ?? "").trim() || "Workflow",
        issue: String(row.issue ?? "").trim(),
        evidence: String(row.evidence ?? "").trim() || "From the provided workflow.",
        kind: (row.kind === "inference" ? "inference" : "fact") as EvidenceKind,
      };
    })
    .filter((item) => item.issue);
}

function asOpportunities(value: unknown): OpportunityItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as Partial<OpportunityItem>;
      return {
        title: String(row.title ?? "").trim(),
        rationale: String(row.rationale ?? "").trim(),
        evidence: String(row.evidence ?? "").trim() || "From the provided workflow.",
        kind: (row.kind === "inference" ? "inference" : "fact") as EvidenceKind,
      };
    })
    .filter((item) => item.title && item.rationale);
}
