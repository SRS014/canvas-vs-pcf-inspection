Revision: 1

Inputs:
- Original request (verbatim, in coordinator brief)
- D:\Master\02-Career\PowerPlatform\CanvasVsPcfInspection\canvas-app\src\create-functionality.md (Revision 1)
- Coordinator decisions on Q1-Q5 (defaults applied; A-1..A-9 accepted)

## Screen set (user constraint, verbatim)

> Five screens: Screen1 (Home: inspection list + KPIs + New inspection), StartScreen (site -> equipment -> start, Patch Draft inspection), InspectScreen (stage tabs, visible questions indented by depth, answer control per answer type, live risk panel; visibility walked level by level with no recursion), PhotoScreen (Add picture -> Inspection photos image column; Annotate = transparent Pen input over the photo, strokes saved to Canvas pen strokes column), ReviewScreen (answers by stage, score breakdown, Submit: ForAll Patch answers, Patch inspection Submitted with score/band and Built with = Canvas only).

The user fixed the screen count, names and contents, so logical IDs map one-to-one:

| ID | Required name | Role |
|---|---|---|
| S1 | `Screen1` | Home (landing screen) |
| S2 | `StartScreen` | Start an inspection |
| S3 | `InspectScreen` | Answer the checklist (hub of an in-progress inspection) |
| S4 | `PhotoScreen` | Photos and annotation for the current inspection |
| S5 | `ReviewScreen` | Review and submit |

Cross-cutting: R10 (names above) and R11 (theme, tablet landscape, risk band/status distinguishable) apply to every screen. R12 (real data only; no compound rules, no fp_rulejson evaluation beyond the coordinator's FL-32 decision) applies to S1, S3, S5.

Linear flow: S1 -> S2 -> S3 <-> {S4, S5} -> S1. S3 is the hub of an in-progress inspection; S4 and S5 are always entered from S3 and return to it.

## S1 Screen1 - Home (landing)

- **Purpose:** see all inspections and their outcomes; start a new one.
- **Owns:** R1, A1, A2. Destination of A6, A15 (success) and A16.
- **Information needed:** all inspections, newest first (Q4): number, equipment, site, status, risk score + band badge (Drafts show no score, A-1), Built with. KPIs (Q1): total, Drafts, Submitted, High+Critical count, average submitted score, Canvas only vs Canvas + PCF counts (A-11: correct beyond delegation limits, or the limit documented).
- **Entry:** app launch; from S2 (cancel); from S3 (abandon); from S5 (after successful submit).
- **Exit:** "New inspection" -> S2 (A2), with no site/equipment preselected.
- **States:**
  - Loading.
  - Loaded: list + KPIs. List rows are read-only (A-1); selecting a row does not navigate.
  - Empty: "No inspections yet" with KPIs at zero; "New inspection" still available.
  - Load failure: error message, list empty, KPIs not shown as zeros (avoid presenting failure as real data, R12).
  - Arrival after submit: transient success confirmation naming the submitted inspection number (A15 outcome); the row shows Submitted with its band badge.
  - Arrival after abandon: list refreshed; the abandoned inspection appears as Draft (Q2).

## S2 StartScreen - Start an inspection

- **Purpose:** site -> equipment -> start; creates the Draft inspection.
- **Owns:** R2, A3, A4, A5, A6.
- **Information needed:** sites (name, code, region); equipment of the selected site only (name, asset tag, type, criticality, hour meter); whether the selected equipment's type has any checklist questions.
- **Entry:** only from S1 (A2). Always starts with nothing selected.
- **Exit:** Start succeeds -> S3 on the first stage of the new inspection (A5). Cancel -> S1, nothing created (A6).
- **States:**
  - No site selected: equipment choice and Start unavailable.
  - Site selected: equipment of that site offered. Changing site clears the equipment selection (A3).
  - Site with no equipment: message; Start unavailable (A3 empty).
  - Equipment selected: type and criticality shown for confirmation (A4).
  - Equipment type has no checklist questions (Pallet racking, Air compressor): message; Start unavailable. Rationale: A5's "message instead of a blank checklist" is surfaced here, before the Draft is created, so no empty Draft record is left behind; S3 keeps a defensive empty state as well.
  - Starting: busy; Start and Cancel disabled so a double tap cannot create two Drafts.
  - Start failure: error shown; stays on S2 with site and equipment kept for retry; no navigation (A5 failure).

## S3 InspectScreen - Answer the checklist

- **Purpose:** answer the branching checklist stage by stage with the live risk score; hub for photos and review.
- **Owns:** R3, R4, R5, R13, A7, A8, A9, A13 (restore on return), A16. Launch point for A10 (-> S4) and A14 (-> S5).
- **Information needed:** current inspection (number assigned by the system, shown in the header per R2; site; equipment; type; criticality multiplier); the equipment type's questions, loaded once per inspection (R3); session answers; the visibility result per question (5 levels, depth 0-4; depth 5+ never shown, R4/R13); live score, band and triggered critical stops (R5). FL-32 shown per the coordinator's Q5 decision.
- **Entry:** from S2 after a successful start (fresh session, first stage, no answers); from S4 or S5 via Back (session restored, see round trips).
- **Exit:** "Photos" -> S4 (A10). "Review" -> S5 (A14). "Abandon" -> confirmation -> S1 (A16). There is no route back to S2: the Draft already exists, and returning there would invite a second Draft.
- **States:**
  - Stage tabs: one active stage among Pre-use, Visual and structural, Operational test, Safety sign-off (A7). Answers in other stages are kept.
  - Stage with no visible questions: message (A7 empty).
  - No questions loaded (defensive; normally prevented on S2): message; Photos and Review remain reachable, plus Abandon.
  - Answering (A8/A9): visibility and risk panel update immediately; hidden-branch answers are kept in session but ignored (A-4). A non-numeric Number entry is shown as not a valid number.
  - Help text expanded or collapsed per question, where present.
  - Abandon confirmation: warns that answers will be lost and the Draft remains. Confirm -> S1; Cancel -> back to the same stage with answers intact.

## S4 PhotoScreen - Photos and annotation

- **Purpose:** add, caption and annotate photos for the current inspection.
- **Owns:** R6, R7, A10 (listing), A11, A12.
- **Information needed:** current inspection (number for the header and default caption, A-6); saved photos for this inspection only (caption, image, saved strokes); the selected photo.
- **Entry:** only from S3 (A10). Requires the Draft from A5.
- **Exit:** Back -> S3 (A13).
- **States:**
  - Photo list: photos of this inspection. Empty: "No photos yet". Load failure: error message.
  - Adding: picture chosen + caption entry (blank caption gets a meaningful default, A-6). Save -> photo record created and listed (A11). Cancel -> unsaved picture discarded. Saving: busy, no double save. Save failure: error; picture and caption kept for retry.
  - Photo selected: the photo shown with its saved strokes, if any, overlaid.
  - Annotating (in-screen state, per the verbatim "Annotate = transparent Pen input over the photo"): freehand drawing over the selected photo; Clear strokes; Save -> strokes image written to that photo's Canvas pen strokes column (A12); Cancel -> strokes discarded, photo unchanged, back to photo selected. Annotating again starts a fresh drawing, and saving replaces the previously saved strokes (R7 limit: strokes separate from the photo, no editable per-mark data). Save failure: error; strokes kept on screen for retry.
  - Leaving S4 during Adding or Annotating discards unsaved work. No confirmation, since saved photos are unaffected.

## S5 ReviewScreen - Review and submit

- **Purpose:** check answers and the score derivation, then submit.
- **Owns:** R8, R9, A14, A15.
- **Information needed:** session answers for visible questions only, grouped by stage; count of unanswered visible questions (Q3); score breakdown (each contributing question with its weight, subtotal, criticality multiplier, cap if applied, critical-stop override, final score and band). These must equal what S3's risk panel showed.
- **Entry:** only from S3 (A14).
- **Exit:** Back -> S3 (A13). Submit success -> S1 (A15).
- **States:**
  - Ready: breakdown shown; unanswered count shown when > 0, without blocking Submit (A-5).
  - No answers: message; Submit unavailable (A15 precondition).
  - Submitting: busy; Submit and Back disabled (no concurrent submit).
  - Submit failure: error; inspection stays Draft; stays on S5 with the session intact; retry updates answers already written instead of duplicating them (A-7).
  - Success: session cleared -> S1 with the confirmation.

## Round trips and preserved context

1. **Start and cancel:** S1 -> S2 (choose site, maybe equipment) -> Cancel -> S1. Nothing is created. S1 shows the list as before. The next entry to S2 starts blank, with selections intentionally reset.
2. **Start failure:** S2 Start fails -> stays on S2 with the same site and equipment selected; retry creates exactly one Draft.
3. **Checklist -> Photos -> Annotate -> Back:** S3 (stage "Operational test", answers given) -> S4 -> add photo -> select photo -> Annotating -> Save -> photo selected -> Back -> S3. Preserved: the same inspection, the active stage tab ("Operational test"), all session answers (including hidden-branch answers, A-4), and the risk panel values. S4 always shows only this inspection's photos. Within S4, cancelling annotation returns to the same selected photo, not the list top. Reset on the next entry to S4: no photo selected, no pending add or annotation.
4. **Checklist -> Review -> Back:** S3 (any stage) -> S5 -> Back -> S3 on the stage that was active before Review, with answers unchanged. S5 recomputes from the session on every entry, so answers changed after returning to S3 are reflected on the next Review.
5. **Nested: Review sends inspector back to photos:** S5 -> Back -> S3 (stage restored) -> S4 -> Back -> S3 (stage still restored) -> S5. The inspection and session survive the whole chain. S4 and S5 never link directly, so Back from either one has a single meaning: return to S3.
6. **Submit:** S5 Submit success -> S1. The session (answers, stage, selected photo) is cleared intentionally. S1 refreshes its list and KPIs and shows the confirmation. "New inspection" then opens a blank S2. Returning to S3/S4/S5 for that inspection is not possible (A-1, no edit after submit).
7. **Submit failure:** stays on S5. Back -> S3 still shows the same inspection and answers. A later submit retries without duplicates (A-7).
8. **Abandon:** S3 -> Abandon -> confirm -> S1. Session answers are discarded. The Draft remains and appears in the list as Draft with no score (Q2, A-1). Cancelling the confirmation keeps the stage and answers.

## Coverage check

R1 S1; R2 S2 (number shown on S3); R3, R4, R5, R13 S3; R6, R7 S4; R8, R9 S5; R10, R11 all; R12 S1/S3/S5.
A1, A2 S1; A3-A6 S2; A7-A9, A16 S3; A13 S3 (triggered from S4/S5 Back); A10 triggered on S3, owned by S4; A11, A12 S4; A14 triggered on S3, owned by S5; A15 S5 (outcome on S1).
