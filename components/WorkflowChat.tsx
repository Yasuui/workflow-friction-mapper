"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { FlowMark } from "@/components/FlowMark";
import { StickerAgent, type StickerMood } from "@/components/StickerAgent";
import { ReportCard } from "@/components/ReportCard";
import {
  AGENT_GREETING,
  PRODUCT_LINE,
  PRODUCT_NAME,
  WORKFLOW_STARTERS,
  splitAgentOutput,
} from "@/lib/agent-protocol";
import { FILE_ACCEPT, MAX_FILES, filesToChatParts } from "@/lib/chat-attachments";
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
    .map((part) => part.text)
    .join("\n");
}

function fileNames(message: UIMessage): string[] {
  return message.parts
    .filter((part): part is { type: "file"; filename?: string; mediaType: string; url: string } => part.type === "file")
    .map((part) => part.filename ?? "attachment");
}

export function WorkflowChat() {
  const [draft, setDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [usedExample, setUsedExample] = useState(false);
  const usedExampleRef = useRef(false);
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const logRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, setMessages, status, stop } = useChat({
    messages: [GREETING_MESSAGE],
    transport: new DefaultChatTransport({ api: "/api/optimize" }),
    onFinish: ({ message }) => {
      const report = splitAgentOutput(textOf(message)).report;
      if (!report) return;
      captureProductEvent("analysis_completed", {
        ...resultContextFromAgent(report),
        primary_opportunity: report.opportunities[0]?.title.slice(0, 40) || "none",
        used_example: usedExampleRef.current,
      });
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const hasUser = messages.some((message) => message.role === "user");

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
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const lastAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages],
  );
  const lastReport = lastAssistant ? splitAgentOutput(textOf(lastAssistant)).report : null;
  const mood: StickerMood =
    status === "submitted" ? "thinking" : status === "streaming" ? "streaming" : lastReport ? "done" : "idle";

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

  async function submitConversation(text: string, files: File[], fromExample = false) {
    const trimmed = text.trim();
    if (!trimmed && files.length === 0) {
      setError("Add a short description of the workflow first.");
      captureProductEvent("analysis_validation_failed", { reason: "missing_description" });
      return;
    }
    const { parts, note } = await filesToChatParts(files);
    setError(note);
    if (fromExample) { setUsedExample(true); usedExampleRef.current = true; }
    setDraft("");
    setPendingFiles([]);
    await sendMessage({
      text: trimmed,
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

  function reset() {
    if (lastReport) captureProductEvent("analysis_reset", resultContextFromAgent(lastReport));
    stop();
    setMessages([GREETING_MESSAGE]);
    setDraft("");
    setPendingFiles([]);
    setError("");
    setUsedExample(false);
    usedExampleRef.current = false;
    composerRef.current?.focus();
  }

  const thread = messages.length ? messages : [GREETING_MESSAGE];

  return (
    <>
      <header className="app-chrome">
        <Link className="wordmark" href="/">
          <span className="mark mark-idle" aria-hidden="true"><FlowMark /></span>
          <span className="wordmark-copy">
            <strong>{PRODUCT_NAME}</strong>
            <small>{PRODUCT_LINE}</small>
          </span>
        </Link>
        <button type="button" className="ghost-button" onClick={reset}>New</button>
      </header>

      <div className="thread" ref={logRef} role="log" aria-live="polite" aria-label="Workflow conversation">
        <div className="thread-inner">
          {thread.map((message, index) => {
            const raw = textOf(message);
            const parsed = message.role === "assistant" ? splitAgentOutput(raw) : { prose: raw, report: null, streamingFence: false };
            const isLast = index === thread.length - 1;
            const streamingThis = isLast && message.role === "assistant" && status === "streaming";
            const files = fileNames(message);
            return (
              <article key={message.id} className={`turn ${message.role}`}>
                {message.role === "assistant" ? (
                  <StickerAgent mood={streamingThis ? "streaming" : parsed.report ? "done" : "idle"} size="md" />
                ) : null}
                <div className="turn-body">
                  {parsed.prose || files.length ? (
                    <div className={`bubble ${message.role}`}>
                      {parsed.prose ? <p>{parsed.prose}</p> : null}
                      {files.length > 0 ? (
                        <ul className="message-files">
                          {files.map((name) => <li key={name}>{name}</li>)}
                        </ul>
                      ) : null}
                      {streamingThis ? <span className="stream-caret" aria-hidden="true" /> : null}
                    </div>
                  ) : null}
                  {parsed.report ? <ReportCard report={parsed.report} usedExample={usedExample} /> : null}
                </div>
              </article>
            );
          })}
          {status === "submitted" ? (
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
          {!hasUser ? (
            <div className="starter-chips" aria-label="Suggested starter prompts">
              {WORKFLOW_STARTERS.map((starter) => (
                <button
                  key={starter.label}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    captureProductEvent("example_selected", { example_label: starter.analyticsLabel });
                    void submitConversation(starter.prompt, [], true);
                  }}
                >
                  {starter.label}
                </button>
              ))}
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
                <span className="sr-only">Message</span>
                <textarea
                  id="workflow-message"
                  ref={composerRef}
                  rows={2}
                  value={draft}
                  maxLength={4000}
                  placeholder="When a request arrives, we…"
                  onChange={(event) => {
                    setDraft(event.target.value);
                    if (event.target.value.trim()) setError("");
                  }}
                  onKeyDown={handleComposerKey}
                />
              </label>
              <button className="send-button" type="submit" disabled={busy}>
                Send <span aria-hidden="true">→</span>
              </button>
            </div>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
          </form>
          <p className="mode-note">
            <StickerAgent mood={mood} size="sm" />
            <span>{mode === "live" ? "Live model" : "Demo mode"}</span>
          </p>
        </div>
      </div>
    </>
  );
}
