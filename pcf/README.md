# App 2: PCF components

Two React + TypeScript code components for App 2, in one PCF project at [components/](components/). The plan and the contract with the Canvas app are in [DESIGN.md](DESIGN.md).

| Component | What it replaces in App 1 | Folder |
| --- | --- | --- |
| `Fusion.InspectionChecklist` | The question gallery, stage tabs and live risk panel | [components/InspectionChecklist](components/InspectionChecklist) |
| `Fusion.PhotoAnnotator` | The transparent Pen input over the photo | [components/PhotoAnnotator](components/PhotoAnnotator) |

Both are virtual controls on the platform's React 16.14 and Fluent UI v9, so the bundles stay small (about 35 KB each) and follow the app's theme. Neither calls Dataverse: the Canvas app passes data in as JSON and patches the outputs.

## Build and test

```
cd pcf/components
npm install
npm test          # engine and contract tests against the seed data (Node 22.6 or later)
npm run build     # lint, type-check and bundle both components
npm start         # PCF test harness in the browser
```

The checklist engine (`InspectionChecklist/engine/engine.ts`) has no runtime imports, so Node runs its tests directly. The tests use the real seed data in `dataverse/seed/` and show:

- the sixth-level question appears and scores (App 1 stops at five levels);
- FL-32 follows the rule stored in `fp_rulejson`, not a hard-coded formula;
- compound rules from `fp_riskrule` add bonus points (App 1's Run 2 answers move from 52.5 High to 75 Critical);
- answers on a collapsed branch never score;
- with no compound rules, the same answers score exactly as App 1 (52.5 High).

## Trying it in the test harness

In `npm start`, paste a sample into the inputs:

- **Questions (JSON)**: `tests/samples/questions-forklift.json` or `questions-conveyor.json`
- **Risk rules (JSON)**: `tests/samples/rules-forklift.json` or `rules-conveyor.json`
- **Criticality**: `High`, `Medium` or `Low`

The samples use the same field names as App 1's `colQ` collection, which is what App 2 will pass.

## Deploy

`pac pcf push` accepts one component per project, so both components ship in a small solution project, [solution/](solution/) (`FusionPcfComponents`, publisher Sohan, prefix `fp`):

```
cd pcf/solution
dotnet build -c Release          # builds pcf/components and packs bin/Release/solution.zip (unmanaged)
pac auth create --environment https://<org>.crm.dynamics.com --deviceCode
pac solution import --path bin/Release/solution.zip --publish-changes
```

The manifests declare Fluent 9.46.2, the highest version the platform accepts in a manifest; the platform loads a newer compatible Fluent at runtime. The environment setting **Allow publishing of canvas apps with code components** must be on. Then, in the canvas app: **Insert → Get more components → Code**.

Deployed to the Developer environment on 2026-10-18 (version 0.1.1) and added to the `CanvasVsPcfInspection` solution.

