# Workflow Friction Mapper Design

## Objective

Build a public, recruiter-ready workflow analysis tool that helps a visitor describe a repetitive process and receive a structured automation review in one interaction.

## Product promise

The visitor supplies a workflow description plus a few non-sensitive operating facts. The browser returns a workflow map, friction score, automation candidates, privacy and human-review safeguards, and an illustrative time-opportunity estimate. No input leaves the device.

## Privacy model

- All analysis runs synchronously in the browser.
- No API routes, databases, analytics, accounts, cookies, local storage, telemetry, or third-party form services.
- Inputs exist only in React memory and disappear on refresh.
- The form warns visitors not to enter personal, confidential, regulated, or employer-owned information.
- Reports are generated locally through copy and download actions.

## Experience

1. A calm, high-contrast landing viewport explains the value and privacy promise.
2. One form collects the workflow description, minutes per run, weekly frequency, handoffs, and data sensitivity.
3. The result view enters with a restrained blur, scale, and vertical transition.
4. Results show an executive summary, workflow map, automation opportunities, safeguards, and the recommended first move.
5. The closing section links to LinkedIn, GitHub, and a booking page.

## Visual direction

- Apple-inspired restraint: warm white background, charcoal typography, thin neutral borders, glass-like surfaces, and one blue accent.
- Large editorial type, generous whitespace, responsive single-column composition, and no dashboard chrome.
- Motion is short, functional, and disabled when reduced motion is preferred.
- No decorative stock images or generated illustrations; product screenshots are the proof asset.

## Analysis model

The analysis engine is deterministic and transparent. It detects workflow signals such as manual copying, reminders, monitoring, spreadsheets, onboarding, and approvals. It converts those signals and the visitor's numeric inputs into bounded scores, candidate automations, safeguards, a short process map, and an illustrative annual time-opportunity estimate.

The interface must label estimates as illustrative and never call the deterministic engine a large language model.

## Quality gates

- Unit tests cover parsing, score bounds, opportunity detection, sensitive-data safeguards, and estimate math.
- Production build and lint must complete without errors.
- Browser verification covers empty-input validation, example loading, analysis, report copying/downloading, responsive layout, reduced-motion behavior, and external calls to the approved profile surfaces.
- The production deployment must be inspected after publication.

## Public proof

The repository includes an evidence-led README, architecture and privacy notes, test instructions, a live URL, and three real product screenshots: landing/input, results overview, and safeguards/contact.
