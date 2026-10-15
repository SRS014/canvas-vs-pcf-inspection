Revision: 1

Inputs:
- D:\Master\02-Career\PowerPlatform\CanvasVsPcfInspection\canvas-app\src\create-functionality.md (Revision 1)
- D:\Master\02-Career\PowerPlatform\CanvasVsPcfInspection\canvas-app\src\create-screens.md (Revision 1)
- D:\Master\02-Career\PowerPlatform\CanvasVsPcfInspection\canvas-app\src\create-design.md (Revision 1)
- D:\Master\02-Career\PowerPlatform\CanvasVsPcfInspection\canvas-app\src\S1.composition.md (Revision 1)
- D:\Master\02-Career\PowerPlatform\CanvasVsPcfInspection\canvas-app\src\S2.composition.md (Revision 1)
- D:\Master\02-Career\PowerPlatform\CanvasVsPcfInspection\canvas-app\src\S3.composition.md (Revision 1)
- D:\Master\02-Career\PowerPlatform\CanvasVsPcfInspection\canvas-app\src\S4.composition.md (Revision 1)
- D:\Master\02-Career\PowerPlatform\CanvasVsPcfInspection\canvas-app\src\S5.composition.md (Revision 1)
- Local reference (not live): D:\Master\02-Career\PowerPlatform\CanvasVsPcfInspection\dataverse\schema.json, ...\dataverse\seed\checklist-questions.json, ...\docs\data-model.md, ...\canvas-app\DESIGN.md, ...\canvas-app\src\App.pa.yaml

## Discovery status: BLOCKED (provisional packet)

The Canvas Authoring MCP tools (`list_controls`, `describe_control`, `list_data_sources`, `get_data_source_schema`, `list_apis`, `describe_api`, `search_stock_images`) were **not exposed to the discovery agent's toolset**, so no tool call was made or could be made. This is a capability failure, not an empty result. Everything below therefore comes from:
- **[L]** local project files (schema.json, seed JSON). These record the intended provisioning. They are not the live app's data-source metadata.
- **[K]** general platform knowledge. These are expectations only. They are not tool-backed evidence and **must not be used as control or property authority**.
- **[P]** plugin references (CreateBuilderCore, CreateGalleryLayout, PowerFxGuide "Platform confirmation with Confirm").

No region/action below has tool-backed feasibility. Re-run discovery with the MCP tools available. The queries needed are listed in "Required tool queries".

## Required tool queries (to resolve before Ready)

1. `list_controls`, then match candidates for: list/repeating surface (with a variable/flexible-height option), button, text input with numeric entry, dropdown/combobox, segmented or radio choice, image, add-picture/media, Pen input, container (AutoLayout and manual/overlap-capable), spinner, toggle/help disclosure.
2. `describe_control` (only these material questions):
   - Pen input: does it have a transparent Fill/background? Does it expose an Image output? Stroke colour and size inputs? A clear/reset path? Can it sit in a container that overlaps it exactly with an Image?
   - Add picture/media: what is the media output (name and type)? Does it support a chooser-only (no camera) path?
   - Container: overlap support (manual layout) inside an AutoLayout parent; vertical overflow scroll for S5.R2.
   - Gallery: is a flexible/variable-height variant available (S3.R3 and S5.R2 rows wrap and expand)? Template containment of input controls (Yes/No, dropdown, number, text) in one row?
   - Dropdown/combobox: can Items come from a split text list? Is a blank "No answer" entry possible?
3. `list_data_sources` and `get_data_source_schema` for all six tables, to confirm the live display names, the Power Fx option-set enum names (see Data contracts), lookup names, and the image column names `Photo` and `Canvas pen strokes`.
4. `search_stock_images`: **not required**. The experience uses only user-captured photos.

## Shared shell (proposed, [P] rules; control identities unverified)

- **Mode: fixed-chrome on every screen.** One stationary full-viewport AutoLayout root holds a 72 px header and a body row. The page never scrolls. Every scroll owner is a bounded viewport inside the body. This matches all five compositions ("the page itself never scrolls").
- **Scroll owners (each needs an approved independent-scroll contract and a visible affordance, [P] QACHK-SCROLL-TRAP):**

| Screen | Scroll owner(s) | Fixed |
|---|---|---|
| S1 | S1.R4 row area (list viewport) | R1, R2, R3, R4 title/column headers |
| S2 | S2.R2 site list; S2.R3 equipment list (two independent owners, deliberate) | R1, R4 confirm panel and Start |
| S3 | S3.R3 question list; S3.R4 critical-stop sub-list only when it overflows | R1, R2 tabs, R4 score/badge/derivation/footer |
| S4 | S4.R2 photo list | R1, R3 viewer (never scrolls) |
| S5 | S5.R2 answers body; S5.R3 contributing-questions sub-list | R1, S5.R3 headline and calculation/submit footer |

- [K] Lists with independent scrolling are normally feasible: a bounded gallery viewport scrolls on its own. This is unverified until `describe_control` confirms gallery sizing and whether the scrollbar can be shown.
- **S5.R2 grouping recommendation.** Stage sections contain wrapping rows of variable height. [P] forbids deriving gallery Height from CountRows x template size. To keep one scroll owner, use a **single list over a flattened session table** with a row-kind discriminator (stage heading row, or question row with an indent from depth). Alternative: a vertically scrolling container with four bounded section lists. That would create nested scroll owners, so it is not recommended. Either way, a flexible-height list is needed (query 2).

## Region/action-to-candidate table (candidates are UNVERIFIED type families, not query identities)

| Screen/region/action | Candidate family to confirm | Material fit limits / open questions |
|---|---|---|
| All R1 headers; S1.R1 New inspection (A2); S2.R1 Cancel (A6); S3.R1 Abandon/Photos/Review; S4.R1 Back/Add; S5.R1 Back | button (primary/secondary/text appearances) | Enabled/disabled states and busy label; contrast of non-filled appearances on white |
| S1.R3 KPI tiles | text/label in containers | Delegation of counts/average, see Data |
| S1.R4 inspections list (A1) | gallery (read-only rows, no tab stop per row per A-1) | Unbounded live source, see Dataset bounds |
| S1.R2 banner, all inline banners | container + text + dismiss button | none known |
| S2.R2 / S2.R3 selectable card lists (A3, A4) | gallery with row select | Changing site must clear the equipment selection (state-driven, not Gallery.Selected) |
| S2.R4 Start (A5) | button + Patch to Inspections | Busy disable; see Data contracts |
| S3.R2 stage tabs (A7) | 4 buttons or a tab-list control, if listed | Live "answered/visible" count per tab |
| S3.R3 question rows (A8, A9) | flexible-height gallery whose row holds: Yes/No segmented (2 buttons or a radio), dropdown, numeric text input, multiline text input, help toggle, Clear | All four answer inputs are conditionally visible in **one template**. Flexible height is needed for wrapping text, expanded help and the validation line. Focus/scroll retention is a risk, see Feasibility F3 |
| S3.R4 risk panel | text + badge container + small gallery for critical stops | none known |
| S3.R5 Abandon confirmation (A16) | Confirm() platform dialog **or** custom overlay container | See Feasibility F1 (needs coordinator decision) |
| S4.R2 photo list (A10) | gallery with image thumbnail | Dataverse image column: thumbnail vs full, see Data |
| S4.R1 Add picture (A11) | add-picture/media control | Output savable to `Photo`, see F5 |
| S4.R3 viewer frame | image (photo) + image (saved strokes) + Pen input, exactly overlapped in a 4:3 box | Overlap needs a manual-layout container inside the AutoLayout body (F4) |
| S4.R3 caption (A11) | text input with a visible "Caption" label | none known |
| S5.R2 answers (A14) | flexible-height gallery over a flattened table | See shell recommendation |
| S5.R3 contributing list; Submit (A15) | gallery + button | ForAll Patch, see Data |

## Feasibility findings (all unverified; tool or runtime evidence required)

- **F1 Abandon modal (S3.R5).** [P] `Confirm(message, {Title, Subtitle, ConfirmButton, CancelButton})` is a platform dialog that returns true/false. It needs no container, overlay stacking or app-authored focus trap. It can carry the title "Abandon INS-nnnnn?", the body text, and buttons labelled "Abandon inspection" / "Keep inspecting". **Compromise if chosen:** the dialog is platform-styled, so the scrim colour, the 480 px card, the destructive red confirm button, default focus on "Keep inspecting" and focus return to Abandon cannot be controlled. Its focus trapping, keyboard dismissal and support in Power Apps mobile are **runtime-unverified**. **Custom overlay alternative:** a full-screen scrim container that covers and blocks pointer input, with SetFocus on "Keep inspecting". The underlying controls would have to be set disabled or non-tabbable while it is open, because the platform has no native focus trap. Both depend on container overlap, which `describe_control` has not confirmed. S3.R5 says builders must not substitute patterns. **Decision needed from the coordinator/user:** accept Confirm() (recommended, with the styling compromise disclosed), or require the custom overlay once overlap and focus capabilities are confirmed.
- **F2 Independent scroll regions.** [K] Expected feasible as bounded gallery viewports. A nested scroll owner inside S3.R4 or S5.R3 is acceptable only as the bounded sub-list described above. Not tool-verified.
- **F3 S3 focus/scroll retention after answering (evidence item, reported honestly).** [K] Rebuilding the visible set (a ClearCollect/Collect into the gallery's Items, level by level) replaces records. Canvas galleries typically re-render when their Items change. Expected outcomes are: (a) the focused input in the answered row loses focus; (b) text and number inputs that commit on change can lose the caret mid-typing; (c) the scroll position can jump when rows are inserted or removed above the viewport, or when the collection is replaced. **Mitigations a capable maker would use (no hiding):** commit text/number answers on blur (OnChange after leaving the field), not on each key; update only the affected rows (UpdateIf/Patch on a stable question Id) instead of replacing the whole collection where the level-by-level rebuild allows; keep stable row identity. Whatever the runtime shows must be recorded as comparison evidence. The S3 composition's "the answered row ... keeps focus; the list does not jump" is therefore **at risk, not guaranteed**. Only runtime testing can settle it.
- **F4 Pen input overlay (S4.R3).** [K] The Pen input is a classic control (no modern equivalent is expected). Expected capabilities: Image output, stroke colour and size inputs, a transparent Fill, and clearing through Reset. The 4:3 frame can be computed from the pane's live width/height (min of width and height x 4/3), with the Image(s) and Pen input given identical X/Y/Width/Height inside a manual-layout container. Photo letterboxing must use "fit" image positioning inside the same 4:3 box, so strokes line up with the frame, not with the photo's own pixels. **Open questions for describe_control:** does a manual-layout (overlap) container nest inside the AutoLayout body; is the Pen input's Fill settable to transparent; is the Image output's background transparent (if it is not, the saved strokes will hide the photo when re-overlaid); does the Pen input have built-in controls that should be hidden.
- **F5 Image saves.** [K] Patching the add-picture control's media output to `Photo`, and the Pen input's Image output to `Canvas pen strokes`, is the documented Dataverse image-column pattern. Not verified here. The column size limit is 10,240 KB per image [L], so a larger photo makes the save fail (A11 error path). When displaying an image, Dataverse image columns return a thumbnail unless the full image is requested. The viewer and stroke overlay need the full image. The list thumbnail can use the default.
- **F6 Power Fx user-defined functions.** [K] UDFs in App.Formulas are expected to be available: a pure `Meets(answer: Text, op: Text, value: Text): Boolean`, and a behavior UDF (brace body) to rebuild visibility. Recursion is not supported, which the design relies on (R4, R13). Behavior UDFs may depend on the app's Power Fx/feature version or a preview setting. **Must be proven by compiling App.pa.yaml.** If behavior UDFs are rejected, the fallback that keeps R13's countable per-level statements is: five named formulas `VisL0`..`VisL4` (each derived from the previous level, so it is still one statement per level), or the same five statements inline in a shared behavior action. Adopting the fallback is a compromise that needs a coordinator decision, because DESIGN.md names a "behavior function".

## Data contracts ([L] intended schema; live names unverified)

Tables (display/plural names): `Sites`, `Equipment`, `Checklist questions`, `Inspections`, `Inspection answers`, `Inspection photos`. The coordinator states all six are in the app and hold real data. **No mock data is proposed** (R12, user constraint).

| Table | Columns used (display name, type) | Lookups |
|---|---|---|
| Sites | Site name (text 100, primary), Site code (10), Region (100) | none |
| Equipment | Equipment name (primary), Asset tag (20), Equipment type (choice, required), Criticality (choice), Hour meter (int) | Site -> Sites |
| Checklist questions | Question (primary, 300), Code (40), Equipment type, Stage (choice), Sort order (int), Depth (int), Answer type (choice), Options (text, pipe-separated), Show when operator (choice), Show when value (text), Risk weight (int), Risk when operator (choice), Risk when value (text), Critical stop (bool), Help text (500). Advanced rule (JSON) is **not read** (R12) | Parent question -> Checklist questions |
| Inspections | Inspection number (primary, autonumber INS-{SEQNUM:5}), Status (choice), Risk score (decimal, 1 dp, 0-100), Risk band (choice), Started on, Submitted on (datetime), Inspector (text 200), Built with (choice), Notes (memo, unused) | Site -> Sites; Equipment -> Equipment |
| Inspection answers | Question code (primary, 100), Value (text 4000), Numeric value (decimal, 2 dp), Risk contribution (decimal, 1 dp, 0-1000) | Inspection -> Inspections (cascade); Question -> Checklist questions |
| Inspection photos | Caption (primary, 200), Photo (image, primary image, 10 MB), Canvas pen strokes (image, 10 MB). Annotated photo / Annotation data (JSON) are App 2 only and **not written** | Inspection -> Inspections (cascade); Question (optional, unused per A-8) |

Global option sets [L] (value / label). Power Fx enum names are expected to follow the option-set display names, for example `'Inspection status'.Draft`. These are **unverified**, and name collisions with column display names (e.g. "Built with", "Equipment type") may force disambiguated names.
- Equipment type (fp_equipmenttype): 122500000 Forklift, ...01 Conveyor, ...02 Pallet racking, ...03 Air compressor
- Inspection stage (fp_inspectionstage): Pre-use, Visual and structural, Operational test, Safety sign-off (122500000-03)
- Answer type (fp_answertype): Yes/No, Choice, Number, Text
- Condition operator (fp_conditionoperator): Equals, Not equals, Greater than, Less than, One of (122500000-04)
- Risk band (fp_riskband): Low, Medium, High, Critical
- Equipment criticality (fp_criticality): Low, Medium, High
- Inspection status (fp_inspectionstatus): Draft, Submitted
- Built with (fp_builtwith): Canvas only (122500000), Canvas + PCF (122500001)

Action contracts (intent only; not executable recipes):
- **A5 Start:** create an Inspections row with Status Draft, Site and Equipment lookups, Started on = now, Inspector = signed-in user's full name (A-2), Built with Canvas only. Read back the returned record for its autonumber Inspection number. Seed permissions are those of the signed-in user (not verified).
- **A11 / A12:** create an Inspection photos row (Caption, Photo, Inspection). Annotation updates `Canvas pen strokes` on that row, found by its stable row id.
- **A15 Submit (A-7 no duplicates):** for each answered visible question, find an existing answer by (Inspection, Question) and update it, otherwise create one. Fields: Question code, Value, Numeric value (Number type only), Risk contribution, Question lookup. Then update the inspection: Status Submitted, Risk score, Risk band, Submitted on, Built with Canvas only. Writes are not transactional (A-7).
- **Delegation ([K], must be checked for compile warnings):** Inspections sorted newest first (Started on or Created on, descending) and filtered on choice/lookup columns are expected to delegate to Dataverse. KPI CountRows on Dataverse is expected to delegate. Average of Risk score is expected to delegate with aggregate limits. If any KPI shows a delegation warning, S1.R3's planned "Note" line documents the limit (A-11).

**A-3 verified against the seed [L]:** show/risk values are stored as the text "Yes"/"No", the option text (e.g. "Damaged", "Crack visible"), or numeric text ("500", "250", "3", "30", "80"). One of values are pipe-separated ("Worn|Damaged", "Slack|Damaged", "Frayed|Torn").
**Q5 note [L]:** FL-32 has no parent, so under the default it is a root and **always visible** in Safety sign-off. It has no risk weight. This should be documented as evidence.
**Depth evidence [L]:** FL-01.1.1.1.1.1 is at depth 5. It is a critical stop with weight 25, and it never appears or scores in App 1.

## Dataset bounds ([P] CreateGalleryLayout)

| List source | Classification | Maximum | Invariants / invalidating changes | Scroll/paging strategy |
|---|---|---|---|---|
| S1 Inspections | live/unbounded (grows with every A5, and with App 2) | unknown | none | bounded list viewport with scrolling; Dataverse incremental paging; delegable sort/filter |
| S2 Sites | live | unknown (seed 3) | table editable outside the app | bounded viewport, scrolls (deliberate) |
| S2 Equipment for a site | live | unknown (seed 7 in total) | same | bounded viewport, scrolls |
| Questions for a type (session copy) | live, loaded once into session | unknown (seed: Forklift 30, Conveyor 10). The session copy is limited by the app's non-delegated row limit (default 500) | a template larger than the row limit would truncate silently, which is a documented limit | the filter by Equipment type should delegate |
| S3 visible questions per stage | derived local | at most the questions in that stage at depth <= 4 (seed max: Forklift Pre-use 11 of 12) | depends on the live template | bounded viewport, scrolls |
| S3 critical stops triggered | derived local | at most the critical questions visible (seed: Forklift 4, Conveyor 3) | template edits | panel sub-list scrolls only on overflow |
| S4 Photos for an inspection | live/unbounded (grows with A11) | unknown | none | bounded viewport, scrolls |
| S5 answers (flattened) / contributing list | derived local | at most 4 stage headings plus the visible questions | template edits | bounded viewport(s), scroll |

## Gaps and decisions needed

1. **Blocking:** MCP authoring tools were unavailable to discovery. No control identities, containment, variants, Pen/Add-picture outputs or live schema names are verified. Re-run discovery with the tools.
2. **F1 (decision):** Confirm() platform dialog (styling compromise) or a custom overlay (pending overlap/focus capability).
3. **F3 (evidence, not a defect):** focus/scroll retention after answering is at risk. The S3 composition promise must be stated as "intended; runtime behavior recorded as evidence".
4. **F6 (contingent decision):** if behavior UDFs fail to compile, switch to five per-level named formulas.
5. **F4 (contingent):** if the Pen input's Image output is not transparent, overlaying the saved strokes on the photo hides the photo. A layout revision of "Photo selected" would then be needed (for example, a toggle between photo and strokes).

## Document-dependent choices

- The Power Fx enum and column names above depend on the live data-source metadata. Re-check them after any change to the data sources.
- UDF availability depends on the app's Power Fx settings and version. Re-check after any app-settings change.
- Overlap container and Pen input decisions depend on `describe_control` responses for the current authoring version.

## Coordinator discovery addendum (2026-10-15)

The discovery specialist couldn't reach the canvas-authoring tools (the plugin agents expect `mcp__canvas-authoring__*`; this install exposes `mcp__plugin_canvas-apps_canvas-authoring__*`). The coordinator ran the queries directly:
- list_controls, and describe_control for GroupContainer, ModernText, ModernButton, Gallery, ModernDropdown, ModernNumberInput, ModernTextInput, ModernTabList, AddMedia, PenInput, Image and ModernSpinner.
- get_data_source_schema for all six tables. Two names clash, so the formulas use the disambiguation operator:
  - The Inspections table has two "Status" columns: `fp_status` displays as 'Status (fp_status)', next to the system column 'Status (statecode)'.
  - 'Risk band' and 'Built with' are each the name of a column and of a choice, so formulas refer to the choice as [@'Risk band'] and [@'Built with'].
- Image columns are typed as Record: Photo is patched as {Full, Value}.
- F1: Confirm() was chosen for Abandon. Its styling compromise is accepted: there's no scrim and no red button.
- F6: pure UDFs, behavior UDFs (SetAnswer/ClearAnswer) and named formulas all compile, so the level-by-level named formulas VisL0..VisL4 are used.
- ModernTabList.ItemDisplayText can't contain lookups or aggregates, so the per-stage counts come from the named formula StageTabs.

## Approval

Status: Preapproved
Revision tuple: functionality@1, screens@1, design@1, S1-S5 compositions@1, discovery@1 (+ coordinator addendum)
Evidence: The owner's brief told Claude to build App 1 end to end and then PAUSE for their review before App 2. The owner sets the review point after the build, not before it. Defaults for the stage 1 questions (Q1-Q5) were applied by the coordinator, and the owner can still override them at that review.
