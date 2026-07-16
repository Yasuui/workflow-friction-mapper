import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);
const previewRoot = new URL("../app/_sites-preview/", import.meta.url);

test("pre-renders the workflow analyzer product shell", async () => {
  const html = await readFile(new URL("../.next/server/app/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>Workflow Friction Mapper/);
  assert.match(html, /Find the friction before you automate/);
  assert.match(html, /Describe one workflow/);
  assert.match(html, /Analysis stays on this device/);
  assert.match(html, /Start with a trigger/);
  assert.match(html, /Paste or type/);
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
  assert.match(studio, /Prioritized fixes/);
  assert.match(studio, /Why these scores/);
  assert.match(studio, /How to validate impact/);
  assert.match(studio, /Input confidence/);
  assert.match(studio, /Higher means more recurring effort/i);
  assert.match(studio, /directional heuristic/i);

  await assert.rejects(access(previewRoot));
  await assert.rejects(access(new URL("public/_sites-preview", templateRoot)));
});

test("defines one consistent brand and complete social metadata", async () => {
  async function source(path) {
    try {
      return await readFile(new URL(path, import.meta.url), "utf8");
    } catch {
      return "";
    }
  }

  const [layout, studio, mark, icon, appleIcon, socialImage] = await Promise.all([
    source("../app/layout.tsx"),
    source("../components/WorkflowStudio.tsx"),
    source("../components/FlowMark.tsx"),
    source("../app/icon.svg"),
    source("../app/apple-icon.tsx"),
    source("../app/opengraph-image.tsx"),
  ]);

  assert.match(layout, /metadataBase/);
  assert.match(layout, /workflow-friction-mapper\.vercel\.app/);
  assert.match(layout, /canonical/);
  assert.match(layout, /openGraph/);
  assert.match(layout, /twitter/);
  assert.match(layout, /summary_large_image/);
  assert.match(studio, /<FlowMark/);
  assert.match(mark, /export function FlowMark/);
  assert.equal((mark.match(/<circle/g) ?? []).length, 3);
  assert.match(icon, /Workflow Friction Mapper/);
  assert.equal((icon.match(/<circle/g) ?? []).length, 3);
  assert.match(appleIcon, /ImageResponse/);
  assert.match(appleIcon, /180/);
  assert.match(appleIcon, /Workflow Friction Mapper/);
  assert.match(socialImage, /ImageResponse/);
  assert.match(socialImage, /1200/);
  assert.match(socialImage, /630/);
  assert.match(socialImage, /Find the friction before you automate/);
  assert.match(socialImage, /Private, browser-local workflow analysis/);
});
