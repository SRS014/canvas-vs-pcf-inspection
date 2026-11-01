// Adds four fictional submitted inspections by driving the published App 1, so the scores and
// answer rows come from the app's own logic. Safe to re-run: an inspection whose comment already
// exists is skipped. The last submit's confirmation banner is saved as a screenshot.
//   node demo/seed-demo.mjs
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { InspectionApp, openBrowser } from "../lib/app.mjs";
import { ROOT } from "../lib/env.mjs";
import * as dv from "../lib/dataverse.mjs";

const SHOTS = join(ROOT, "..", "..", "docs", "screenshots", "app1");
mkdirSync(SHOTS, { recursive: true });

const yes = (code) => ["yesNo", code, "Yes"];
const no = (code) => ["yesNo", code, "No"];
const pick = (code, option) => ["choice", code, option];
const num = (code, value) => ["number", code, value];
const stage = (name) => ["stage", name];

const INSPECTIONS = [
  {
    site: "Riverside Assembly Plant", equipment: "Conveyor CV-2", type: "Conveyor", score: 12.5, band: "Low",
    comment: ["CV-30", "Belt fray on the return side, 12 cm. Tracking drifts under load. Booked for the next planned stop."],
    steps: [yes("CV-01"), yes("CV-02"),
      stage("Visual and structural"), pick("CV-10", "Frayed"), num("CV-10.1", 12), yes("CV-11"),
      stage("Operational test"), num("CV-20", 62), no("CV-21"),
      stage("Safety sign-off")],
  },
  {
    site: "Northgate Distribution Centre", equipment: "Forklift FL-12", type: "Forklift", score: 37.5, band: "Medium",
    comment: ["FL-33", "Rear left tyre damaged and tilt control is jerky. Fit to finish the shift at low speed, workshop tomorrow."],
    steps: [yes("FL-01"), num("FL-02", 410), yes("FL-03"),
      stage("Visual and structural"), pick("FL-10", "Damaged"), pick("FL-10.1", "Rear left"), pick("FL-11", "OK"), pick("FL-12", "OK"), no("FL-13"),
      stage("Operational test"), yes("FL-20"), yes("FL-21"), no("FL-22"), yes("FL-23"),
      stage("Safety sign-off"), yes("FL-30"), yes("FL-31")],
  },
  {
    site: "Riverside Assembly Plant", equipment: "Forklift FL-03", type: "Forklift", score: 67.5, band: "High",
    comment: ["FL-33", "Hydraulic weep at the mast, horn dead and the extinguisher is out of date. Safety lead told. Parked until repaired."],
    steps: [yes("FL-01"), num("FL-02", 9875), num("FL-02.1", 320), yes("FL-02.1.1"), yes("FL-03"),
      stage("Visual and structural"), pick("FL-10", "Good"), pick("FL-11", "OK"), pick("FL-12", "OK"), yes("FL-13"), pick("FL-13.1", "Hydraulic"),
      stage("Operational test"), yes("FL-20"), no("FL-21"), pick("FL-21.1", "Horn"), yes("FL-22"), yes("FL-23"),
      stage("Safety sign-off"), no("FL-30"), yes("FL-31"), yes("FL-32")],
  },
  {
    site: "Northgate Distribution Centre", equipment: "Forklift FL-07", type: "Forklift", score: 45, band: "Critical",
    comment: ["FL-33", "Hairline crack at the heel of the left fork. Truck taken out of service and tagged."],
    steps: [yes("FL-01"), num("FL-02", 6120), num("FL-02.1", 120), yes("FL-03"),
      stage("Visual and structural"), pick("FL-10", "Good"), pick("FL-11", "Crack visible"), pick("FL-12", "OK"), no("FL-13"),
      stage("Operational test"), yes("FL-20"), yes("FL-21"), yes("FL-22"), yes("FL-23"),
      stage("Safety sign-off"), yes("FL-30"), yes("FL-31")],
  },
];

const browser = await openBrowser();
let failed = false;
for (const [index, item] of INSPECTIONS.entries()) {
  const [commentCode, comment] = item.comment;
  if (await dv.answerExists(comment)) {
    console.log(`Already there: ${item.equipment} (${item.band})`);
    continue;
  }
  const app = new InspectionApp((await InspectionApp.open(browser.context)).page);
  let number;
  try {
    number = await app.startInspection(item.site, item.equipment);
    app.stageType = item.type;
    for (const [action, ...args] of item.steps) await app[action](...args);
    await app.note(commentCode, comment);
    await app.score(item.score, item.band);
    await app.click("btnInspReview");
    await app.waitEnabled("btnRevSubmit");
    await app.click("btnRevSubmit");
    await app.ctl("conHomeBanner").waitFor({ timeout: 60_000 });
    const row = await dv.inspection(number);
    if (row.status !== "Submitted" || row.score !== item.score || row.band !== item.band) throw new Error(`${number} saved as ${JSON.stringify(row)}`);
    console.log(`${number}: ${item.equipment}, ${row.score} ${row.band}, ${(await dv.answers(row.id)).length} answers`);
    if (index === INSPECTIONS.length - 1) {
      // The list and KPI cards refresh a moment after the banner shows
      const bannerAt = Date.now();
      await app.waitText("txtHomeBannerText", new RegExp(`${number} submitted`));
      await app.waitText("txtHomeRowNumber", new RegExp(number), 60_000);
      const { drafts, submitted } = await dv.counts();
      await app.waitKpis(drafts, submitted);
      console.log(`List and KPI cards caught up ${((Date.now() - bannerAt) / 1000).toFixed(1)} s after the banner`);
      await app.page.waitForTimeout(1500); // let the player's progress dots clear
      await app.shot(join(SHOTS, "08-submitted.png"));
    }
  } catch (e) {
    failed = true;
    console.error(`FAILED ${item.equipment}: ${e.message}`);
    await app.shot(join(ROOT, "test-results", `seed-failure-${index}.png`)).catch(() => {});
    if (number) await dv.removeInspections([number]); // no half-finished row left behind
    break;
  }
  await app.page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
