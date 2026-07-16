import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);
const previewRoot = new URL("../app/_sites-preview/", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the workflow analyzer product shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Workflow Friction Mapper/);
  assert.match(html, /Find the friction before you automate/);
  assert.match(html, /Describe one workflow/);
  assert.match(html, /Analysis stays on this device/);
  assert.match(html, /Connect on LinkedIn/);
  assert.match(html, /View the source/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("keeps analysis local and removes the disposable starter", async () => {
  const [page, layout, packageJson, studio, analysis] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../components/WorkflowStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/workflow-analysis.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<WorkflowStudio \/>/);
  assert.match(layout, /Workflow Friction Mapper/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(studio, /fetch\(|XMLHttpRequest|localStorage|sessionStorage/);
  assert.doesNotMatch(analysis, /fetch\(|XMLHttpRequest/);
  assert.match(studio, /do not enter personal, confidential, regulated/i);

  await assert.rejects(access(previewRoot));
  await assert.rejects(access(new URL("public/_sites-preview", templateRoot)));
});
