// Captures App 1's key screens at 1280x720 into docs/screenshots/app1, using a temporary inspection
// that's deleted at the end. 08-submitted comes from seed-demo.mjs. The photo screens run only once
// demo/out/photo-clean.jpg exists (see prepare-photo.mjs).
//   node demo/shots-app1.mjs
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { InspectionApp, openBrowser } from "../lib/app.mjs";
import { ROOT } from "../lib/env.mjs";
import * as dv from "../lib/dataverse.mjs";

const SHOTS = join(ROOT, "..", "..", "docs", "screenshots", "app1");
const PHOTO = join(ROOT, "demo", "out", "photo-clean.jpg");
mkdirSync(SHOTS, { recursive: true });
const NORTHGATE = "Northgate Distribution Centre";
const EASTPORT = "Eastport Bonded Warehouse";
const JAW = { x: 0.25, y: 0.42, rx: 0.15, ry: 0.2 }; // around the spanner's jaw in the photo

const browser = await openBrowser();
const created = [];
const open = async () => new InspectionApp((await InspectionApp.open(browser.context)).page);
const shot = async (app, name) => {
  await app.page.waitForTimeout(1500); // let transitions and the player's progress dots clear
  await app.shot(join(SHOTS, `${name}.png`));
  console.log(name);
};
try {
  let app = await open();
  await app.waitText("txtHomeRowNumber", /INS-/);
  await shot(app, "01-home");

  await app.click("btnHomeNew");
  await app.pickRow("galStartSites", NORTHGATE, "btnStartSiteSelect");
  await app.pickRow("galStartEquipment", "Forklift FL-07", "btnStartEquipSelect");
  await app.waitEnabled("btnStartGo");
  await shot(app, "02-new-inspection");

  await app.click("btnStartGo");
  await app.ctl("tabInspStages").waitFor({ timeout: 60_000 });
  created.push((await app.waitText("txtInspTitle", /INS-\d+/)).match(/INS-\d+/)[0]);
  await app.yesNo("FL-01", "No");
  await app.choice("FL-01.1", "Damaged");
  await app.choice("FL-01.1.1", "Hydraulics");
  await app.yesNo("FL-01.1.1.1", "Yes");
  await app.yesNo("FL-01.1.1.1.1", "No");
  await app.score(52.5, "High");
  await shot(app, "03-checklist-branch");

  await app.click("btnInspReview");
  await app.waitText("txtRevScore", /52\.5/);
  await app.waitEnabled("btnRevSubmit");
  await shot(app, "05-review");
  await app.page.close();

  app = await open();
  created.push(await app.startInspection(EASTPORT, "Forklift FL-21"));
  await app.yesNo("FL-03", "No");
  await app.score(30, "Critical");
  await shot(app, "04-critical-stop");

  if (existsSync(PHOTO)) {
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
    await app.ctl("penPhotoAnnotate").waitFor();
    await app.drawCircle("penPhotoAnnotate", JAW);
    await shot(app, "06-photo-pen");
    await app.click("btnPhotoSave");
    await app.ctl("conPhotoRowTagBadge").waitFor({ timeout: 60_000 });
    await app.waitPhotoShown();
    await app.waitPhotoShown(60_000, "imgPhotoStrokes");
    await shot(app, "07-photo-saved");
  } else {
    console.log("No demo/out/photo-clean.jpg yet: photo screens skipped.");
  }
} finally {
  await browser.close();
  await dv.removeInspections(created);
}
