// Records App 1's demo in the published app with fictional data, then builds the MP4, captions and
// poster. The inspection it creates is deleted at the end, so the sample data stays as seeded.
//   npm run demo:app1      (Studio must not be running: the recording needs the signed-in profile)
import { existsSync } from "node:fs";
import { join } from "node:path";
import { InspectionApp } from "../lib/app.mjs";
import { ROOT, playUrl } from "../lib/env.mjs";
import * as dv from "../lib/dataverse.mjs";
import { createRecorder, symbol } from "./recorder.mjs";

const PHOTO = join(ROOT, "demo", "out", "photo-clean.jpg");
if (!existsSync(PHOTO)) throw new Error("Run demo/prepare-photo.mjs first: the photo scene needs demo/out/photo-clean.jpg.");
const JAW = { x: 0.25, y: 0.42, rx: 0.15, ry: 0.2 }; // around the spanner's jaw in the photo

const { page, now, sleep, at, gate, open, scene, overlays, chip, card, finish } = await createRecorder();
const app = new InspectionApp(page);

await page.goto(playUrl("app1", { v: String(Date.now()) }));
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
await card(`${symbol}<div class="eyebrow">The Fusion Platform · Proof of concept</div><h1>Equipment inspections in Canvas</h1>
  <p>A multi-stage inspection app in Power Apps Canvas and Dataverse, built to find exactly where Canvas stops.</p>
  <p class="foot">Sohanur Rahman Sohan · Power Platform Developer &amp; Solution Builder</p>`);
await sleep(600);
const contentStart = now(); // everything before this (sign-in, loading) is trimmed

await scene("title");
await card(`<div class="eyebrow">The problem</div><h1>Inspections that adapt</h1><ul>
  <li>Forklifts and conveyors across three warehouse sites.</li>
  <li>A checklist that changes with each answer.</li>
  <li>A live risk score, photos of defects, and Dataverse as the record.</li></ul>`);
await scene("problem");
await card("");

await chip("Home");
await scene("home", async () => { await at("s03b", 0.3); await app.ctl("galHomeKpis").hover(); });

let number;
await chip("New inspection");
gate("s04a", "s04b");
await scene("start", async () => {
  await app.click("btnHomeNew");
  await app.ctl("galStartSites").waitFor();
  await sleep(800);
  open("s04a");
  await at("s04a", 1.8);
  await app.pickRow("galStartSites", "Northgate Distribution Centre", "btnStartSiteSelect");
  await app.ctl("galStartEquipment").getByText("Forklift FL-07").first().waitFor();
  await sleep(1200);
  await app.pickRow("galStartEquipment", "Forklift FL-07", "btnStartEquipSelect");
  await app.waitEnabled("btnStartGo");
  open("s04b");
});

await chip("Checklist");
gate("s05a", "s05b", "s05c");
await scene("checklist", async () => {
  await app.click("btnStartGo");
  await app.ctl("tabInspStages").waitFor({ timeout: 60_000 });
  number = (await app.waitText("txtInspTitle", /INS-\d+/)).match(/INS-\d+/)[0];
  await sleep(500);
  open("s05a");
  await at("s05a", 2.5);
  await app.yesNo("FL-01", "No");
  await app.waitShows("FL-01.1");
  open("s05b");
  await at("s05b", 1.6);
  await app.choice("FL-01.1", "Damaged");
  await at("s05b", 3.0);
  await app.choice("FL-01.1.1", "Hydraulics");
  await at("s05b", 4.6);
  await app.yesNo("FL-01.1.1.1", "Yes");
  await app.score(30, "Medium");
  await app.waitShows("FL-01.1.1.1.1");
  open("s05c");
  await at("s05c", 1.0);
  await app.yesNo("FL-01.1.1.1.1", "No");
  await app.score(52.5, "High");
});

await chip("Where Canvas stops");
await scene("limit");

await chip("Critical stop");
gate("s07b");
await scene("stop", async () => {
  await at("s07a", 1.6);
  await app.yesNo("FL-01", "Yes");
  await app.score(0, "Low");
  await app.waitShows("FL-03");
  open("s07b");
  await at("s07b", 1.8);
  await app.yesNo("FL-03", "No");
  await app.score(45, "Critical");
});

await chip("Photos");
gate("s08a", "s08b");
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
  open("s08a");
  await at("s08a", 1.2);
  await app.click("btnPhotoAnnotate");
  await app.ctl("penPhotoAnnotate").waitFor();
  await sleep(800);
  await app.drawCircle("penPhotoAnnotate", JAW);
  open("s08b");
  await at("s08b", 1.6);
  await app.click("btnPhotoSave");
  await app.ctl("conPhotoRowTagBadge").waitFor({ timeout: 60_000 });
  await app.waitPhotoShown();
  await app.waitPhotoShown(60_000, "imgPhotoStrokes");
  await sleep(1500);
});

await chip("Review and submit");
gate("s09a", "s09b");
await scene("review", async () => {
  await app.click("btnPhotoBackNav");
  await app.ctl("tabInspStages").waitFor();
  await app.click("btnInspReview");
  await app.waitText("txtRevScore", /45\.0/);
  await app.waitEnabled("btnRevSubmit");
  await sleep(500);
  open("s09a");
  await at("s09a", 3.5);
  open("s09b");
  await at("s09b", 0.6);
  await app.click("btnRevSubmit");
  await app.ctl("conHomeBanner").waitFor({ timeout: 60_000 });
  const c = await dv.counts();
  await app.waitKpis(c.drafts, c.submitted);
  while ((await app.firstRowInView()) !== number) await sleep(250);
  await sleep(1500);
});
await chip("");

await card(`<div class="eyebrow">Under the hood</div><h1>Canvas, pushed as far as it goes</h1>
  <div class="stats"><div class="stat"><b>6</b>Dataverse tables</div><div class="stat"><b>5</b>canvas screens</div><div class="stat"><b>3,500+</b>lines of Power Fx source</div></div>
  <div class="stats"><div class="stat"><b>23</b>Playwright tests</div><div class="stat"><b>10</b>documented limits</div><div class="stat"><b>0</b>code components</div></div>
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
