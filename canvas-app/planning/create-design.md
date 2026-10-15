Revision: 1

Inputs:
- Original request (verbatim, in coordinator brief), including known constraints (landscape tablet, brand usage notes, risk band readable without colour)
- D:\Master\02-Career\PowerPlatform\CanvasVsPcfInspection\canvas-app\src\create-screens.md (Revision 1)
- D:\Master\02-Career\PowerPlatform\CanvasVsPcfInspection\canvas-app\src\create-functionality.md (Revision 1)
- D:\Master\02-Career\PowerPlatform\CanvasVsPcfInspection\canvas-app\DESIGN.md (scenario context only)

## User constraints (verbatim)

> Fusion Sky theme: primary #0B5F7E, secondary #209CCB, purple #742774, text #0F2530, muted #51646E, background #EDF7FB, border #CBE2EC, success #167044, warning #8A5A00, error #B42318. Tablet layout.

> - Landscape tablet; this is a portfolio piece, so it should look polished and professional (clean enterprise look, Fusion Sky palette, good hierarchy, generous spacing), while staying genuinely usable for a warehouse inspector (large touch targets, legible risk state at a glance).
> - Brand usage notes from the owner's brand guide: secondary #209CCB is for accents only (never as text colour); purple #742774 for small labels/eyebrows/tags; success/warning/error only for their meaning and always paired with a text label; background #EDF7FB for page wash; white cards on it.
> - The risk band must be readable without colour alone (always show the band word and the score).

## Design intent

A calm, enterprise work tool: white cards on the pale wash, one strong action colour (primary), purple reserved for small labels, and colour carrying meaning only for risk/outcome. The inspector's two at-a-glance needs are "what do I answer next" and "what is the risk right now"; every screen puts its main task in the largest region and keeps its single forward action in a fixed, always-visible place.

## Target viewports (reasoning anchors, not limits)

| Anchor | Size | Why |
|---|---|---|
| Primary | 1366 x 768 landscape | Common Windows tablet and the default landscape tablet canvas; all compositions are sized against it. |
| Compact | 1024 x 768 landscape | iPad-class tablet in Power Apps mobile. Columns narrow; nothing moves below the fold. |
| Short | 1366 x 650 | Same tablet in a browser with toolbar/tab chrome. Fixed chrome must still leave each scroll owner at least 3 rows. |
| Wide | 1920 x 1080 | Desktop browser review (portfolio screenshots). Body content stops growing at 1600 px and centres on the wash. |

Portrait and phone widths are not targets (the request fixes landscape tablet). No narrow layout is designed; if a host presents a window narrower than 1024, the landscape composition is preserved (scaled), not reflowed. Discovery confirms how the host behaves.

## Hierarchy

Every screen reads in the same order: header (where am I, which inspection) -> the screen's main work region -> supporting panel -> footer action of that panel. One primary (filled) button per screen state; everything else is secondary or text style.

## Type scale (single sans-serif family, platform default; two weights: Regular 400, Semibold 600)

| Role | Size / line height | Weight | Colour |
|---|---|---|---|
| Live score figure (S3 risk panel) | 48 / 56 | Semibold | Text #0F2530 |
| KPI / review score figure | 32 / 40 | Semibold | Text |
| Screen title (header) | 22 / 28 | Semibold | Text |
| Section heading (card titles, stage headings) | 18 / 24 | Semibold | Text |
| Body, question text, answer values, button labels | 16 / 24 | Regular (question text and button labels Semibold) | Text |
| Secondary/meta (asset tag, dates, help text, helper text) | 14 / 20 | Regular | Muted #51646E |
| Eyebrow / tag | 12 / 16, uppercase, +0.5 letter spacing | Semibold | Purple #742774 |

Minimum text is 14 px except eyebrows/tags (12 px, short uppercase words). Figures use tabular (fixed-width) numerals where the platform allows, so scores do not jitter when recalculating.

## Spacing and density

- 8 px grid. Page margin 24 px; gap between cards 24 px horizontally, 16 px vertically; card padding 20 px; gap inside groups 8-12 px.
- Comfortable density: list rows min 64 px; question rows min 72 px; selectable cards min 72 px.
- Touch targets: min 48 x 48 px for every interactive element (including icon buttons, tabs, Clear, Help); primary panel buttons 56 px tall; at least 8 px between adjacent targets.
- Corner radius: cards 8 px; buttons, inputs, badges 6 px; pills fully rounded.

## Colour roles and contrast intent

| Role | Colour | Use |
|---|---|---|
| Page wash | #EDF7FB background | Behind all cards. |
| Surface | #FFFFFF | Cards, header bar, panels. |
| Card divider / card outline | #CBE2EC border | Decorative structure only (1 px). Never the sole boundary of an input. |
| Text | #0F2530 | All primary text. |
| Muted text | #51646E | Meta text, placeholders, unselected tabs, "Not answered". (Approx. 5.9:1 on white, 5.4:1 on wash.) |
| Primary | #0B5F7E | Primary button fill (white text, approx. 7:1), selected tab text + underline, selection outline, links/text buttons, focus ring, input focus border. |
| Input outline | Muted #51646E, 1 px | Inputs, dropdowns, segmented options (meets 3:1 non-text contrast; #CBE2EC does not). |
| Secondary | #209CCB | Accents only: 4 px header accent stripe, KPI tile top accent, help-text side rule. Never text, never the only indicator of a state. |
| Purple | #742774 | Eyebrows, tags (Built with, CRITICAL STOP, ANNOTATED), question codes on review. Approx. 9:1 on white. |
| Success | #167044 | Low band, success confirmations. Always with a text label. |
| Warning | #8A5A00 | Medium band, "unanswered" notice, no-checklist notice. Always with a text label. |
| Error | #B42318 | High and Critical bands, error messages, invalid input, destructive confirm button, annotation pen strokes (marking defects). Always with a text label (strokes excepted, they are the user's drawing). |
| Tints (derived, background only) | ~10% tints: success #E8F3EC, warning #FBF1DF, error #FBE9E7, primary #E3F0F5, purple #F3E9F3 | Badge and banner backgrounds, selected-row fill. Text on a tint always uses the full-strength colour. |

Disabled controls: #CBE2EC fill or outline with muted text, plus a visible reason line nearby (never disabled without explanation).

## Shared components (visual decisions, not controls)

**Header bar (all screens).** White bar, 72 px tall including a 4 px secondary accent stripe along its top edge, 1 px #CBE2EC bottom border, fixed (never scrolls). Layout left to right: leave action (if any) -> eyebrow over screen title over optional context line -> flexible space -> screen-level actions (right-aligned). The leave action is always at the far left and always labelled with a word, never an icon alone:

| Screen | Eyebrow (purple) | Title | Leave action (left) | Header actions (right) |
|---|---|---|---|---|
| S1 Screen1 | APP 1 · BUILT WITH CANVAS | Equipment inspections | none | New inspection (primary) |
| S2 StartScreen | NEW INSPECTION | Choose equipment to inspect | Cancel | none |
| S3 InspectScreen | DRAFT INSPECTION | INS-nnnnn (system number) | Abandon | Photos (secondary), Review (primary) |
| S4 PhotoScreen | INS-nnnnn · PHOTOS | Photos and annotation | Back to checklist | Add picture (primary) |
| S5 ReviewScreen | INS-nnnnn · REVIEW | Review and submit | Back to checklist | none (Submit lives in the score panel) |

The context line (14 px muted, one line, truncates with full text available to assistive tech) carries equipment name · asset tag · site · equipment type · criticality on S3/S4/S5, so the inspector always sees which equipment is being inspected. There is no global menu or tab bar: the flow is linear (S1 -> S2 -> S3 <-> S4/S5 -> S1) and the header's leave action is the only way back.

**Risk badge (S1, S3, S5).** Always shows score and band word together, e.g. "62.5 · High"; colour is reinforcement only.
- Low: success tint background, success text and 1 px success outline.
- Medium: warning tint, warning text and outline.
- High: error tint, error text and 2 px error outline.
- Critical: solid error fill, white text, a stop glyph before the word. When forced by a critical stop the word reads "Critical" and the reason is shown next to the badge where space allows ("critical stop").
- Not scored (Drafts on S1): white background, #CBE2EC outline, muted text "Not scored".
Sizes: compact 32 px tall (lists), large 48 px tall full-width (S3 panel, S5 headline).

**Status pill (S1).** Distinct from risk so they are never confused: Draft = white fill, muted outline and muted text "Draft"; Submitted = primary tint fill, primary text "Submitted". No semantic colours for status.

**Built with tag (S1).** Purple 12 px uppercase text in a 1 px purple outline on purple tint: "CANVAS ONLY" or "CANVAS + PCF".

**Inline message banner.** Card-width block, 4 px left bar in the semantic colour, matching tint background, icon + bold label word + message in text colour. Label words: "Error", "Warning", "Submitted"/"Saved" (success), "Note" (primary tint, informational). Placed at the top of the region it concerns, never at the bottom of a long list.

**Selection.** Selected card/row = primary tint fill, 2 px primary outline, and a check glyph; exposed as "selected" to assistive tech. Never fill colour alone.

**Buttons.** Primary: primary fill, white 16 px semibold label, 48 px (56 px in panel footers). Secondary: white fill, 1 px primary outline, primary label. Text button: primary label, no outline, 48 px hit area. Destructive confirm: error fill, white label. Busy: label changes to the progressive verb ("Starting...", "Saving...", "Submitting...") with a spinner, and the button plus any competing navigation is disabled.

**Empty / loading states.** Centred within the region that would hold content: short headline (16 semibold) + one muted sentence + the action that resolves it, if one exists on that screen. Loading shows a spinner and "Loading ..." text, never zeros or blank values.

**Focus and accessibility (all screens).** Visible 2 px primary focus ring with 2 px offset on every interactive element. Reading/focus order follows the visual order stated in each composition. Every input has a persistent visible label (question text acts as the label of its answer control); placeholders never replace labels. Status changes (risk band change, save/submit results, errors) are announced politely; errors assertively. Icons always carry a text label or accessible name.

## Intentional differences between screen families

- **Overview (S1)** is the only screen without a leave action; its main region is a read-only list, so rows show no chevrons or press feedback that suggest navigation (A-1).
- **Selection (S2)** uses left-to-right columns that mirror the site -> equipment -> start sequence; it has no context line because no inspection exists yet.
- **Work screens (S3, S5)** use a "main region + fixed right panel" split: the panel holds the risk outcome so it stays visible while the main region scrolls. S3's panel is 340 px (live), S5's is 400 px (it carries the derivation and Submit).
- **Media (S4)** uses "list + large viewer" where the viewer takes remaining space and has no scrolling, so drawing never competes with scroll gestures.
