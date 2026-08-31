"use client";

import { useState } from "react";
import {
  type AgentReport,
  type EvidenceKind,
  factsAndAssumptions,
  formatHours,
  reportToMarkdown,
  reportToPlainText,
  stepCaption,
  stepIsFriction,
  stripKindPrefix,
} from "@/lib/agent-protocol";
import { downloadBriefMarkdown, downloadBriefPdf } from "@/lib/brief-export";
import { captureProductEvent, resultContextFromAgent, type FeedbackReason } from "@/lib/product-analytics";

const FEEDBACK_REASON: Record<"yes" | "partly" | "no", FeedbackReason> = {
  yes: "clear_next_step",
  partly: "missing_context",
  no: "wrong_priority",
};

function KindPill({ kind }: { kind: EvidenceKind }) {
  const assumption = kind === "inference";
  return (
    <span className={`kind-pill ${assumption ? "is-assumption" : "is-fact"}`}>
      <i />
      {assumption ? "Assumption" : "Fact"}
    </span>
  );
}

export function ReportCard({ report, usedExample }: { report: AgentReport; usedExample: boolean }) {
  const [copyStatus, setCopyStatus] = useState("Copy");
  const [feedbackValue, setFeedbackValue] = useState<"yes" | "partly" | "no" | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const context = resultContextFromAgent(report);
  const { facts, assumptions } = factsAndAssumptions(report);
  const subtitle = report.steps[0] ? `${report.steps[0]} · updated just now` : "updated just now";

  async function copyBrief() {
    await navigator.clipboard.writeText(reportToMarkdown(report));
    setCopyStatus("Copied");
    captureProductEvent("report_copied", context);
  }

  function downloadMd() {
    downloadBriefMarkdown(reportToMarkdown(report));
    captureProductEvent("report_downloaded", context);
  }

  function downloadPdf() {
    downloadBriefPdf("Workflow optimization brief", reportToPlainText(report));
    captureProductEvent("report_downloaded", context);
  }

  function submitFeedback(value: "yes" | "partly" | "no") {
    if (feedbackSent) return;
    setFeedbackValue(value);
    captureProductEvent("feedback_submitted", {
      ...context,
      feedback_value: value,
      feedback_reason: FEEDBACK_REASON[value],
    });
    setFeedbackSent(true);
  }

  return (
    <section className="report-card" aria-label="Workflow optimization brief">
      <header className="report-card-head">
        <div>
          <span className="panel-label">Optimization brief</span>
          <p className="report-kicker">{subtitle}</p>
        </div>
        <div className="results-actions" aria-label="Brief tools">
          <button type="button" onClick={copyBrief}>
            <CopyIcon />
            {copyStatus}
          </button>
          <button type="button" onClick={downloadMd}>
            <DownloadIcon />
            Download .md
          </button>
          <button type="button" onClick={downloadPdf}>
            <FileDownIcon />
            Download .pdf
          </button>
        </div>
      </header>

      <div className="report-scroll">
        <div className="report-inner">
          <section className="brief-hero">
            <div>
              {report.hours.annualManual != null ? (
                <>
                  <span className="hero-hours">
                    {formatHours(report.hours.annualManual)} <small>hrs/year</small>
                  </span>
                  <span className="hero-caption">from stated volume only</span>
                </>
              ) : (
                <>
                  <span className="hero-hours hero-hours-muted">Hours not stated</span>
                  <span className="hero-caption">from stated volume only</span>
                </>
              )}
            </div>
            {report.firstMove ? (
              <div className="hero-move">
                <span className="panel-label">First move</span>
                <p>{stripKindPrefix(report.firstMove)}</p>
              </div>
            ) : null}
          </section>

          {report.steps.length > 0 ? (
            <section>
              <span className="panel-label">Workflow spine</span>
              <ol className="spine-list">
                {report.steps.map((step, index) => {
                  const friction = stepIsFriction(report, step);
                  const caption = stepCaption(report, step);
                  const last = index === report.steps.length - 1;
                  return (
                    <li key={`${step}-${index}`} className={last ? "is-last" : ""}>
                      {last ? null : <span className={`spine-line ${friction ? "is-friction" : ""}`} />}
                      <span className={`spine-index ${friction ? "is-friction" : ""}`}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className={`spine-card ${friction ? "is-friction" : ""}`}>
                        <strong>{step}</strong>
                        {caption ? <p>{caption}</p> : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}

          {report.friction.length > 0 || report.bottlenecks.length > 0 ? (
            <section className="evidence-grid">
              {report.friction.map((item) => (
                <article key={`friction-${item.issue}`}>
                  <div className="evidence-head">
                    <span className="panel-label">Friction</span>
                    <KindPill kind={item.kind} />
                  </div>
                  <h2>{stripKindPrefix(item.issue)}</h2>
                  <p>{stripKindPrefix(item.evidence)}</p>
                </article>
              ))}
              {report.bottlenecks.map((item) => (
                <article key={`bottleneck-${item.issue}`}>
                  <div className="evidence-head">
                    <span className="panel-label">Bottleneck</span>
                    <KindPill kind={item.kind} />
                  </div>
                  <h2>{stripKindPrefix(item.issue)}</h2>
                  <p>{stripKindPrefix(item.evidence)}</p>
                </article>
              ))}
            </section>
          ) : null}

          {report.opportunities.length > 0 ? (
            <section>
              <span className="panel-label">Opportunities</span>
              <div className="opportunity-grid">
                {report.opportunities.map((item, index) => (
                  <article key={item.title} className="opportunity-item">
                    <div className="opportunity-index">{index + 1}</div>
                    <h2>{stripKindPrefix(item.title)}</h2>
                    <p>{stripKindPrefix(item.rationale)}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {report.firstMove ? (
            <article className="first-move-panel">
              <span className="panel-label">Recommended first move</span>
              <p>{stripKindPrefix(report.firstMove)}</p>
            </article>
          ) : null}

          {facts.length > 0 || assumptions.length > 0 ? (
            <details className="facts-block">
              <summary>
                <span>Facts and assumptions</span>
                <ChevronIcon />
              </summary>
              <div className="facts-body">
                {facts.map((item) => (
                  <p key={`fact-${item}`}>
                    <KindPill kind="fact" />
                    {item}
                  </p>
                ))}
                {assumptions.map((item) => (
                  <p key={`assumption-${item}`}>
                    <KindPill kind="inference" />
                    {item}
                  </p>
                ))}
              </div>
            </details>
          ) : null}

          {report.question ? <p className="report-question">{report.question}</p> : null}
        </div>
      </div>

      <aside className="feedback-panel compact-feedback" aria-labelledby="feedback-title">
        {feedbackSent ? (
          <div className="feedback-thanks">
            <strong>Feedback recorded.</strong>
            <span>Thank you.</span>
          </div>
        ) : (
          <>
            <span id="feedback-title">Was the first recommendation useful?</span>
            <div className="feedback-options" aria-label="Recommendation usefulness">
              {(["yes", "partly", "no"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={feedbackValue === value ? "selected" : ""}
                  onClick={() => submitFeedback(value)}
                >
                  {value === "yes" ? "Yes" : value === "partly" ? "Partly" : "No"}
                </button>
              ))}
            </div>
          </>
        )}
      </aside>
      <span hidden>{usedExample ? "example" : "custom"}</span>
    </section>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="9" width="11" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v12m0 0 4-4m-4 4-4-4M5 19h14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FileDownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M14 3v5h5M12 11v6m0 0 2.5-2.5M12 17l-2.5-2.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
