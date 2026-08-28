"use client";

import { useEffect } from "react";
import Script from "next/script";

type PostHogClient = {
  init: (token: string, config: Record<string, unknown>) => void;
  capture: (event: string, properties?: Record<string, string | number>) => void;
  push: (...args: unknown[]) => number;
  _i?: unknown[];
};

declare global {
  interface Window {
    posthog?: PostHogClient;
  }
}

const POSTHOG_TOKEN = "phc_BKoNfZWQBjA3vUbQ98qs5PGtgTMjhVYiJcTEhTDmr3Zo";
const POSTHOG_HOST = "https://us.i.posthog.com";

function capture(event: string, properties?: Record<string, string | number>) {
  window.posthog?.capture(event, properties);
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

  return (
    <>
      <Script id="posthog-bootstrap" strategy="beforeInteractive">
        {`
window.posthog = window.posthog || [];
window.posthog._i = window.posthog._i || [];
window.posthog.init = window.posthog.init || function(token, config) {
  window.posthog._i.push([token, config]);
};
["capture", "identify", "alias", "register", "reset"].forEach(function(method) {
  window.posthog[method] = window.posthog[method] || function() {
    window.posthog.push([method].concat(Array.prototype.slice.call(arguments)));
  };
});
window.posthog.init(${JSON.stringify(POSTHOG_TOKEN)}, {
  api_host: ${JSON.stringify(POSTHOG_HOST)},
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  disable_session_recording: true,
  persistence: "memory",
  person_profiles: "never"
});
        `}
      </Script>
      <Script src={`${POSTHOG_HOST}/static/array.js`} strategy="afterInteractive" />
    </>
  );
}
