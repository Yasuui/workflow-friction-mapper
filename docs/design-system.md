# Mapper design system

One job per screen: get a workflow in, get a plan out. Every rule below exists to keep attention on that path.

## Principles

1. **One primary action per view.** Empty state: describe the workflow. Brief: the recommended move. Everything else is secondary in weight, colour or position.
2. **Honesty is visible.** Facts, assumptions and "Needs confirmation" are styled differently, never by wording alone. A reader should spot what to verify without reading every line.
3. **Calm by default, signal on purpose.** Neutral surfaces. Accent blue means "act here or this is sourced". Warm orange means "friction or unconfirmed". Nothing else gets colour.
4. **Small screens get less, not smaller.** Labels collapse (`New analysis` → `+`), secondary hints hide, the footer leaves during a conversation. Touch targets never drop below 40px (44px on coarse pointers).

## Tokens (`app/globals.css`)

| Group | Tokens | Use |
| --- | --- | --- |
| Surface | `--bg` `--surface` `--surface-2` `--surface-3` | Page, cards, wells, pressed states |
| Text | `--ink` `--ink-2` `--muted` | Headings, body, secondary. `--faint` is decoration only: it fails AA for text |
| Lines | `--line` `--line-strong` | Dividers, outlines. Prefer shadow-rings (`--shadow-sm`) over borders on cards |
| Accent | `--accent` `--accent-soft` `--accent-text` | Primary action, selection, facts, human review |
| Signal | `--friction` `--friction-soft` | Friction steps, "Needs confirmation" |
| Danger | `--danger` | Errors only |
| Depth | `--shadow-sm` `--shadow-md` `--shadow-lg` | Resting card, hover/selected, floating overlay |
| Radius | `--r-sm 8` `--r-md 12` `--r-lg 16` `--r-xl 20` | Controls, chips, cards, sheets |
| Space | `--s-1 4` … `--s-10 40` | 4px grid. Section gap 36, card padding 16 to 20, inline gap 8 to 12 |
| Type | `--t-xs 11.5` `--t-sm 12.5` `--t-md 14` `--t-lg 16` `--t-xl 30` | Meta, labels, body, composer, hero |
| Motion | `--ease` | `cubic-bezier(.2,.8,.2,1)`, 150 to 450ms. All motion is off under `prefers-reduced-motion` |

Light and dark are one set of names with two values; components never branch on theme.

## Type

- Inter, five sizes only. Headings 600 weight with negative tracking (−.015 to −.028em); body 400 at 1.5 to 1.6 line height.
- Numbers in tables, counters and plan steps use `font-variant-numeric: tabular-nums`.
- Heading order inside the brief: `h2` brief title → `h3` section → `h4` plan row.

## Components

| Component | Rule |
| --- | --- |
| Intent card | Radio + title (+ subtitle at ≥640px). Selected = accent ring, not fill |
| Starter chip | Neutral pill, sends immediately. Never more than four |
| Composer | Single pill, grows to 200px. Placeholder is one line and ellipsises |
| Brief chip | The thread's link to the canvas. Same title as the brief header (`briefKicker`) |
| Brief tabs | Overview → Build plan → Actions → Workflow → Evidence. Scroll-spy, counts in a neutral badge |
| Recommended move | The only card with an accent edge. Always first in Overview |
| Plan row | Number, label, detail. Detail tags: `needs-tag` (warm) for missing facts, `kind-tag` (neutral) for Fetch / Validate / Route / Notify / Write, accent for Human review |
| Kind pill | Fact (accent) vs Assumption (warm). The data field drives it, never the copy |
| Export bar | Copy, .md, .pdf, n8n. Icon + short label, one segmented well |

## Layout

- **≥1024px:** two panes, conversation 40% (min 400px) and canvas 60%. Brief content caps at 820px.
- **640 to 1023px:** single pane; the brief is a full-screen sheet with focus trapped and the page behind it `inert`.
- **<640px:** header shows mark, engine dot and icon buttons only; composer hint is one line; footer hides once a conversation starts.

## Accessibility checklist

- Text contrast AA in both themes (`--muted` is the floor).
- Every icon-only control has an accessible name; collapsed labels use the visually-hidden pattern, not `display:none`.
- Overlay: `role="dialog"`, `aria-modal`, Escape closes, focus returns to the composer.
- Live regions: the thread is `role="log"`; copy status and feedback thanks announce politely.
- `/` focuses the composer; `Enter` sends, `Shift+Enter` adds a line.
