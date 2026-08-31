"use client";

import posthog from "posthog-js";
import type { WorkflowReport } from "@/lib/workflow-analysis";
import type { AgentReport } from "@/lib/agent-protocol";

export const PRODUCT_EVENTS = [
  "mapper_viewed",
  "example_selected",
  "analysis_validation_failed",
  "analysis_completed",
  "report_copied",
  "report_downloaded",
  "analysis_reset",
  "feedback_submitted",
  "contact_clicked",
] as const;

type ProductEvent = (typeof PRODUCT_EVENTS)[number];
type ScoreBand = "low" | "medium" | "high";
type AcquisitionSource = "direct" | "linkedin" | "github" | "x" | "search" | "other";
export type FeedbackValue = "yes" | "partly" | "no";
export type FeedbackReason = "clear_next_step" | "wrong_priority" | "missing_context" | "unclear_estimate" | "other";

type SafeProperties = {
  "mapper_viewed": { acquisition_source: AcquisitionSource };
  "example_selected": { example_label: "data_review" | "meeting_follow_up" | "case_monitoring" | "onboarding" };
  "analysis_validation_failed": { reason: "missing_description" };
  "analysis_completed": {
    input_confidence: "low" | "medium" | "high";
    friction_band: ScoreBand;
    automation_fit_band: ScoreBand;
    primary_opportunity: string;
    used_example: boolean;
  };
  "report_copied": ResultContext;
  "report_downloaded": ResultContext;
  "analysis_reset": ResultContext;
  "feedback_submitted": ResultContext & {
    feedback_value: FeedbackValue;
    feedback_reason: FeedbackReason;
  };
  "contact_clicked": { destination: "linkedin" | "github" | "calcom" };
};

type ResultContext = {
  input_confidence: "low" | "medium" | "high";
  friction_band: ScoreBand;
  automation_fit_band: ScoreBand;
};

const SAFE_PROPERTY_KEYS = new Set([
  "acquisition_source",
  "example_label",
  "reason",
  "input_confidence",
  "friction_band",
  "automation_fit_band",
  "primary_opportunity",
  "used_example",
  "feedback_value",
  "feedback_reason",
  "destination",
  "traffic_class",
  "analytics_schema_version",
]);

const BLOCKED_AUTOMATIC_PROPERTIES = new Set([
  "$current_url",
  "$pathname",
  "$referrer",
  "$referring_domain",
  "$initial_current_url",
  "$initial_pathname",
  "$initial_referrer",
  "$initial_referring_domain",
  "$search_engine",
  "$ip",
  "$raw_user_agent",
  "$geoip_city_name",
  "$geoip_postal_code",
  "$geoip_subdivision_1_name",
  "$geoip_subdivision_2_name",
]);

type AnalyticsEnvelope = {
  event?: string;
  properties?: Record<string, unknown>;
};

export function sanitizeAnalyticsEvent<T extends AnalyticsEnvelope>(event: T | null): T | null {
  if (!event || !PRODUCT_EVENTS.includes(event.event as ProductEvent)) return null;

  const properties = Object.fromEntries(
    Object.entries(event.properties ?? {}).filter(([key]) => SAFE_PROPERTY_KEYS.has(key)),
  );

  return { ...event, properties };
}

export function scoreBand(score: number): ScoreBand {
  if (score < 40) return "low";
  if (score < 70) return "medium";
  return "high";
}

export function resultContext(report: WorkflowReport): ResultContext {
  return {
    input_confidence: report.inputConfidence.toLowerCase() as ResultContext["input_confidence"],
    friction_band: scoreBand(report.frictionScore),
    automation_fit_band: scoreBand(report.automationReadiness),
  };
}


export function resultContextFromAgent(report: AgentReport): ResultContext {
  return {
    input_confidence: report.missing.length ? "low" : report.assumptions.length ? "medium" : "high",
    friction_band: report.friction.length >= 3 ? "high" : report.friction.length >= 1 ? "medium" : "low",
    automation_fit_band: report.opportunities.length >= 2 ? "high" : report.opportunities.length >= 1 ? "medium" : "low",
  };
}

export function acquisitionSource(): AcquisitionSource {
  if (typeof window === "undefined") return "direct";

  const source = new URLSearchParams(window.location.search).get("utm_source")?.toLowerCase();
  if (source === "linkedin") return "linkedin";
  if (source === "github") return "github";
  if (source === "x" || source === "twitter") return "x";
  if (source === "google" || source === "bing" || source === "duckduckgo") return "search";
  if (source) return "other";

  if (!document.referrer) return "direct";
  try {
    const host = new URL(document.referrer).hostname;
    if (host.includes("linkedin.com")) return "linkedin";
    if (host.includes("github.com")) return "github";
    if (host === "x.com" || host.includes("twitter.com")) return "x";
    if (host.includes("google.") || host.includes("bing.") || host.includes("duckduckgo.")) return "search";
    return "other";
  } catch {
    return "other";
  }
}

export function trafficClass(): "verification" | "organic" {
  if (typeof window === "undefined") return "organic";
  return new URLSearchParams(window.location.search).get("analytics_mode") === "verification"
    ? "verification"
    : "organic";
}

export function captureProductEvent<E extends ProductEvent>(event: E, properties: SafeProperties[E]) {
  if (process.env.NODE_ENV !== "production" || !process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;
  const sanitized = sanitizeAnalyticsEvent({
    event,
    properties: {
      ...properties,
      traffic_class: trafficClass(),
      analytics_schema_version: 1,
    },
  });
  if (sanitized) posthog.capture(event, sanitized.properties);
}

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (projectToken && process.env.NODE_ENV === "production") {
  posthog.init(projectToken, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    ui_host: "https://us.posthog.com",
    defaults: "2026-05-30",
    cookieless_mode: "always",
    person_profiles: "never",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_exceptions: false,
    disable_session_recording: true,
    request_batching: false,
    session_recording: { recordCrossOriginIframes: false },
    property_denylist: Array.from(BLOCKED_AUTOMATIC_PROPERTIES),
    before_send: (event) => sanitizeAnalyticsEvent(event),
  });
}
