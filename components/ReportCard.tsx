"use client";

import { useState } from "react";
import {
  type AgentReport,
  reportToMarkdown,
  reportToPlainText,
} from "@/lib/agent-protocol";
import { downloadBriefMarkdown, downloadBriefPdf } from "@/lib/brief-export";
import { captureProductEvent, resultContextFromAgent } from "@/lib/product-analytics";

const feedbackReasons = [
  { value: "clear_next_step", label: "Clear next step" },
  { value: "wrong_priority", label: "Wrong priority" },
  { value: "missing_context", label: "Missing context" },
  { value: "unclear_estimate", label: "Unclear estimate" },
  { value: "other", label: "Something else" },
] as const;

export function ReportCard({ report, usedExample }: { report: AgentReport; usedExample: boolean }) {
  const [copyStatus, setCopyStatus] = useState("Copy brief");
  const [feedbackValue, setFeedbackValue] = useState<"yes" | "partly" | "no" | null>(null);
  const [feedbackReason, setFeedbackReason] = useState<(typeof feedbackReasons)[number]["value"] | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const context = resultContextFromAgent(report);

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

  function submitFeedback() {
    if (!feedbackValue || !feedbackReason) return;
    captureProductEvent("feedback_submitted", {
      ...context,
      feedback_value: feedbackValue,
      feedback_reason: feedbackReason,
    });
    setFeedbackSent(true);
  }

  return (
    <section className="report-card" aria-label="Workflow optimization brief">
      <header className="report-card-head">
        <span className="panel-label">Optimization brief</span>
        <div className="results-actions">
          <button type="button" onClick={copyBrief}>{copyStatus}</button>
          <button type="button" onClick={downloadMd}>Download .md</button>
          <button type="button" onClick={downloadPdf}>Download .pdf</button>
        </div>
      </header>
      {report.summary ? <p className="report-summary">{report.summary}</p> : null}
      {report.hours.annualManual != null ? (
        <p className="report-hours">
          <strong>{report.hours.annualManual} hrs/year</strong>
          <span> from stated volume only · {report.hours.kind}</span>
        </p>
      ) : null}

      <div className="report-columns">
        <article>
          <span className="panel-label">Current steps</span>
          <ol className="workflow-list">
            {report.steps.map((step, index) => (
              <li key={`${step}-${index}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </article>
        <article>
          <span className="panel-label">Friction</span>
          <ul className="evidence-list">
            {report.friction.map((item) => (
              <li key={item.issue}>
                <strong>{item.step}</strong>
                <span>{item.issue}</span>
                <em>{item.kind}: {item.evidence}</em>
              </li>
            ))}
          </ul>
        </article>
      </div>

      {report.bottlenecks.length > 0 ? (
        <article>
          <span className="panel-label">Bottlenecks</span>
          <ul className="evidence-list">
            {report.bottlenecks.map((item) => (
              <li key={item.issue}>
                <strong>{item.step}</strong>
                <span>{item.issue}</span>
                <em>{item.kind}: {item.evidence}</em>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      <article>
        <span className="panel-label">Opportunities</span>
        <div className="opportunity-list">
          {report.opportunities.map((item, index) => (
            <div key={item.title} className="opportunity-item">
              <div>
                <h3><b>{index + 1}</b>{item.title}</h3>
                <span>{item.kind}</span>
              </div>
              <p>{item.rationale}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="first-move-panel">
        <span className="panel-label">Recommended first move</span>
        <p>{report.firstMove}</p>
      </article>

      {report.assumptions.length > 0 ? (
        <article className="assumptions">
          <span className="panel-label">Facts vs assumptions</span>
          <ul>{report.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
      ) : null}

      {report.question ? <p className="report-question">{report.question}</p> : null}

      <aside className="feedback-panel compact-feedback" aria-labelledby="feedback-title">
        {feedbackSent ? (
          <div className="feedback-thanks"><strong>Feedback recorded.</strong><span>Thank you.</span></div>
        ) : (
          <>
            <div>
              <strong id="feedback-title">Was the first recommendation useful?</strong>
            </div>
            <div className="feedback-controls">
              <div className="feedback-options" aria-label="Recommendation usefulness">
                {(["yes", "partly", "no"] as const).map((value) => (
                  <button key={value} type="button" className={feedbackValue === value ? "selected" : ""} onClick={() => setFeedbackValue(value)}>
                    {value === "yes" ? "Yes" : value === "partly" ? "Partly" : "No"}
                  </button>
                ))}
              </div>
              <div className="feedback-reasons" aria-label="Feedback reason">
                {feedbackReasons.map((reason) => (
                  <button key={reason.value} type="button" className={feedbackReason === reason.value ? "selected" : ""} onClick={() => setFeedbackReason(reason.value)}>
                    {reason.label}
                  </button>
                ))}
              </div>
              <button className="feedback-submit" type="button" disabled={!feedbackValue || !feedbackReason} onClick={submitFeedback}>Submit feedback</button>
            </div>
          </>
        )}
      </aside>
      <span hidden>{usedExample ? "example" : "custom"}</span>
    </section>
  );
}
