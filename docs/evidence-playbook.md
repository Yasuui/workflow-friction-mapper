# Product evidence playbook

Use this playbook to turn PostHog data into credible portfolio evidence without overstating adoption or collecting workflow content.

## Evidence hierarchy

1. **Operational proof:** production deployment, passing tests, privacy controls, and verified event delivery.
2. **Usage proof:** organic anonymous visitors over a stated period.
3. **Activation proof:** organic visitors who complete an analysis.
4. **Value proof:** activated visitors who copy/download a report or submit structured useful feedback.
5. **Outcome proof:** a separate, consented case study with a measured before/after workflow result. PostHog events alone do not prove time or money saved.

## Required filters

- Exclude `traffic_class = verification`.
- Use one consistent date range, normally trailing 30 days.
- State that counts are anonymous browser-level estimates, not identified people.
- Show the numerator and denominator beside every percentage.
- Treat the current launch-verification event as synthetic, not adoption.

## Proof gates

| Claim type | Minimum evidence |
| --- | --- |
| Shipped | Production URL, build/test evidence, and live event-delivery verification |
| Used | At least 10 organic anonymous visitors |
| Activated | At least 10 organic visitors and at least 5 completed analyses |
| Useful | At least 10 structured feedback responses or 10 report actions |
| Improved a workflow | Consented before/after measurement outside PostHog with method and sample disclosed |

These are credibility gates, not statistical-significance thresholds.

## Dashboard views

Keep these views on `Workflow Friction — Evidence`:

- organic anonymous visitors and completed analyses;
- view-to-analysis activation funnel;
- analysis-to-proof-action funnel (feedback, copy, or download);
- validation failures and resets as behavioral friction;
- structured usefulness responses and reasons;
- confidence, friction, automation-fit, and recommendation-category mix;
- acquisition-source mix; and
- contact-intent clicks.

Do not add session replay, autocapture, free-text surveys, workflow text, exact inputs, or identified-person reporting.

## Resume-safe claim template

> Built and deployed a privacy-safe workflow analysis product with cookieless PostHog instrumentation, explicit event contracts, automated privacy tests, and dashboards tracking [organic anonymous visitors], [completed analyses], and [value actions] from [start date] to [end date] (n=[sample]).

Replace every bracket with verified data. If the sample gate has not been met, describe the instrumentation and production verification rather than adoption.

## Monthly evidence routine

1. Refresh the dashboard with verification traffic excluded.
2. Record the date range, anonymous sample size, activation count, and value-action count.
3. Investigate validation failures, resets, and negative/partial feedback before adding features.
4. Save one screenshot only when the period contains organic data.
5. Update portfolio or résumé claims only when the supporting snapshot is retained.
