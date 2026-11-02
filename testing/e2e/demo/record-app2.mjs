// Records App 2's demo in the published app with fictional data, then builds the MP4, captions and
// poster. The inspection it creates is deleted at the end, so the sample data stays as seeded.
//   DEMO=app2 node demo/record-app2.mjs      (Studio must not be running: the recording needs the signed-in profile)
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ChecklistApp } from "../lib/app.mjs";
import { ROOT, playUrl } from "../lib/env.mjs";
import * as dv from "../lib/dataverse.mjs";
import { createRecorder, symbol } from "./recorder.mjs";

const PHOTO = join(ROOT, "demo", "out", "photo-clean.jpg");
if (!existsSync(PHOTO)) throw new Error("Run demo/prepare-photo.mjs first: the photo scene needs demo/out/photo-clean.jpg.");

const { page, now, sleep, at, gate, open, scene, overlays, chip, card, finish } = await createRecorder();
const app = new ChecklistApp(page);

// A failed recording shouldn't leave its inspection behind
let number;
process.on("uncaughtException", async (e) => {
  console.error(e);
  if (number) await dv.removeInspections([number]).catch(() => {});
  process.exit(1);
});
process.on("unhandledRejection", (e) => { throw e; });

await page.goto(playUrl("app2", { v: String(Date.now()) }));
await app.ctl("btnHomeNew").waitFor({ timeout: 120_000 });
const stale = page.getByText(/You're using an old version of this app/);
if (await stale.waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) {
  await page.getByRole("button", { name: /^Refresh$/ }).first().click();
  await app.ctl("btnHomeNew").waitFor({ timeout: 120_000 });
}
await app.closeBanners();
const { drafts, submitted } = await dv.counts();
await app.waitKpis(drafts, submitted);
await app.waitText("txtHomeRowNumber", /INS-/);
await overlays();
await card(`${symbol}<div class="eyebrow">The Fusion Platform · Proof of concept</div><h1>Canvas + PCF: rules-driven inspections</h1>
  <p>The same inspection app, with React and TypeScript code components where Canvas ran out.</p>
  <p class="foot">Sohanur Rahman Sohan · Power Platform Developer &amp; Solution Builder</p>`);
await sleep(600);
const contentStart = now(); // everything before this (sign-in, loading) is trimmed

await scene("title");
await card(`<div class="eyebrow">Where Canvas stopped</div><h1>Four limits to remove</h1><ul>
  <li>A checklist fixed at five levels.</li>
  <li>Cross-question rules written as formulas.</li>
  <li>No compound risk rules.</li>
  <li>Freehand markup, saved apart from the photo.</li></ul>`);
await scene("problem");
await card("");

await chip("Home");
await scene("home", async () => { await app.ctl("galHomeKpis").hover(); });

await chip("New inspection");
gate("s04a");
await scene("start", async () => {
  await app.click("btnHomeNew");
  await app.ctl("galStartSites").waitFor();
  await sleep(600);
  open("s04a");
  await at("s04a", 1.5);
  await app.pickRow("galStartSites", "Northgate Distribution Centre", "btnStartSiteSelect");
  await app.ctl("galStartEquipment").getByText("Forklift FL-07").first().waitFor();
  await sleep(1000);
  await app.pickRow("galStartEquipment", "Forklift FL-07", "btnStartEquipSelect");
  await app.waitEnabled("btnStartGo");
  await sleep(600);
});

await chip("Checklist component");
gate("s05a", "s05c", "s05d", "s05e");
await scene("checklist", async () => {
  await app.click("btnStartGo");
  await app.checklist.waitFor({ timeout: 60_000 });
  number = (await app.waitText("txtInspTitle", /INS-\d+/)).match(/INS-\d+/)[0];
  await app.waitShows("FL-01");
  await sleep(500);
  open("s05a");
  await at("s05b", 0.2);
  await app.yesNo("FL-01", "No");
  await at("s05b", 1.6);
  await app.choice("FL-01.1", "Damaged");
  await at("s05b", 3.0);
  await app.choice("FL-01.1.1", "Hydraulics");
  await at("s05b", 4.6);
  await app.yesNo("FL-01.1.1.1", "Yes");
  await app.score(30, "Medium");
  await app.waitShows("FL-01.1.1.1.1");
  open("s05c");
  await at("s05c", 0.8);
  await app.yesNo("FL-01.1.1.1.1", "No");
  await app.score(75, "Critical");
  await app.waitShows("FL-01.1.1.1.1.1");
  open("s05d");
  await at("s05d", 0.6);
  await app.question("FL-01.1.1.1.1.1").scrollIntoViewIfNeeded();
  open("s05e");
  await at("s05e", 0.3);
  await app.yesNo("FL-01.1.1.1.1.1", "No");
  await app.score(100, "Critical");
});

await chip("");
await card(`<div class="eyebrow">The boundary</div><h1>Canvas owns the data</h1>
  <div class="stats" style="grid-template-columns:repeat(2,1fr)">
    <div class="stat"><b>In, as JSON</b>QuestionsJson, RulesJson, AnswersJson and Criticality</div>
    <div class="stat"><b>Out, as properties</b>AnswersOut, Score, Band, CriticalHit and ExplanationJson</div>
  </div>
  <p class="foot">Canvas reads the outputs in OnChange, and does every Dataverse read and write itself.</p>`);
await scene("boundary");
await card("");

await chip("Photo annotator component");
gate("s07a", "s07b");
await scene("photos", async () => {
  await app.click("btnInspPhotos");
  await app.ctl("addPhotoPicker").waitFor();
  await app.ctl("addPhotoPicker").locator('input[type="file"]').first().setInputFiles(PHOTO);
  await app.waitEnabled("btnPhotoSave");
  await app.ctl("txtPhotoCaption").locator("input, textarea").first().fill("Worn spanner jaw");
  await app.click("btnPhotoSave");
  await app.waitText("galPhotoList", /Worn spanner/, 60_000);
  await app.ctl("btnPhotoAnnotate").waitFor();
  await app.waitPhotoShown();
  await app.click("btnPhotoAnnotate");
  await app.annotatorReady();
  await sleep(600);
  open("s07a");
  await at("s07a", 1.0);
  await app.placeMark("Numbered marker", { x: 0.2, y: 0.33 });
  await sleep(700);
  await app.placeMark("Arrow", { x: 0.5, y: 0.14 }, { x: 0.3, y: 0.27 });
  await sleep(700);
  await app.placeMark("Box", { x: 0.1, y: 0.18 }, { x: 0.38, y: 0.52 });
  await sleep(700);
  await app.freehandRing({ x: 0.845, y: 0.69, rx: 0.06, ry: 0.09 });
  await app.markCount(4);
  open("s07b");
  await at("s07b", 1.2);
  await app.click("btnPhotoSave");
  await app.ctl("conPhotoRowTagBadge").waitFor({ timeout: 60_000 });
  await app.waitPhotoShown();
  await sleep(1500);
});

await chip("Review and submit");
gate("s08a", "s08b");
await scene("review", async () => {
  await app.click("btnPhotoBackNav");
  await app.checklist.waitFor();
  await app.click("btnInspReview");
  await app.waitText("txtRevScore", /100\.0/);
  await app.waitEnabled("btnRevSubmit");
  await sleep(500);
  open("s08a");
  await at("s08a", 3.0);
  await app.click("btnRevSubmit");
  await app.ctl("conHomeBanner").waitFor({ timeout: 60_000 });
  const c = await dv.counts();
  await app.waitKpis(c.drafts, c.submitted);
  while ((await app.firstRowInView()) !== number) await sleep(250);
  open("s08b");
  await at("s08b", 3.0);
});
await chip("");

await card(`<div class="eyebrow">Under the hood</div><h1>Code only where Canvas stopped</h1>
  <div class="stats"><div class="stat"><b>2</b>React + TypeScript components</div><div class="stat"><b>7</b>Dataverse tables</div><div class="stat"><b>6</b>compound rules, stored as rows</div></div>
  <div class="stats"><div class="stat"><b>23</b>Playwright tests</div><div class="stat"><b>15</b>unit tests</div><div class="stat"><b>6</b>levels reached, with no depth limit</div></div>
  <p class="foot">Fictional sample data in a developer environment.</p>`);
await scene("value");
await card(`${symbol}<div class="eyebrow">The Fusion Platform by Sohan</div><h1>Thanks for watching</h1>
  <p>Code, tests and build scripts: github.com/SRS014/canvas-vs-pcf-inspection</p>
  <p>Portfolio: srs014.github.io</p><p class="foot">Fuse ideas. Build smarter. Integrate better.</p>`);
await scene("outro");
await sleep(800);
const contentEnd = now();

await finish({ contentStart, contentEnd });
await dv.removeInspections([number]);
console.log(`Removed the demo inspection ${number}.`);
