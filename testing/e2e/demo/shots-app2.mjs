// Captures App 2's key screens at 1280x720 into docs/screenshots/app2, using a temporary inspection
// that's deleted at the end. Needs demo/out/photo-clean.jpg (see prepare-photo.mjs).
//   node demo/shots-app2.mjs
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ChecklistApp, openBrowser } from "../lib/app.mjs";
import { ROOT } from "../lib/env.mjs";
import * as dv from "../lib/dataverse.mjs";

const SHOTS = join(ROOT, "..", "..", "docs", "screenshots", "app2");
const PHOTO = join(ROOT, "demo", "out", "photo-clean.jpg");
mkdirSync(SHOTS, { recursive: true });

const browser = await openBrowser();
const created = [];
const open = async () => new ChecklistApp((await ChecklistApp.open(browser.context, { app: "app2" })).page);
const shot = async (app, name) => {
  await app.page.waitForTimeout(1500); // let transitions and the player's progress dots clear
  await app.shot(join(SHOTS, `${name}.png`));
  console.log(name);
};
try {
  const app = await open();
  await app.waitText("txtHomeRowNumber", /INS-/);
  await shot(app, "01-home");

  await app.click("btnHomeNew");
  await app.pickRow("galStartSites", "Northgate Distribution Centre", "btnStartSiteSelect");
  await app.pickRow("galStartEquipment", "Forklift FL-07", "btnStartEquipSelect");
  await app.waitEnabled("btnStartGo");
  await shot(app, "02-new-inspection");

  await app.click("btnStartGo");
  await app.checklist.waitFor({ timeout: 60_000 });
  created.push((await app.waitText("txtInspTitle", /INS-\d+/)).match(/INS-\d+/)[0]);
  await app.yesNo("FL-01", "No");
  await app.choice("FL-01.1", "Damaged");
  await app.choice("FL-01.1.1", "Hydraulics");
  await app.yesNo("FL-01.1.1.1", "Yes");
  await app.yesNo("FL-01.1.1.1.1", "No");
  await app.score(75, "Critical");
  await app.waitShows("FL-01.1.1.1.1.1");
  await shot(app, "03-compound-rule");
  await app.question("FL-01.1.1.1.1.1").scrollIntoViewIfNeeded();
  await app.yesNo("FL-01.1.1.1.1.1", "No");
  await app.score(100, "Critical");
  await shot(app, "04-sixth-level");

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
  await app.placeMark("Numbered marker", { x: 0.2, y: 0.33 });
  await app.placeMark("Arrow", { x: 0.5, y: 0.14 }, { x: 0.3, y: 0.27 });
  await app.placeMark("Box", { x: 0.1, y: 0.18 }, { x: 0.38, y: 0.52 });
  await app.freehandRing({ x: 0.845, y: 0.69, rx: 0.06, ry: 0.09 });
  await app.markCount(4);
  await shot(app, "05-annotator");
  await app.click("btnPhotoSave");
  await app.ctl("conPhotoRowTagBadge").waitFor({ timeout: 60_000 });
  await app.waitPhotoShown();
  await shot(app, "06-annotated-saved");

  await app.click("btnPhotoBackNav");
  await app.checklist.waitFor();
  await app.click("btnInspReview");
  await app.waitText("txtRevScore", /100\.0/);
  await app.waitEnabled("btnRevSubmit");
  await shot(app, "07-review");
} finally {
  await browser.close();
  await dv.removeInspections(created);
}
