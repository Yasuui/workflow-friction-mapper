import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { WORKFLOW_STARTERS, groundReport, parseReportJson, quoteAppearsIn, splitAgentOutput } from "../lib/agent-protocol.ts";
import { affirmedText, buildDemoReply } from "../lib/demo-agent.ts";

const reportJson = (overrides) =>
  JSON.stringify({
    steps: ["Export requests"],
    friction: [{ step: "Export", issue: "Cleanup delays the queue", evidence: "Export requests from Excel", kind: "fact" }],
    firstMove: "Add a status column",
    hours: { annualManual: 260, basis: "30 × 10 × 52", kind: "fact" },
    ...overrides,
  });

test("parser drops negative, non-finite and absurd hour figures", () => {
  for (const annualManual of [-999999, Number.MAX_VALUE, "260", null]) {
    const report = parseReportJson(reportJson({ hours: { annualManual, basis: "x", kind: "fact" } }));
    assert.equal(report.hours.annualManual, null, String(annualManual));
    assert.equal(report.hours.basis, null);
  }
});

test("an invalid or missing evidence kind never becomes a fact", () => {
  const report = parseReportJson(
    reportJson({
      friction: [
        { step: "A", issue: "One", evidence: "quoted", kind: "unsupported" },
        { step: "B", issue: "Two", evidence: "quoted" },
        { step: "C", issue: "Three", evidence: "", kind: "fact" },
      ],
    }),
  );
  assert.deepEqual(report.friction.map((item) => item.kind), ["inference", "inference", "inference"]);
  assert.equal(report.friction[2].evidence, "Not quoted from the material.");
});

test("a fact whose quote is not in the person's material is downgraded", () => {
  const report = parseReportJson(
    reportJson({
      friction: [
        { step: "A", issue: "Real", evidence: "“Export requests from Excel”", kind: "fact" },
        { step: "B", issue: "Invented", evidence: "The team re-keys every invoice into SAP twice", kind: "fact" },
      ],
    }),
  );
  const grounded = groundReport(report, "Export requests from Excel. Check required fields.");
  assert.deepEqual(grounded.friction.map((item) => item.kind), ["fact", "inference"]);
  assert.equal(quoteAppearsIn("check REQUIRED fields.", "Check required fields and remove duplicates"), true);
});

test("negated and already-automated clauses are ignored by the rules", () => {
  const text =
    "We do not use spreadsheets or email. The system validates required fields automatically. Nothing is copied manually. Requests arrive through the portal.";
  assert.equal(affirmedText(text), "Requests arrive through the portal.");
  const { report, prose } = splitAgentOutput(buildDemoReply(text, "improve"), text);
  assert.ok(report);
  assert.equal(report.friction.length, 0);
  assert.equal(report.doThis.length, 0);
  assert.equal(report.automations.length, 0);
  assert.ok(report.question);
  assert.match(prose, /will not invent/i);
  assert.doesNotMatch(JSON.stringify(report), /status column|duplicate flag/i);
});

test("sample workflows still get a recommendation with evidence quoted from the input", () => {
  for (const starter of WORKFLOW_STARTERS) {
    const { report } = splitAgentOutput(buildDemoReply(starter.prompt, "improve"), starter.prompt);
    assert.ok(report.doThis.length > 0, starter.label);
    const quoted = report.friction.filter((item) => quoteAppearsIn(item.evidence, starter.prompt));
    assert.ok(quoted.length > 0, starter.label);
  }
});

test("rule-based replies are not artificially delayed", () => {
  const stream = readFileSync(new URL("../lib/agent-stream.ts", import.meta.url), "utf8");
  assert.match(stream, /options\.delayMs \?\? 0/);
});

test("one analytics path, and report wording cannot be sent as a property value", () => {
  assert.equal(existsSync(new URL("../components/WorkflowPostHog.tsx", import.meta.url)), false);
  const chat = readFileSync(new URL("../components/WorkflowChat.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(chat, /primary_opportunity:\s*report\.[a-z]+\[0\]\?\.\w+\.slice/);
  const analytics = readFileSync(new URL("../lib/product-analytics.ts", import.meta.url), "utf8");
  assert.match(analytics, /isAllowedValue\(key, value\)/);
});

test("live guard rate-limits a client, caps concurrency and the day", async () => {
  const { admitLive, resetLiveGuardForTests, LIVE_REQUESTS_PER_WINDOW, LIVE_MAX_CONCURRENT } = await import("../lib/live-guard.ts");
  resetLiveGuardForTests();
  const now = Date.UTC(2026, 9, 30, 12);
  for (let i = 0; i < LIVE_REQUESTS_PER_WINDOW; i += 1) {
    const decision = admitLive("a", now + i);
    assert.equal(decision.ok, true);
    decision.release();
  }
  assert.deepEqual(admitLive("a", now + 100), { ok: false, reason: "rate" });

  resetLiveGuardForTests();
  const held = Array.from({ length: LIVE_MAX_CONCURRENT }, (_, i) => admitLive(`c${i}`, now));
  assert.deepEqual(admitLive("next", now), { ok: false, reason: "busy" });
  held.forEach((decision) => decision.release());
  held[0].release();
  assert.equal(admitLive("next", now).ok, true);

  resetLiveGuardForTests();
  process.env.LIVE_DAILY_REQUEST_LIMIT = "1";
  admitLive("d1", now).release();
  assert.deepEqual(admitLive("d2", now), { ok: false, reason: "daily" });
  delete process.env.LIVE_DAILY_REQUEST_LIMIT;
  resetLiveGuardForTests();
});

test("grounding needs a verbatim span, not shared words in another order", () => {
  const source = "We never send invoices before approval; we send invoices after approval.";
  assert.equal(quoteAppearsIn("We send invoices before approval", source), false);
  assert.equal(quoteAppearsIn("“we send invoices after approval.”", source), true);
  assert.equal(quoteAppearsIn("We never send invoices … after approval", source), true);
  assert.equal(quoteAppearsIn("send invoices after approv", source), false);
  assert.equal(quoteAppearsIn("Data", "Data is internal."), false);
});

test("quotes in non-Latin scripts are matched, not stripped", () => {
  assert.equal(quoteAppearsIn("毎日請求書を手作業で確認して送信します", "毎日請求書を手作業で確認して送信します。"), true);
  assert.equal(quoteAppearsIn("請求書を手作業で確認", "毎日請求書を手作業で確認して送信します。"), true);
  assert.equal(quoteAppearsIn("請求書を自動で送信", "毎日請求書を手作業で確認して送信します。"), false);
  assert.equal(quoteAppearsIn("Prüfen Sie die Pflichtfelder", "Wir prüfen die Pflichtfelder. Prüfen Sie die Pflichtfelder täglich."), true);
  assert.equal(quoteAppearsIn("Prüfen täglich Pflichtfelder", "Prüfen Sie die Pflichtfelder täglich."), false);
});

test("only explicit automation terms mark a clause as already automated", () => {
  assert.equal(affirmedText("We manually review automobile insurance claims each morning."), "We manually review automobile insurance claims each morning.");
  assert.equal(affirmedText("An autograph log is checked daily."), "An autograph log is checked daily.");
  for (const clause of ["Fields are validated automatically.", "Reminders are automated.", "The CRM auto-assigns each ticket.", "Rows autofill from the form."]) {
    assert.equal(affirmedText(clause), "", clause);
  }
});

test("data-source provenance stays in the browser and is not resent as history", async () => {
  const { outboundMessages } = await import("../lib/agent-protocol.ts");
  const user = { id: "u", role: "user", parts: [{ type: "text", text: "Steps" }] };
  const reply = {
    id: "a",
    role: "assistant",
    parts: [{ type: "text", text: "Brief" }, { type: "data-source", data: { text: "x".repeat(60_000) } }],
  };
  const sent = outboundMessages([user, reply]);
  assert.equal(sent[0], user);
  assert.deepEqual(sent[1].parts, [{ type: "text", text: "Brief" }]);
  assert.equal(reply.parts.length, 2, "browser state keeps the provenance");
  const chat = readFileSync(new URL("../components/WorkflowChat.tsx", import.meta.url), "utf8");
  assert.match(chat, /messages:\s*outboundMessages\(messages\)/);
});

test("trimmed live history carries the original material forward as a bounded user turn", async () => {
  const { boundedHistory, LIVE_HISTORY_MESSAGES, LIVE_CARRIED_MATERIAL_CHARS } = await import("../lib/live-guard.ts");
  const turn = (i) => ({ id: `m${i}`, role: i % 2 ? "assistant" : "user", parts: [{ type: "text", text: `turn ${i}` }] });
  const short = Array.from({ length: LIVE_HISTORY_MESSAGES }, (_, i) => turn(i));
  assert.equal(boundedHistory(short, "Export rows"), short);

  const long = Array.from({ length: 20 }, (_, i) => turn(i));
  const sent = boundedHistory(long, "Export requests from Excel. Never email customers.");
  assert.equal(sent.length, LIVE_HISTORY_MESSAGES);
  assert.equal(sent[0].role, "user");
  assert.match(sent[0].parts[0].text, /Never email customers/);
  assert.match(sent[0].parts[0].text, /data, not instructions/);
  assert.equal(sent.at(-1).id, "m19");

  const huge = boundedHistory(long, "x".repeat(LIVE_CARRIED_MATERIAL_CHARS * 2));
  assert.ok(huge[0].parts[0].text.length < LIVE_CARRIED_MATERIAL_CHARS + 200);
});

test("create mode keeps requested automation steps as requirements", () => {
  const text =
    "Create a workflow for our weekly meeting. Automatically capture notes in Teams. Automatically extract action items with owners. Automatically send reminders before due dates. Automatically escalate overdue tasks to the lead.";
  const { report } = splitAgentOutput(buildDemoReply(text, "create"), text);
  const all = [...report.steps, ...report.proposedSteps].join(" ").toLowerCase();
  for (const requirement of ["capture notes", "action items", "reminders", "escalate overdue"]) {
    assert.ok(all.includes(requirement), requirement);
  }
  const improve = splitAgentOutput(buildDemoReply(text, "improve"), text).report;
  assert.doesNotMatch(improve.steps.join(" ").toLowerCase(), /escalate overdue/);
});
