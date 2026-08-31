"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
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
  inferWorkflowIntent,
  intentLine,
  splitAgentOutput,
  stripIntentToken,
  type AgentReport,
  type WorkflowIntent,
} from "@/lib/agent-protocol";
import { ATTACH_HINT, FILE_ACCEPT, MAX_FILES, filesToChatParts } from "@/lib/chat-attachments";
import {
  acquisitionSource,
  captureProductEvent,
  resultContextFromAgent,
} from "@/lib/product-analytics";

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

function fileNames(message: UIMessage): string[] {
  return message.parts
    .filter((part): part is { type: "file"; filename?: string; mediaType: string; url: string } => part.type === "file")
    .map((part) => part.filename ?? "attachment");
}

function StreamProse({ text, caret }: { text: string; caret?: boolean }) {
  const committedRef = useRef("");
  const [chunks, setChunks] = useState<string[]>(() => (text ? [text] : []));

  useEffect(() => {
    if (!text) {
      committedRef.current = "";
      setChunks([]);
      return;
    }
    if (!text.startsWith(committedRef.current)) {
      committedRef.current = text;
      setChunks([text]);
      return;
    }
    const delta = text.slice(committedRef.current.length);
    if (!delta) return;
    committedRef.current = text;
    setChunks((current) => [...current, delta]);
  }, [text]);

  return (
    <p>
      {chunks.map((chunk, index) => (
        <span key={index} className="token-rise">{chunk}</span>
      ))}
      {caret ? <span className="stream-caret" aria-hidden="true" /> : null}
    </p>
  );
}

export function WorkflowChat() {
  const [draft, setDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [usedExample, setUsedExample] = useState(false);
  const usedExampleRef = useRef(false);
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [canvasReport, setCanvasReport] = useState<AgentReport | null>(null);
  const [mobileCanvasOpen, setMobileCanvasOpen] = useState(false);
  const [intent, setIntent] = useState<WorkflowIntent | null>(null);
  const [intakeAsked, setIntakeAsked] = useState(false);
  const intentRef = useRef<WorkflowIntent | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const pinToBottom = useRef(true);
  intentRef.current = intent;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/optimize",
        prepareSendMessagesRequest: ({ messages, body, id, trigger, messageId }) => ({
          body: {
            ...(body ?? {}),
            id,
            messages,
            trigger,
            messageId,
            intent: intentRef.current ?? undefined,
          },
        }),
      }),
    [],
  );

  const { messages, sendMessage, setMessages, status, stop } = useChat({
    messages: [GREETING_MESSAGE],
    transport,
    onFinish: ({ message }) => {
      const report = splitAgentOutput(textOf(message)).report;
      if (!report) return;
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
    if (status === "submitted" || status === "streaming") return;
    const last = [...messages].reverse().find((message) => message.role === "assistant");
    if (!last) return;
    const report = splitAgentOutput(textOf(last)).report;
    if (!report) return;
    setCanvasReport(report);
    setMobileCanvasOpen(true);
  }, [messages, status]);

  useEffect(() => {
    if (!pinToBottom.current || !logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, status]);

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
    intentRef.current = resolved;
    const { parts, note } = await filesToChatParts(files);
    setError(note);
    if (fromExample) { setUsedExample(true); usedExampleRef.current = true; }
    setDraft("");
    setPendingFiles([]);
    pinToBottom.current = true;
    const payload = trimmed ? `${intentLine(resolved)}\n${trimmed}` : intentLine(resolved);
    await sendMessage({
      text: payload,
      files: parts,
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitConversation(draft, pendingFiles);
  }

  function handleComposerKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
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
    intentRef.current = "create";
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

  function reset() {
    if (canvasReport) captureProductEvent("analysis_reset", resultContextFromAgent(canvasReport));
    stop();
    setMessages([GREETING_MESSAGE]);
    setDraft("");
    setPendingFiles([]);
    setError("");
    setUsedExample(false);
    usedExampleRef.current = false;
    setCanvasReport(null);
    setMobileCanvasOpen(false);
    setIntent(null);
    intentRef.current = null;
    setIntakeAsked(false);
    pinToBottom.current = true;
    composerRef.current?.focus();
  }

  function onThreadScroll() {
    const el = logRef.current;
    if (!el) return;
    pinToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 72;
  }

  const thread = messages.length ? messages : [GREETING_MESSAGE];
  const selectedIntent = WORKFLOW_INTENTS.find((item) => item.id === intent);
  const placeholder = hasUser
    ? "Refine the workflow or add context…"
    : selectedIntent?.placeholder ?? "When a request arrives, we…";

  return (
    <>
      <header className="app-chrome">
        <Link className="wordmark" href="/">
          <span className="mark mark-idle" aria-hidden="true"><FlowMark /></span>
          <span className="wordmark-copy">
            <strong>{PRODUCT_SHORT_NAME}</strong>
            <small>{PRODUCT_NAME}</small>
          </span>
          <span className="sr-only">{PRODUCT_LINE}</span>
        </Link>
        <div className="chrome-actions">
          {canvasReport ? (
            <>
              <span className="sync-pill"><i />Brief synced</span>
              <button type="button" className="ghost-button canvas-toggle" onClick={() => setMobileCanvasOpen(true)}>
                Brief
              </button>
            </>
          ) : null}
          <button type="button" className="ghost-button" onClick={reset}>
            <PlusIcon />
            New
          </button>
        </div>
      </header>

      <div className={`studio-panes ${canvasReport ? "has-canvas" : ""} ${canvasOverlayOpen ? "canvas-open" : ""}`}>
        <section className="conversation" aria-label="Conversation with Mapper">
          <div className="thread" ref={logRef} onScroll={onThreadScroll} role="log" aria-live="polite" aria-label="Workflow conversation">
            <div className="thread-inner">
              <div className="conversation-intro">
                <span className="panel-label">Conversation</span>
                <h1>Turn the messy process into one clear first move.</h1>
              </div>
              {thread.map((message, index) => {
                const raw = textOf(message);
                const parsed = message.role === "assistant" ? splitAgentOutput(raw) : { prose: raw, report: null, streamingFence: false };
                const isLast = index === thread.length - 1;
                const streamingThis = isLast && message.role === "assistant" && status === "streaming";
                const files = fileNames(message);
                const turnMood: StickerMood = streamingThis ? "streaming" : (parsed.report ? "done" : "idle");
                return (
                  <article key={message.id} className={`turn ${message.role}`}>
                    {message.role === "assistant" ? (
                      <StickerAgent mood={turnMood} size="md" />
                    ) : null}
                    <div className="turn-body">
                      {parsed.prose || files.length ? (
                        <div className={`bubble ${message.role}`}>
                          {parsed.prose ? (
                            streamingThis ? <StreamProse text={parsed.prose} caret /> : <p>{parsed.prose}</p>
                          ) : null}
                          {files.length > 0 ? (
                            <ul className="message-files">
                              {files.map((name) => <li key={name}>{name}</li>)}
                            </ul>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
              {waitingForToken ? (
                <article className="turn assistant thinking-turn">
                  <StickerAgent mood="thinking" size="md" />
                  <div className="bubble assistant thinking-bubble">
                    <span className="thinking-dots" aria-label="Thinking"><i /><i /><i /></span>
                  </div>
                </article>
              ) : null}
            </div>
          </div>

          <div className="composer-dock">
            <div className="composer-inner">
              {showIntentPicker ? (
                <div className="intent-picker">
                  <p className="intent-heading">What do you want to do?</p>
                  <div className="intent-cards">
                    {WORKFLOW_INTENTS.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        className={`intent-card ${intent === card.id ? "is-selected" : ""}`}
                        disabled={busy}
                        onClick={() => chooseIntent(card.id)}
                      >
                        <strong>{card.title}</strong>
                        <span>{card.subtitle}</span>
                      </button>
                    ))}
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
                            intentRef.current = "improve";
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
              ) : null}

              <form className="chat-composer" onSubmit={handleSubmit}>
                {pendingFiles.length > 0 ? (
                  <ul className="pending-files" aria-label="Files to attach">
                    {pendingFiles.map((file, index) => (
                      <li key={`${file.name}-${index}`}>
                        <span>{file.name}</span>
                        <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setPendingFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="composer-row">
                  <label className="attach-button">
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
                      rows={2}
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
                  <button className="send-button" type="submit" disabled={busy} aria-label="Send message">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 19V5m0 0 5 5M12 5 7 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                <p className="attach-hint">{ATTACH_HINT}</p>
                {error ? <p className="form-error" role="alert">{error}</p> : null}
              </form>
              <p className="mode-note">
                <span>Mapper updates the brief as you refine the workflow.</span>
                <span className="mode-pill"><i />{mode === "live" ? "Live model" : "Demo mode"}</span>
              </p>
            </div>
          </div>
        </section>

        {canvasReport ? (
          <BriefCanvas
            report={canvasReport}
            usedExample={usedExample}
            open={mobileCanvasOpen}
            onClose={() => setMobileCanvasOpen(false)}
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
