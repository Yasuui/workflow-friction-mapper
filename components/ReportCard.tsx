"use client";

import { useEffect, useRef, useState } from "react";
import {
  briefKicker,
  reportMeaning,
  type AgentReport,
  type EvidenceItem,
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

type SectionId = "overview" | "actions" | "workflow" | "evidence";
type EvidenceFilter = "all" | EvidenceKind;

function KindPill({ kind }: { kind: EvidenceKind }) {
  const assumption = kind === "inference";
  return (
    <span className={`kind-pill ${assumption ? "is-assumption" : "is-fact"}`}>
      <i />
      {assumption ? "Assumption" : "Fact"}
    </span>
  );
}

function EvidenceCard({ item, type }: { item: EvidenceItem; type: "Friction" | "Bottleneck" }) {
  const step = stripKindPrefix(item.step);
  return (
    <article>
      <div className="evidence-head">
        <span className={`evidence-type ${type === "Bottleneck" ? "is-bottleneck" : ""}`}><i />{type}</span>
        <KindPill kind={item.kind} />
      </div>
      <h3>{stripKindPrefix(item.issue)}</h3>
      <p>{stripKindPrefix(item.evidence)}</p>
      {step ? <p className="evidence-step">Step: {step}</p> : null}
    </article>
  );
}

export function ReportCard({ report, usedExample }: { report: AgentReport; usedExample: boolean }) {
  const [copyStatus, setCopyStatus] = useState("Copy");
  const [feedbackValue, setFeedbackValue] = useState<"yes" | "partly" | "no" | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [evidenceFilter, setEvidenceFilter] = useState<EvidenceFilter>("all");
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const scrollRef = useRef<HTMLDivElement>(null);
  const context = resultContextFromAgent(report);
  const { facts, assumptions } = factsAndAssumptions(report);
  const subtitle = report.steps[0] ? `${report.steps[0]} · updated just now` : "updated just now";
  const meaning = reportMeaning(report);
  const doThis = report.doThis.length
    ? report.doThis
    : report.opportunities.slice(0, 3).map((item) => ({
        action: stripKindPrefix(item.title),
        why: stripKindPrefix(item.rationale),
        example: stripKindPrefix(item.evidence),
      }));
  const workflowSteps = report.intent === "create"
    ? (report.proposedSteps.length ? report.proposedSteps : report.steps)
    : report.steps;
  const workflowLabel = report.intent === "create" ? "Proposed workflow" : "Workflow";
  const markFriction = report.intent !== "create";
  const frictionSteps = markFriction ? workflowSteps.filter((step) => stepIsFriction(report, step)).length : 0;
  const issueCount = report.friction.length + report.bottlenecks.length;
  const evidenceTotal = facts.length + assumptions.length;
  const factShare = evidenceTotal ? Math.round((facts.length / evidenceTotal) * 100) : 0;
  const keep = (item: EvidenceItem) => evidenceFilter === "all" || item.kind === evidenceFilter;
  const friction = report.friction.filter(keep);
  const bottlenecks = report.bottlenecks.filter(keep);
  const countKind = (kind: EvidenceKind) =>
    [...report.friction, ...report.bottlenecks].filter((item) => item.kind === kind).length;

  const sections: Array<{ id: SectionId; label: string; count?: number }> = [{ id: "overview", label: "Overview" }];
  if (doThis.length || report.automations.length) sections.push({ id: "actions", label: "Actions", count: doThis.length + report.automations.length });
  if (workflowSteps.length) sections.push({ id: "workflow", label: workflowLabel, count: workflowSteps.length });
  if (issueCount || evidenceTotal) sections.push({ id: "evidence", label: "Evidence", count: issueCount });

  useEffect(() => {
    if (copyStatus === "Copy") return;
    const timeout = window.setTimeout(() => setCopyStatus("Copy"), 2000);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  function onScroll() {
    const container = scrollRef.current;
    if (!container) return;
    const top = container.getBoundingClientRect().top;
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 8;
    let current: SectionId = sections[0].id;
    for (const section of sections) {
      const el = document.getElementById(`brief-${section.id}`);
      if (el && el.getBoundingClientRect().top - top <= 56) current = section.id;
    }
    if (atBottom) current = sections[sections.length - 1].id;
    if (current !== activeSection) setActiveSection(current);
  }

  function jumpTo(id: SectionId) {
    setActiveSection(id);
    document.getElementById(`brief-${id}`)?.scrollIntoView({ block: "start" });
  }

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(reportToMarkdown(report));
      setCopyStatus("Copied");
      captureProductEvent("report_copied", context);
    } catch {
      setCopyStatus("Copy failed");
    }
  }

  function downloadMd() {
    downloadBriefMarkdown(reportToMarkdown(report));
    captureProductEvent("report_downloaded", context);
  }

  function downloadPdf() {
    downloadBriefPdf(briefKicker(report.intent), reportToPlainText(report));
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
        <div className="report-title-row">
          <div className="report-title">
            <h2>Automation plan</h2>
            <p className="report-kicker">{subtitle} · Proposed, not running</p>
          </div>
          <div className="results-actions" role="group" aria-label="Brief tools">
            <button type="button" onClick={copyBrief} aria-live="polite">
              <CopyIcon />
              {copyStatus}
            </button>
            <button type="button" onClick={downloadMd} aria-label="Download as Markdown">
              <DownloadIcon />
              .md
            </button>
            <button type="button" onClick={downloadPdf} aria-label="Download as PDF">
              <FileDownIcon />
              .pdf
            </button>
          </div>
        </div>
        <nav className="brief-tabs" aria-label="Brief sections">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              aria-current={activeSection === section.id}
              onClick={() => jumpTo(section.id)}
            >
              {section.label}
              {section.count ? <span className="tab-count">{section.count}</span> : null}
            </button>
          ))}
        </nav>
      </header>

      <div className="report-scroll" ref={scrollRef} onScroll={onScroll}>
        <div className="report-inner">
          {report.buildPlan ? (
            <section className="build-plan" aria-label="Automation build plan">
              <p className="plan-intro">Review the details before building. Confirm anything marked as missing.</p>
              {[
                ["Trigger", report.buildPlan.trigger || "Needs confirmation"],
                ["Inputs", report.buildPlan.inputs || "Needs confirmation"],
                ["Human review", report.buildPlan.approval || "Needs confirmation"],
                ["Failure handling", report.buildPlan.failure || "Needs confirmation"],
              ].slice(0, 2).map(([label, value], index) => (
                <div className="plan-row" key={label}>
                  <div className="plan-row-title"><span className="plan-number">{String(index + 1).padStart(2, "0")}</span><h2>{label}</h2></div><p>{value}</p>
                </div>
              ))}
              <div className="plan-row">
                <div className="plan-row-title"><span className="plan-number">03</span><h2>Steps</h2></div>
                <ol>{report.buildPlan.steps.length ? report.buildPlan.steps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>) : <li>Needs confirmation</li>}</ol>
              </div>
              {[["Human review", report.buildPlan.approval], ["Failure handling", report.buildPlan.failure]].map(([label, value], index) => (
                <div className="plan-row" key={label}>
                  <div className="plan-row-title"><span className="plan-number">{String(index + 4).padStart(2, "0")}</span><h2>{label}</h2></div><p>{value || "Needs confirmation"}</p>
                </div>
              ))}
              <div className="plan-row">
                <div className="plan-row-title"><span className="plan-number">06</span><h2>Test before launch</h2></div>
                <ul>{report.buildPlan.tests.length ? report.buildPlan.tests.map((test, index) => <li key={`${test}-${index}`}>{test}</li>) : <li>Needs confirmation</li>}</ul>
              </div>
            </section>
          ) : <p className="plan-notice">This response does not include a build plan. Ask Mapper to add a trigger, inputs, review steps and failure handling.</p>}
          <section className="brief-section" id="brief-overview" aria-label="Overview">
            <div className="kpi-grid">
              <div className="kpi">
                <span className="kpi-label">Manual time</span>
                {report.hours.annualManual != null ? (
                  <span className="kpi-value">{formatHours(report.hours.annualManual)}<small>hrs/yr</small></span>
                ) : (
                  <span className="kpi-value is-muted">—</span>
                )}
                <span className="kpi-caption">
                  {report.hours.annualManual != null ? "from stated volume only" : "Hours not stated"}
                </span>
              </div>
              <div className="kpi">
                <span className="kpi-label">{report.intent === "create" ? "Proposed steps" : "Steps mapped"}</span>
                <span className="kpi-value">{workflowSteps.length}</span>
                <span className="kpi-caption">
                  {markFriction ? `${frictionSteps} with friction` : "ready to pilot"}
                </span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Issues found</span>
                <span className={`kpi-value ${issueCount ? "is-friction" : "is-muted"}`}>{issueCount}</span>
                <span className="kpi-caption">
                  {report.friction.length} friction · {report.bottlenecks.length} bottleneck{report.bottlenecks.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Grounded in facts</span>
                <span className={`kpi-value ${evidenceTotal ? "" : "is-muted"}`}>
                  {evidenceTotal ? <>{factShare}<small>%</small></> : "—"}
                </span>
                <div className="kpi-meter" role="img" aria-label={`${facts.length} facts, ${assumptions.length} assumptions`}>
                  <span style={{ width: `${factShare}%` }} />
                </div>
              </div>
            </div>

            {report.firstMove ? (
              <div className="first-move">
                <span className="panel-label">First move</span>
                <p>{stripKindPrefix(report.firstMove)}</p>
              </div>
            ) : null}

            {meaning ? (
              <div className="meaning-panel">
                <span className="panel-label">What this is telling you</span>
                <p>{meaning}</p>
              </div>
            ) : null}

            {report.question ? (
              <p className="report-question"><strong>Open question</strong>{report.question}</p>
            ) : null}
          </section>

          {doThis.length > 0 || report.automations.length > 0 ? (
            <section className="brief-section" id="brief-actions" aria-label="Actions">
              {doThis.length > 0 ? (
                <>
                  <div className="section-head"><span className="panel-label">This week</span></div>
                  <ol className="dothis-list">
                    {doThis.map((item, index) => (
                      <li key={`${item.action}-${index}`}>
                        <span className="dothis-index">{index + 1}</span>
                        <div>
                          <strong>{item.action}</strong>
                          {item.why ? <p>{item.why}</p> : null}
                          {item.example ? <p className="quiet-example">{item.example}</p> : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </>
              ) : null}

              {report.automations.length > 0 ? (
                <>
                  <div className="section-head"><span className="panel-label">Automation options</span></div>
                  <div className="automation-grid">
                    {report.automations.map((item, index) => (
                      <article key={`${index}-${item.title}`} className="automation-item">
                        <div className="automation-head">
                          <h3>{item.title}</h3>
                          <span className={`effort-pill ${item.effort === "this week" ? "is-now" : ""}`}>{item.effort}</span>
                        </div>
                        <p>{item.how}</p>
                        {item.example ? <p className="quiet-example">{item.example}</p> : null}
                        {item.tools.length > 0 ? (
                          <p className="tool-line">{item.tools.map((tool) => <span key={tool}>{tool}</span>)}</p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </>
              ) : null}
            </section>
          ) : null}

          {workflowSteps.length > 0 ? (
            <section className="brief-section" id="brief-workflow" aria-label={workflowLabel}>
              <div className="section-head">
                <span className="panel-label">{workflowLabel}</span>
                {markFriction && frictionSteps > 0 ? (
                  <span className="legend" aria-hidden="true">
                    <span><i />Step</span>
                    <span><i className="is-friction" />Friction</span>
                  </span>
                ) : null}
              </div>
              <ol className="spine-list">
                {workflowSteps.map((step, index) => {
                  const flagged = markFriction && stepIsFriction(report, step);
                  const caption = markFriction ? stepCaption(report, step) : "";
                  const last = index === workflowSteps.length - 1;
                  return (
                    <li key={`${step}-${index}`} className={last ? "is-last" : ""}>
                      {last ? null : <span className={`spine-line ${flagged ? "is-friction" : ""}`} aria-hidden="true" />}
                      <span className={`spine-index ${flagged ? "is-friction" : ""}`}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className={`spine-card ${flagged ? "is-friction" : ""}`}>
                        <strong>{step}</strong>
                        {caption ? <p><span className="sr-only">Friction: </span>{caption}</p> : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}

          {issueCount > 0 || evidenceTotal > 0 ? (
            <section className="brief-section" id="brief-evidence" aria-label="Evidence">
              {issueCount > 0 ? (
                <>
                  <div className="section-head">
                    <span className="panel-label">Friction and bottlenecks</span>
                    <div className="segmented" role="group" aria-label="Filter by evidence type">
                      {([
                        ["all", "All", issueCount],
                        ["fact", "Facts", countKind("fact")],
                        ["inference", "Assumptions", countKind("inference")],
                      ] as const).map(([value, label, count]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={evidenceFilter === value}
                          onClick={() => setEvidenceFilter(value)}
                        >
                          {label}<span>{count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {friction.length || bottlenecks.length ? (
                    <div className="evidence-grid">
                      {friction.map((item, index) => (
                        <EvidenceCard key={`friction-${index}-${item.issue}`} item={item} type="Friction" />
                      ))}
                      {bottlenecks.map((item, index) => (
                        <EvidenceCard key={`bottleneck-${index}-${item.issue}`} item={item} type="Bottleneck" />
                      ))}
                    </div>
                  ) : (
                    <p className="evidence-empty">
                      No {evidenceFilter === "fact" ? "facts" : "assumptions"} behind these issues.
                    </p>
                  )}
                </>
              ) : null}

              {evidenceTotal > 0 ? (
                <details className="facts-block">
                  <summary>
                    <span>
                      Facts and assumptions · {facts.length} {facts.length === 1 ? "fact" : "facts"}, {assumptions.length} {assumptions.length === 1 ? "assumption" : "assumptions"}
                    </span>
                    <ChevronIcon />
                  </summary>
                  <div className="facts-body">
                    {facts.map((item) => (
                      <p key={`fact-${item}`}>
                        <KindPill kind="fact" />
                        <span>{item}</span>
                      </p>
                    ))}
                    {assumptions.map((item) => (
                      <p key={`assumption-${item}`}>
                        <KindPill kind="inference" />
                        <span>{item}</span>
                      </p>
                    ))}
                  </div>
                </details>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>

      <aside className="feedback-panel compact-feedback" aria-labelledby="feedback-title">
        {feedbackSent ? (
          <div className="feedback-thanks" role="status">
            <strong>Feedback recorded.</strong>
            <span>Thank you.</span>
          </div>
        ) : (
          <>
            <span id="feedback-title">Was the first recommendation useful?</span>
            <div className="feedback-options" role="group" aria-label="Recommendation usefulness">
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
