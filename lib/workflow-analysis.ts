export type Sensitivity = "public" | "internal" | "sensitive";

export interface WorkflowInput {
  description: string;
  minutesPerRun: number;
  runsPerWeek: number;
  handoffs: number;
  sensitivity: Sensitivity;
}

export interface AutomationOpportunity {
  id: string;
  title: string;
  rationale: string;
  impact: "Foundation" | "Quick win" | "High leverage";
}

export interface WorkflowReport {
  frictionScore: number;
  automationReadiness: number;
  annualManualHours: number;
  potentialHoursReclaimed: number;
  estimateNote: string;
  summary: string;
  steps: string[];
  opportunities: AutomationOpportunity[];
  scoreDrivers: string[];
  validationChecks: string[];
  safeguards: string[];
  firstMove: string;
}

interface OpportunityRule extends AutomationOpportunity {
  terms: string[];
}

const opportunityRules: OpportunityRule[] = [
  {
    id: "data-validation",
    title: "Structure and validate incoming data",
    rationale:
      "Normalize spreadsheet or copied inputs before they enter the workflow, then flag incomplete records for review.",
    impact: "Foundation",
    terms: ["excel", "spreadsheet", "csv", "copy", "paste", "row", "data"],
  },
  {
    id: "capture-summarize",
    title: "Capture and summarize once",
    rationale:
      "Create one trusted set of notes and actions instead of asking people to re-enter the same meeting context.",
    impact: "Quick win",
    terms: ["meeting", "notes", "minutes", "summary", "transcribe"],
  },
  {
    id: "reminder-routing",
    title: "Trigger reminders from state",
    rationale:
      "Send the next reminder only when an owner, due date, or workflow state requires attention.",
    impact: "Quick win",
    terms: ["reminder", "follow up", "follow-up", "notify", "message", "teams"],
  },
  {
    id: "case-monitoring",
    title: "Monitor cases by exception",
    rationale:
      "Watch status and service thresholds automatically, then surface only cases that need a human decision.",
    impact: "High leverage",
    terms: ["case", "ticket", "monitor", "status", "queue", "incident"],
  },
  {
    id: "onboarding-orchestration",
    title: "Orchestrate onboarding milestones",
    rationale:
      "Sequence learning, access, and check-ins from a single onboarding state instead of separate manual reminders.",
    impact: "High leverage",
    terms: ["onboarding", "new hire", "course", "training", "learning"],
  },
  {
    id: "approval-gate",
    title: "Design a human approval gate",
    rationale:
      "Let automation prepare evidence and recommendations while a named person keeps final authority.",
    impact: "Foundation",
    terms: ["approve", "approval", "review", "decision", "sign off", "sign-off"],
  },
];

const fallbackOpportunities: AutomationOpportunity[] = [
  {
    id: "normalize-inputs",
    title: "Normalize the intake",
    rationale:
      "Use one consistent entry format so downstream steps receive complete, comparable information.",
    impact: "Foundation",
  },
  {
    id: "route-work",
    title: "Route work from clear triggers",
    rationale:
      "Define the state change, owner, and service expectation that should move each item forward.",
    impact: "Quick win",
  },
  {
    id: "measure-exceptions",
    title: "Measure exceptions first",
    rationale:
      "Track delays, rework, and escalations before automating so the result can be evaluated honestly.",
    impact: "Foundation",
  },
];

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function roundHours(value: number): number {
  return Math.round(value * 10) / 10;
}

export function extractSteps(description: string): string[] {
  const steps = description
    .split(/(?:\r?\n|\s*->\s*|[.;]+|\bthen\b)/i)
    .map((step) => step.replace(/^[-•\d)\s]+/, "").trim())
    .filter((step) => step.length > 1)
    .map((step) => step.charAt(0).toUpperCase() + step.slice(1));

  return steps.slice(0, 6);
}

function detectOpportunities(description: string): AutomationOpportunity[] {
  const normalized = description.toLowerCase();
  const matches = opportunityRules
    .filter((rule) => rule.terms.some((term) => normalized.includes(term)))
    .map((rule) => ({
      id: rule.id,
      title: rule.title,
      rationale: rule.rationale,
      impact: rule.impact,
    }));

  const combined = [...matches];
  for (const fallback of fallbackOpportunities) {
    if (combined.length >= 3) break;
    if (!combined.some((opportunity) => opportunity.id === fallback.id)) {
      combined.push(fallback);
    }
  }

  return combined.slice(0, 5);
}

export function analyzeWorkflow(input: WorkflowInput): WorkflowReport {
  const description = input.description.trim();
  const opportunities = detectOpportunities(description);
  const matchedSignals = opportunityRules.filter((rule) =>
    rule.terms.some((term) => description.toLowerCase().includes(term)),
  ).length;
  const volumePressure = Math.min(
    24,
    (Math.max(0, input.minutesPerRun) * Math.max(0, input.runsPerWeek)) / 20,
  );
  const sensitivityPressure =
    input.sensitivity === "sensitive" ? 12 : input.sensitivity === "internal" ? 5 : 0;

  const frictionScore = clamp(
    10 + input.handoffs * 8 + volumePressure + matchedSignals * 4 + sensitivityPressure,
  );
  const automationReadiness = clamp(
    42 + matchedSignals * 8 - input.handoffs * 2 - sensitivityPressure / 2,
  );
  const annualManualHours = roundHours(
    (Math.max(0, input.minutesPerRun) / 60) * Math.max(0, input.runsPerWeek) * 52,
  );
  const potentialRate = Math.min(
    0.68,
    Math.max(
      0.22,
      0.27 + matchedSignals * 0.07 - (input.sensitivity === "sensitive" ? 0.08 : 0),
    ),
  );
  const potentialHoursReclaimed = roundHours(annualManualHours * potentialRate);
  const safeguards = [
    "Keep a named human accountable for exceptions and final decisions.",
    "Log each automated action, source, and outcome so the process can be audited.",
  ];

  if (input.sensitivity === "sensitive") {
    safeguards.unshift(
      "Keep sensitive or personal data out of unapproved tools; minimize fields and test with synthetic records first.",
    );
  } else if (input.sensitivity === "internal") {
    safeguards.unshift(
      "Use approved internal tools and share only the minimum fields required for the task.",
    );
  }

  if (/excel|spreadsheet|csv|row|data/i.test(description)) {
    safeguards.push(
      "Validate column names, required values, and data types before any automated handoff.",
    );
  }

  if (/ai|model|summary|report|recommend/i.test(description)) {
    safeguards.push(
      "Test generated outputs against a small reference set and route uncertain results to human review.",
    );
  }

  const steps = extractSteps(description);
  const firstOpportunity = opportunities[0];
  const scoreDrivers = [
    `${input.minutesPerRun} minutes × ${input.runsPerWeek} runs per week equals about ${annualManualHours} manual hours per year.`,
    `${input.handoffs} handoff${input.handoffs === 1 ? "" : "s"} can add waiting, ownership gaps, or rework.`,
    `${matchedSignals} repeatable automation signal${matchedSignals === 1 ? " was" : "s were"} found in the workflow description.`,
  ];

  if (input.sensitivity !== "public") {
    scoreDrivers.push(
      `${input.sensitivity === "sensitive" ? "Sensitive" : "Internal"} data increases the need for approved tools, minimum fields, and review gates.`,
    );
  }

  const validationChecks = [
    "Measure median cycle time for 10–20 runs before and after the pilot.",
    "Count exceptions, rework, and missed handoffs; automation should reduce, not hide, them.",
    "Review a sample of outputs with the process owner and record clear pass/fail criteria.",
  ];

  return {
    frictionScore,
    automationReadiness,
    annualManualHours,
    potentialHoursReclaimed,
    estimateNote:
      "Illustrative, directional scenario based only on the time and frequency entered—not a forecast. Validate every estimate with a measured baseline.",
    summary: `This workflow shows ${frictionScore >= 70 ? "high" : frictionScore >= 45 ? "meaningful" : "manageable"} friction and ${automationReadiness >= 65 ? "strong" : "developing"} automation readiness. Focus first on a bounded step with clear inputs, ownership, and review.`,
    steps: steps.length > 0 ? steps : ["Describe the current workflow"],
    opportunities,
    scoreDrivers,
    validationChecks,
    safeguards,
    firstMove: `Start with ${firstOpportunity.title.toLowerCase()}. Run it beside the current process, measure exceptions, and expand only after the result is reliable.`,
  };
}
