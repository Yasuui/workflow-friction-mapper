# Workflow Friction Mapper Brand and Social Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved Flow path identity, complete social-sharing metadata, recruiter-facing GitHub evidence, verified production screenshots, and launch copy for LinkedIn and X.

**Architecture:** A reusable server-rendered SVG component supplies the website wordmark while Next.js metadata conventions supply the favicon and generated Open Graph image. Existing workflow analysis remains unchanged. Documentation, profile evidence, screenshots, and social copy are updated only after local behavior and production metadata are verified.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Next.js `ImageResponse`, Node test runner, Playwright-compatible browser verification, GitHub CLI, Vercel.

## Global Constraints

- Use the approved Flow path symbol and the existing ink, warm-white, and blue palette.
- Preserve the browser-only privacy model: no API, database, analytics, storage, or workflow-data transmission.
- Do not change workflow scoring or input behavior.
- Use “directional heuristic,” never “AI prediction,” “audit,” “forecast,” or guaranteed savings.
- Implement and verify locally before pushing public changes.
- Show the exact changed-file list and checks before public publication.

---

### Task 1: Brand and social metadata contract

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `tests/vercel-readiness.test.mjs`
- Create: `components/FlowMark.tsx`
- Create: `app/icon.svg`
- Create: `app/apple-icon.tsx`
- Create: `app/opengraph-image.tsx`
- Modify: `app/layout.tsx`
- Modify: `components/WorkflowStudio.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: the production URL `https://workflow-friction-mapper.vercel.app` and existing CSS tokens.
- Produces: `FlowMark({ className?: string })`, canonical metadata, Open Graph image endpoint, X summary-large-image metadata, and visible brand marks.

- [ ] **Step 1: Add failing metadata and brand tests**

Add assertions that read `app/layout.tsx`, `app/opengraph-image.tsx`, `app/icon.svg`, `app/apple-icon.tsx`, and `components/FlowMark.tsx`. Require `metadataBase`, `alternates.canonical`, `openGraph`, `twitter`, `summary_large_image`, `FlowMark`, and three SVG circles.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `node --test tests/rendered-html.test.mjs tests/vercel-readiness.test.mjs`

Expected: failures because the metadata and brand files do not exist.

- [ ] **Step 3: Implement the Flow path mark**

Create a typed component with one accessible title when a label is supplied and decorative output otherwise:

```tsx
export function FlowMark({ className, label }: { className?: string; label?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" role={label ? "img" : undefined} aria-hidden={label ? undefined : true}>
      {label && <title>{label}</title>}
      <path d="M7 9h6c4 0 6 2 6 6v2c0 4 2 6 6 6" />
      <circle cx="7" cy="9" r="2.25" />
      <circle cx="19" cy="16" r="2.25" />
      <circle cx="25" cy="23" r="2.25" />
    </svg>
  );
}
```

- [ ] **Step 4: Add favicon and generated mobile icon**

Use the same 32 by 32 geometry, ink rounded-square background, warm-white path, and blue nodes. Include a readable `<title>Workflow Friction Mapper</title>` in the SVG and return a 180 by 180 PNG from the Apple icon route.

- [ ] **Step 5: Add complete root metadata**

Set `metadataBase` to `new URL("https://workflow-friction-mapper.vercel.app")`, canonical `/`, Open Graph type `website`, title, honest description, `siteName`, image `/opengraph-image`, and X `card: "summary_large_image"`.

- [ ] **Step 6: Add the generated share card**

Export `alt`, `size = { width: 1200, height: 630 }`, `contentType = "image/png"`, and a default function returning `new ImageResponse(...)`. Render the approved mark, product name, “Find the friction before you automate,” “Private, browser-local workflow analysis,” and `workflow-friction-mapper.vercel.app`.

- [ ] **Step 7: Integrate the mark into the website**

Replace the `WF` text tile in the navigation with `<FlowMark className="brand-mark" />`; add the same mark beside the footer product name. Update CSS so the icon remains 32 pixels in navigation and 20 pixels in the footer without changing existing layout behavior.

- [ ] **Step 8: Run focused tests and confirm GREEN**

Run: `npm run build && node --test tests/rendered-html.test.mjs tests/vercel-readiness.test.mjs`

Expected: all focused tests pass and the production build creates `/opengraph-image`.

- [ ] **Step 9: Commit the tested brand layer**

```bash
git add app components tests
git commit -m "feat: add workflow brand and social metadata"
```

### Task 2: Project README evidence

**Files:**
- Modify: `README.md`
- Create: `docs/screenshots/landing.png`
- Create: `docs/screenshots/report.png`
- Create: `docs/screenshots/fixes.png`
- Create: `docs/screenshots/contact.png`
- Create: `docs/screenshots/social-card.png`
- Modify: `tests/vercel-readiness.test.mjs`

**Interfaces:**
- Consumes: verified local product screens and `/opengraph-image`.
- Produces: a scan-friendly public case study with authentic images, live/source actions, workings, privacy, and limits.

- [ ] **Step 1: Add a failing README evidence test**

Require the exact live URL, five screenshot paths, “How it works,” “Directional heuristic,” and “No workflow text leaves the browser.”

- [ ] **Step 2: Run the README test and confirm RED**

Run: `node --test tests/vercel-readiness.test.mjs`

Expected: failure because the new screenshot and explanation references are absent.

- [ ] **Step 3: Capture local branded screenshots**

Run the app, use a 1440-pixel desktop viewport, load the Data review example, map it, and capture landing, report, fixes, contact, and `/opengraph-image`. Save PNG files under `docs/screenshots/` and mirror them to the task `outputs/` directory.

- [ ] **Step 4: Update README content**

Open with `docs/screenshots/social-card.png`, keep the live demo prominent, explain the five-stage flow, embed the four product screenshots, preserve privacy and accuracy sections, and avoid an oversized technology badge wall.

- [ ] **Step 5: Run the README test and confirm GREEN**

Run: `node --test tests/vercel-readiness.test.mjs`

Expected: all readiness tests pass.

- [ ] **Step 6: Commit the README evidence**

```bash
git add README.md docs/screenshots tests/vercel-readiness.test.mjs
git commit -m "docs: add branded workflow mapper evidence"
```

### Task 3: Full local functional verification

**Files:**
- Modify only if a verified defect is found: source or tests directly responsible for that defect.

**Interfaces:**
- Consumes: the completed local application.
- Produces: reproducible test evidence and a clean publication candidate.

- [ ] **Step 1: Run automated verification**

Run: `npm test && npm run lint && npm audit --omit=dev`

Expected: build and tests pass, lint exits zero, and any audit advisories are recorded without applying a breaking downgrade.

- [ ] **Step 2: Verify desktop functionality**

Check empty submission, all four examples, high-confidence report, vague input low-confidence corrections, KPI definitions, methodology expansion, copy report, Markdown download, reset, contact links, favicon, social image, and canonical metadata.

- [ ] **Step 3: Verify mobile and accessibility behavior**

At 390 by 844, check no horizontal overflow, readable form fields, responsive KPI panels, visible actions, keyboard focus, and reduced-motion behavior.

- [ ] **Step 4: Verify browser health**

Require zero uncaught production-origin console errors and no workflow-analysis network request.

- [ ] **Step 5: Review the exact public diff**

Run: `git status -sb && git diff origin/main...HEAD --stat && git diff --check`

Expected: only approved branding, metadata, evidence, specification, plan, and tests.

### Task 4: Publish project and verify Vercel

**Files:**
- No additional files unless production verification identifies a defect.

**Interfaces:**
- Consumes: validated commits on local `main`.
- Produces: updated GitHub project and Ready production deployment at the simple alias.

- [ ] **Step 1: Push the approved project commits**

Run: `git push origin main`

Expected: GitHub accepts the commits and Vercel starts a deployment.

- [ ] **Step 2: Wait for and inspect production**

Run: `vercel inspect https://workflow-friction-mapper.vercel.app --scope yasuuis-projects`

Expected: status `Ready` and alias `https://workflow-friction-mapper.vercel.app`.

- [ ] **Step 3: Verify live metadata and assets**

Request `/`, `/icon.svg`, `/apple-icon`, and `/opengraph-image`; confirm HTTP 200, canonical URL, Open Graph tags, and X card tags.

- [ ] **Step 4: Repeat the core live browser flow**

Run one high-confidence and one vague-input assessment, verify copy/reset, and require zero production-origin console errors.

### Task 5: Update GitHub profile and prepare launch copy

**Files:**
- Modify in profile repository: `README.md`
- Create outside repositories: `outputs/linkedin-launch-post.md`
- Create outside repositories: `outputs/x-launch-post.md`

**Interfaces:**
- Consumes: verified live URL, source URL, production screenshots, and accurate product limitations.
- Produces: public GitHub profile proof and ready-to-post LinkedIn/X copy.

- [ ] **Step 1: Clone or refresh the public profile repository**

Clone `https://github.com/Yasuui/Yasuui.git` into the task workspace without modifying unrelated repositories.

- [ ] **Step 2: Add Workflow Friction Mapper as first Selected work item**

Use this concise entry:

```markdown
- [Workflow Friction Mapper](https://workflow-friction-mapper.vercel.app) ([source](https://github.com/Yasuui/workflow-friction-mapper)) — A privacy-first browser tool that maps manual workflows, explains directional automation signals, and proposes safer measurable pilots.
```

- [ ] **Step 3: Verify and publish the profile README**

Run `git diff --check`, commit only `README.md` with `docs: feature workflow friction mapper`, and push `main`.

- [ ] **Step 4: Write LinkedIn launch copy**

Explain the problem, the local deterministic process, KPI meaning, prioritized fixes, privacy, validation limits, who benefits, live link, source link, and a focused feedback question. Do not present course work or unsupported employer metrics as product validation.

- [ ] **Step 5: Write X launch copy**

Keep the post concise enough for one X post, retain the live link, browser-local privacy point, directional-score limitation, and usefulness to teams evaluating automation candidates.

- [ ] **Step 6: Final handoff**

Report exact files changed, commits, checks, production URL, GitHub URLs, remaining risks, outputs, and durable WikiLLM notes updated.
