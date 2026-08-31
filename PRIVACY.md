# Privacy statement

Workflow Friction Mapper is intentionally designed without user accounts, a workflow database, or server-side workflow processing.

## Data flow

1. A user enters a workflow description and a few numeric inputs.
2. The application analyzes those inputs with deterministic TypeScript in the browser.
3. The generated report stays in temporary React memory.
4. Copy and download actions operate locally in the browser.
5. Refreshing or resetting the page clears the active input and report.
6. A small set of cookieless, anonymous product events may be sent to PostHog to measure whether the tool is useful.

## Anonymous product analytics

PostHog is configured in cookieless mode. It does not use browser cookies, local storage, or session storage, and it does not create named user profiles. Session replay is disabled. Autocapture, automatic pageview capture, and automatic exception capture are also disabled.

Only explicit product events are recorded:

- mapper viewed;
- example selected, using one of four fixed example labels;
- missing-description validation error;
- analysis completed, using only low/medium/high score bands, input-confidence band, a fixed recommendation category, and whether an example was used;
- report copied or downloaded;
- analysis reset;
- structured feedback selections; and
- LinkedIn, GitHub, or Cal.com link selected.

Acquisition is reduced to a fixed category such as direct, LinkedIn, GitHub, X, search, or other. Client payloads are allowlisted: only named event properties may be sent. PostHog automatic properties, full URLs, search terms, IP, detailed location, and referrer URLs are stripped before an event is sent.

## What is never collected

Workflow text is never sent to PostHog or any other server. No names or email addresses are collected. The analytics payload excludes:

- a database;
- API routes or third-party model calls;
- workflow descriptions, steps, report text, score explanations, or recommendations;
- exact minutes, frequency, handoff counts, sensitivity selections, scores, or calculated hours;
- names or email addresses;
- company, employer, or account identifiers;
- free-text feedback;
- precise location;
- session replay or screen recordings; and
- authentication or advertising profiles.

The public host and PostHog may retain standard infrastructure metadata needed to serve requests and aggregate anonymous usage. The application does not add workflow input to URLs, logs, analytics requests, or error reports.

## Responsible use

Do not enter personal, confidential, regulated, or employer-owned information. Use synthetic examples when evaluating sensitive workflows. Automation recommendations should be piloted with a named human owner, exception handling, auditability, and an approved data boundary.
