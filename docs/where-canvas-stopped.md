# Where Canvas stopped

> **Status: draft.** Part A is evidence from building and compiling App 1 against a live Power Apps Studio session (2026-10-15). Part B lists what can only be shown by running the app; those results go in after the test run.

## The short version (for the portfolio)

The Canvas app works. It lists inspections, starts one against real Dataverse records, walks a nested checklist that changes with each answer, scores risk live, captures photos, lets the inspector draw on them and submits everything back to Dataverse. A capable maker can build all of that in Power Fx.

It stopped in four places. None of them is a missing button. Each is a point where the logic has to live in *code the maker writes by hand*, so the app falls behind the data:

1. **The checklist tree has a fixed depth.** Power Fx functions can't call themselves, so the app walks the question tree one level at a time, with one formula per level. It supports five levels because it has five formulas. The business added a sixth-level question, "Is the spill area cordoned off from pedestrians?". It's a critical safety stop, and the Canvas app never shows or scores it, without any error.
2. **Rules that span branches become hard-coded.** "Notify the site safety lead" depends on answers in three different places. The rule is stored as data, but Canvas can't evaluate a rule tree of arbitrary depth for the same reason. So that one rule is written as a Power Fx expression, and every new rule means editing and republishing the app.
3. **Annotation is freehand only, and saved apart from the photo.** A transparent Pen input over the photo lets the inspector circle a defect. There are no arrows, labels or numbered markers. The strokes save as a separate image, not burned into the photo, and nothing about the marks is stored as data.
4. **The live score is a recalculation chain, not an engine.** Weighted triggers, a criticality multiplier and critical stops are fine. But "a leak *and* a missing extinguisher is worse than the two added together" would need a hand-written formula for every combination.

## Part A: evidence from the build

| # | Limit | What the build showed | Where |
| --- | --- | --- | --- |
| A1 | **No recursion** | Power Fx user-defined functions don't support recursion ([Microsoft Learn](https://learn.microsoft.com/power-platform/power-fx/reference/object-app#user-defined-functions)). Visibility is five near-identical named formulas, `VisL0` to `VisL4`, joined by `VisibleQ`. Adding a level means a new `VisL5` formula, an edit to `VisibleQ` and a republish. | [App.pa.yaml](../canvas-app/src/App.pa.yaml) |
| A2 | **Silent data loss on deeper templates** | The seeded question FL-01.1.1.1.1.1 is at depth 5. It's a critical stop worth 25 points, and it never appears in the Canvas app, never scores and raises no error. The risk band understates a real hazard. | Seed data; `VisL0`–`VisL4` |
| A3 | **Rules as data can't be evaluated** | `fp_rulejson` on FL-32 holds an `any`/`all` tree. Canvas uses the hard-coded `FL32Visible` instead. That's correct today, but it no longer follows the stored rule once someone edits it. | `FL32Visible` in App.pa.yaml |
| A4 | **Image columns need an undocumented shape** | The Dataverse image column is typed as a Record in Power Fx. Patching the Add picture control's `Media` (Text) was rejected by the compiler. `{Full: Media, Value: Media}` compiles; whether it saves full resolution is a runtime check (B4). | PhotoScreen `btnPhotoSave` |
| A5 | **Annotation ceiling** | The Pen input exposes draw/erase, colour and thickness, and outputs a single `Image` of the strokes. Shapes, text, numbered markers, per-mark undo and structured mark data aren't available. Strokes go to `fp_canvasstrokes`, separate from `fp_photo`. | PhotoScreen |
| A6 | **Client-side template load** | The checklist loads into a collection, because the visibility walk needs the whole tree in memory. Collections are capped by the data row limit (500 by default, 2,000 maximum), and the compiler flagged delegation until it was restructured. Large templates would be cut off. | StartScreen `btnStartGo` |
| A7 | **Control-level restrictions** | The tab list's display text can't contain lookups or counts, so per-stage "answered/visible" counts had to move into a separate named formula. Two Inspections columns both show as "Status", and choice names clash with column names, so formulas need disambiguation (`[@'Risk band']`). | InspectScreen, App.pa.yaml |
| A8 | **Compound risk** | The scoring formula supports weights, a multiplier, a cap and critical stops. Compound rules (A + B scores more than A plus B) weren't built. Each would be another hand-written formula. | `RiskItems`, `LiveScore` |

Size of what a maker maintains: about 3,200 lines of Power Fx YAML across 5 screens and 203 controls. The checklist screen alone has 41 controls and depends on the shared visibility and risk formulas in App.pa.yaml.

## Part B: confirm in the test run

Run each check in the published app with Monitor open, then record what happens.

- [ ] **B1. Re-render on answer.** Every answer changes `colAns`, which re-evaluates `VisL0`–`VisL4`, `VisibleQ`, `RiskItems` and the gallery's items. Does the question list flicker or jump, or does focus leave the field? Check especially when typing in a Number answer.
- [ ] **B2. Responsiveness as the form grows.** Answer the forklift branch FL-01 → No → Damaged → Hydraulics → Yes → No. Note how long each answer takes to update the score and show the next question (Monitor timings).
- [ ] **B3. The missing sixth level.** At FL-01.1.1.1.1 "Has a spill kit been deployed?", answer **No**. Confirm FL-01.1.1.1.1.1 doesn't appear and the score doesn't include its 25 points or the critical stop.
- [ ] **B4. Photo save.** Add a picture, save it, reopen it. Is the full-size image stored and shown (not just the 144 px thumbnail)?
- [ ] **B5. Annotation.** Draw on a photo and save. Does the strokes image overlay the photo correctly afterwards (transparent background, same aspect ratio)? Does the photo itself stay unchanged?
- [ ] **B6. Choice dropdown loop.** Change a Choice answer that reveals children. Does the dropdown's change event fire again when the list reloads? Microsoft documents this as a gallery pitfall.
- [ ] **B7. Submit.** Submit, then check the Dataverse records: one answer row per visible answered question, plus the score, band, status and "Canvas only" on the inspection.

## What this sets up for App 2

The PCF component (React + TypeScript) takes over the three interaction-heavy jobs: the recursive checklist, the annotation canvas and the rules engine. The Canvas app keeps navigation and Dataverse reads and writes, because code components in canvas apps can't call the Dataverse Web API. The mapping from each limit to its solution is in [how-pro-code-solved-it.md](how-pro-code-solved-it.md) (after App 2).
