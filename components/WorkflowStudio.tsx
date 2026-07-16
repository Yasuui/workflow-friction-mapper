"use client";

import { FormEvent, useRef, useState } from "react";
import { analyzeWorkflow, type Sensitivity, type WorkflowInput, type WorkflowReport } from "@/lib/workflow-analysis";

const initialInput: WorkflowInput = { description: "", minutesPerRun: 20, runsPerWeek: 5, handoffs: 2, sensitivity: "internal" };
const workflowExamples: Array<{ label: string; input: WorkflowInput }> = [
  {
    label: "Data review",
    input: {
      description: "Export requests from Excel. Check required fields and remove duplicates. Send incomplete rows back to the owner. Add valid requests to the case queue.",
      minutesPerRun: 30,
      runsPerWeek: 10,
      handoffs: 2,
      sensitivity: "internal",
    },
  },
  {
    label: "Meeting follow-up",
    input: {
      description: "After a project meeting, write notes and action items. Confirm owners and due dates. Send reminders in Teams. Escalate overdue actions to the project lead.",
      minutesPerRun: 25,
      runsPerWeek: 4,
      handoffs: 3,
      sensitivity: "internal",
    },
  },
  {
    label: "Case monitoring",
    input: {
      description: "A new IT case enters the queue. Review its priority and assign an owner. Check the status each day. Notify the owner near the service deadline. Close the case after confirmation.",
      minutesPerRun: 15,
      runsPerWeek: 20,
      handoffs: 3,
      sensitivity: "internal",
    },
  },
  {
    label: "Onboarding",
    input: {
      description: "When a new employee starts, assign required courses and access tasks. Remind each owner before the due date. Check completion weekly. Escalate missing items before onboarding closes.",
      minutesPerRun: 40,
      runsPerWeek: 3,
      handoffs: 4,
      sensitivity: "internal",
    },
  },
];

function reportToMarkdown(report: WorkflowReport) {
  return `# Workflow Friction Report

## Executive summary
${report.summary}

- Friction score: ${report.frictionScore}/100
- Automation readiness: ${report.automationReadiness}/100
- Annual manual time: ${report.annualManualHours} hours
- Potential time reclaimed: ${report.potentialHoursReclaimed} hours
- Input confidence: ${report.inputConfidence} (${report.inputQualityScore}/100)

_${report.estimateNote}_

## Current workflow
${report.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}

## Automation opportunities
${report.opportunities.map((item) => `- **${item.title}** — ${item.rationale}`).join("\n")}

## Why these scores
${report.scoreDrivers.map((item) => `- ${item}`).join("\n")}

## Improve input accuracy
${report.inputImprovements.length ? report.inputImprovements.map((item) => `- ${item}`).join("\n") : "- The input includes a usable trigger, ordered steps, completion state, time, and frequency."}

## How to validate impact
${report.validationChecks.map((item) => `- ${item}`).join("\n")}

## Safeguards
${report.safeguards.map((item) => `- ${item}`).join("\n")}

## Recommended first move
${report.firstMove}

Generated locally with Workflow Friction Mapper by Yonis Diriye.`;
}

export function WorkflowStudio() {
  const [input, setInput] = useState<WorkflowInput>(initialInput);
  const [report, setReport] = useState<WorkflowReport | null>(null);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("Copy report");
  const resultsRef = useRef<HTMLElement>(null);

  function updateNumber(field: "minutesPerRun" | "runsPerWeek" | "handoffs", value: string) {
    setInput((current) => ({ ...current, [field]: Math.max(0, Number(value) || 0) }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.description.trim()) {
      setError("Add a short description of the workflow first.");
      return;
    }
    setError("");
    setCopyStatus("Copy report");
    setReport(analyzeWorkflow(input));
    window.requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function copyReport() {
    if (!report) return;
    await navigator.clipboard.writeText(reportToMarkdown(report));
    setCopyStatus("Copied");
  }

  function downloadReport() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([reportToMarkdown(report)], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "workflow-friction-report.md";
    link.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setInput(initialInput);
    setReport(null);
    setError("");
    setCopyStatus("Copy report");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="page-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <nav className="nav-wrap" aria-label="Primary navigation">
        <a className="wordmark" href="#top"><span className="mark" aria-hidden="true">WF</span><span>Workflow Friction Mapper</span></a>
        <a className="nav-link" href="#how-it-works">How it works</a>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="pulse-dot" /> Browser-only workflow analysis</div>
          <h1>Find the friction before you automate.</h1>
          <p className="hero-lede">Turn one manual workflow into a clear map of bottlenecks, automation opportunities, safeguards, and the next best move.</p>
          <div className="hero-trust"><span>No account</span><span>No upload</span><span>No tracking</span></div>
        </div>

        <div className="studio-card">
          <div className="card-heading">
            <div><span className="step-label">One step</span><h2>Describe one workflow</h2></div>
            <span className="input-mode">Paste or type</span>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="input-guide" id="workflow-help">
              <strong>Start with a trigger, then write each step in order.</strong>
              <span>Include actions, decisions, handoffs, and what “done” means. Short sentences work best.</span>
            </div>
            <label className="field-label" htmlFor="workflow-description">Paste or type the current process</label>
            <textarea id="workflow-description" value={input.description} onChange={(event) => setInput((current) => ({ ...current, description: event.target.value }))} placeholder="When [trigger] happens, we… Then… If… Finally…" rows={6} maxLength={900} aria-describedby="workflow-help privacy-note" />
            <div className="example-row" aria-label="Workflow examples">
              <span>Try an example</span>
              <div>{workflowExamples.map((example) => <button key={example.label} type="button" onClick={() => setInput(example.input)}>{example.label}</button>)}</div>
            </div>
            <div className="character-row"><span>Use synthetic or sanitized details</span><span>{input.description.length}/900</span></div>
            <div className="input-grid">
              <label><span>Minutes each time</span><input aria-label="Minutes each time" type="number" min="0" max="1440" value={input.minutesPerRun} onChange={(event) => updateNumber("minutesPerRun", event.target.value)} /></label>
              <label><span>Times per week</span><input aria-label="Times per week" type="number" min="0" max="1000" value={input.runsPerWeek} onChange={(event) => updateNumber("runsPerWeek", event.target.value)} /></label>
              <label><span>People / team handoffs</span><input aria-label="People or team handoffs" type="number" min="0" max="20" value={input.handoffs} onChange={(event) => updateNumber("handoffs", event.target.value)} /></label>
              <label><span>Data type</span><select value={input.sensitivity} onChange={(event) => setInput((current) => ({ ...current, sensitivity: event.target.value as Sensitivity }))}><option value="public">Public / synthetic</option><option value="internal">Internal</option><option value="sensitive">Sensitive</option></select></label>
            </div>
            <div className="privacy-row" id="privacy-note">
              <div className="privacy-chip"><span aria-hidden="true">●</span> Analysis stays on this device</div>
              <p>Paste or type only; file uploads are off by design. Do not enter personal, confidential, regulated, or employer-owned information.</p>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button" type="submit">Map this workflow <span aria-hidden="true">→</span></button>
          </form>
        </div>
      </section>

      <section className="method-section" id="how-it-works" aria-labelledby="method-title">
        <div className="section-kicker">From activity to evidence</div>
        <h2 id="method-title">A useful first conversation,<br />not a black-box verdict.</h2>
        <div className="method-grid">
          <article><span>01</span><h3>Map</h3><p>Use the trigger, ordered steps, decisions, and handoffs you provide.</p></article>
          <article><span>02</span><h3>Explain</h3><p>Show which inputs drive each directional score and estimate.</p></article>
          <article><span>03</span><h3>Improve</h3><p>Prioritize one fix, add safeguards, and define how to validate impact.</p></article>
        </div>
      </section>

      {report && <section className="results-shell" ref={resultsRef} aria-labelledby="results-title">
        <div className="results-header">
          <div><span className="section-kicker">Your workflow signal</span><div className={`confidence-badge confidence-${report.inputConfidence.toLowerCase()}`}><i /> Input confidence: <strong>{report.inputConfidence}</strong><small>· {report.inputQualityScore}/100</small></div><h2 id="results-title">A clearer place to start.</h2></div>
          <div className="results-actions"><button type="button" onClick={copyReport}>{copyStatus}</button><button type="button" onClick={downloadReport}>Download .md</button><button type="button" onClick={reset}>Reset</button></div>
        </div>
        <p className="executive-summary">{report.summary}</p>
        <div className="metric-grid">
          <article><span>Friction signal</span><strong>{report.frictionScore}<small>/100</small></strong><p>Higher means more recurring effort, handoffs, repeated work, or control needs.</p><div className="meter"><i style={{ width: `${report.frictionScore}%` }} /></div><em>Directional</em></article>
          <article><span>Automation fit</span><strong>{report.automationReadiness}<small>/100</small></strong><p>Higher means the workflow contains clearer, repeatable patterns that can be piloted safely.</p><div className="meter"><i style={{ width: `${report.automationReadiness}%` }} /></div><em>Directional</em></article>
          <article><span>Annual manual time</span><strong>{report.annualManualHours}<small> hrs</small></strong><p>Minutes each time × times per week × 52, converted to hours.</p><em>Calculated</em></article>
          <article><span>Potentially reclaimed</span><strong>{report.potentialHoursReclaimed}<small> hrs</small></strong><p>A conservative scenario based on matched fixes and data sensitivity—not a promise.</p><em>Illustrative</em></article>
        </div>
        <div className="accuracy-note"><strong>Accuracy note</strong><p>This is a directional heuristic, not an audit or forecast. Results can be off when steps, volume, handoffs, or data constraints are missing. Use the validation checks below before making a business case.</p></div>
        <details className="methodology-note"><summary>How the analysis works</summary><div><p><strong>Friction</strong> weighs recurring effort, handoffs, repeatable task signals, and data sensitivity.</p><p><strong>Automation fit</strong> looks for clear patterns such as validation, reminders, monitoring, summaries, onboarding, and approvals, then adjusts for handoffs and sensitive data.</p><p><strong>Time reclaimed</strong> applies a bounded scenario rate to the calculated annual hours. It must be replaced with measured pilot results.</p></div></details>
        <p className="estimate-note">{report.estimateNote}</p>
        {report.inputImprovements.length > 0 && <article className="quality-panel"><div><span className="panel-label">Improve input accuracy</span><strong>{report.inputConfidence} confidence</strong></div><ul>{report.inputImprovements.map((item) => <li key={item}><span aria-hidden="true">+</span>{item}</li>)}</ul></article>}
        <div className="explain-grid">
          <article className="explain-panel"><span className="panel-label">Why these scores</span><ul>{report.scoreDrivers.map((item) => <li key={item}><span aria-hidden="true">→</span>{item}</li>)}</ul></article>
          <article className="explain-panel"><span className="panel-label">How to validate impact</span><ol>{report.validationChecks.map((item, index) => <li key={item}><span>{index + 1}</span>{item}</li>)}</ol></article>
        </div>
        <div className="report-grid">
          <article className="report-panel"><span className="panel-label">Current workflow</span><ol className="workflow-list">{report.steps.map((step, index) => <li key={`${step}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>)}</ol></article>
          <article className="report-panel"><span className="panel-label">Prioritized fixes</span><div className="opportunity-list">{report.opportunities.map((item, index) => <div key={item.id} className="opportunity-item"><div><h3><b>{index + 1}</b>{item.title}</h3><span>{item.impact}</span></div><p>{item.rationale}</p></div>)}</div></article>
          <article className="report-panel safeguard-panel"><span className="panel-label">Safeguards before scale</span><ul>{report.safeguards.map((item) => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul></article>
          <article className="report-panel first-move-panel"><span className="panel-label">Recommended first move</span><p>{report.firstMove}</p><span className="small-note">Pilot → measure exceptions → review → expand</span></article>
        </div>
      </section>}

      <section className="contact-section">
        <span className="section-kicker">Built by Yonis Diriye</span><h2>Better systems start<br />with a clear map.</h2>
        <p>I build practical AI automation and full-stack tools that make work clearer, faster, and safer.</p>
        <div className="contact-links">
          <a href="https://www.linkedin.com/in/yonisdiriye/" target="_blank" rel="noreferrer">Connect on LinkedIn <span aria-hidden="true">↗</span></a>
          <a href="https://github.com/Yasuui/workflow-friction-mapper" target="_blank" rel="noreferrer">View the source <span aria-hidden="true">↗</span></a>
          <a href="https://cal.com/yonis-diriye" target="_blank" rel="noreferrer">Book a conversation <span aria-hidden="true">↗</span></a>
        </div>
      </section>
      <footer><span>Workflow Friction Mapper</span><span>Private by design · © {new Date().getFullYear()} Yonis Diriye</span></footer>
    </main>
  );
}
