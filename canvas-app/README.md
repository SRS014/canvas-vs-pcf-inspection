# App 1: Canvas app

An equipment inspection app built entirely with Canvas controls and Power Fx, on the six Dataverse tables in [../dataverse](../dataverse).

| Screen | What it does |
| --- | --- |
| `HomeScreen` | Inspections newest first, with KPIs including a Canvas-only vs Canvas + PCF split |
| `NewInspectionScreen` | Site, then equipment, then Start: creates a Draft inspection and loads that equipment type's checklist |
| `InspectionScreen` | Stage tabs with live counts, the visible questions indented by level, an answer control per answer type, and a live risk panel |
| `PhotosScreen` | Add picture to the Dataverse image column; Annotate with a transparent Pen input; strokes saved to a separate column |
| `ReviewSubmitScreen` | Answers by stage, the score breakdown, Submit (one batched `Collect` of `ForAll` answer records, then `Patch` of the inspection) |

## Brand and UX

The app uses The Fusion Platform's Fusion Sky identity, the same template as the portfolio site:
- the 6 px line gradient (#209CCB → #742774 → #E3008C) across the top of every screen
- the gradient ring symbol in every header
- a light-wash hero on Home
- 3 px gradient lines on cards and under section headings
- purple uppercase eyebrows
- a footer with the tagline

Colour carries meaning only for risk. The band is always shown as a word plus a score, never by colour alone.

Buttons are solid Deep lagoon (#0B5F7E), which the brand allows. A gradient behind a button would lose the platform's hover, focus-ring and disabled states. Canvas can't load Manrope or Inter, so text uses Segoe UI with brand weights.

Quality gates: App checker has 0 issues, and the accessibility checker has 0 errors.
- Every text control has an accessible label.
- Lists have keyboard tab stops.
- Decorative gradients are HTML, which screen readers skip.
- The pen has a text alternative ("Describe what you marked").

## Source

`src/` holds the app as Power Apps source code (`.pa.yaml`), the format Microsoft uses for Git integration. It was written with Microsoft's [canvas-apps plugin](https://github.com/microsoft/power-platform-skills) and its canvas authoring MCP server. Every file was compiled against a live Power Apps Studio co-authoring session before it was accepted. The final compile has no errors and no warnings.

The core logic lives in [src/App.pa.yaml](src/App.pa.yaml) as named formulas and user-defined functions: the condition test `Meets`, the per-level visibility formulas `VisL0`–`VisL4`, and the risk engine `RiskItems` → `LiveScore` → `LiveBand`.

`planning/` keeps the staged design artifacts from Microsoft's CREATE workflow: functionality, screens, layout, discovery and bindings.

## Load it into your own environment

1. Provision and seed Dataverse ([../docs/data-model.md](../docs/data-model.md#provisioning)).
2. Create a blank tablet canvas app in the `CanvasVsPcfInspection` solution. Turn on **Settings → Updates → Coauthoring**, then add the six `fp_` tables from the Data panel.
3. With the canvas-apps plugin connected to that session, compile `src/` (or open each screen's YAML and paste it into Studio with **Paste code**).

## Known limits

See [../docs/where-canvas-stopped.md](../docs/where-canvas-stopped.md).
