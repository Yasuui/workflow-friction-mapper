import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import { AGENT_GREETING, BRIEF_MARKDOWN_FILENAME, BRIEF_PDF_FILENAME, parseReportJson, splitAgentOutput } from "../lib/agent-protocol.ts";
import { extractFacts } from "../lib/workflow-intake.ts";
import { analyzeWorkflow } from "../lib/workflow-analysis.ts";

test("landing greeting explains how to use the agent", () => {
  assert.match(AGENT_GREETING, /Paste a workflow/);
  assert.match(AGENT_GREETING, /starter/);
  assert.match(AGENT_GREETING, /inventing numbers/i);
});

test("optimize API route exists and prefers gpt-5-mini", async () => {
  const route = await readFile(new URL("../app/api/optimize/route.ts", import.meta.url), "utf8");
  await access(new URL("../app/api/optimize/route.ts", import.meta.url));
  assert.match(route, /OPENAI_API_KEY/);
  assert.match(route, /gpt-5-mini/);
  assert.match(route, /gpt-4.1-mini/);
  assert.match(route, /streamDemo/);
  assert.match(route, /streamText/);
});

test("brief downloads use the public filenames", async () => {
  assert.equal(BRIEF_MARKDOWN_FILENAME, "workflow-optimization-brief.md");
  assert.equal(BRIEF_PDF_FILENAME, "workflow-optimization-brief.pdf");
  const exporter = await readFile(new URL("../lib/brief-export.ts", import.meta.url), "utf8");
  assert.match(exporter, /appendChild/);
  assert.match(exporter, /revokeObjectURL/);
});

test("volume is extracted only when stated", () => {
  const missing = extractFacts("When a request arrives, review the form. Then assign an owner.");
  assert.equal(missing.minutesPerRun, null);
  assert.equal(missing.runsPerWeek, null);
  const stated = extractFacts("Export requests from Excel. 30 minutes, 10 times a week, 2 handoffs.");
  assert.equal(stated.minutesPerRun, 30);
  assert.equal(stated.runsPerWeek, 10);
  const hours = analyzeWorkflow({
    description: "Export requests from Excel. Check required fields.",
    minutesPerRun: stated.minutesPerRun,
    runsPerWeek: stated.runsPerWeek,
    handoffs: 2,
    sensitivity: "internal",
  }).annualManualHours;
  assert.equal(hours, 260);
});

test("demo agent does not apply intake defaults", async () => {
  const source = await readFile(new URL("../lib/demo-agent.ts", import.meta.url), "utf8");
  assert.match(source, /extractFacts/);
  assert.doesNotMatch(source, /INTAKE_DEFAULTS/);
});

test("report JSON parser accepts a workflow-report object", () => {
  const report = parseReportJson(JSON.stringify({
    summary: "A short brief.",
    steps: ["Export", "Review"],
    friction: [{ step: "Export", issue: "Manual cleanup", evidence: "Excel", kind: "fact" }],
    bottlenecks: [],
    opportunities: [{ title: "Validate rows", rationale: "Catch missing fields", evidence: "Excel", kind: "fact" }],
    firstMove: "Validate incoming rows at the source.",
    assumptions: [],
    missing: [],
    question: null,
    hours: { annualManual: null, basis: null, kind: "fact" },
  }));
  assert.ok(report);
  assert.match(report.firstMove, /Validate/);
  const fenced = "Hello.\n\n```workflow-report\n{\"summary\":\"A short brief.\",\"steps\":[\"Export\"],\"friction\":[],\"bottlenecks\":[],\"opportunities\":[],\"firstMove\":\"Ship a checklist.\",\"assumptions\":[],\"missing\":[],\"question\":null,\"hours\":{\"annualManual\":null,\"basis\":null,\"kind\":\"fact\"}}\n```";
  const parsed = splitAgentOutput(fenced);
  assert.equal(parsed.prose, "Hello.");
  assert.ok(parsed.report);
});

test("copy no longer claims fully browser-local product", async () => {
  const files = ["../README.md", "../PRIVACY.md", "../app/layout.tsx", "../app/opengraph-image.tsx", "../components/WorkflowStudio.tsx", "../components/WorkflowChat.tsx"];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /entirely in your browser/i);
    assert.doesNotMatch(source, /No tracking/);
    assert.doesNotMatch(source, /No API requests or AI model calls/);
  }
});
