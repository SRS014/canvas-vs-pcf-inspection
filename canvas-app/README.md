# App 1: Canvas app

An equipment inspection app built entirely with Canvas controls and Power Fx, on the six Dataverse tables in [../dataverse](../dataverse).

| Screen | What it does |
| --- | --- |
| `Screen1` (Home) | Inspections newest first, with KPIs including a Canvas-only vs Canvas + PCF split |
| `StartScreen` | Site, then equipment, then Start: creates a Draft inspection and loads that equipment type's checklist |
| `InspectScreen` | Stage tabs with live counts, the visible questions indented by level, an answer control per answer type, and a live risk panel |
| `PhotoScreen` | Add picture to the Dataverse image column; Annotate with a transparent Pen input; strokes saved to a separate column |
| `ReviewScreen` | Answers by stage, the score breakdown, Submit (`ForAll` + `Patch` of the answers, then the inspection) |

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
