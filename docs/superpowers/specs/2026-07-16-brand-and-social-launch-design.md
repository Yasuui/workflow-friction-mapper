# Workflow Friction Mapper Brand and Social Launch Design

## Objective

Give Workflow Friction Mapper a recognizable minimalist identity, complete social-link previews, recruiter-facing GitHub evidence, and a credible launch package for LinkedIn and X without changing its privacy model or analysis behavior.

## Approved brand direction

Use the selected **Flow path** mark: three connected workflow nodes resolving into a clear route. The mark represents mapping a manual process, locating friction, and finding a safer improvement path.

- Use a rounded-square container that matches the existing product surfaces.
- Use the existing ink, warm-white, and blue palette.
- Preserve legibility from a 16-pixel favicon through the navigation wordmark and social card.
- Keep the symbol geometric and static; existing page motion remains unchanged.
- Replace the temporary `WF` navigation tile with the symbol and add the symbol to the footer.

## Browser and sharing assets

Use Next.js metadata file conventions so assets are part of the application build:

- `app/icon.svg` for the scalable browser favicon.
- `app/apple-icon.svg` for saved mobile shortcuts.
- `app/opengraph-image.tsx` for a 1200 by 630 share card generated with Next.js `ImageResponse`.
- Complete `metadataBase`, canonical URL, Open Graph, and X card metadata in the root layout.

The social card contains the Flow path mark, product name, the line “Find the friction before you automate,” a short browser-local privacy statement, and the production domain. It does not include unverified performance claims or estimated savings.

## Website integration

Create one reusable `FlowMark` component for the navigation and footer. The favicon and social card use the same geometry so the brand remains consistent without duplicated interpretations.

No workflow input, scoring formula, network behavior, storage behavior, or user flow changes are included in this launch extension.

## GitHub evidence

Update the project README with:

- the social card as a branded opening image;
- clear Live demo and Source actions;
- a concise “How it works” explanation covering structured input, browser-local deterministic analysis, transparent KPI drivers, prioritized fixes, and measured validation;
- the refreshed product screenshots; and
- accurate limits: directional heuristic, no AI API, and no guaranteed savings.

Update `Yasuui/Yasuui` so Workflow Friction Mapper is the first item under Selected work. Its description links to the live product and source and positions it as a privacy-first workflow assessment tool rather than an AI prediction product.

## Launch assets and copy

Capture authentic production images after deployment:

1. Landing and one-step input.
2. High-confidence KPI report with accuracy explanation.
3. Prioritized fixes and validation checks.
4. Contact and source actions.
5. The Open Graph share card.

Prepare a substance-first LinkedIn post that explains the workflow problem, how the deterministic analysis works, what each output helps a team decide, privacy boundaries, validation limits, live link, and invitation for useful feedback. Prepare a shorter X post with the same truthful positioning and the live link.

## Verification

Use test-first changes for all new metadata and brand behavior:

- Add failing source/render assertions for the mark, favicon, canonical URL, Open Graph image, X card, and README evidence before implementation.
- Run the focused tests to confirm the expected failures, then implement the smallest changes that make them pass.
- Run the complete test suite, lint, production build, and dependency audit.
- Verify the live desktop and mobile UI, example loading, empty input, vague-input confidence warning, high-confidence report, copy, download, reset, external links, favicon request, Open Graph response, social metadata, and browser console health.
- Confirm the final Vercel deployment is Ready and the simple production alias points to that deployment.

## Error handling and risks

- If social platforms cache the previous preview, verify the production metadata first and use each platform’s refresh/debug tool rather than changing correct tags.
- If the generated share image fails at build time, keep the same design and fall back to a static PNG committed under `app/`.
- The analysis remains deterministic and explainable but not statistically calibrated against real operational outcomes; launch copy must call it directional.
- Current dependency advisories must be reported with their practical exposure and must not be “fixed” with a breaking downgrade.

## Public-change boundary

Implement and verify locally first. Show the exact changed-file list and verification results before the public GitHub push. The approved push updates the project repository, triggers Vercel, and updates the public GitHub profile README.
