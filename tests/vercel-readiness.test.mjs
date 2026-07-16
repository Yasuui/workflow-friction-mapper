import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("uses a standard Next.js build for Vercel", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.equal(packageJson.scripts.dev, "next dev");
  assert.equal(packageJson.scripts.build, "next build");
  assert.equal(packageJson.scripts.start, "next start");
  assert.equal(packageJson.scripts.test, "npm run build && node --test tests/*.test.mjs");
  assert.equal(packageJson.dependencies.vinext, undefined);
  assert.equal(packageJson.devDependencies.wrangler, undefined);
});

test("removes the unused hosting and API starter surfaces", async () => {
  const removed = [
    ".openai/hosting.json",
    "build/sites-vite-plugin.ts",
    "examples/d1/app/api/notes/route.ts",
    "vite.config.ts",
    "worker/index.ts",
  ];

  for (const path of removed) {
    await assert.rejects(access(new URL(path, root)));
  }
});

test("documents the live product with branded visual evidence", async () => {
  const readme = await readFile(new URL("README.md", root), "utf8");

  assert.match(readme, /https:\/\/workflow-friction-mapper\.vercel\.app/);
  assert.match(readme, /docs\/screenshots\/social-card\.png/);
  assert.match(readme, /docs\/screenshots\/landing\.png/);
  assert.match(readme, /docs\/screenshots\/report\.png/);
  assert.match(readme, /docs\/screenshots\/fixes\.png/);
  assert.match(readme, /docs\/screenshots\/contact\.png/);
  assert.match(readme, /## How it works/);
  assert.match(readme, /Directional heuristic/);
  assert.match(readme, /No workflow text leaves the browser/);
});
