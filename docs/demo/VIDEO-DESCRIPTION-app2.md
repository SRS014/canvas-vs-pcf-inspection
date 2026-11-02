# Canvas + PCF, rules-driven inspections: video description

Copy-ready text for the portfolio page, YouTube or LinkedIn. Video: `rules-driven-inspections-demo.mp4` (2:30, 1280×720), captions in `.srt` and `.vtt`.

---

**Canvas + PCF: the same inspection app, with React and TypeScript code components where Canvas ran out.**

The Canvas-only build of this app hit real limits: a checklist fixed at five levels, a safety question that never appeared, hard-coded rules, and freehand markup saved apart from the photo. This build keeps the Canvas screens and moves only those parts into two code components.

What you'll see:

0:00 Intro
0:13 Where Canvas stopped
0:27 The home screen
0:34 Starting an inspection
0:43 The checklist component
0:54 A compound rule stored as a row
1:02 The sixth level, and a critical stop
1:11 The boundary: data in as JSON, results out as properties
1:28 The photo annotator component
1:46 Review and submit
2:00 Under the hood
2:16 What it shows

Built with Power Apps (canvas), Power Fx and Dataverse (7 tables), plus two code components in React and TypeScript with Fluent UI. It's tested with 23 Playwright tests against the published app and 15 unit tests.

All sites, equipment and inspections are fictional sample data in a developer environment. Three waits are shortened in the edit, and each cut shows how many seconds it skipped.

Narration generated with a clone of my own voice.

Case study: https://srs014.github.io/projects/canvas-pcf-rules-driven-inspections/
Code, tests and build scripts: https://github.com/SRS014/canvas-vs-pcf-inspection

Sohanur Rahman Sohan · The Fusion Platform
