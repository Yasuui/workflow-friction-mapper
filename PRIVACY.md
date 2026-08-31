# Privacy statement

Workflow Friction Mapper is a chat agent that reads the workflow you share in order to optimize it. There is no account and no workflow database.

## Data flow

1. You paste a process, tap a starter, or attach a file in the chat.
2. That message (and parsed attachment text) is posted to /api/optimize.
3. Demo mode (no OPENAI_API_KEY): a local streamed brief is generated on the server from what you shared. It does not call a model provider.
4. Live mode (key present): the same payload is sent to OpenAI (gpt-5-mini by default) so the agent can read it.
5. Copy and download (Markdown/PDF) run in the browser.
6. Refreshing or starting a new chat clears the thread from memory.
7. A small set of cookieless, anonymous product events may be sent to PostHog.

## Anonymous product analytics

PostHog is configured in cookieless mode. It does not use browser cookies, local storage, or session storage, and it does not create named user profiles. Session replay is disabled. Autocapture, automatic pageview capture, and automatic exception capture are also disabled.

Only explicit product events are recorded (view, starter selected, analysis completed as score bands, copy/download, structured feedback, outbound links). Workflow text is never sent to PostHog.

## What is never collected for analytics

No names or email addresses are collected. The analytics payload excludes workflow descriptions, steps, report text, exact minutes, frequency, names, free-text feedback, and session replay.

The public host and, in live mode, the model provider process the chat content required to answer you. PostHog does not receive that content.

## Responsible use

Do not enter secrets, passwords, or personal identifiers you would not send to a writing assistant. Use synthetic examples when evaluating sensitive workflows.
