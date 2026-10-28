import assert from "node:assert/strict";
import test from "node:test";
import { MAX_REQUEST_BYTES, readLimitedJson, requestSchema } from "../lib/request-validation.ts";
import { buildDemoReply } from "../lib/demo-agent.ts";
import { reportToMarkdown, splitAgentOutput, WORKFLOW_STARTERS } from "../lib/agent-protocol.ts";

test("accepts a bounded user message and rejects remote or mismatched file URLs", () => {
  const body = { messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "Review an incoming request." }] }] };
  assert.equal(requestSchema.safeParse(body).success, true);
  for (const file of [
    { type: "file", mediaType: "image/png", url: "https://example.com/file.png" },
    { type: "file", mediaType: "image/png", url: "data:application/pdf;base64,AAAA" },
  ]) {
    assert.equal(requestSchema.safeParse({ messages: [{ id: "1", role: "user", parts: [file] }] }).success, false);
  }
});

test("body reading rejects an oversized request before JSON parsing", async () => {
  const request = new Request("http://localhost/api/optimize", { method: "POST", headers: { "content-length": String(MAX_REQUEST_BYTES + 1) }, body: "{}" });
  await assert.rejects(readLimitedJson(request), /too_large/);
});

test("sample plan is labelled as a proposal and survives markdown export", () => {
  const report = splitAgentOutput(buildDemoReply(WORKFLOW_STARTERS[1].prompt, "improve")).report;
  assert.ok(report?.buildPlan);
  assert.match(report.buildPlan.trigger, /needs confirmation/i);
  const markdown = reportToMarkdown(report);
  for (const section of ["Automation build plan (proposed)", "Human review", "Failure handling", "Test before launch"]) assert.ok(markdown.includes(section));
});
