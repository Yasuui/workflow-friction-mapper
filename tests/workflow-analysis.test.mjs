import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeWorkflow,
  extractSteps,
} from "../lib/workflow-analysis.ts";

const representativeWorkflow = {
  description:
    "Export requests from Excel. Then review each row and write meeting notes. Send reminders to Teams and monitor the IT case until it closes.",
  minutesPerRun: 30,
  runsPerWeek: 10,
  handoffs: 3,
  sensitivity: "internal",
};

test("extractSteps turns a workflow description into concise ordered steps", () => {
  assert.deepEqual(
    extractSteps("Collect the form. Then review it; notify the owner -> archive the case."),
    [
      "Collect the form",
      "Review it",
      "Notify the owner",
      "Archive the case",
    ],
  );
});

test("analyzeWorkflow keeps scores and estimates within explainable bounds", () => {
  const report = analyzeWorkflow(representativeWorkflow);

  assert.ok(report.frictionScore >= 0 && report.frictionScore <= 100);
  assert.ok(report.automationReadiness >= 0 && report.automationReadiness <= 100);
  assert.equal(report.annualManualHours, 260);
  assert.ok(report.potentialHoursReclaimed > 0);
  assert.ok(report.potentialHoursReclaimed <= report.annualManualHours);
  assert.match(report.estimateNote, /illustrative/i);
  assert.ok(report.scoreDrivers.some((driver) => /handoff/i.test(driver)));
  assert.ok(report.scoreDrivers.some((driver) => /hours|minutes/i.test(driver)));
  assert.equal(report.validationChecks.length, 3);
  assert.ok(report.validationChecks.some((check) => /cycle time/i.test(check)));
});

test("analyzeWorkflow detects workflow-specific automation candidates", () => {
  const report = analyzeWorkflow(representativeWorkflow);
  const ids = report.opportunities.map((opportunity) => opportunity.id);

  assert.ok(ids.includes("data-validation"));
  assert.ok(ids.includes("capture-summarize"));
  assert.ok(ids.includes("reminder-routing"));
  assert.ok(ids.includes("case-monitoring"));
  assert.match(report.firstMove, /start/i);
  assert.match(report.firstMove, /measure/i);
});

test("analyzeWorkflow adds strict safeguards for sensitive inputs", () => {
  const report = analyzeWorkflow({
    ...representativeWorkflow,
    description: "Review personal records and approve the final case decision.",
    sensitivity: "sensitive",
  });

  assert.ok(report.safeguards.some((item) => /sensitive|personal/i.test(item)));
  assert.ok(report.safeguards.some((item) => /human/i.test(item)));
  assert.ok(report.safeguards.some((item) => /log|audit/i.test(item)));
});

test("analyzeWorkflow returns useful generic candidates when no keyword matches", () => {
  const report = analyzeWorkflow({
    description: "Prepare the weekly operating review for the team.",
    minutesPerRun: 20,
    runsPerWeek: 1,
    handoffs: 1,
    sensitivity: "public",
  });

  assert.ok(report.opportunities.length >= 3);
  assert.ok(report.steps.length >= 1);
  assert.ok(report.summary.length > 40);
});
