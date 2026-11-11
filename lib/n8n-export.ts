import type { AgentReport } from "./agent-protocol.ts";

/**
 * Turns a brief's build plan into an importable n8n workflow scaffold.
 *
 * The scaffold is deliberately inert: a Manual Trigger, one No Operation node per step (named
 * by what the step does) and sticky notes for inputs, review, failure handling and the launch
 * tests. Nothing calls an external system until a person swaps a placeholder for a real node,
 * so importing it can never send an email, write a row or spend money.
 */

export type StepKind = "fetch" | "validate" | "route" | "notify" | "write" | "review" | "manual";

// The action is the step's leading verb: "Email the approved invoice" notifies, it does not
// review, and "Record the email" writes, it does not notify. Words later in the sentence only
// decide when the step does not open with a known verb ("A new case enters the queue").
const VERB_KIND: Array<[StepKind, RegExp]> = [
  ["review", /^(approve|review|confirm|decide|escalate|sign)\b/],
  ["validate", /^(check|validate|verify|dedupe|deduplicate|clean|compare|reconcile|remove|match|test)\b/],
  ["notify", /^(send|notify|remind|email|message|alert|ping|tell|inform|share|reply)\b/],
  ["route", /^(assign|route|triage|prioriti[sz]e|forward|hand|delegate|allocate)\b/],
  ["fetch", /^(export|import|download|pull|collect|receive|gather|open|read|extract|fetch|get|scan)\b/],
  ["write", /^(add|update|create|record|log|move|close|file|save|write|post|enter|fill|upload|archive|mark|set)\b/],
];

// Fallback scan. Past participles used as modifiers ("approved", "reviewed", "sent") are not actions.
const KIND_RULES: Array<[StepKind, RegExp]> = [
  ["review", /\b(approve(?!d)|approval|sign[- ]?off|confirm(?!ed)|review(?!ed)|decide|escalat(?!ed))/i],
  ["validate", /\b(check|validat|verify|dedup|duplicate|required field|clean|compare|reconcil)/i],
  ["notify", /\b(send(?!t)|notify|remind|email|message|alert|ping)/i],
  ["route", /\b(assign|route|triage|priorit|forward|hand ?off)/i],
  ["fetch", /\b(export|import|download|pull|collect|receive|arrive|enter|open|read|extract)/i],
  ["write", /\b(add|update|create|record|log|move|close|file|save|write|post)/i],
];

const LEAD_FILLER = /^(?:(?:then|and|next|finally|first|we|i|they|you|please|someone|the team|the owner|manually|also)\b[\s,]*)+/;

export const STEP_KIND_LABEL: Record<StepKind, string> = {
  fetch: "Fetch",
  validate: "Validate",
  route: "Route",
  notify: "Notify",
  write: "Write",
  review: "Human review",
  manual: "Manual",
};

/** What swaps in for the placeholder once the team picks its tools. Generic on purpose. */
const KIND_HINT: Record<StepKind, string> = {
  fetch: "Replace with the source node (spreadsheet, form, inbox, HTTP Request).",
  validate: "Replace with an IF or Code node that checks the rule, plus a branch for failures.",
  route: "Replace with a Switch node keyed on the field that decides the owner.",
  notify: "Replace with the messaging node your team already uses.",
  write: "Replace with the node that writes to the system of record.",
  review: "Replace with a send-and-wait approval or a Wait node resumed by the reviewer.",
  manual: "Keep manual until the step is written down as a rule.",
};

export function classifyStep(step: string): StepKind {
  const lead = step.trim().toLowerCase().replace(/^\d+[.)]\s*/, "").replace(LEAD_FILLER, "");
  for (const [kind, verb] of VERB_KIND) if (verb.test(lead)) return kind;
  for (const [kind, rule] of KIND_RULES) if (rule.test(step)) return kind;
  return "manual";
}

type N8nNode = {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  notes?: string;
  notesInFlow?: boolean;
};

export type N8nWorkflow = {
  name: string;
  nodes: N8nNode[];
  connections: Record<string, { main: Array<Array<{ node: string; type: "main"; index: number }>> }>;
  settings: { executionOrder: "v1" };
  pinData: Record<string, never>;
  meta: { templateCredsSetupCompleted: false; generatedBy: string };
};

const NODE_GAP = 260;
const MAX_NAME = 60;

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Strips the "Kind: " prefix the demo plan adds, so the node name is not doubled. */
function stepText(step: string): string {
  return step.replace(/^(fetch|validate|route|notify|write|human review|manual)\s*:\s*/i, "");
}

export function reportToN8n(report: AgentReport, title = "Workflow Friction Mapper scaffold"): N8nWorkflow {
  const plan = report.buildPlan;
  const steps = plan?.steps.length ? plan.steps : report.intent === "create" ? report.proposedSteps : report.steps;
  const used = new Set<string>();
  const unique = (base: string) => {
    let name = base;
    for (let n = 2; used.has(name); n += 1) name = `${base} (${n})`;
    used.add(name);
    return name;
  };

  const nodes: N8nNode[] = [];
  const order: string[] = [];
  const trigger = unique("Start manually (replace with real trigger)");
  nodes.push({
    id: "trigger",
    name: trigger,
    type: "n8n-nodes-base.manualTrigger",
    typeVersion: 1,
    position: [0, 0],
    parameters: {},
    notes: plan?.trigger || "Needs confirmation: what starts this workflow?",
    notesInFlow: true,
  });
  order.push(trigger);

  steps.forEach((raw, index) => {
    const text = stepText(raw);
    const kind = classifyStep(text);
    const name = unique(clip(`${index + 1}. ${STEP_KIND_LABEL[kind]} · ${text}`, MAX_NAME));
    nodes.push({
      id: `step-${index + 1}`,
      name,
      type: "n8n-nodes-base.noOp",
      typeVersion: 1,
      position: [NODE_GAP * (index + 1), 0],
      parameters: {},
      notes: `${text}\n\n${KIND_HINT[kind]}`,
      notesInFlow: true,
    });
    order.push(name);
  });

  const width = NODE_GAP * (steps.length + 1);
  const note = (id: string, x: number, y: number, w: number, h: number, content: string, color: number) =>
    nodes.push({ id, name: unique(id), type: "n8n-nodes-base.stickyNote", typeVersion: 1, position: [x, y], parameters: { content, width: w, height: h, color } });

  const bullet = (items: string[]) => (items.length ? items.map((item) => `- ${item}`).join("\n") : "- Needs confirmation");
  note("Read me", -40, -360, Math.max(520, width), 300, [
    `## ${title}`,
    "Proposed, not running. Every step is a placeholder (No Operation) so importing this sends nothing.",
    `**Inputs:** ${plan?.inputs || "Needs confirmation"}`,
    `**Human review:** ${plan?.approval || "Needs confirmation"}`,
    `**First move:** ${report.firstMove || "Needs confirmation"}`,
  ].join("\n\n"), 4);
  note("Failure handling", -40, 180, 420, 240, `## Failure handling\n${plan?.failure || "Needs confirmation"}\n\nSet an Error Workflow in this workflow's settings before activating.`, 3);
  note("Test before launch", 420, 180, 460, 240, `## Test before launch\n${bullet(plan?.tests ?? [])}`, 5);

  const connections: N8nWorkflow["connections"] = {};
  for (let index = 0; index < order.length - 1; index += 1) {
    connections[order[index]] = { main: [[{ node: order[index + 1], type: "main", index: 0 }]] };
  }

  return {
    name: clip(title, 120),
    nodes,
    connections,
    settings: { executionOrder: "v1" },
    pinData: {},
    meta: { templateCredsSetupCompleted: false, generatedBy: "workflow-friction-mapper" },
  };
}
