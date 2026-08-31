import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);
const previewRoot = new URL("../app/_sites-preview/", import.meta.url);

test("pre-renders the workflow agent product shell", async () => {
  const html = await readFile(new URL("../.next/server/app/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>Workflow Friction Mapper/);
  assert.match(html, /Paste a workflow, attach a SOP or notes, or tap a starter/);
  assert.match(html, /Workflow optimizer/);
  assert.match(html, /Connect on LinkedIn/);
  assert.match(html, /View the source/);
  assert.doesNotMatch(html, /entirely in your browser/i);
  assert.doesNotMatch(html, /No tracking/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("keeps the chat agent product and removes the disposable starter", async () => {
  const [page, layout, packageJson, studio, chat] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../components/WorkflowStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/WorkflowChat.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<WorkflowStudio \/>/);
  assert.match(layout, /Workflow Friction Mapper/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(studio, /localStorage|sessionStorage/);
  assert.doesNotMatch(chat, /localStorage|sessionStorage/);
  assert.match(chat, /AGENT_GREETING/);
  assert.match(chat, /\/api\/optimize/);
  assert.match(chat, /starter-chips/);

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
  assert.match(socialImage, /Chat agent for one workflow/);
  assert.doesNotMatch(socialImage, /No tracking/);
  assert.doesNotMatch(socialImage, /browser-local/);
});

test("sets markdown and pdf filenames, and serves SEO plus a styled 404", async () => {
  const exporter = await readFile(new URL("../lib/brief-export.ts", import.meta.url), "utf8");
  const protocol = await readFile(new URL("../lib/agent-protocol.ts", import.meta.url), "utf8");
  assert.match(protocol, /workflow-optimization-brief\.md/);
  assert.match(protocol, /workflow-optimization-brief\.pdf/);
  assert.match(exporter, /BRIEF_MARKDOWN_FILENAME/);
  assert.match(exporter, /BRIEF_PDF_FILENAME/);
  assert.match(exporter, /appendChild\(link\)/);
  assert.match(exporter, /revokeObjectURL/);

  await access(new URL("../app/not-found.tsx", import.meta.url));
  await access(new URL("../app/robots.ts", import.meta.url));
  await access(new URL("../app/sitemap.ts", import.meta.url));
  await access(new URL("../app/favicon.ico", import.meta.url));
  await access(new URL("../app/icon.svg", import.meta.url));

  const notFound = await readFile(new URL("../app/not-found.tsx", import.meta.url), "utf8");
  assert.match(notFound, /href="\/"/);
  assert.match(notFound, /Back to the mapper/);

  const robots = await readFile(new URL("../app/robots.ts", import.meta.url), "utf8");
  const sitemap = await readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8");
  assert.match(robots, /sitemap\.xml/);
  assert.match(sitemap, /workflow-friction-mapper\.vercel\.app/);
});
