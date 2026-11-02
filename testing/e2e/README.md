# End-to-end tests

Playwright tests that drive the published canvas app and check what it wrote to Dataverse. Everything here uses fictional data.

## Set up

1. Copy `../../local.config.example.json` to `../../local.config.json` and fill in your tenant's values. The file is git-ignored.
2. `npm install`. It needs Node.js 24 and Playwright's Chromium (`npx playwright install chromium`).
3. `npm run login` and sign in once in the window that opens. The session stays in `.auth/profile`, which is git-ignored. No password goes into any script.
4. Run `npm install` in `../../dataverse` as well. The tests read Dataverse through its scripts, using a device-code sign-in the first time.

## Run

```bash
npm run test:app1
npm run test:app2
```

Each test opens the app fresh, and every inspection a test creates is deleted by number afterwards. Tests wait for something on screen rather than for a fixed time, so a slow run takes longer instead of failing.

## What App 1's 23 tests cover

| Group | Checks |
| --- | --- |
| A. Home | KPI cards match Dataverse; the list is newest first |
| B. Starting | Start stays disabled until equipment is chosen; a site shows only its own equipment; cancelling writes nothing; Start creates a Draft |
| C. Checklist | Child questions appear and go away with their parent; the branch stops at level five; collapsed answers stop scoring; critical stops; number thresholds; the cross-question rule; band limits at 25, 50 and 75; the cap at 100 |
| D. Submit | Disabled with no answers; score, band and answer rows saved; hidden answers not saved; a critical stop saved as Critical |
| E. Leaving | Exit asks first; abandoning leaves an unscored Draft |
| G. On screen | No control on any screen shows the default word "Text"; Contributing questions show the whole of the longest question; a new inspection is the first row in view after a submit |
| F. Photos | A photo saves full-size; pen strokes save separately from it |

Test C2 confirms that the sixth-level question never shows. That is Canvas's documented limit, the point of this project, and not a defect the suite hides.

Not covered: keyboard use. App 1 has no offline mode to test.

## What App 2's 23 tests cover

| Group | Checks |
| --- | --- |
| A. Home | KPI cards match Dataverse; the list is newest first |
| B. Starting | Start stays disabled until equipment is chosen; Start creates a Draft marked Canvas + PCF, and the component renders |
| C. Checklist component | Child questions appear and go away; the sixth level appears and scores; collapsed answers stop scoring; critical stops; number thresholds; the stored rule on FL-32; compound rules; band limits; the cap at 100; answering by keyboard |
| D. Submit | Disabled with no answers; score, band and each answer's contribution saved; hidden answers not saved; a critical stop saved as Critical |
| E. Leaving | Exit asks first; abandoning leaves an unscored Draft |
| F. Photo annotator | Marks save as data and burned into a copy, the original photo stays, undo works, and saved marks reopen for editing |
| G. On screen | No control shows the default word "Text"; Contributing questions show the whole of the longest question; a new inspection is the first row in view after a submit |

## Other scripts

- `demo/seed-demo.mjs` adds four fictional submitted inspections by driving the app, so scores come from its own logic. It skips any that already exist.
- `demo/shots-app1.mjs` and `demo/shots-app2.mjs` capture the screenshots in `docs/screenshots`.
- `demo/prepare-photo.mjs` makes a metadata-free copy of a photo for the photo screens. Photos stay out of git.
- `demo/record-app1.mjs` and `demo/record-app2.mjs` (with `DEMO=app2` set) record the demo videos in the published apps, using `demo/recorder.mjs`, then `demo/mux.mjs` adds the voice, captions and poster. Each spoken line waits for its moment on screen, and silent waits over 4.5 s are shortened to 3.5 s with a label showing what was skipped. Voice clips come from [demo/voice-prep](demo/voice-prep).
- `auth/studio.mjs` keeps Studio open for co-authoring, and `lib/studio.mjs` saves and publishes it. Tests attach to that browser while it's running. Video recording needs its own, so stop Studio first.
- `../../dataverse/scripts/backup-inspections.mjs` saves inspections, answers and full-size images to a local folder and checks them against Dataverse. Keep that folder out of git.
