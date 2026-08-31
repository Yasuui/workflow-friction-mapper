import type { Metadata } from "next";
import Link from "next/link";
import { FlowMark } from "@/components/FlowMark";

export const metadata: Metadata = {
  title: "Page not found",
  description: "That path is not part of Workflow Friction Mapper.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="page-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <nav className="nav-wrap" aria-label="Primary navigation">
        <Link className="wordmark" href="/">
          <span className="mark" aria-hidden="true"><FlowMark /></span>
          <span>Workflow Friction Mapper</span>
        </Link>
      </nav>
      <section className="not-found" aria-labelledby="not-found-title">
        <div className="eyebrow">404</div>
        <h1 id="not-found-title">Page not found.</h1>
        <p>That path isn’t part of this tool. Return to the mapper to analyze a workflow in your browser.</p>
        <Link className="not-found-link" href="/">Back to the mapper <span aria-hidden="true">→</span></Link>
      </section>
    </main>
  );
}
