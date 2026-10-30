import assert from "node:assert/strict";
import test from "node:test";
import { readUIMessageStream } from "ai";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";

import { LIVE_FALLBACK_NOTICE, LIVE_MAX_OUTPUT_TOKENS, streamAgentReply } from "../lib/agent-stream.ts";

const user = { id: "u1", role: "user", parts: [{ type: "text", text: "Export rows, check fields, send back incomplete ones." }] };
const usage = { inputTokens: { total: 10 }, outputTokens: { total: 10 } };

function textModel(text) {
  return new MockLanguageModelV3({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "t" },
          ...text.match(/.{1,7}/gs).map((delta) => ({ type: "text-delta", id: "t", delta })),
          { type: "text-end", id: "t" },
          { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
        ],
      }),
    }),
  });
}

const throwingModel = () =>
  new MockLanguageModelV3({
    doStream: async () => {
      throw new Error("401 invalid api key");
    },
  });

const midstreamModel = () =>
  new MockLanguageModelV3({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "t" },
          { type: "text-delta", id: "t", delta: "Partial answer" },
          { type: "error", error: new Error("connection reset") },
        ],
      }),
    }),
  });

async function finalMessage(response) {
  let last;
  for await (const message of readUIMessageStream({ stream: uiChunks(response) })) last = message;
  return last;
}

function uiChunks(response) {
  // Parse the SSE body back into UI message chunks.
  const decoder = new TextDecoder();
  let buffer = "";
  return response.body.pipeThrough(
    new TransformStream({
      transform(bytes, controller) {
        buffer += decoder.decode(bytes, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop();
        for (const event of events) {
          const data = event.replace(/^data: /, "").trim();
          if (data && data !== "[DONE]") controller.enqueue(JSON.parse(data));
        }
      },
    }),
  );
}

const textOf = (message) => message.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
const demoReply = async () => "Demo brief.";

test("streams the live model's text and asks for enough output tokens for the brief", async () => {
  const model = textModel("Possible friction at intake. ```workflow-report\n{}\n```");
  const message = await finalMessage(
    streamAgentReply({ attempts: [{ model, label: "primary" }], system: "s", messages: [user], demoReply, delayMs: 0 }),
  );
  assert.equal(textOf(message), "Possible friction at intake. ```workflow-report\n{}\n```");
  assert.equal(model.doStreamCalls[0].maxOutputTokens, LIVE_MAX_OUTPUT_TOKENS);
  assert.equal(model.doStreamCalls[0].providerOptions.openai.reasoningEffort, "low");
});

test("falls through to the next model when the first fails before writing", async () => {
  const errors = [];
  const message = await finalMessage(
    streamAgentReply({
      attempts: [
        { model: throwingModel(), label: "primary" },
        { model: textModel("Fallback model answer."), label: "fallback" },
      ],
      system: "s",
      messages: [user],
      demoReply,
      onModelError: (label) => errors.push(label),
      delayMs: 0,
    }),
  );
  assert.equal(textOf(message), "Fallback model answer.");
  assert.deepEqual(errors, ["primary"]);
});

test("serves the demo brief with a notice when every model fails, leaving one clean text part", async () => {
  const message = await finalMessage(
    streamAgentReply({
      attempts: [
        { model: throwingModel(), label: "primary" },
        { model: throwingModel(), label: "fallback" },
      ],
      system: "s",
      messages: [user],
      demoReply,
      delayMs: 0,
    }),
  );
  assert.equal(textOf(message), `${LIVE_FALLBACK_NOTICE} Demo brief.`);
  assert.equal(message.parts.filter((part) => part.type === "text").length, 1);
});

test("without a key the demo streams with no notice", async () => {
  const message = await finalMessage(streamAgentReply({ attempts: [], system: "s", messages: [user], demoReply, delayMs: 0 }));
  assert.equal(textOf(message), "Demo brief.");
});

test("a failure after text has started ends the turn with an error instead of mixing in the demo", async () => {
  const response = streamAgentReply({
    attempts: [{ model: midstreamModel(), label: "primary" }, { model: textModel("never used"), label: "fallback" }],
    system: "s",
    messages: [user],
    demoReply,
    delayMs: 0,
  });
  const chunks = [];
  const reader = uiChunks(response).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  assert.ok(chunks.some((chunk) => chunk.type === "error"));
  assert.ok(!chunks.some((chunk) => chunk.type === "text-delta" && /Demo brief|never used/.test(chunk.delta)));
});

test("attachment text the server read is returned as a data-source part for grounding", async () => {
  const message = await finalMessage(
    streamAgentReply({ attempts: [], system: "s", messages: [user], demoReply, delayMs: 0, sourceMaterial: "Attachment sop.pdf:\nApprove refunds daily." }),
  );
  assert.equal(textOf(message), "Demo brief.");
  const source = message.parts.find((part) => part.type === "data-source");
  assert.equal(source?.data.text, "Attachment sop.pdf:\nApprove refunds daily.");

  const plain = await finalMessage(streamAgentReply({ attempts: [], system: "s", messages: [user], demoReply, delayMs: 0 }));
  assert.equal(plain.parts.some((part) => part.type === "data-source"), false);
});
