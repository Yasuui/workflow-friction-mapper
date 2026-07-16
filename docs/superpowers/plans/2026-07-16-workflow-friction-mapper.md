# Workflow Friction Mapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public, privacy-first workflow analysis experience with a tested client-side engine, polished single-page interface, proof screenshots, GitHub repository, and production URL.

**Architecture:** A Vinext/Next-compatible page renders one client component. A pure TypeScript analysis module receives typed form input and returns a deterministic report. React owns transient UI state; there is no server-side data path or persistence.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Vinext, Node test runner, Sites hosting, GitHub.

## Global Constraints

- No API routes, authentication, database, analytics, cookies, local storage, or external data processing.
- Do not send or persist workflow input.
- Use one screen for input and one animated result transition.
- Respect reduced-motion and keyboard navigation.
- Display estimates as illustrative, not measured outcomes.

---

### Task 1: Analysis engine

**Files:**
- Create: `lib/workflow-analysis.ts`
- Create: `tests/workflow-analysis.test.ts`

**Interfaces:**
- Consumes: `WorkflowInput` with `description`, `minutesPerRun`, `runsPerWeek`, `handoffs`, and `sensitivity`.
- Produces: `WorkflowReport` with scores, steps, opportunities, safeguards, estimates, and a first recommendation.

- [ ] Write tests for workflow parsing, score bounds, signal detection, sensitive-data safeguards, and annual estimate math.
- [ ] Run `node --test tests/workflow-analysis.test.ts` and confirm failure because the implementation does not exist.
- [ ] Implement the smallest deterministic engine that satisfies the tests.
- [ ] Run `node --test tests/workflow-analysis.test.ts` and confirm all tests pass.

### Task 2: One-step product experience

**Files:**
- Create: `components/WorkflowStudio.tsx`
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Delete: `app/_sites-preview/SkeletonPreview.tsx`
- Delete: `app/_sites-preview/preview.css`

**Interfaces:**
- Consumes: `analyzeWorkflow(input)` from `lib/workflow-analysis.ts`.
- Produces: accessible form, animated report, copy/download controls, and profile calls to action.

- [ ] Add a rendered-HTML assertion for the privacy statement, input label, result regions, and profile links.
- [ ] Run the rendered test and confirm it fails against the starter.
- [ ] Replace the starter with the complete responsive product UI and metadata.
- [ ] Remove starter preview code and unused loading dependency.
- [ ] Run tests, lint, and build.

### Task 3: Repository evidence

**Files:**
- Modify: `README.md`
- Create: `docs/screenshots/landing.png`
- Create: `docs/screenshots/report.png`
- Create: `docs/screenshots/safeguards.png`

**Interfaces:**
- Consumes: verified deployed UI and production URL.
- Produces: public case-study README and authentic screenshots.

- [ ] Document the problem, value, privacy architecture, analysis logic, stack, local setup, checks, and limitations.
- [ ] Capture the three named screenshots from the running product at a desktop viewport.
- [ ] Add screenshots and the verified production URL to the README.
- [ ] Re-run tests, lint, and build after documentation updates.

### Task 4: Publish and verify

**Files:**
- Modify: `.openai/hosting.json`

**Interfaces:**
- Consumes: current Git commit and validated build archive.
- Produces: public GitHub repository and public production deployment.

- [ ] Commit the exact validated source.
- [ ] Create and push the public `Yasuui/workflow-friction-mapper` GitHub repository.
- [ ] Create and deploy the Sites project from the same commit.
- [ ] Verify the production URL, full input-to-report flow, privacy copy, external links, and console/network health.
- [ ] Copy the three final screenshots to the task outputs directory for posting.
