"use client";

import { FormEvent, useRef, useState } from "react";
import { analyzeWorkflow, type Sensitivity, type WorkflowInput, type WorkflowReport } from "@/lib/workflow-analysis";

const initialInput: WorkflowInput = { description: "", minutesPerRun: 20, runsPerWeek: 5, handoffs: 2, sensitivity: "internal" };
const exampleInput: WorkflowInput = {
  description: "Export requests from Excel. Review each row and write meeting notes. Send reminders to Teams and monitor the IT case until it closes.",
  minutesPerRun: 30,
  runsPerWeek: 10,
  handoffs: 3,
  sensitivity: "internal",
};

function reportToMarkdown(report: WorkflowReport) {
  return `# Workflow Friction Report

## Executive summary
${report.summary}

- Friction score: ${report.frictionScore}/100
- Automation readiness: ${report.automationReadiness}/100
- Annual manual time: ${report.annualManualHours} hours
- Potential time reclaimed: ${report.potentialHoursReclaimed} hours

_${report.estimateNote}_

## Current workflow
${report.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}

## Automation opportunities
${report.opportunities.map((item) => `- **${item.title}** — ${item.rationale}`).join("\n")}

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
            <button className="text-button" type="button" onClick={() => setInput(exampleInput)}>Try example <span aria-hidden="true">↗</span></button>
          </div>
          <form onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="workflow-description">What happens today?</label>
            <textarea id="workflow-description" value={input.description} onChange={(event) => setInput((current) => ({ ...current, description: event.target.value }))} placeholder="Example: Export requests from Excel, review each row, send reminders, then monitor the case until it closes." rows={5} maxLength={900} aria-describedby="privacy-note" />
            <div className="input-grid">
              <label><span>Minutes / run</span><input type="number" min="0" max="1440" value={input.minutesPerRun} onChange={(event) => updateNumber("minutesPerRun", event.target.value)} /></label>
              <label><span>Runs / week</span><input type="number" min="0" max="1000" value={input.runsPerWeek} onChange={(event) => updateNumber("runsPerWeek", event.target.value)} /></label>
              <label><span>Handoffs</span><input type="number" min="0" max="20" value={input.handoffs} onChange={(event) => updateNumber("handoffs", event.target.value)} /></label>
              <label><span>Data type</span><select value={input.sensitivity} onChange={(event) => setInput((current) => ({ ...current, sensitivity: event.target.value as Sensitivity }))}><option value="public">Public / synthetic</option><option value="internal">Internal</option><option value="sensitive">Sensitive</option></select></label>
            </div>
            <div className="privacy-row" id="privacy-note">
              <div className="privacy-chip"><span aria-hidden="true">●</span> Analysis stays on this device</div>
              <p>Do not enter personal, confidential, regulated, or employer-owned information.</p>
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
          <article><span>01</span><h3>Map</h3><p>Break the current process into visible steps and handoffs.</p></article>
          <article><span>02</span><h3>Measure</h3><p>Estimate recurring effort and where friction is likely to compound.</p></article>
          <article><span>03</span><h3>Improve</h3><p>Choose one bounded automation with safeguards and human ownership.</p></article>
        </div>
      </section>

      {report && <section className="results-shell" ref={resultsRef} aria-labelledby="results-title">
        <div className="results-header">
          <div><span className="section-kicker">Your workflow signal</span><h2 id="results-title">A clearer place to start.</h2></div>
          <div className="results-actions"><button type="button" onClick={copyReport}>{copyStatus}</button><button type="button" onClick={downloadReport}>Download .md</button><button type="button" onClick={reset}>Reset</button></div>
        </div>
        <p className="executive-summary">{report.summary}</p>
        <div className="metric-grid">
          <article><span>Friction score</span><strong>{report.frictionScore}<small>/100</small></strong><div className="meter"><i style={{ width: `${report.frictionScore}%` }} /></div></article>
          <article><span>Automation readiness</span><strong>{report.automationReadiness}<small>/100</small></strong><div className="meter"><i style={{ width: `${report.automationReadiness}%` }} /></div></article>
          <article><span>Annual manual time</span><strong>{report.annualManualHours}<small> hrs</small></strong><em>Illustrative</em></article>
          <article><span>Potentially reclaimed</span><strong>{report.potentialHoursReclaimed}<small> hrs</small></strong><em>Illustrative</em></article>
        </div>
        <p className="estimate-note">{report.estimateNote}</p>
        <div className="report-grid">
          <article className="report-panel"><span className="panel-label">Current workflow</span><ol className="workflow-list">{report.steps.map((step, index) => <li key={`${step}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>)}</ol></article>
          <article className="report-panel"><span className="panel-label">Automation opportunities</span><div className="opportunity-list">{report.opportunities.map((item) => <div key={item.id} className="opportunity-item"><div><h3>{item.title}</h3><span>{item.impact}</span></div><p>{item.rationale}</p></div>)}</div></article>
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
