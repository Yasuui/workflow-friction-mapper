"use client";

import { useEffect, useRef } from "react";
import type { AgentReport } from "@/lib/agent-protocol";
import { ReportCard } from "@/components/ReportCard";

export function BriefCanvas({
  report,
  source,
  usedExample,
  open,
  modal,
  onClose,
}: {
  report: AgentReport;
  /** What the person typed, so the brief can show which claims quote it. */
  source: string;
  usedExample: boolean;
  open: boolean;
  /** True while the brief is a full-screen overlay on small screens. */
  modal: boolean;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // As an overlay the brief behaves like a dialog, so move focus into it when it opens.
  useEffect(() => {
    if (modal) closeRef.current?.focus();
  }, [modal]);

  return (
    <aside
      id="brief-canvas"
      tabIndex={-1}
      className={`brief-canvas ${open ? "is-open" : ""}`}
      role={modal ? "dialog" : undefined}
      aria-modal={modal || undefined}
      aria-label="Optimization brief canvas"
    >
      <button ref={closeRef} type="button" className="canvas-close" onClick={onClose} aria-label="Close brief">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Close
      </button>
      <ReportCard report={report} source={source} usedExample={usedExample} />
    </aside>
  );
}
