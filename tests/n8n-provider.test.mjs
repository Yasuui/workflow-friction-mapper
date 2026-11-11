import assert from "node:assert/strict";
import test from "node:test";

import { WORKFLOW_STARTERS, splitAgentOutput } from "../lib/agent-protocol.ts";
import { buildDemoReply } from "../lib/demo-agent.ts";
import { classifyStep, reportToN8n } from "../lib/n8n-export.ts";
import { liveConfig } from "../lib/model-provider.ts";

function starterReport(index = 0) {
  const { report } = splitAgentOutput(buildDemoReply(WORKFLOW_STARTERS[index].prompt, "improve"));
  assert.ok(report);
  return report;
}

test("steps are classified by what they do, not left as 'review whether to automate'", () => {
  assert.equal(classifyStep("Check required fields and remove duplicates"), "validate");
  assert.equal(classifyStep("Send reminders in Teams"), "notify");
  assert.equal(classifyStep("Assign an owner"), "route");
  assert.equal(classifyStep("Export requests from Excel"), "fetch");
  assert.equal(classifyStep("Escalate overdue actions to the project lead"), "review");
  assert.equal(classifyStep("Think about it"), "manual");

  for (const [index, starter] of WORKFLOW_STARTERS.entries()) {
    const plan = starterReport(index).buildPlan;
    assert.ok(plan, starter.label);
    assert.ok(plan.steps.every((step) => !/review whether to automate/i.test(step)), starter.label);
    assert.ok(plan.steps.every((step) => /^(Fetch|Validate|Route|Notify|Write|Human review|Manual): /.test(step)), starter.label);
  }
});

test("the n8n scaffold is valid, linear and inert", () => {
  const report = starterReport(0);
  const workflow = reportToN8n(report, "Data review");
  const names = workflow.nodes.map((node) => node.name);
  assert.equal(new Set(names).size, names.length, "node names are unique");
  assert.ok(workflow.nodes.every((node) => node.id && node.type.startsWith("n8n-nodes-base.") && Array.isArray(node.position)));

  // Only a manual trigger, placeholders and notes: importing it cannot call anything.
  const types = new Set(workflow.nodes.map((node) => node.type));
  assert.deepEqual([...types].sort(), ["n8n-nodes-base.manualTrigger", "n8n-nodes-base.noOp", "n8n-nodes-base.stickyNote"]);

  const flow = workflow.nodes.filter((node) => node.type !== "n8n-nodes-base.stickyNote");
  assert.equal(flow.length, report.buildPlan.steps.length + 1);
  for (let index = 0; index < flow.length - 1; index += 1) {
    assert.equal(workflow.connections[flow[index].name].main[0][0].node, flow[index + 1].name);
  }
  assert.ok(flow.every((node) => node.name.length <= 70));
  assert.match(JSON.stringify(workflow), /Proposed, not running/);
  assert.match(flow[1].name, /^1\. Fetch · /);
});

test("duplicate step names stay unique in n8n", () => {
  const report = starterReport(0);
  const workflow = reportToN8n({ ...report, buildPlan: { ...report.buildPlan, steps: ["Send it", "Send it"] } });
  const names = workflow.nodes.map((node) => node.name);
  assert.equal(new Set(names).size, names.length);
});

test("model provider: demo without keys, OpenAI by default, any compatible endpoint when configured", () => {
  assert.equal(liveConfig({}).mode, "demo");

  const openai = liveConfig({ OPENAI_API_KEY: "sk-test" });
  assert.equal(openai.mode, "live");
  assert.deepEqual(openai.models, ["gpt-5-mini", "gpt-4.1-mini"]);
  const [primary] = openai.attempts();
  assert.deepEqual(primary.providerOptions, { openai: { reasoningEffort: "low" } });

  const compatible = liveConfig({
    LLM_BASE_URL: "https://openrouter.ai/api/v1",
    LLM_API_KEY: "test",
    MODEL: "some/model:free",
    FALLBACK_MODEL: "other/model",
  });
  assert.equal(compatible.mode, "live");
  assert.equal(compatible.provider, "openrouter");
  const attempts = compatible.attempts();
  assert.equal(attempts.length, 2);
  // OpenAI-only parameters are never sent to another provider.
  assert.ok(attempts.every((attempt) => attempt.providerOptions === undefined));

  // A compatible endpoint without an explicit model stays in demo rather than guessing one.
  assert.equal(liveConfig({ LLM_BASE_URL: "https://api.groq.com/openai/v1", LLM_API_KEY: "x" }).mode, "demo");
});
