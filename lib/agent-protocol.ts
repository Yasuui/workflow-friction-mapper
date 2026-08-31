export const PRODUCT_NAME = "Workflow Friction Mapper";
export const PRODUCT_SHORT_NAME = "Mapper";
export const PRODUCT_LINE = "Workflow optimizer";
export const BRIEF_MARKDOWN_FILENAME = "workflow-optimization-brief.md";
export const BRIEF_PDF_FILENAME = "workflow-optimization-brief.pdf";

export type WorkflowIntent = "create" | "improve" | "diagnose";

export const INTENT_TOKEN_RE = /^\[Mapper intent:\s*(create|improve|diagnose)\]\s*/i;

export const AGENT_GREETING =
  "Pick what you want to do, then describe the job, paste the steps, or attach a SOP, notes, CSV, or a screenshot. I’ll map friction and a first move from what you share. If volume is missing, I’ll ask once instead of inventing numbers.";

export const INTAKE_QUESTIONS =
  "Let’s sketch a new workflow. Answer these three, then I’ll put a proposed process on the canvas.\n\n1. What job needs to get done?\n2. What kicks it off (email, form, meeting, ticket)?\n3. Who touches it after you?";

export const WORKFLOW_INTENTS: Array<{
  id: WorkflowIntent;
  title: string;
  subtitle: string;
  placeholder: string;
}> = [
  {
    id: "create",
    title: "Start a new workflow",
    subtitle: "I need a process from scratch.",
    placeholder: "Describe the job: what should happen, who starts it, what done looks like.",
  },
  {
    id: "improve",
    title: "Improve one I already run",
    subtitle: "Tighten a process I use now.",
    placeholder: "Paste the steps in order, or attach the SOP.",
  },
  {
    id: "diagnose",
    title: "Find what's wrong",
    subtitle: "This process is slow, error-prone, or stuck.",
    placeholder: "What's breaking, and walk the steps until it fails.",
  },
];

export const SYSTEM_PROMPT = `You are a senior workflow optimizer.

Ground every claim in the user's messages and files. Label inferences. Never invent hours, dollars, headcount, tools, or SLAs that were not in the material. If volume or constraints are missing, ask one precise question instead of fabricating. Be specific: name the step, the handoff, and the failure mode. No generic "consider RPA" filler. Do not name a vendor the user did not mention.

The user message may start with [Mapper intent: create|improve|diagnose]. Honor that mode:
- create: propose a new workflow the user can start using (fill proposedSteps). Do not only list friction on an empty process.
- improve: tighten the current process they already run.
- diagnose: find what is slow, error-prone, or stuck.

Reply in 2–5 short spoken sentences. Do not restate the structured brief in chat; the product shows it on a canvas. Point the user to that brief. When you can analyze the process, append exactly one fenced block tagged workflow-report with this JSON:
{"intent":"improve","summary":"spoken paragraph","meaning":"1-3 plain sentences: what this brief is telling you to do","steps":["ordered current steps"],"proposedSteps":["recommended workflow when creating or refining"],"friction":[{"step":"","issue":"","evidence":"","kind":"fact"}],"bottlenecks":[{"step":"","issue":"","evidence":"","kind":"fact"}],"opportunities":[{"title":"","rationale":"","evidence":"","kind":"fact"}],"doThis":[{"action":"this-week move","why":"why it matters","example":"concrete artifact: checklist item, formula, message, or column name"}],"automations":[{"title":"","how":"","example":"worked example","tools":["spreadsheet"],"effort":"this week"}],"firstMove":"one concrete next action","assumptions":[],"missing":[],"question":null,"hours":{"annualManual":null,"basis":null,"kind":"fact"}}
kind must be "fact" or "inference". effort must be "this week" or "next". Tools: only names present in the material, or generic "spreadsheet / email / checklist". Prefer validation at source, a template, an exception alert, a shared checklist, or a due-date reminder. Include a worked example. If you must clarify first, omit the fenced block.`;

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

export interface DoThisItem {
  action: string;
  why: string;
  example: string;
}

export interface AutomationItem {
  title: string;
  how: string;
  example: string;
  tools: string[];
  effort: "this week" | "next";
}

export interface AgentReport {
  intent: WorkflowIntent;
  summary: string;
  meaning: string;
  steps: string[];
  proposedSteps: string[];
  friction: EvidenceItem[];
  bottlenecks: EvidenceItem[];
  opportunities: OpportunityItem[];
  doThis: DoThisItem[];
  automations: AutomationItem[];
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
const KIND_PREFIX = /^\s*_?(fact|inference|assumption)\s*:\s*/i;

export function stripKindPrefix(text: string): string {
  return text.replace(KIND_PREFIX, "").trim();
}

export function kindLabel(kind: EvidenceKind): "fact" | "assumption" {
  return kind === "inference" ? "assumption" : "fact";
}

export function parseWorkflowIntent(value: unknown): WorkflowIntent | null {
  if (value === "create" || value === "improve" || value === "diagnose") return value;
  return null;
}

export function stripIntentToken(text: string): string {
  return text.replace(INTENT_TOKEN_RE, "").trim();
}

export function parseIntentToken(text: string): WorkflowIntent | null {
  const match = text.match(INTENT_TOKEN_RE);
  return match ? parseWorkflowIntent(match[1].toLowerCase()) : null;
}

export function intentLine(intent: WorkflowIntent): string {
  return `[Mapper intent: ${intent}]`;
}

export function inferWorkflowIntent(text: string, selected?: WorkflowIntent | null): WorkflowIntent {
  if (selected) return selected;
  const lower = text.toLowerCase();
  if (
    /\b(from scratch|new process|new workflow|need a process|design a process|stand up a process|i need a (new )?process)\b/.test(
      lower,
    )
  ) {
    return "create";
  }
  if (
    /\b(slow|stuck|error-prone|what'?s (going )?wrong|breaking|failing|blocked|keeps failing|diagnose|where it fails)\b/.test(
      lower,
    )
  ) {
    return "diagnose";
  }
  return "improve";
}

export function briefKicker(intent: WorkflowIntent): string {
  if (intent === "create") return "New workflow";
  if (intent === "diagnose") return "What's going wrong";
  return "Optimization brief";
}

export function reportMeaning(report: AgentReport): string {
  if (report.meaning.trim()) return report.meaning;
  const friction = stripKindPrefix(report.friction[0]?.issue ?? "");
  const move = stripKindPrefix(report.firstMove);
  if (report.intent === "create") {
    return move
      ? `Stand up the proposed process, starting with: ${lowerFirst(move)}`
      : "Use the proposed steps as the new process, then take one first move this week.";
  }
  if (friction && move) {
    return `The process is getting stuck at ${lowerFirst(friction)}. Do this first: ${lowerFirst(move)}`;
  }
  if (move) return `Do this first: ${move}`;
  return "Read the brief, then take the first named move on the process you shared.";
}

export function stepIsFriction(report: AgentReport, step: string): boolean {
  const lower = step.toLowerCase();
  return [...report.friction, ...report.bottlenecks].some((item) => {
    const named = item.step.toLowerCase();
    return lower === named || lower.includes(named) || named.includes(lower);
  });
}

export function stepCaption(report: AgentReport, step: string): string {
  const lower = step.toLowerCase();
  const match = [...report.friction, ...report.bottlenecks].find((item) => {
    const named = item.step.toLowerCase();
    return lower === named || lower.includes(named) || named.includes(lower);
  });
  return match ? stripKindPrefix(match.issue) : "";
}

export function factsAndAssumptions(report: AgentReport): { facts: string[]; assumptions: string[] } {
  const facts: string[] = [];
  const assumptions: string[] = [];
  const push = (kind: EvidenceKind, text: string) => {
    const clean = stripKindPrefix(text);
    if (!clean) return;
    (kind === "inference" ? assumptions : facts).push(clean);
  };
  if (report.hours.annualManual != null && report.hours.basis) {
    push(
      report.hours.kind,
      `The workflow volume works out to ${formatHours(report.hours.annualManual)} hours/year (${report.hours.basis}).`,
    );
  }
  for (const item of report.friction) push(item.kind, item.evidence);
  for (const item of report.bottlenecks) push(item.kind, item.evidence);
  for (const item of report.assumptions) assumptions.push(stripKindPrefix(item));
  return { facts, assumptions };
}

export function formatHours(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

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
      intent: parseWorkflowIntent(data.intent) ?? "improve",
      summary: typeof data.summary === "string" ? data.summary.trim() : "",
      meaning: typeof data.meaning === "string" ? data.meaning.trim() : "",
      steps,
      proposedSteps: asStringArray(data.proposedSteps),
      friction,
      bottlenecks: asEvidence(data.bottlenecks),
      opportunities: asOpportunities(data.opportunities),
      doThis: asDoThis(data.doThis),
      automations: asAutomations(data.automations),
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
  const doThis = report.doThis
    .map((item, index) => `${index + 1}. **${item.action}** — ${item.why}${item.example ? `\n   Example: ${item.example}` : ""}`)
    .join("\n");
  const automations = report.automations
    .map((item) => {
      const tools = item.tools.length ? ` Tools: ${item.tools.join(", ")}.` : "";
      return `- **${item.title}** (${item.effort}) — ${item.how}\n  Example: ${item.example}${tools}`;
    })
    .join("\n");
  const meaning = reportMeaning(report);
  const proposed = report.proposedSteps.length ? report.proposedSteps : report.intent === "create" ? report.steps : [];
  const workflowHeading = report.intent === "create" ? "Proposed workflow" : "Current steps";
  const workflowSteps = report.intent === "create" ? proposed : report.steps;

  return `# ${briefKicker(report.intent)}

${report.summary}

## What this is telling you
${meaning}

${hoursLine}

## This week
${doThis || `- ${report.firstMove || "No this-week move was named."}`}

## Automation options
${automations || "- None named from the material."}

## ${workflowHeading}
${workflowSteps.map((step, index) => `${index + 1}. ${step}`).join("\n") || "- Not enough ordered steps were provided."}

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

function lowerFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toLowerCase() + value.slice(1);
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
        issue: stripKindPrefix(String(row.issue ?? "")),
        evidence: stripKindPrefix(String(row.evidence ?? "")) || "From the provided workflow.",
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
        title: stripKindPrefix(String(row.title ?? "")),
        rationale: stripKindPrefix(String(row.rationale ?? "")),
        evidence: stripKindPrefix(String(row.evidence ?? "")) || "From the provided workflow.",
        kind: (row.kind === "inference" ? "inference" : "fact") as EvidenceKind,
      };
    })
    .filter((item) => item.title && item.rationale);
}

function asDoThis(value: unknown): DoThisItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as Partial<DoThisItem>;
      return {
        action: String(row.action ?? "").trim(),
        why: String(row.why ?? "").trim(),
        example: String(row.example ?? "").trim(),
      };
    })
    .filter((item) => item.action);
}

function asAutomations(value: unknown): AutomationItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as {
        title?: unknown;
        how?: unknown;
        example?: unknown;
        tools?: unknown;
        effort?: unknown;
      };
      const tools = Array.isArray(row.tools)
        ? asStringArray(row.tools)
        : typeof row.tools === "string"
          ? row.tools.split(/[,/]|·/).map((part: string) => part.trim()).filter(Boolean)
          : [];
      const effort: AutomationItem["effort"] = row.effort === "next" ? "next" : "this week";
      return {
        title: String(row.title ?? "").trim(),
        how: String(row.how ?? "").trim(),
        example: String(row.example ?? "").trim(),
        tools,
        effort,
      };
    })
    .filter((item) => item.title && item.how);
}
