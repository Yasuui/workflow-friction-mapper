import type { UIMessage } from "ai";
import { extractSteps } from "./workflow-analysis.ts";
import { extractFacts } from "./workflow-intake.ts";
import {
  inferWorkflowIntent,
  parseIntentToken,
  parseWorkflowIntent,
  stripIntentToken,
  type AgentReport,
  type AutomationItem,
  type DoThisItem,
  type EvidenceItem,
  type OpportunityItem,
  type WorkflowIntent,
} from "./agent-protocol.ts";

const MAX_FILE_CHARS = 12_000;

export async function collectUserMaterial(
  messages: UIMessage[],
  extractPdf?: (dataUrl: string) => Promise<string>,
): Promise<string> {
  const chunks: string[] = [];
  for (const message of messages) {
    if (message.role !== "user") continue;
    for (const part of message.parts) {
      if (part.type === "text") {
        const text = stripIntentToken(part.text);
        if (text && !/^please review the attached file/i.test(text)) chunks.push(text);
      }
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

export function readMaterialIntent(messages: UIMessage[], fallback?: unknown): WorkflowIntent {
  const hinted = parseWorkflowIntent(fallback);
  if (hinted) return hinted;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") continue;
    for (const part of message.parts) {
      if (part.type === "text") {
        const token = parseIntentToken(part.text);
        if (token) return token;
      }
    }
  }
  return "improve";
}

export function buildDemoReply(material: string, intentHint?: WorkflowIntent | null): string {
  const token = parseIntentToken(material);
  const text = stripIntentToken(material);
  if (text.length < 24) {
    if ((intentHint ?? token) === "create") {
      return "I can draft a new workflow once I have the job, what kicks it off, and who touches it after you.";
    }
    return "I need the actual process — a trigger and the steps in order. Type it, attach a .txt, .md, .csv, .json, or .pdf, or pick a sample.";
  }

  const intent = intentHint ?? token ?? inferWorkflowIntent(text);
  const steps = extractSteps(text);
  const usableSteps = steps.length ? steps : [text.split(/[.?\n]/)[0]?.trim() || "The current process you described"];
  const facts = extractFacts(text);
  const friction = detectFriction(text, usableSteps, intent);
  const bottlenecks = detectBottlenecks(text, usableSteps, friction);
  const opportunities = detectOpportunities(text, usableSteps);
  const automations = detectAutomations(text, intent);
  const doThis = detectDoThis(text, intent, automations);
  const proposedSteps = buildProposedSteps(text, usableSteps, intent);
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
    doThis[0]
      ? `${doThis[0].action}. ${doThis[0].example ? `Example: ${doThis[0].example}` : doThis[0].why}`
      : opportunities[0]
        ? `Start with ${opportunities[0].title.toLowerCase()}. Run it beside the current process and measure exceptions before expanding.`
        : `Write the ${usableSteps[0].toLowerCase()} step as a checklist with a named owner, then measure one week of exceptions.`;

  const meaning = buildMeaning(text, intent, friction, firstMove, proposedSteps);
  const summary = annual
    ? `This process has ${usableSteps.length} visible steps and ${friction.length} friction points I can name from your description. From the volume you stated, that is about ${annual} manual hours per year. First move: ${firstMove}`
    : `This process has ${usableSteps.length} visible steps and ${friction.length} friction points I can name from your description. I did not estimate hours because volume was not stated. First move: ${firstMove}`;

  const report: AgentReport = {
    intent,
    summary,
    meaning,
    steps: usableSteps,
    proposedSteps,
    friction,
    bottlenecks,
    opportunities,
    doThis,
    automations,
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

  const follow = bottlenecks[0] && bottlenecks[0].issue !== friction[0]?.issue
    ? bottlenecks[0].issue
    : friction[1]?.issue;
  let spoken = spokenFor(intent, friction[0], follow);
  if (question) spoken = `${spoken}\n\n${question}`;

  return `${spoken}\n\n\`\`\`workflow-report\n${JSON.stringify(report, null, 2)}\n\`\`\``;
}

function spokenFor(intent: WorkflowIntent, first: EvidenceItem | undefined, follow: string | undefined): string {
  if (intent === "create") {
    return "I’ve proposed a new workflow from the job you described. The brief on the right is the process to stand up, plus this week’s first moves.";
  }
  if (intent === "diagnose") {
    return first
      ? `The break is ${lowerFirst(first.issue)}. What’s going wrong is on the right, with this-week moves and a couple of automation options.`
      : "I’ve mapped what’s going wrong from what you shared. The brief is on the right.";
  }
  return first
    ? `The main friction is ${lowerFirst(first.issue)}${follow ? `, followed by ${lowerFirst(follow)}` : ""}. I’ve mapped the brief on the right.`
    : "I’ve mapped the current steps and a first move from what you shared. The brief is on the right.";
}

function buildMeaning(
  text: string,
  intent: WorkflowIntent,
  friction: EvidenceItem[],
  firstMove: string,
  proposedSteps: string[],
): string {
  const lower = text.toLowerCase();
  if (/excel|spreadsheet|csv|row|field|duplicate/i.test(lower)) {
    if (intent === "diagnose") {
      return "The process is stalling at intake: rows are cleaned by hand before anything can enter the case queue. Fix validation and the return path first.";
    }
    if (intent === "create") {
      return "Stand up intake so complete requests go to the queue and incomplete ones bounce with a reason. Do not start with a daily cleanup ritual.";
    }
    return "This brief is telling you to stop treating Excel cleanup as the real work. Validate required fields and duplicates on the sheet, return incomplete rows with a reason, and only let complete requests into the case queue.";
  }
  if (/meeting|notes|action items/i.test(lower)) {
    return "This brief is telling you to capture owners, actions, and due dates once, then remind only from that list — not by retyping notes after every meeting.";
  }
  if (/case|ticket|queue|monitor|status/i.test(lower) && /each day|daily|monitor/i.test(lower)) {
    return "This brief is telling you to stop polling every case every day. Watch exceptions near the deadline, and keep daily status checks off the critical path.";
  }
  if (/onboarding|new employee|course|access/i.test(lower)) {
    return "This brief is telling you to run onboarding from one shared checklist with named owners and due dates, instead of chasing courses and access in separate threads.";
  }
  if (intent === "create") {
    const first = proposedSteps[0] ? lowerFirst(proposedSteps[0]) : "a single intake";
    return `This brief is telling you to stand up a simple process that starts with ${first}, names who touches it next, and makes done visible. Take the first move this week; do not wait for a platform.`;
  }
  if (intent === "diagnose" && friction[0]) {
    return `This brief is telling you the process is breaking at ${lowerFirst(friction[0].issue)}. Fix that step before adding more work around it.`;
  }
  return `This brief is telling you to take one concrete move this week: ${lowerFirst(firstMove)}`;
}

function buildProposedSteps(text: string, steps: string[], intent: WorkflowIntent): string[] {
  if (intent !== "create") return steps;
  const trigger = inferTrigger(text);
  if (steps.length >= 4) {
    return [
      `Intake on ${trigger}: ${steps[0]}`,
      ...steps.slice(1, -1),
      `Done: ${steps[steps.length - 1]}`,
    ];
  }
  return [
    `Capture the work when it starts (${trigger})`,
    "Record the job, a named owner, and what done looks like",
    "Check required fields before anyone else is pulled in",
    "Hand off to the next person who touches it, with the outcome expected",
    "Track open items until done is visible",
    "Close the work and keep a one-line record",
  ];
}

function inferTrigger(text: string): string {
  const match = text.match(/\b(email|form|meeting|ticket|chat|slack|teams|spreadsheet|excel|request|queue)\b/i);
  return match ? match[1].toLowerCase() : "the trigger you named";
}

function detectDoThis(text: string, intent: WorkflowIntent, automations: AutomationItem[]): DoThisItem[] {
  const lower = text.toLowerCase();
  if (/excel|spreadsheet|csv|row|field|duplicate/i.test(lower)) {
    return [
      {
        action: "Add a Status column plus a duplicate flag on the export sheet",
        why: "Incomplete and duplicate rows are cleaned by hand before anything else can start.",
        example: "Status flags a blank Owner or a duplicate Request ID (COUNTIF on the ID column).",
      },
      {
        action: "Return incomplete rows with a reason and a resubmit date",
        why: "Sending rows back without naming the gap creates another loop of questions.",
        example: "Missing: <fields>. Resubmit by <date>.",
      },
      {
        action: "Move only Ready rows into the case queue",
        why: "Valid requests wait behind cleanup if every row travels together.",
        example: "Filter Status=\"Ready\" into the case queue; Status=\"Return\" stays with the owner.",
      },
    ];
  }
  if (/meeting|notes|action items/i.test(lower)) {
    return [
      {
        action: "Capture actions on one list before anyone leaves the meeting",
        why: "Rewriting notes later drops owners and dates.",
        example: "A row per action: Owner | Action | Due date | Status.",
      },
      {
        action: "Send reminders only from due dates",
        why: "Manual nudges in Teams depend on someone remembering.",
        example: "Teams message: \"<action> is due <date>. Reply done or need a new date.\"",
      },
    ];
  }
  if (/case|ticket|queue|monitor|status/i.test(lower)) {
    return [
      {
        action: "Assign owner and priority at intake, not during the daily sweep",
        why: "Unowned cases sit until someone happens to look.",
        example: "Queue columns: Owner, Priority, Due, Last update.",
      },
      {
        action: "Alert only cases near the service deadline or with no update",
        why: "Daily status checks cap throughput at polling speed.",
        example: "A \"Needs a look\" view: Due within 24 hours OR Last update > 2 days.",
      },
    ];
  }
  if (/onboarding|new employee|course|access/i.test(lower)) {
    return [
      {
        action: "Put courses and access on one shared checklist with owners",
        why: "Separate chases hide what is still missing.",
        example: "Checklist item: \"Laptop + SSO — IT — due day 2\".",
      },
      {
        action: "Remind the named owner before each due date",
        why: "Weekly completion checks arrive after the miss.",
        example: "Reminder: \"<task> for <name> is due <date>. Mark done or flag a blocker.\"",
      },
    ];
  }
  if (intent === "create") {
    return [
      {
        action: "Write the intake as a short form or checklist",
        why: "A new process fails first when the start is implied, not captured.",
        example: "Fields: Request, Owner, Due date, Done looks like.",
      },
      {
        action: "Name who touches it after you, and what they receive",
        why: "Handoffs stall when the next person has to guess.",
        example: "Handoff line: \"To: <role>. Please <action> by <date>.\"",
      },
    ];
  }
  return automations.slice(0, 2).map((item) => ({
    action: item.title,
    why: item.how,
    example: item.example,
  }));
}

function detectAutomations(text: string, _intent: WorkflowIntent): AutomationItem[] {
  const lower = text.toLowerCase();
  if (/excel|spreadsheet|csv|row|field|duplicate/i.test(lower)) {
    return [
      {
        title: "Validate at source",
        how: "Add required-field columns and a duplicate key on the sheet so cleanup happens before anyone re-exports.",
        example: "A Status column with a flag for missing Owner or a duplicate Request ID.",
        tools: namedTools(text, ["spreadsheet"]),
        effort: "this week",
      },
      {
        title: "Return with a reason",
        how: "Send incomplete rows back with the missing fields named and a resubmit date, instead of a vague bounce.",
        example: "Missing: <fields>. Resubmit by <date>.",
        tools: namedTools(text, ["email", "spreadsheet"]),
        effort: "this week",
      },
      {
        title: "Exception queue",
        how: "Only incomplete or duplicate rows go back to the owner. Complete rows enter the case queue automatically in this process.",
        example: "Filter Status=\"Ready\" into the case queue; Status=\"Return\" stays with the owner.",
        tools: namedTools(text, ["spreadsheet", "checklist"]),
        effort: "next",
      },
    ];
  }
  if (/meeting|notes|action items/i.test(lower)) {
    return [
      {
        title: "One action template",
        how: "Capture notes and actions once so nobody retypes the meeting afterward.",
        example: "Owner | Action | Due date | Status — one row per action before the meeting ends.",
        tools: namedTools(text, ["checklist"]),
        effort: "this week",
      },
      {
        title: "Due-date reminder",
        how: "Send the next nudge only when an owner or date requires it.",
        example: "Teams message: \"<action> is due <date>. Reply done or need a new date.\"",
        tools: namedTools(text, ["email", "checklist"]),
        effort: "this week",
      },
      {
        title: "Escalate overdue only",
        how: "The project lead sees items past due, not every action from the meeting.",
        example: "Daily digest: actions where Status is not Done and Due date is past.",
        tools: namedTools(text, ["email", "checklist"]),
        effort: "next",
      },
    ];
  }
  if (/case|ticket|queue|monitor|status/i.test(lower)) {
    return [
      {
        title: "Priority at intake",
        how: "Review priority and assign an owner when the case enters the queue, not during the daily sweep.",
        example: "Queue columns: Owner, Priority, Due, Last update.",
        tools: namedTools(text, ["checklist"]),
        effort: "this week",
      },
      {
        title: "Exception alert",
        how: "Notify the owner near the service deadline instead of checking every case each day.",
        example: "A \"Needs a look\" view: Due within 24 hours OR Last update older than 2 days.",
        tools: namedTools(text, ["email", "checklist"]),
        effort: "this week",
      },
      {
        title: "Close with confirmation",
        how: "Closing is a recorded confirmation, not a memory of who checked the queue.",
        example: "Close note: \"Confirmed with <name> on <date>.\"",
        tools: namedTools(text, ["checklist"]),
        effort: "next",
      },
    ];
  }
  if (/onboarding|new employee|course|access/i.test(lower)) {
    return [
      {
        title: "Shared onboarding checklist",
        how: "Sequence courses and access from one list with a named owner on each item.",
        example: "\"Laptop + SSO — IT — due day 2\" on the same checklist as \"Security course — new hire — due day 5\".",
        tools: namedTools(text, ["checklist"]),
        effort: "this week",
      },
      {
        title: "Due-date reminder",
        how: "Remind each owner before the due date instead of discovering misses in the weekly check.",
        example: "Reminder: \"<task> for <name> is due <date>. Mark done or flag a blocker.\"",
        tools: namedTools(text, ["email", "checklist"]),
        effort: "this week",
      },
      {
        title: "Escalate missing items",
        how: "Surface only open items before onboarding closes.",
        example: "Exception list: any task still Open 3 days before the close date.",
        tools: namedTools(text, ["checklist"]),
        effort: "next",
      },
    ];
  }
  return [
    {
      title: "Validate at source",
      how: "Give the first step a consistent format so later work is comparable.",
      example: "Required fields: Request, Owner, Due date, Done looks like.",
      tools: namedTools(text, ["spreadsheet", "checklist"]),
      effort: "this week",
    },
    {
      title: "Shared checklist",
      how: "Make state visible to everyone who touches the work.",
      example: "One list with Owner, Status, and Due date on every row.",
      tools: namedTools(text, ["checklist"]),
      effort: "this week",
    },
    {
      title: "Due-date reminder",
      how: "Nudge only when a date or owner requires it.",
      example: "\"<item> is due <date>. Reply done or need a new date.\"",
      tools: namedTools(text, ["email", "checklist"]),
      effort: "next",
    },
  ];
}

function namedTools(text: string, fallback: string[]): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  if (/\bexcel\b/i.test(lower)) found.push("Excel");
  if (/\bteams\b/i.test(lower)) found.push("Teams");
  if (/\bcsv\b/i.test(lower)) found.push("CSV");
  for (const extra of fallback) {
    const label = extra.toLowerCase();
    if (!["spreadsheet", "email", "checklist"].includes(label)) continue;
    if (!found.some((item) => item.toLowerCase() === label)) found.push(extra);
  }
  return found.slice(0, 3);
}

function detectFriction(text: string, steps: string[], intent: WorkflowIntent): EvidenceItem[] {
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
  if (items.length === 0 && steps.length && intent !== "create") {
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

function lowerFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toLowerCase() + value.slice(1);
}
