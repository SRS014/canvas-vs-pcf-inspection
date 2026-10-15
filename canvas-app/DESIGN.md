# App 1: Canvas app build plan

The goal is an honest, presentable Canvas app that does everything Canvas can reasonably do for this scenario, built the way a capable maker would build it. It is not a straw man. Where it struggles, the struggle should be visible and measurable, not staged.

## How it's built

The app is authored as `.pa.yaml` source with Microsoft's **canvas app authoring MCP server** (the `canvas-apps` plugin from `microsoft/power-platform-skills`). Every screen is compiled and validated against the live Power Apps Studio co-authoring session before it's accepted. The validated source is committed to `canvas-app/src/`.

## Screens

| Screen | What it does | Canvas features shown |
| --- | --- | --- |
| `Screen1` (Home) | Inspection list with risk badges, status and which app captured it; KPI tiles; "New inspection" | Gallery on Dataverse, delegable filter and sort, modern controls, Fusion Sky theme |
| `StartScreen` | Pick a site, then a piece of equipment (filtered by site), then start | Cascading selection, `Patch` to create the Draft inspection, autonumber name |
| `InspectScreen` | Stage tabs, the visible questions for the stage (indented by depth), an answer control per answer type, and a live risk panel | Conditional visibility, collections, behavior user-defined functions, live recalculation |
| `PhotoScreen` | Capture or attach photos, add a caption, save to Dataverse. "Annotate" overlays a transparent Pen input on the photo | Add picture / Camera, image column `Patch`, Pen input |
| `ReviewScreen` | Answers grouped by stage, a score breakdown, Submit | `ForAll` + `Patch` of answers, final score and band written to the inspection |

## Core logic (Power Fx)

**Loading.** Questions for the equipment type load once into `colQ`: Id, ParentId, Depth, Stage, AnswerType, Options, show and risk conditions, Critical. Answers live in `colAns` (question id, value) until Submit.

**Condition test.** A pure user-defined function `Meets(answer, operator, value)` implements Equals, Not equals, Greater than, Less than and One of.

**Visibility.** Power Fx user-defined functions don't support recursion, so the tree is walked one depth at a time. A behavior function rebuilds the visible set level by level:

```
level 0 = all roots
level 1 = children of level-0 questions whose parent answer Meets the condition
level 2 = children of level-1 questions ...
...
```

Each level is its own statement. The app supports as many levels as there are statements, which is the point the comparison will test.

**Risk score.** Sum the weights of visible questions whose answer meets the risk condition, multiply by the equipment criticality, cap at 100, and band it. Any triggered critical question forces Critical.

**Photos.** The image column takes the captured photo directly. The Pen input's `Image` output (the strokes) is saved to a second image column, `fp_canvasstrokes`.

## Evidence to collect while building (for "Where Canvas stopped")

- [ ] Line count and statement count of the visibility routine, and what must change to add one more level of nesting
- [ ] What happens to the seeded sixth-level question (FL-01.1.1.1.1.1) in the Canvas app
- [ ] Whether the cross-question rule (FL-32) can be evaluated generically from `fp_rulejson`
- [ ] App checker and Monitor observations as the question gallery re-evaluates after each answer (including input focus and gallery reload)
- [ ] What the Pen input overlay can and can't produce: freehand only, strokes saved separately from the photo, no shapes, text labels or numbered markers, no per-mark data
- [ ] How compound risk rules would have to be written in Power Fx
- [ ] Screenshots of every screen
