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
  quoteAppearsIn,
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

// A pilot plan every recommendation carries: what to measure and when to stop. Savings are never
// claimed; only a measured before/after can show them.
const PILOT_STEPS = [
  "Run the change beside the current process for two weeks, on real work.",
  "Record handling minutes per run, exceptions, and rework, before and after.",
  "Stop or roll back if a request is lost or routed wrongly.",
];

export function ReportCard({ report, source, usedExample }: { report: AgentReport; source: string; usedExample: boolean }) {
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
  const claims = [...report.friction, ...report.bottlenecks, ...report.opportunities];
  const linked = claims.filter((item) => quoteAppearsIn(item.evidence, source));
  const unlinkedCount = claims.length - linked.length + report.assumptions.length;
  const leadQuote = linked[0] ?? null;
  const abstained = !doThis.length && !report.friction.length && !report.automations.length;
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
            <h2>{briefKicker(report.intent)}</h2>
            <p className="report-kicker">{subtitle}</p>
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
          <section className="brief-section" id="brief-overview" aria-label="Overview">
            <div className={`first-move ${abstained ? "is-abstained" : ""}`}>
              <span className="panel-label">{abstained ? "No supported improvement yet" : "Recommended move"}</span>
              <p>{stripKindPrefix(report.firstMove) || "Name the step that still needs a person every time."}</p>
              {leadQuote ? (
                <figure className="lead-quote">
                  <blockquote>{stripKindPrefix(leadQuote.evidence).replace(/^[“"]|[”"]$/g, "")}</blockquote>
                  <figcaption>From your description{"step" in leadQuote && leadQuote.step ? ` · ${stripKindPrefix(leadQuote.step)}` : ""}</figcaption>
                </figure>
              ) : null}
            </div>

            {report.question ? (
              <p className="report-question"><strong>Open question</strong>{report.question}</p>
            ) : null}

            {meaning ? (
              <div className="meaning-panel">
                <span className="panel-label">What this is telling you</span>
                <p>{meaning}</p>
              </div>
            ) : null}

            <dl className="proof-strip">
              <div>
                <dt>Manual workload</dt>
                <dd>
                  {report.hours.annualManual != null ? <>{formatHours(report.hours.annualManual)}<small> hrs/yr</small></> : <span className="is-muted">Not stated</span>}
                </dd>
                <span>{report.hours.annualManual != null ? "From your stated volume. Workload, not savings." : "Add minutes per run and runs per week."}</span>
              </div>
              <div>
                <dt>{report.intent === "create" ? "Proposed steps" : "Steps mapped"}</dt>
                <dd>{workflowSteps.length}</dd>
                <span>{markFriction ? `${frictionSteps} with possible friction` : "ready to pilot"}</span>
              </div>
              <div>
                <dt>Traceable to your words</dt>
                <dd>{linked.length}<small> of {claims.length}</small></dd>
                <span>{unlinkedCount} assumption{unlinkedCount === 1 ? "" : "s"} labelled as such</span>
              </div>
            </dl>

            {!abstained && report.intent !== "create" ? (
              <div className="pilot-panel">
                <span className="panel-label">How to test it</span>
                <ol>
                  {PILOT_STEPS.map((step) => <li key={step}>{step}</li>)}
                </ol>
              </div>
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
