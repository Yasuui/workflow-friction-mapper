"use client";

import type { AgentReport } from "@/lib/agent-protocol";
import { ReportCard } from "@/components/ReportCard";

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
  return (
    <aside className={`brief-canvas ${open ? "is-open" : ""}`} aria-label="Optimization brief canvas">
      <button type="button" className="canvas-close" onClick={onClose} aria-label="Close brief">
        Close
      </button>
      <ReportCard report={report} usedExample={usedExample} />
    </aside>
  );
}
