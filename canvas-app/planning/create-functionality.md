Revision: 1

Inputs:

Original request (verbatim):
> Build the equipment inspection Canvas app ("App 1") described in D:\Master\02-Career\PowerPlatform\CanvasVsPcfInspection\canvas-app\DESIGN.md, in the app synced to D:\Master\02-Career\PowerPlatform\CanvasVsPcfInspection\canvas-app\src. Data model: D:\Master\02-Career\PowerPlatform\CanvasVsPcfInspection\docs\data-model.md and dataverse\schema.json. Five screens: Screen1 (Home: inspection list + KPIs + New inspection), StartScreen (site -> equipment -> start, Patch Draft inspection), InspectScreen (stage tabs, visible questions indented by depth, answer control per answer type, live risk panel; visibility walked level by level with no recursion), PhotoScreen (Add picture -> Inspection photos image column; Annotate = transparent Pen input over the photo, strokes saved to Canvas pen strokes column), ReviewScreen (answers by stage, score breakdown, Submit: ForAll Patch answers, Patch inspection Submitted with score/band and Built with = Canvas only). Fusion Sky theme: primary #0B5F7E, secondary #209CCB, purple #742774, text #0F2530, muted #51646E, background #EDF7FB, border #CBE2EC, success #167044, warning #8A5A00, error #B42318. Tablet layout. Real Dataverse data only, no mock data.

Clarifications / known constraints (verbatim from coordinator):
> - Read D:\Master\02-Career\PowerPlatform\CanvasVsPcfInspection\canvas-app\DESIGN.md, D:\Master\02-Career\PowerPlatform\CanvasVsPcfInspection\docs\data-model.md and D:\Master\02-Career\PowerPlatform\CanvasVsPcfInspection\dataverse\schema.json for the scenario and data. Seed data is in D:\Master\02-Career\PowerPlatform\CanvasVsPcfInspection\dataverse\seed\.
> - Purpose: a portfolio piece showing what Canvas can reasonably do for this scenario, built the way a capable maker would. It is the "low-code" half of a Canvas-vs-PCF comparison; it must be honest and presentable, not a straw man. Do not implement compound risk rules or the advanced cross-question rule (fp_rulejson); those are deliberately out of scope for App 1 and will be documented as limits.
> - Device: tablet (landscape), used by warehouse inspectors; may be used in browser or Power Apps mobile.
> - Data: Dataverse in the current environment. All six tables already exist and are added to the app as data sources: Sites, Equipment, Checklist questions, Inspections, Inspection answers, Inspection photos. Real data is seeded (3 sites, 7 equipment, 40 questions: Forklift 30 questions up to 6 levels deep, Conveyor 10 questions up to 2 levels). No mock data.
> - Visibility rule: a child question shows only when its parent's answer meets its show condition (Equals, Not equals, Greater than, Less than, One of; One of values are pipe-separated) and the parent is itself visible. The Canvas app supports a fixed number of levels (5 levels, depth 0-4) because Power Fx user-defined functions have no recursion; the seeded 6th-level question FL-01.1.1.1.1.1 is expected NOT to appear in this Canvas app (this is intentional evidence for the comparison).
> - Risk: sum of weights of visible questions whose own answer meets their risk condition, times equipment criticality multiplier (Low 1.0, Medium 1.25, High 1.5), capped at 100; bands 0-24 Low, 25-49 Medium, 50-74 High, 75-100 Critical; any triggered critical question forces Critical. Answers on hidden branches never score.
> - Inspector name: use the signed-in user's full name.
> - Inspections record Built with = "Canvas only" so the two apps can be compared on real records.

## Users and tasks

- **Inspector** (signed-in user, tablet landscape, browser or Power Apps mobile): review existing inspections; start an inspection of one piece of equipment at a site; answer a branching checklist stage by stage while watching the risk score; attach and annotate photos; review and submit.
- **Comparison reviewer / portfolio audience**: reads inspection outcomes (status, risk, which app captured each) on real records. No separate role or permissions; same user population.

No roles, approval workflow, edit-after-submit or delete capability is requested.

## Domain concepts (semantic)

- **Site**: name, site code, region. Has equipment.
- **Equipment**: name, asset tag, equipment type (Forklift, Conveyor, Pallet racking, Air compressor), criticality (Low/Medium/High -> multiplier 1.0/1.25/1.5), hour meter, site.
- **Checklist question**: one node of a per-equipment-type tree. Code (dotted nesting), text, stage (Pre-use, Visual and structural, Operational test, Safety sign-off), sort order, depth (0 = root), parent question, answer type (Yes/No, Choice, Number, Text), options (pipe-separated, for Choice), show condition (operator + value, tested against the parent's answer), risk weight, risk condition (operator + value, tested against its own answer), critical stop flag, help text, advanced rule (out of scope).
- **Condition operators**: Equals, Not equals, Greater than, Less than, One of (pipe-separated values).
- **Inspection**: autonumber (INS-nnnnn), site, equipment, status (Draft/Submitted), risk score (0-100, 1 decimal), risk band (Low/Medium/High/Critical), started on, submitted on, inspector name, built with (Canvas only / Canvas + PCF), notes.
- **Inspection answer**: inspection, question, question code, value (text), numeric value, risk contribution.
- **Inspection photo**: inspection, optional question, caption, photo image, Canvas pen strokes image. (Annotated photo and annotation data columns belong to App 2; not written here.)

Persistence: all data is the live Dataverse tables already in the app. Answers are held in the session until Submit (per DESIGN.md), then persisted. Photos persist when saved. No mock data, no offline persistence requested.

## Requirements

- **R1 Home overview.** Shows inspections from Dataverse with, per inspection: number, equipment, site, status, risk score and band shown as a risk badge, and which app captured it (Built with). Inspections are filtered/sorted in a way that stays delegable on Dataverse. Shows KPI summary figures (see Q1). Offers "New inspection". Empty state when there are no inspections.
- **R2 Start an inspection.** Inspector selects a site, then a piece of equipment restricted to that site, then starts. Starting creates a Draft inspection in Dataverse linked to site and equipment, with started-on time, inspector = signed-in user's full name, Built with = "Canvas only"; the system-assigned inspection number is shown afterwards.
- **R3 Checklist by stage.** The equipment's type determines the question set (loaded once per inspection). Questions are grouped into the four stages, selectable as stage tabs; within a stage only visible questions appear, in sort order, each indented by its depth. Each question offers an answer input matching its answer type: Yes/No; Choice from its pipe-separated options; Number; Text. Help text is available where present.
- **R4 Conditional visibility (fixed depth).** Roots are always visible. A child is visible only when its parent is visible and the parent's answer meets the child's show condition. Evaluation is level by level without recursion, supporting exactly 5 levels (depth 0-4). Questions at depth 5+ (seeded FL-01.1.1.1.1.1) never appear; this is intentional evidence, not a defect. Visibility updates immediately after each answer.
- **R5 Live risk panel.** While answering, shows the current score and band, recalculated after each answer: sum of risk weights of visible questions whose own answer meets their risk condition, times the equipment criticality multiplier, capped at 100; bands 0-24 Low, 25-49 Medium, 50-74 High, 75-100 Critical; any triggered critical-stop question forces Critical. Hidden questions never score. Shows which critical stop(s) triggered.
- **R6 Photo capture.** For the current inspection, inspector adds a picture ("Add picture"), enters a caption, and saves it to the Inspection photos image column linked to the inspection. Saved photos for the inspection are listed.
- **R7 Photo annotation.** "Annotate" = transparent Pen input over the photo; the inspector draws freehand strokes, and the strokes image (not merged with the photo) is saved to the Canvas pen strokes column of that photo record. Limits (freehand only, strokes separate from photo, no shapes/labels/markers/per-mark data) are expected and are not to be worked around.
- **R8 Review.** Shows answers grouped by stage (visible questions only), and a score breakdown: each contributing question with its weight, the subtotal, the criticality multiplier, the cap if applied, critical-stop override, final score and band.
- **R9 Submit.** Persists the answers as Inspection answer records (ForAll Patch, verbatim constraint) with value, numeric value for Number answers, question link/code and risk contribution; then updates the inspection to Submitted with risk score, risk band, submitted-on time and Built with = "Canvas only" (verbatim constraint). Returns to Home where the inspection shows as Submitted.
- **R10 Navigation and naming (constraint for build stage, verbatim).** Five screens: `Screen1` (Home), `StartScreen`, `InspectScreen`, `PhotoScreen`, `ReviewScreen`, with the content listed in the original request.
- **R11 Theme and layout (constraint for design stage, verbatim).** Fusion Sky theme: primary #0B5F7E, secondary #209CCB, purple #742774, text #0F2530, muted #51646E, background #EDF7FB, border #CBE2EC, success #167044, warning #8A5A00, error #B42318. Tablet layout (landscape). Risk bands and status must be visually distinguishable.
- **R12 Data honesty.** Real Dataverse data only, no mock data. Compound risk rules and the cross-question advanced rule (fp_rulejson, e.g. FL-32) are NOT implemented; FL-32 therefore behaves only per its ordinary parent/show condition, if any (see Q5).
- **R13 Comparison evidence readiness (constraint from DESIGN.md).** The visibility logic must be structured so that its per-level statements are countable and adding a level means adding a statement; implementation must not hide the depth limit.

## Actions

- **A1 View inspections** (R1). Any signed-in user. Pre: none. Outcome: list + KPIs from Dataverse. Empty: "no inspections yet" message. Failure: data load error shown, list empty.
- **A2 Begin new inspection** (R1, R2). Inspector, from Home. Outcome: start flow with no site/equipment preselected.
- **A3 Select site** (R2). Outcome: equipment choices limited to that site; changing site clears the equipment selection. Empty: site with no equipment shows a message; start unavailable.
- **A4 Select equipment** (R2). Pre: site selected. Outcome: equipment type and criticality visible for confirmation.
- **A5 Start inspection** (R2, R3). Pre: site and equipment selected. Transition: new Draft inspection created (R2 fields). Outcome: checklist opens on first stage with that equipment's questions, and empty answers. Empty: equipment type with no questions (Pallet racking, Air compressor have none seeded) shows a message instead of a blank checklist. Failure: save error shown, inspector stays on start step, no checklist opened.
- **A6 Cancel start** (R2). Inspector returns to Home before starting; nothing is created.
- **A7 Switch stage** (R3). Outcome: that stage's visible questions shown; answers in other stages kept. Empty: stage with no visible questions shows a message.
- **A8 Answer a question** (R3, R4, R5). Inspector, on a visible question. Transition: session answer set/changed. Outcome: newly qualifying children appear indented beneath; children whose condition no longer holds (and their descendants) disappear and stop scoring; risk panel recalculates. Number input that is not numeric is not accepted as a number (does not meet Greater/Less than). Answers on now-hidden branches are retained in session but ignored (A-4).
- **A9 Clear/change an answer** (R4, R5). Same as A8; clearing makes dependent children hidden.
- **A10 Open photos** (R6). Pre: a Draft inspection exists (created by A5). Outcome: photos for this inspection listed. Empty: "no photos yet".
- **A11 Add picture and save** (R6). Pre: picture chosen. Transition: Inspection photo created with image, caption, inspection link. Outcome: appears in list. Cancel: discard unsaved picture. Failure: save error shown; picture kept for retry. Empty caption: see A-6.
- **A12 Annotate photo** (R7). Pre: a saved photo selected. Inspector draws over it; can clear strokes before saving. Save: strokes image written to that photo's Canvas pen strokes column. Cancel: strokes discarded, photo unchanged. Failure: error shown.
- **A13 Return to checklist** (R3). From photos or review; session answers and current stage preserved.
- **A14 Review** (R8). Pre: inspection in progress. Outcome: answers by stage + score breakdown. Unanswered visible questions are indicated (see Q3).
- **A15 Submit** (R9). Pre: Draft inspection with at least one answer (A-5). Transition: answers written, inspection -> Submitted with score/band/submitted on/Built with "Canvas only". Outcome: success confirmation, Home shows Submitted with band badge; session cleared. Failure: error shown, inspection stays Draft, inspector stays on review and can retry (see A-7 re partial writes). Submit cannot be triggered twice concurrently.
- **A16 Abandon in-progress inspection** (R1, R2). Inspector leaves to Home without submitting; session answers are lost; the Draft record remains (see Q2).

## Assumptions

- **A-1** (R1, A1) Home list is read-only; selecting an inspection does not resume or edit it. Drafts appear with status Draft and no score.
- **A-2** (R2) Inspector name = signed-in user's full name from the platform user profile; no separate identity configuration.
- **A-3** (R3, R4) Yes/No answers are stored and compared as the text "Yes"/"No"; Choice as the selected option text; comparisons for Equals/Not equals/One of are case-insensitive on trimmed text; Greater/Less than compare numerically. To verify against seeded show/risk values during discovery.
- **A-4** (R4, R5, R9) Hidden-branch answers are kept in session (so re-opening a branch restores them) but never score and are not persisted on Submit; only answers to visible questions are written.
- **A-5** (A15) Submit is allowed with unanswered visible questions; no mandatory-answer rule was requested.
- **A-6** (A11) Caption defaults to something meaningful (e.g. inspection number + sequence) if left blank, since caption is the record's primary name.
- **A-7** (A15) Writes are not transactional; on partial failure, answers already written remain and a retry must not duplicate them (retry updates rather than re-creates).
- **A-8** (R6) Photos are linked to the inspection only; linking a photo to a specific question is supported by the data but not requested.
- **A-9** (R6) "Add picture" is the required capture path; a live camera path (mentioned in DESIGN.md) is optional.
- **A-10** (R5, R8) Score stored with one decimal; criticality missing on equipment treated as Low (x1.0).
- **A-11** (R1) Delegable filtering on Dataverse is required for the list; KPI counts must remain correct beyond delegation limits or the limitation is documented as evidence.

## Material questions (non-blocking; defaults above apply)

- **Q1** (R1) Which KPIs? Proposed: total inspections, Drafts, Submitted, High+Critical count, average submitted score, and Canvas-only vs Canvas+PCF counts.
- **Q2** (A16, A1) Should abandoned Drafts be resumable, deletable, or simply left as Drafts? Default: left as Drafts (A-1), since answers live only in session until Submit.
- **Q3** (A14, A15) Should Submit require every visible question answered? Default: no (A-5), unanswered count shown on review.
- **Q4** (R1) Should Home show all users' inspections or only the signed-in inspector's? Default: all, newest first.
- **Q5** (R12) FL-32 has an advanced rule that App 1 will not evaluate. Should it be hidden in App 1, or shown per its parent/show condition only (or always if it is a root)? Default: treat it like any other question using only its stored parent/show condition; document the behaviour as evidence.
