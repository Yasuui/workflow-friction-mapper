# Privacy statement

Workflow Friction Mapper is intentionally designed without user accounts, persistent storage, or server-side workflow processing.

## Data flow

1. A user enters a workflow description and a few numeric inputs.
2. The application analyzes those inputs with deterministic TypeScript in the browser.
3. The generated report stays in temporary React memory.
4. Copy and download actions operate locally in the browser.
5. Refreshing or resetting the page clears the active input and report.

## What is not collected

The application does not include:

- a database;
- API routes or third-party model calls;
- analytics or advertising trackers;
- cookies;
- local or session storage;
- authentication; or
- telemetry containing workflow text.

The public host may retain standard infrastructure access logs. The application does not intentionally add workflow input to URLs, logs, requests, or error reports.

## Responsible use

Do not enter personal, confidential, regulated, or employer-owned information. Use synthetic examples when evaluating sensitive workflows. Automation recommendations should be piloted with a named human owner, exception handling, auditability, and an approved data boundary.
