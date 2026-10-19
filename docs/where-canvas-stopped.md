# Where Canvas stopped

> **Status: final for App 1 (2026-10-17).** Part A is evidence from building and compiling App 1 against a live Power Apps Studio session. Part B records three Monitor-traced test runs and the owner's sign-off.

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
| A4 | **Image columns need an undocumented shape** | The Dataverse image column is typed as a Record in Power Fx. Patching the Add picture control's `Media` (Text) was rejected by the compiler. `{Full: Media, Value: Media}` compiles; whether it saves full resolution is a runtime check (B4). | PhotosScreen `btnPhotoSave` |
| A5 | **Annotation ceiling** | The Pen input exposes draw/erase, colour and thickness, and outputs a single `Image` of the strokes. Shapes, text, numbered markers, per-mark undo and structured mark data aren't available. Strokes go to `fp_canvasstrokes`, separate from `fp_photo`. | PhotosScreen |
| A6 | **Client-side template load** | The checklist loads into a collection, because the visibility walk needs the whole tree in memory. Loading it with ClearCollect is nondelegable, so it's capped by the data row limit (500 by default, settable up to 10,000 in Settings > General; [Microsoft Learn](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/delegation-overview)), and the compiler flagged delegation until it was restructured. Large templates would be cut off. | NewInspectionScreen `btnStartGo` |
| A7 | **Control-level restrictions** | The tab list's display text can't contain lookups or counts, so per-stage "answered/visible" counts had to move into a separate named formula. Two Inspections columns both show as "Status", and choice names clash with column names, so formulas need disambiguation (`[@'Risk band']`). | InspectionScreen, App.pa.yaml |
| A8 | **Compound risk** | The scoring formula supports weights, a multiplier, a cap and critical stops. Compound rules (A + B scores more than A plus B) weren't built. Each would be another hand-written formula. | `RiskItems`, `LiveScore` |
| A9 | **Brand fidelity costs workarounds** | Canvas can't load the brand fonts (Manrope, Inter), so the app uses Segoe UI with brand weights. There is no gradient fill, so the brand's gradient line, light wash and ring symbol are drawn as inline SVG and HTML. Image controls always count as interactive, so the accessibility checker flagged every decorative gradient until they were moved to the HTML text control. | App.pa.yaml (`BrandLine`, `HtmlLine`), all headers |

Size of what a maker maintains: about 3,600 lines of Power Fx YAML across 5 screens and 209 controls. The checklist screen alone has 41 controls and depends on the shared visibility and risk formulas in App.pa.yaml.

## Part B: confirm in the test run

Run each check in the published app with Monitor open, then record what happens.

### Run 1 (2026-10-15, Monitor trace, conveyor CV-A, INS-01001)

This run used a build from before the accessibility and brand pass (it still had `Screen1` and the per-answer submit loop). It still settled four things:

- **Tap to update: about 85 ms.** Tapping Yes on CV-01 updated the visible list, the stage counts and the score within about 85 ms. Within that one tap, though, `StageTabs`, `RiskItems`, `AnsweredCount` and the gallery items were each re-evaluated about ten times, because every named formula that depends on `colAns` recalculates. Ten questions are fine. The cost grows with every formula and every question.
- **Hidden controls still evaluate.** Every row has all four answer controls, with only one visible. The hidden number input still evaluated `Value("Yes")` on Yes/No rows and logged an unhandled error on every tap. Fixed with a type guard, but it shows the cost of "one gallery row fits every answer type".
- **Image columns held thumbnails only (B4 failed, B5 invalid).** The 600 px photo was stored as 144 × 144, and the 704 × 544 strokes image was squeezed to 144 × 144, losing its aspect ratio. The cause was Dataverse, not Canvas. `CanStoreFullImage` sent at column creation is ignored, so all three image columns kept 144 px only, and the last image column created became the primary image. The columns were corrected by metadata update, and `provision.mjs` now applies it after creation. B4 and B5 need a re-run.
- **Submit worked (B7 passed on the old build).** Two answer rows, score 0, band Low, status Submitted, Built with "Canvas only". But the old row-by-row submit took 2.4 s for two answers: about 1.2 s each, for a lookup, a second lookup and a create. A full 30-question forklift run would take over 30 seconds. The current build writes all answers in one batched `Collect`.

Not covered by this run: B3 (the conveyor checklist has no sixth level) and B6.

### Run 2 (2026-10-16, Monitor trace, forklift FL-07, INS-01002)

The current build, with no errors or warnings. The only warning in the file came from a stale `Screen1` session that loaded for 11 seconds before the reload.

- **B2 passed: about 70–210 ms per tap.** Each Yes/No tap ran about 830 formula evaluations (`StageTabs` 3,514 and `AnsweredCount` 2,672 over the run), and the screen still settled within 210 ms. The recalculation fan-out from Run 1 is still there, but it isn't visible at 19 questions.
- **B3 confirmed.** FL-01 No → Damaged → Hydraulics → Yes → No showed five levels. FL-01.1.1.1.1.1 never appeared and wasn't scored (35 × 1.5 = 52.5, High, with no critical stop).
- **B4 and B5 saved.** The photo went to `fp_photo` as a separate file upload (PATCH, 204) and came back through the full-image file download, not the thumbnail. The strokes went to `fp_canvasstrokes` (PATCH, 204). Whether the overlay lines up is still a visual check.
- **B6: the guard held.** Two dropdown answers fired three change events. The `Self.Selected.Value <> current` guard stopped the extra one from writing.
- **B7 passed, 5.8 s for 7 answers.** The 7 answer rows were created in parallel within 50 ms. But each row's `Question` lookup made its own Dataverse query, one after another: 7 × 350 ms = 2.5 s. The question rows are now cached in `colQ` when the checklist loads, so Submit makes no per-answer queries.
- **The layout broke in Studio, not in the source (A10).** See below.

| # | Limit | What the build showed | Where |
| --- | --- | --- | --- |
| A10 | **Text and decoration scroll; Studio keeps its own control order** | A modern Text control shows scroll arrows when one line of text plus its default 5 px top and bottom padding is taller than the control: 56 of 98 labels did. Each needs zero vertical padding or more height, checked label by label. Even then, Run 3 (17 Oct) still showed arrows in play mode on labels that looked fine in Studio: the modern Text control has no overflow setting. The fix was the classic Label (`Overflow.Hidden`, same point sizes) for 86 labels, with a rounded container behind the 8 badges because the classic Label has no corner radius. Twelve Labels that Studio created new were flagged as interactive by the accessibility checker, so those headings use a modern Text control with `AutoHeight` instead. Run 3 also showed that Studio had been rolled back to an older version, so always confirm the live build before testing. The HTML text control behind each gradient also showed a scrollbar, and needs `AutoHeight`. Separately, controls added to an existing screen through co-authoring were appended to the end of their container, not placed where the source puts them. Recompiling never reorders existing controls, so the logo, accent lines, a footer and two card titles drifted. The reliable fix was to rename the screen, so Studio rebuilt it in source order. | All screens |

- [x] **B1. Re-render on answer.** *Owner accepted on a visual check, 2026-10-17; no Monitor evidence of flicker or focus loss.* Every answer changes `colAns`, which re-evaluates `VisL0`–`VisL4`, `VisibleQ`, `RiskItems` and the gallery's items. Does the question list flicker or jump, or does focus leave the field? Check especially when typing in a Number answer.
- [x] **B2. Responsiveness as the form grows.** Answer the forklift branch FL-01 → No → Damaged → Hydraulics → Yes → No. Note how long each answer takes to update the score and show the next question (Monitor timings).
- [x] **B3. The missing sixth level.** At FL-01.1.1.1.1 "Has a spill kit been deployed?", answer **No**. Confirm FL-01.1.1.1.1.1 doesn't appear and the score doesn't include its 25 points or the critical stop.
- [x] **B4. Photo save.** *Run 2: the photo uploaded as a file and came back through the full-image download.* Add a picture, save it, reopen it. Is the full-size image stored and shown (not just the 144 px thumbnail)?
- [x] **B5. Annotation.** *Owner accepted on a visual check, 2026-10-17. Strokes save to their own column (Run 2 trace).* Draw on a photo and save. Does the strokes image overlay the photo correctly afterwards (transparent background, same aspect ratio)? Does the photo itself stay unchanged?
- [x] **B6. Choice dropdown loop.** Change a Choice answer that reveals children. Does the dropdown's change event fire again when the list reloads? Microsoft documents this as a gallery pitfall.
- [x] **B7. Submit.** Submit, then check the Dataverse records: one answer row per visible answered question, plus the score, band, status and "Canvas only" on the inspection.

## What this sets up for App 2

The PCF component (React + TypeScript) takes over the three interaction-heavy jobs: the recursive checklist, the annotation canvas and the rules engine. The Canvas app keeps navigation and Dataverse reads and writes, because code components in canvas apps can't call the Dataverse Web API. The mapping from each limit to its solution is in [how-pro-code-solved-it.md](how-pro-code-solved-it.md) (after App 2).
