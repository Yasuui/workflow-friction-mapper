"use client";

import { useEffect } from "react";

const POSTHOG_TOKEN = "phc_BKoNfZWQBjA3vUbQ98qs5PGtgTMjhVYiJcTEhTDmr3Zo";
const POSTHOG_CAPTURE_URL = "https://us.i.posthog.com/capture/";
let distinctId = "";

function capture(event: string, properties: Record<string, string | number> = {}) {
  if (!distinctId) {
    distinctId = globalThis.crypto?.randomUUID?.() || `anonymous-${Math.random().toString(36).slice(2)}`;
  }
  const payload = JSON.stringify({
    api_key: POSTHOG_TOKEN,
    event,
    properties: {
      distinct_id: distinctId,
      $lib: "posthog-direct-capture",
      ...properties,
    },
  });
  void fetch(POSTHOG_CAPTURE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

export default function WorkflowPostHog() {
  useEffect(() => {
    const onFocus = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        capture("workflow_input_started");
      }
    };
    const onSubmit = (event: SubmitEvent) => {
      if ((event.target as HTMLElement)?.tagName === "FORM") capture("workflow_analysis_completed");
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      if (!button) return;
      const label = button.textContent?.trim() || "";
      if (label === "Copy report") capture("workflow_report_copied");
      if (label === "Download .md") capture("workflow_report_downloaded");
      if (label === "Reset") capture("workflow_reset");
      if (["Data review", "Meeting follow-up", "Case monitoring", "Onboarding"].includes(label)) {
        capture("workflow_example_selected", { example: label });
      }
    };
    document.addEventListener("focusin", onFocus);
    document.addEventListener("submit", onSubmit);
    document.addEventListener("click", onClick);
    capture("workflow_page_viewed", { path: window.location.pathname });
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("submit", onSubmit);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}
