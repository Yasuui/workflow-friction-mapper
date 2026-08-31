import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const analyticsUrl = new URL("../lib/product-analytics.ts", import.meta.url);
const instrumentationUrl = new URL("../instrumentation-client.ts", import.meta.url);
assert.equal(existsSync(analyticsUrl), true, "privacy-safe analytics module must exist");
assert.equal(existsSync(instrumentationUrl), true, "privacy-safe PostHog instrumentation must exist");

const analytics = readFileSync(analyticsUrl, "utf8");
const instrumentation = readFileSync(instrumentationUrl, "utf8");
const studio = readFileSync(new URL("../components/WorkflowStudio.tsx", import.meta.url), "utf8");
const privacy = readFileSync(new URL("../PRIVACY.md", import.meta.url), "utf8");

test("PostHog is explicit-event-only and cannot record workflow form contents", () => {
  assert.match(instrumentation, /product-analytics/);
  assert.match(analytics, /autocapture:\s*false/);
  assert.match(analytics, /capture_pageview:\s*false/);
  assert.match(analytics, /disable_session_recording:\s*true/);
  assert.match(analytics, /person_profiles:\s*"never"/);
  assert.match(analytics, /cookieless_mode:\s*"always"/);
  assert.match(analytics, /sanitizeAnalyticsEvent/);
  assert.match(analytics, /const sanitized = sanitizeAnalyticsEvent\(/);
  assert.match(analytics, /posthog\.capture\(event,\s*sanitized\.properties\)/);
  assert.match(analytics, /before_send:\s*\(event\)\s*=>\s*sanitizeAnalyticsEvent/);
  assert.match(analytics, /SAFE_PROPERTY_KEYS\.has\(key\)/);
  assert.doesNotMatch(analytics, /key\.startsWith\("\$"\)/);

  for (const forbidden of ["description", "minutesPerRun", "runsPerWeek", "handoffs", "sensitivity"]) {
    assert.doesNotMatch(analytics, new RegExp(`capture[^;]+${forbidden}`, "s"));
  }
});

test("analytics exposes a bounded evidence funnel with safe categorical properties", () => {
  for (const event of [
    "mapper_viewed",
    "example_selected",
    "analysis_completed",
    "report_copied",
    "report_downloaded",
    "feedback_submitted",
    "contact_clicked",
  ]) {
    assert.match(analytics, new RegExp(`"${event}"`));
  }

  for (const property of [
    "input_confidence",
    "friction_band",
    "automation_fit_band",
    "used_example",
    "feedback_value",
    "feedback_reason",
    "destination",
  ]) {
    assert.match(analytics, new RegExp(`"${property}"`));
  }
});

test("analytics separates verification traffic from organic evidence", () => {
  assert.match(analytics, /traffic_class/);
  assert.match(analytics, /analytics_schema_version/);
  assert.match(analytics, /verification/);
  assert.match(analytics, /organic/);
  assert.match(analytics, /URLSearchParams/);
});

test("the interface collects structured feedback without a free-text field", () => {
  assert.match(studio, /Was the first recommendation useful\?/);
  assert.match(studio, /Yes/);
  assert.match(studio, /Partly/);
  assert.match(studio, /No/);
  assert.doesNotMatch(studio, /feedback[^]{0,300}<textarea/i);
});

test("privacy documentation discloses anonymous analytics and its strict exclusions", () => {
  assert.match(privacy, /cookieless/i);
  assert.match(privacy, /workflow text is never sent/i);
  assert.match(privacy, /session replay is disabled/i);
  assert.match(privacy, /no names or email addresses/i);
});
