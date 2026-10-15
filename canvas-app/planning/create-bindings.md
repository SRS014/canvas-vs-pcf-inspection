Revision: 1
Inputs: functionality@1, screens@1, design@1, S1-S5 compositions@1, discovery@1

| Screen | YAML key | File | Prefix | Status |
|---|---|---|---|---|
| S1 | Screen1 | Screen1.pa.yaml | Home | Written, compiled |
| S2 | StartScreen | StartScreen.pa.yaml | Start | Written, compiled |
| S3 | InspectScreen | InspectScreen.pa.yaml | Insp | Written, compiled |
| S4 | PhotoScreen | PhotoScreen.pa.yaml | Photo | Written, compiled |
| S5 | ReviewScreen | ReviewScreen.pa.yaml | Rev | Written, compiled |

Shared state (App.pa.yaml):
- colQ: the session copy of the equipment type's questions. Loaded on Start via ClearCollect from a delegated Filter, so it is bounded by the data row limit (default 500); the seed has 30 questions max per type.
- colAns: the session answers {AQId, ACode, AValue}, written by SetAnswer and ClearAnswer.
- varCtx: the inspection context. varStage: the active tab. varBannerText: the Home banner after submit.
- Named formulas: Meets, AnswerOf, FL32Visible, VisL0..VisL4, VisibleQ, VisibleAnswers, RiskItems, CriticalHit, RawPoints, LiveScore, LiveBand, StageTabs, AnsweredCount, plus the colour tokens.

Builders: none. The coordinator wrote all screens directly because the specialist agents can't reach the canvas-authoring tools in this install (see the discovery addendum).
Plugin: canvas-apps 3.1.0 at C:\Users\hp\.claude\plugins\cache\power-platform-skills\canvas-apps\3.1.0 (marketplace microsoft/power-platform-skills, main as of 2026-10-15).
