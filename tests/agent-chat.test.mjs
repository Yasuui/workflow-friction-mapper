import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import {
  AGENT_GREETING,
  BRIEF_MARKDOWN_FILENAME,
  BRIEF_PDF_FILENAME,
  WORKFLOW_STARTERS,
  parseReportJson,
  reportToMarkdown,
  splitAgentOutput,
  stripKindPrefix,
} from "../lib/agent-protocol.ts";
import { buildDemoReply } from "../lib/demo-agent.ts";
import { extractFacts } from "../lib/workflow-intake.ts";
import { analyzeWorkflow } from "../lib/workflow-analysis.ts";

test("landing greeting explains how to use the agent", () => {
  assert.match(AGENT_GREETING, /attach a SOP|describe the job|paste the steps/i);
  assert.match(AGENT_GREETING, /inventing numbers/i);
  assert.doesNotMatch(AGENT_GREETING, /\d+\s*hours/);
});

test("optimize API route exists and prefers gpt-5-mini", async () => {
  const route = await readFile(new URL("../app/api/optimize/route.ts", import.meta.url), "utf8");
  await access(new URL("../app/api/optimize/route.ts", import.meta.url));
  assert.match(route, /OPENAI_API_KEY/);
  assert.match(route, /gpt-5-mini/);
  assert.match(route, /gpt-4.1-mini/);
  assert.match(route, /streamDemo/);
  assert.match(route, /streamText/);
  assert.match(route, /intent/);
});

test("brief downloads use the public filenames", async () => {
  assert.equal(BRIEF_MARKDOWN_FILENAME, "workflow-optimization-brief.md");
  assert.equal(BRIEF_PDF_FILENAME, "workflow-optimization-brief.pdf");
  const exporter = await readFile(new URL("../lib/brief-export.ts", import.meta.url), "utf8");
  assert.match(exporter, /showSaveFilePicker/);
  assert.match(exporter, /suggestedName: filename/);
  assert.doesNotMatch(exporter, /createObjectURL/);
  assert.doesNotMatch(exporter, /window\.open/);
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
  assert.equal(report.intent, "improve");
  assert.equal(report.meaning, "");
  assert.deepEqual(report.doThis, []);
  assert.deepEqual(report.automations, []);
  assert.deepEqual(report.proposedSteps, []);
  const fenced = "Hello.\n\n```workflow-report\n{\"summary\":\"A short brief.\",\"steps\":[\"Export\"],\"friction\":[],\"bottlenecks\":[],\"opportunities\":[],\"firstMove\":\"Ship a checklist.\",\"assumptions\":[],\"missing\":[],\"question\":null,\"hours\":{\"annualManual\":null,\"basis\":null,\"kind\":\"fact\"}}\n```";
  const parsed = splitAgentOutput(fenced);
  assert.equal(parsed.prose, "Hello.");
  assert.ok(parsed.report);
});

test("report JSON parser accepts new brief fields", () => {
  const report = parseReportJson(JSON.stringify({
    intent: "create",
    summary: "A new process.",
    meaning: "This brief is telling you to stand up intake first.",
    steps: ["Capture", "Route"],
    proposedSteps: ["Intake on email", "Name an owner", "Close with a record"],
    friction: [],
    bottlenecks: [],
    opportunities: [],
    doThis: [{ action: "Write the intake", why: "Start is implied", example: "Fields: Request, Owner" }],
    automations: [{ title: "Shared checklist", how: "Make state visible", example: "Owner | Status | Due", tools: ["checklist"], effort: "this week" }],
    firstMove: "Write the intake as a short form.",
    assumptions: [],
    missing: [],
    question: null,
    hours: { annualManual: null, basis: null, kind: "fact" },
  }));
  assert.ok(report);
  assert.equal(report.intent, "create");
  assert.match(report.meaning, /stand up intake/);
  assert.equal(report.doThis[0].example, "Fields: Request, Owner");
  assert.equal(report.automations[0].effort, "this week");
  assert.equal(report.proposedSteps.length, 3);
  const md = reportToMarkdown(report);
  assert.match(md, /What this is telling you/);
  assert.match(md, /This week/);
  assert.match(md, /Automation options/);
  assert.match(md, /Proposed workflow/);
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

test("starter volume and attachment headers are not treated as steps", async () => {
  const { extractSteps } = await import("../lib/workflow-analysis.ts");
  const starter =
    "Export requests from Excel. Check required fields and remove duplicates. Send incomplete rows back to the owner. Add valid requests to the case queue. It takes about 30 minutes, 10 times a week, with 2 handoffs. Data is internal.";
  const steps = extractSteps(starter);
  assert.equal(steps[0], "Export requests from Excel");
  assert.ok(steps.every((step) => !/minutes|times a week|handoffs|data is/i.test(step)));
  assert.equal(steps.length, 4);

  const attached = extractSteps("Attachment dummy-workflow.txt:\nExport requests from Excel. Check required fields.");
  assert.equal(attached[0], "Export requests from Excel");
  assert.ok(attached.every((step) => !/^attachment\b/i.test(step)));

  const wrapper = extractSteps("Please review the attached file(s). Collect invoices from email. Match them to purchase orders.");
  assert.equal(wrapper[0], "Collect invoices from email");
  assert.ok(wrapper.every((step) => !/please review the attached/i.test(step)));
});

test("brief exporter uses the file picker with public filenames", async () => {
  const exporter = await readFile(new URL("../lib/brief-export.ts", import.meta.url), "utf8");
  assert.match(exporter, /showSaveFilePicker/);
  assert.match(exporter, /BRIEF_MARKDOWN_FILENAME/);
  assert.match(exporter, /BRIEF_PDF_FILENAME/);
  assert.match(exporter, /setAttribute\("download", filename\)/);
  assert.doesNotMatch(exporter, /\/api\/brief-download/);
});

test("kind prefixes are stripped before display", () => {
  assert.equal(stripKindPrefix("_fact: Manual review"), "Manual review");
  assert.equal(stripKindPrefix("fact: Manual review"), "Manual review");
  assert.equal(stripKindPrefix("assumption: missing fields"), "missing fields");
  assert.equal(stripKindPrefix("Manual review"), "Manual review");
});

test("demo spoken reply stays short and points to the canvas", async () => {
  const source = await readFile(new URL("../lib/demo-agent.ts", import.meta.url), "utf8");
  assert.match(source, /brief on the right/);
  assert.match(source, /lowerFirst/);
  assert.doesNotMatch(source, /const spoken = question/);
  const fenced = "The main friction is manual data cleanup. I’ve mapped the brief on the right.\n\n```workflow-report\n{\"summary\":\"Longer brief for the download.\",\"steps\":[\"Export\"],\"friction\":[],\"bottlenecks\":[],\"opportunities\":[],\"firstMove\":\"Ship a checklist.\",\"assumptions\":[],\"missing\":[],\"question\":null,\"hours\":{\"annualManual\":260,\"basis\":\"30 minutes × 10 runs/week × 52\",\"kind\":\"fact\"}}\n```";
  const parsed = splitAgentOutput(fenced);
  assert.match(parsed.prose, /brief on the right/);
  assert.ok(parsed.prose.length < 120);
  assert.equal(parsed.report?.hours.annualManual, 260);
  assert.doesNotMatch(parsed.prose, /```/);
});

test("demo Excel brief includes meaning and a worked automation example", () => {
  const raw = buildDemoReply(WORKFLOW_STARTERS[0].prompt, "improve");
  const { report, prose } = splitAgentOutput(raw);
  assert.ok(report);
  assert.ok(report.meaning.length > 20);
  assert.doesNotMatch(report.meaning, /\d+\s*hours/);
  assert.ok(report.automations.length >= 1);
  assert.ok(report.automations.some((item) => item.example && item.example.length > 10));
  assert.match(report.automations.map((item) => `${item.title} ${item.example}`).join(" "), /Status|Missing:|Request ID/);
  assert.match(reportToMarkdown(report), /What this is telling you/);
  assert.match(prose, /brief on the right/);
});

test("chat keeps the brief on a persistent canvas instead of in the thread", async () => {
  const chat = await readFile(new URL("../components/WorkflowChat.tsx", import.meta.url), "utf8");
  const face = await readFile(new URL("../components/MapperFace.tsx", import.meta.url), "utf8");
  const sticker = await readFile(new URL("../components/StickerAgent.tsx", import.meta.url), "utf8");
  const card = await readFile(new URL("../components/ReportCard.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const attachments = await readFile(new URL("../lib/chat-attachments.ts", import.meta.url), "utf8");
  assert.match(chat, /BriefCanvas/);
  assert.match(chat, /studio-panes/);
  assert.match(chat, /intent-card/);
  assert.match(chat, /canvas-open/);
  assert.match(chat, /ATTACH_HINT/);
  assert.match(chat, /starter-chips/);
  assert.match(chat, /have a workflow yet/);
  assert.doesNotMatch(chat, /<ReportCard/);
  assert.match(face, /viewBox="0 0 48 48"/);
  assert.match(face, /prefers-reduced-motion/);
  assert.match(face, /mousemove/);
  assert.doesNotMatch(sticker, /🧭/);
  assert.match(card, /kind-pill/);
  assert.match(card, /What this is telling you/);
  assert.match(card, /Automation options/);
  assert.doesNotMatch(card, /item\.kind\}: \{item\.evidence/);
  const accept = attachments.match(/export const FILE_ACCEPT = "([^"]+)"/)?.[1] ?? "";
  assert.doesNotMatch(accept, /xlsx|docx/);
  assert.match(attachments, /are not read/);
  assert.match(attachments, /ATTACH_HINT/);
  assert.match(css, /studio-panes\.canvas-open/);
  assert.match(css, /pointer-events:\s*none/);
  assert.match(css, /:has\(\.canvas-open\) \.app-footer/);
});
