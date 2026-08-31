# Privacy-safe analytics event contract

This contract defines the only product data Workflow Friction Mapper is allowed to send to PostHog.

Every event also includes `traffic_class` (`organic` or `verification`) and `analytics_schema_version`. Verification traffic is set only when the URL contains `analytics_mode=verification` and must be excluded from public proof.

## Evidence funnel

| Event | Safe properties | Evidence use |
| --- | --- | --- |
| `mapper_viewed` | `acquisition_source` | Anonymous reach by fixed source category |
| `example_selected` | `example_label` | Which synthetic examples help users begin |
| `analysis_validation_failed` | `reason` | Empty-submit friction |
| `analysis_completed` | confidence and score bands, fixed recommendation category, example use | Activation, result mix, and recurring friction categories |
| `report_copied` | confidence and score bands | Result engagement |
| `report_downloaded` | confidence and score bands | Strong result-value signal |
| `analysis_reset` | confidence and score bands | Re-analysis intent |
| `feedback_submitted` | structured usefulness and reason categories, confidence and score bands | Direct usefulness evidence |
| `contact_clicked` | fixed destination category | High-intent portfolio contact signal |

## Portfolio KPIs

Use a trailing 30-day window unless a claim states otherwise.

- **Anonymous visitors:** unique privacy-preserving hashes with `mapper_viewed`.
- **Activation rate:** unique visitors with `analysis_completed` divided by anonymous visitors.
- **Strong engagement rate:** unique activated visitors with `report_copied` or `report_downloaded` divided by activated visitors.
- **Feedback response rate:** unique activated visitors with `feedback_submitted` divided by activated visitors.
- **Positive usefulness rate:** `yes` responses divided by all structured feedback responses.
- **Top friction signal:** most common `primary_opportunity` among completed analyses.
- **Input quality mix:** distribution of `input_confidence`.
- **Acquisition mix:** distribution of `acquisition_source`.

Every public claim must include its date range and sample size. Do not present low-volume percentages without the underlying count.

See [evidence-playbook.md](evidence-playbook.md) for proof gates and claim templates.

## Forbidden data

Never add workflow descriptions, parsed steps, report text, exact form inputs, exact scores, exact calculated hours, names, emails, company identifiers, full URLs, referrer URLs, search terms, precise location, free text, autocapture, or session replay.

New event properties require a privacy test and an update to `PRIVACY.md` before deployment.
