"use client";

import { WorkflowChat } from "@/components/WorkflowChat";
import { FlowMark } from "@/components/FlowMark";
import { captureProductEvent } from "@/lib/product-analytics";

export function WorkflowStudio() {
  return (
    <main className="app-shell">
      <WorkflowChat />
      <footer className="app-footer">
        <span className="footer-brand"><FlowMark /> Workflow Friction Mapper</span>
        <span className="footer-links">
          <a href="https://www.linkedin.com/in/yonisdiriye/" target="_blank" rel="noreferrer" onClick={() => captureProductEvent("contact_clicked", { destination: "linkedin" })}>Connect on LinkedIn</a>
          <a href="https://github.com/Yasuui/workflow-friction-mapper" target="_blank" rel="noreferrer" onClick={() => captureProductEvent("contact_clicked", { destination: "github" })}>View the source</a>
          <span>© {new Date().getFullYear()} Yonis Diriye</span>
        </span>
      </footer>
    </main>
  );
}
