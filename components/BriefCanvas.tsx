"use client";

import { useEffect, useRef } from "react";
import type { AgentReport } from "@/lib/agent-protocol";
import { ReportCard } from "@/components/ReportCard";

const OVERLAY_QUERY = "(max-width: 1023px)";

export function BriefCanvas({
  report,
  usedExample,
  open,
  onClose,
}: {
  report: AgentReport;
  usedExample: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // On small screens the brief is a full-screen overlay, so move focus into it when it opens.
  useEffect(() => {
    if (open && window.matchMedia(OVERLAY_QUERY).matches) closeRef.current?.focus();
  }, [open]);

  return (
    <aside id="brief-canvas" tabIndex={-1} className={`brief-canvas ${open ? "is-open" : ""}`} aria-label="Optimization brief canvas">
      <button ref={closeRef} type="button" className="canvas-close" onClick={onClose} aria-label="Close brief">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Close
      </button>
      <ReportCard report={report} usedExample={usedExample} />
    </aside>
  );
}
