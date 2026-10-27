"use client";

import { FormEvent, KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { FlowMark } from "@/components/FlowMark";
import { StickerAgent, type StickerMood } from "@/components/StickerAgent";
import { BriefCanvas } from "@/components/BriefCanvas";
import {
  AGENT_GREETING,
  INTAKE_QUESTIONS,
  PRODUCT_LINE,
  PRODUCT_NAME,
  PRODUCT_SHORT_NAME,
  WORKFLOW_INTENTS,
  WORKFLOW_STARTERS,
  briefKicker,
  inferWorkflowIntent,
  intentLine,
  splitAgentOutput,
  stepIsFriction,
  stripIntentToken,
  type AgentReport,
  type WorkflowIntent,
} from "@/lib/agent-protocol";
import { ATTACH_HINT, FILE_ACCEPT, MAX_FILES, attachmentBudgetError, filesToChatParts } from "@/lib/chat-attachments";
import {
  acquisitionSource,
  captureProductEvent,
  resultContextFromAgent,
} from "@/lib/product-analytics";

// The intent travels per request in sendMessage's body, so the transport holds no component state.
const CHAT_TRANSPORT = new DefaultChatTransport({ api: "/api/optimize" });

const GREETING_MESSAGE: UIMessage = {
  id: "agent-greeting",
  role: "assistant",
  parts: [{ type: "text", text: AGENT_GREETING }],
};

function textOf(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => stripIntentToken(part.text))
    .join("\n");
}

/** The API answers rejected requests with { error }; the transport surfaces that body as the message. */
function readableChatError(failure: Error): string {
  try {
    const parsed = JSON.parse(failure.message) as { error?: unknown };
    if (typeof parsed.error === "string" && parsed.error) return parsed.error;
  } catch {
    // Not a JSON error body; fall through to the generic message.
  }
  return "Mapper could not finish that reply. Try again, or start a new conversation.";
}

function fileNames(message: UIMessage): string[] {
  return message.parts
    .filter((part): part is { type: "file"; filename?: string; mediaType: string; url: string } => part.type === "file")
    .map((part) => part.filename ?? "attachment");
}

function StreamProse({ text, caret }: { text: string; caret?: boolean }) {
  // Each streamed delta becomes its own span so only new tokens animate.
  // State is adjusted during render (not in an effect) to avoid a second paint per token.
  const [stream, setStream] = useState(() => ({ committed: text, chunks: text ? [text] : [] }));
  if (stream.committed !== text) {
    const continues = Boolean(text) && text.startsWith(stream.committed);
    const delta = continues ? text.slice(stream.committed.length) : "";
    setStream({
      committed: text,
      chunks: !text ? [] : continues ? [...stream.chunks, delta] : [text],
    });
  }
  const { chunks } = stream;

  return (
    <p>
      {chunks.map((chunk, index) => (
        <span key={index} className="token-rise">{chunk}</span>
      ))}
      {caret ? <span className="stream-caret" aria-hidden="true" /> : null}
    </p>
  );
}

function briefSummary(report: AgentReport): string {
  const steps = report.intent === "create" && report.proposedSteps.length ? report.proposedSteps : report.steps;
  const parts = [`${steps.length} ${steps.length === 1 ? "step" : "steps"}`];
  if (report.intent !== "create") {
    const flagged = steps.filter((step) => stepIsFriction(report, step)).length;
    parts.push(`${flagged} with friction`);
  }
  if (report.doThis.length) parts.push(`${report.doThis.length} ${report.doThis.length === 1 ? "action" : "actions"}`);
  return parts.join(" · ");
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

export function WorkflowChat() {
  const [draft, setDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [usedExample, setUsedExample] = useState(false);
  const usedExampleRef = useRef(false);
  const [mode, setMode] = useState<"demo" | "live">("demo");
  // The canvas shows one brief at a time; older briefs in the thread can be reopened by message id.
  const [canvas, setCanvas] = useState<{ id: string; report: AgentReport } | null>(null);
  const [mobileCanvasOpen, setMobileCanvasOpen] = useState(false);
  const [intent, setIntent] = useState<WorkflowIntent | null>(null);
  const [intakeAsked, setIntakeAsked] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const pinToBottom = useRef(true);
  const canvasReport = canvas?.report ?? null;

  const { messages, sendMessage, setMessages, status, stop } = useChat({
    messages: [GREETING_MESSAGE],
    transport: CHAT_TRANSPORT,
    onError: (failure) => setError(readableChatError(failure)),
    onFinish: ({ message }) => {
      const report = splitAgentOutput(textOf(message)).report;
      if (!report) return;
      setCanvas({ id: message.id, report });
      setMobileCanvasOpen(true);
      captureProductEvent("analysis_completed", {
        ...resultContextFromAgent(report),
        primary_opportunity: report.opportunities[0]?.title.slice(0, 40) || report.doThis[0]?.action.slice(0, 40) || "none",
        used_example: usedExampleRef.current,
      });
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const hasUser = messages.some((message) => message.role === "user");
  const showIntentPicker = !hasUser && !intakeAsked;
  const canvasOverlayOpen = Boolean(canvasReport && mobileCanvasOpen);

  useEffect(() => {
    captureProductEvent("mapper_viewed", { acquisition_source: acquisitionSource() });
    composerRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/optimize")
      .then((response) => response.json())
      .then((data: { mode?: string }) => {
        if (!cancelled) setMode(data.mode === "live" ? "live" : "demo");
      })
      .catch(() => {
        if (!cancelled) setMode("demo");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!logRef.current) return;
    // The empty state reads top-down; a conversation follows its newest turn.
    if (showIntentPicker) logRef.current.scrollTop = 0;
    else if (pinToBottom.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, status, showIntentPicker]);

  // Grow the composer with its content, up to the CSS max-height.
  useLayoutEffect(() => {
    const field = composerRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [draft]);

  // "/" jumps to the composer from anywhere; Escape closes the brief overlay on small screens.
  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && mobileCanvasOpen) {
        setMobileCanvasOpen(false);
        return;
      }
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTypingTarget(event.target)) {
        event.preventDefault();
        composerRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileCanvasOpen]);

  const waitingForToken = useMemo(() => {
    if (status === "submitted") return true;
    if (status !== "streaming") return false;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return true;
    return !splitAgentOutput(textOf(last)).prose;
  }, [status, messages]);

  function addPendingFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setPendingFiles((current) => {
      const next = [...current];
      for (const file of Array.from(fileList)) {
        if (next.length >= MAX_FILES) break;
        if (!next.some((item) => item.name === file.name && item.size === file.size)) next.push(file);
      }
      return next;
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submitConversation(text: string, files: File[], fromExample = false, forcedIntent?: WorkflowIntent) {
    const trimmed = text.trim();
    if (!trimmed && files.length === 0) {
      setError("Add a short description of the workflow first.");
      captureProductEvent("analysis_validation_failed", { reason: "missing_description" });
      return;
    }
    const resolved = inferWorkflowIntent(trimmed, forcedIntent ?? intent);
    if (!intent) setIntent(resolved);
    const { parts, note } = await filesToChatParts(files);
    // Check the combined size before clearing the composer, so the person can remove a file.
    const budgetError = attachmentBudgetError(messages, parts);
    if (budgetError) {
      setError(budgetError);
      return;
    }
    setError(note);
    if (fromExample) { setUsedExample(true); usedExampleRef.current = true; }
    setDraft("");
    setPendingFiles([]);
    pinToBottom.current = true;
    const payload = trimmed ? `${intentLine(resolved)}\n${trimmed}` : intentLine(resolved);
    await sendMessage({ text: payload, files: parts }, { body: { intent: resolved } });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    void submitConversation(draft, pendingFiles);
  }

  function handleComposerKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (busy) return;
      void submitConversation(draft, pendingFiles);
    }
  }

  function chooseIntent(next: WorkflowIntent) {
    setIntent(next);
    setError("");
    composerRef.current?.focus();
  }

  function askIntake() {
    setIntent("create");
    setIntakeAsked(true);
    setError("");
    setMessages((current) => [
      ...current,
      {
        id: `intake-${Date.now()}`,
        role: "assistant",
        parts: [{ type: "text", text: INTAKE_QUESTIONS }],
      },
    ]);
    composerRef.current?.focus();
  }

  function openBrief(id: string, report: AgentReport) {
    setCanvas({ id, report });
    setMobileCanvasOpen(true);
    document.getElementById("brief-canvas")?.focus({ preventScroll: true });
  }

  function reset() {
    if (canvasReport) captureProductEvent("analysis_reset", resultContextFromAgent(canvasReport));
    stop();
    setMessages([GREETING_MESSAGE]);
    setDraft("");
    setPendingFiles([]);
    setError("");
    setUsedExample(false);
    usedExampleRef.current = false;
    setCanvas(null);
    setMobileCanvasOpen(false);
    setIntent(null);
    setIntakeAsked(false);
    pinToBottom.current = true;
    composerRef.current?.focus();
  }

  function onThreadScroll() {
    const el = logRef.current;
    if (!el) return;
    pinToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 72;
  }

  // The greeting's guidance lives in the empty state, so the thread starts at the first real turn.
  const thread = messages.filter((message) => message.id !== GREETING_MESSAGE.id);
  const selectedIntent = WORKFLOW_INTENTS.find((item) => item.id === intent);
  const placeholder = hasUser
    ? "Refine the workflow or add context…"
    : selectedIntent?.placeholder ?? "When a request arrives, we…";

  return (
    <>
      <header className="app-chrome">
        <Link className="wordmark" href="/">
          <span className="mark" aria-hidden="true"><FlowMark /></span>
          <span className="wordmark-copy">
            <strong>{PRODUCT_SHORT_NAME}</strong>
            <small>{PRODUCT_NAME}</small>
          </span>
          <span className="sr-only">{PRODUCT_LINE}</span>
        </Link>
        <div className="chrome-actions">
          <span className={`mode-badge is-${mode}`} title={mode === "live" ? "Replies come from the live model" : "Replies are a deterministic demo grounded in what you share"}>
            <i aria-hidden="true" />
            {mode === "live" ? "Live model" : "Demo mode"}
          </span>
          {canvasReport ? (
            <button type="button" className="ghost-button is-outlined canvas-toggle" onClick={() => setMobileCanvasOpen(true)}>
              <BriefIcon />
              Brief
            </button>
          ) : null}
          <button type="button" className="ghost-button is-outlined" onClick={reset}>
            <PlusIcon />
            New analysis
          </button>
        </div>
      </header>

      <div className={`studio-panes ${canvasReport ? "has-canvas" : ""} ${canvasOverlayOpen ? "canvas-open" : ""}`}>
        <section className="conversation" aria-label="Conversation with Mapper">
          <div className="thread" ref={logRef} onScroll={onThreadScroll} role="log" aria-live="polite" aria-label="Workflow conversation">
            <div className="thread-inner">
              {showIntentPicker ? (
                <section className="empty-state" aria-labelledby="empty-title">
                  <div className="empty-head">
                    <span className="empty-eyebrow"><StickerAgent mood="idle" size="sm" />{PRODUCT_SHORT_NAME} is ready</span>
                    <h1 id="empty-title">Find the friction before you automate.</h1>
                    <p>{AGENT_GREETING}</p>
                  </div>
                  <div className="intent-picker">
                    <div>
                      <p className="intent-heading" id="intent-heading">What do you want to do?</p>
                      <div className="intent-cards" role="group" aria-labelledby="intent-heading">
                        {WORKFLOW_INTENTS.map((card) => (
                          <button
                            key={card.id}
                            type="button"
                            className={`intent-card ${intent === card.id ? "is-selected" : ""}`}
                            aria-pressed={intent === card.id}
                            disabled={busy}
                            onClick={() => chooseIntent(card.id)}
                          >
                            <span className="intent-radio" aria-hidden="true" />
                            <strong>{card.title}</strong>
                            <span>{card.subtitle}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="sample-row">
                      <p className="sample-label">Or try a sample</p>
                      <div className="starter-chips" aria-label="Suggested starter prompts">
                        {WORKFLOW_STARTERS.map((starter) => (
                          <button
                            key={starter.label}
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setIntent("improve");
                              setError("");
                              captureProductEvent("example_selected", { example_label: starter.analyticsLabel });
                              void submitConversation(starter.prompt, [], true, "improve");
                            }}
                          >
                            {starter.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button type="button" className="intent-helper" disabled={busy} onClick={askIntake}>
                      I don&apos;t have a workflow yet
                    </button>
                  </div>
                </section>
              ) : null}
              {thread.map((message, index) => {
                const raw = textOf(message);
                const parsed = message.role === "assistant" ? splitAgentOutput(raw) : { prose: raw, report: null, streamingFence: false };
                const isLast = index === thread.length - 1;
                const streamingThis = isLast && message.role === "assistant" && status === "streaming";
                const files = fileNames(message);
                const turnMood: StickerMood = streamingThis ? "streaming" : (parsed.report ? "done" : "idle");
                const report = parsed.report;
                return (
                  <article key={message.id} className={`turn ${message.role}`}>
                    {message.role === "assistant" ? (
                      <StickerAgent mood={turnMood} size="sm" />
                    ) : null}
                    <div className="turn-body">
                      {parsed.prose || files.length ? (
                        <div className={`bubble ${message.role}`}>
                          {parsed.prose ? (
                            streamingThis ? <StreamProse text={parsed.prose} caret /> : <p>{parsed.prose}</p>
                          ) : null}
                          {files.length > 0 ? (
                            <ul className="message-files">
                              {files.map((name) => <li key={name}><ClipIcon />{name}</li>)}
                            </ul>
                          ) : null}
                        </div>
                      ) : null}
                      {report && !streamingThis ? (
                        <button
                          type="button"
                          className={`brief-chip ${canvas?.id === message.id ? "is-active" : ""}`}
                          onClick={() => openBrief(message.id, report)}
                        >
                          <span className="brief-chip-icon" aria-hidden="true"><BriefIcon /></span>
                          <span className="brief-chip-copy">
                            <strong>{briefKicker(report.intent)}</strong>
                            <span>{briefSummary(report)}</span>
                          </span>
                          <span className="brief-chip-cta">{canvas?.id === message.id ? "Showing" : "Open"}</span>
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
              {waitingForToken ? (
                <article className="turn assistant thinking-turn">
                  <StickerAgent mood="thinking" size="sm" />
                  <div className="bubble assistant thinking-bubble">
                    <span>Reading your workflow</span>
                    <span className="thinking-dots" aria-hidden="true"><i /><i /><i /></span>
                  </div>
                </article>
              ) : null}
            </div>
          </div>

          <div className="composer-dock">
            <div className="composer-inner">
              <form className="chat-composer" onSubmit={handleSubmit}>
                {pendingFiles.length > 0 ? (
                  <ul className="pending-files" aria-label="Files to attach">
                    {pendingFiles.map((file, index) => (
                      <li key={`${file.name}-${index}`}>
                        <ClipIcon />
                        <span>{file.name}</span>
                        <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setPendingFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="composer-row">
                  <label className="attach-button" title="Attach a file">
                    <span className="sr-only">Attach a file</span>
                    <input
                      ref={fileRef}
                      type="file"
                      multiple
                      accept={FILE_ACCEPT}
                      onChange={(event) => addPendingFiles(event.target.files)}
                    />
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8 7.5v8.2a4 4 0 0 0 8 0V7.2a2.7 2.7 0 0 0-5.4 0v8.1a1.4 1.4 0 0 0 2.8 0V8.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  </label>
                  <label className="composer-field">
                    <span className="sr-only">Message Mapper</span>
                    <textarea
                      id="workflow-message"
                      ref={composerRef}
                      rows={1}
                      value={draft}
                      maxLength={4000}
                      placeholder={placeholder}
                      onChange={(event) => {
                        setDraft(event.target.value);
                        if (event.target.value.trim()) setError("");
                      }}
                      onKeyDown={handleComposerKey}
                    />
                  </label>
                  {busy ? (
                    <button className="send-button is-stop" type="button" onClick={() => stop()} aria-label="Stop the reply">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" /></svg>
                    </button>
                  ) : (
                    <button className="send-button" type="submit" aria-label="Send message">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 19V5m0 0 5 5M12 5 7 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </div>
              </form>
              {error ? <p className="form-error" role="alert">{error}</p> : null}
              <div className={`composer-meta ${hasUser ? "is-quiet" : ""}`}>
                <p className="attach-hint">{ATTACH_HINT}</p>
                <span className="kbd-hint" aria-hidden="true"><kbd>Enter</kbd> send <kbd>/</kbd> focus</span>
              </div>
            </div>
          </div>
        </section>

        {canvas ? (
          <BriefCanvas
            key={canvas.id}
            report={canvas.report}
            usedExample={usedExample}
            open={mobileCanvasOpen}
            onClose={() => {
              setMobileCanvasOpen(false);
              composerRef.current?.focus();
            }}
          />
        ) : null}
      </div>
    </>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function BriefIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 9h8M8 12.5h8M8 16h5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ClipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
      <path d="M8 7.5v8.2a4 4 0 0 0 8 0V7.2a2.7 2.7 0 0 0-5.4 0v8.1a1.4 1.4 0 0 0 2.8 0V8.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
