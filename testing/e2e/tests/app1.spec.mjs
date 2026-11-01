// App 1 (Canvas only), tested against the published app. Scores come from the seeded forklift
// template: FL-07 is High criticality (x1.50), FL-21 is Low (x1.00).
// Every inspection a test creates is recorded and deleted by number afterwards.
import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import { InspectionApp, openBrowser } from "../lib/app.mjs";
import { ROOT } from "../lib/env.mjs";
import * as dv from "../lib/dataverse.mjs";

const NORTHGATE = "Northgate Distribution Centre";
const EASTPORT = "Eastport Bonded Warehouse";
const FL07 = "Forklift FL-07";
const FL21 = "Forklift FL-21";

let browser, app;
const created = [];
const start = async (site, equipment) => {
  const number = await app.startInspection(site, equipment);
  created.push(number);
  return number;
};

test.beforeAll(async () => {
  browser = await openBrowser();
});
test.afterAll(async () => {
  await browser?.close();
  await dv.removeInspections(created);
});
test.beforeEach(async () => {
  await app?.page.close().catch(() => {});
  const base = await InspectionApp.open(browser.context);
  app = new InspectionApp(base.page);
});

test.describe("A. Home", () => {
  test("A1 KPI cards match Dataverse", async () => {
    const c = await dv.counts();
    await app.waitKpis(c.drafts, c.submitted);
    const kpis = (await app.ctl("galHomeKpis").innerText()).replace(/\s+/g, " ");
    expect(kpis).toContain(`Total inspections ${c.total}`);
  });
  test("A2 the list is newest first", async () => {
    await app.waitText("txtHomeRowNumber", /INS-/);
    const numbers = (await app.all("txtHomeRowNumber").allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    expect(numbers.length).toBeGreaterThan(1);
    expect(numbers).toEqual([...numbers].sort().reverse());
  });
});

test.describe("B. Starting an inspection", () => {
  test("B1 Start stays disabled until equipment is chosen", async () => {
    await app.click("btnHomeNew");
    await app.ctl("galStartSites").waitFor();
    expect(await app.disabled("btnStartGo")).toBe(true);
    await expect(app.ctl("txtStartReason")).toBeVisible();
    await app.pickRow("galStartSites", NORTHGATE, "btnStartSiteSelect");
    expect(await app.disabled("btnStartGo")).toBe(true);
    await app.pickRow("galStartEquipment", FL07, "btnStartEquipSelect");
    await app.waitEnabled("btnStartGo");
    await expect(app.ctl("txtStartReason")).toBeHidden();
  });
  test("B2 a site shows only its own equipment, and changing site clears the choice", async () => {
    await app.click("btnHomeNew");
    await app.pickRow("galStartSites", EASTPORT, "btnStartSiteSelect");
    await expect(app.ctl("galStartEquipment")).toContainText(FL21);
    await expect(app.ctl("galStartEquipment")).not.toContainText(FL07);
    await app.pickRow("galStartEquipment", FL21, "btnStartEquipSelect");
    await app.waitEnabled("btnStartGo");
    await app.pickRow("galStartSites", NORTHGATE, "btnStartSiteSelect");
    await expect(app.ctl("galStartEquipment")).toContainText(FL07);
    expect(await app.disabled("btnStartGo")).toBe(true);
  });
  test("B3 cancelling writes nothing", async () => {
    const before = await dv.counts();
    await app.click("btnHomeNew");
    await app.pickRow("galStartSites", EASTPORT, "btnStartSiteSelect");
    await app.pickRow("galStartEquipment", FL21, "btnStartEquipSelect");
    await app.click("btnStartCancelNav");
    await app.ctl("btnHomeNew").waitFor();
    expect((await dv.counts()).total).toBe(before.total);
  });
  test("B4 Start creates a Draft marked Canvas only", async () => {
    const number = await start(EASTPORT, FL21);
    const row = await dv.inspection(number);
    expect(row).toMatchObject({ status: "Draft", builtWith: "Canvas only" });
    await expect(app.ctl("txtInspContext")).toContainText("EBW-FL-21");
  });
});

test.describe("C. The checklist", () => {
  test("C1 a child question appears and goes away with its parent's answer", async () => {
    await start(EASTPORT, FL21);
    expect(await app.shows("FL-01.1")).toBe(false);
    await app.yesNo("FL-01", "No");
    await app.waitShows("FL-01.1");
    await app.waitShows("FL-01.2");
    await app.yesNo("FL-01", "Yes");
    await app.waitShows("FL-01.1", false);
    await app.waitShows("FL-01.2", false);
  });
  test("C2 the branch reaches level five and scores it; the sixth level never shows", async () => {
    await start(NORTHGATE, FL07);
    await app.yesNo("FL-01", "No");
    await app.choice("FL-01.1", "Damaged");
    await app.choice("FL-01.1.1", "Hydraulics");
    await app.yesNo("FL-01.1.1.1", "Yes");
    await app.score(30, "Medium");
    await app.yesNo("FL-01.1.1.1.1", "No");
    // (20 + 15) x 1.50: this is Canvas's documented limit, not a defect the suite should hide
    await app.score(52.5, "High");
    await app.answered(5);
    expect(await app.shows("FL-01.1.1.1.1.1")).toBe(false);
    await expect(app.ctl("txtInspStopsNone")).toBeVisible();
  });
  test("C3 answers on a collapsed branch stop scoring", async () => {
    await start(NORTHGATE, FL07);
    await app.yesNo("FL-01", "No");
    await app.choice("FL-01.1", "Damaged");
    await app.choice("FL-01.1.1", "Hydraulics");
    await app.yesNo("FL-01.1.1.1", "Yes");
    await app.score(30);
    await app.yesNo("FL-01", "Yes");
    await app.score(0, "Low");
  });
  test("C4 a critical stop forces the Critical band at a low score", async () => {
    await start(EASTPORT, FL21);
    await app.score(0, "Low");
    await app.yesNo("FL-03", "No");
    await app.score(30, "Critical");
    await expect(app.ctl("txtInspStopsNone")).toBeHidden();
    await expect(app.ctl("galInspStops")).toContainText("licence");
    await app.clearAnswer("FL-03");
    await app.score(0, "Low");
    await expect(app.ctl("txtInspStopsNone")).toBeVisible();
  });
  test("C5 number answers open children at their thresholds and score", async () => {
    await start(EASTPORT, FL21);
    await app.number("FL-02", 400);
    await app.answered(1);
    expect(await app.shows("FL-02.1")).toBe(false);
    await app.number("FL-02", 600);
    await app.waitShows("FL-02.1");
    await app.number("FL-02.1", 200);
    await app.answered(2);
    expect(await app.shows("FL-02.1.1")).toBe(false);
    await app.score(0);
    await app.number("FL-02.1", 300);
    await app.waitShows("FL-02.1.1");
    await app.score(10, "Low");
  });
  test("C6 the cross-question rule shows FL-32 for either of its two conditions", async () => {
    await start(EASTPORT, FL21);
    await app.stage("Safety sign-off");
    expect(await app.shows("FL-32")).toBe(false);
    await app.stage("Operational test");
    await app.yesNo("FL-20", "No");
    await app.stage("Safety sign-off");
    await app.waitShows("FL-32");
    await app.stage("Operational test");
    await app.yesNo("FL-20", "Yes");
    await app.stage("Safety sign-off");
    await app.waitShows("FL-32", false);
    await app.yesNo("FL-30", "No");
    await app.answered(2);
    expect(await app.shows("FL-32")).toBe(false); // needs the leak as well
    await app.stage("Visual and structural");
    await app.yesNo("FL-13", "Yes");
    await app.stage("Safety sign-off");
    await app.waitShows("FL-32");
  });
  test("C7 the bands change at 25, 50 and 75", async () => {
    await start(EASTPORT, FL21); // x1.00, so points are the score
    await app.stage("Safety sign-off");
    await app.yesNo("FL-31", "No");
    await app.score(15, "Low");
    await app.yesNo("FL-30", "No");
    await app.score(25, "Medium");
    await app.stage("Operational test");
    await app.yesNo("FL-22", "No");
    await app.score(40, "Medium");
    await app.yesNo("FL-21", "No");
    await app.score(50, "High");
    await app.yesNo("FL-23", "No");
    await app.score(60, "High");
    await app.stage("Visual and structural");
    await app.yesNo("FL-13", "Yes");
    await app.score(75, "Critical");
  });
  test("C8 the score caps at 100", async () => {
    await start(NORTHGATE, FL07);
    await app.stage("Operational test");
    await app.yesNo("FL-22", "No");
    await app.yesNo("FL-21", "No");
    await app.yesNo("FL-23", "No");
    await app.stage("Safety sign-off");
    await app.yesNo("FL-31", "No");
    await app.yesNo("FL-30", "No");
    await app.stage("Visual and structural");
    await app.yesNo("FL-13", "Yes");
    await app.score(100, "Critical"); // 75 x 1.50 = 112.5
    await expect(app.ctl("galInspDerivation")).toContainText("Capped at 100");
  });
});

test.describe("D. Review and submit", () => {
  test("D1 Submit is disabled with no answers", async () => {
    await start(EASTPORT, FL21);
    await app.click("btnInspReview");
    await app.ctl("btnRevSubmit").waitFor();
    expect(await app.disabled("btnRevSubmit")).toBe(true);
    await expect(app.ctl("txtRevContribNone")).toBeVisible();
    const row = await dv.inspection(created.at(-1));
    expect(row.status).toBe("Draft");
  });
  test("D2 Submit writes the score, band and one row per visible answer", async () => {
    const number = await start(NORTHGATE, FL07);
    await app.yesNo("FL-01", "No");
    await app.choice("FL-01.1", "Damaged");
    await app.choice("FL-01.1.1", "Hydraulics");
    await app.yesNo("FL-01.1.1.1", "Yes");
    await app.yesNo("FL-01.1.1.1.1", "No");
    await app.score(52.5, "High");
    await app.stage("Safety sign-off");
    await app.note("FL-33", "Hydraulic leak under the mast. Taken out of service.");
    await app.click("btnInspReview");
    await app.waitText("txtRevScore", /52\.5/);
    await app.waitEnabled("btnRevSubmit");
    await app.click("btnRevSubmit");
    await app.ctl("conHomeBanner").waitFor({ timeout: 60_000 });
    await expect(app.ctl("txtHomeBannerText")).toContainText(`${number} submitted with risk 52.5`);

    const row = await dv.inspection(number);
    expect(row).toMatchObject({ status: "Submitted", score: 52.5, band: "High", builtWith: "Canvas only" });
    expect(row.submittedOn).toBeTruthy();
    const saved = await dv.answers(row.id);
    expect(saved.map((a) => a.code).sort()).toEqual(["FL-01", "FL-01.1", "FL-01.1.1", "FL-01.1.1.1", "FL-01.1.1.1.1", "FL-33"]);
    expect(saved.find((a) => a.code === "FL-01.1.1.1").points).toBe(30);
    expect(saved.find((a) => a.code === "FL-01.1.1.1.1").points).toBe(22.5);
    expect(saved.find((a) => a.code === "FL-33").value).toContain("Hydraulic leak");

    await expect(app.ctl("galHomeInspections")).toContainText(number);
  });
  test("D3 an answer on a collapsed branch is not saved", async () => {
    const number = await start(EASTPORT, FL21);
    await app.yesNo("FL-01", "No");
    await app.yesNo("FL-01.2", "Yes");
    await app.yesNo("FL-01", "Yes");
    await app.waitShows("FL-01.2", false);
    await app.click("btnInspReview");
    await app.waitEnabled("btnRevSubmit");
    await app.click("btnRevSubmit");
    await app.ctl("conHomeBanner").waitFor({ timeout: 60_000 });
    const row = await dv.inspection(number);
    expect((await dv.answers(row.id)).map((a) => a.code)).toEqual(["FL-01"]);
  });
  test("D4 a critical stop is saved as Critical", async () => {
    const number = await start(EASTPORT, FL21);
    await app.yesNo("FL-03", "No");
    await app.score(30, "Critical");
    await app.click("btnInspReview");
    await app.waitEnabled("btnRevSubmit");
    await app.click("btnRevSubmit");
    await app.ctl("conHomeBanner").waitFor({ timeout: 60_000 });
    expect(await dv.inspection(number)).toMatchObject({ status: "Submitted", score: 30, band: "Critical" });
  });
});

test.describe("G. What the screen shows", () => {
  // A blank modern Text control shows its default word "Text"
  const noDefaultText = async (screen) => {
    const stray = await app.frame.locator("[data-control-name]").evaluateAll((els) =>
      els.filter((e) => e.offsetParent !== null && !e.querySelector("[data-control-name]") && (e.innerText || "").trim() === "Text")
        .map((e) => e.getAttribute("data-control-name")));
    expect(stray, `${screen} shows the default word "Text"`).toEqual([]);
  };
  test("G1 no control on any screen shows the default word Text", async () => {
    await noDefaultText("Home");
    await start(EASTPORT, FL21);
    await noDefaultText("Inspection");
    await app.yesNo("FL-03", "No");
    await app.score(30, "Critical");
    await app.click("btnInspPhotos");
    await app.ctl("addPhotoPicker").waitFor();
    await noDefaultText("Photos");
    await app.click("btnPhotoBackNav");
    await app.ctl("tabInspStages").waitFor();
    await app.click("btnInspReview");
    await app.waitText("txtRevScore", /30\.0/);
    await noDefaultText("Review");
    await app.click("btnRevBackNav");
    await app.ctl("tabInspStages").waitFor();
    await app.page.close();
    app = new InspectionApp((await InspectionApp.open(browser.context)).page);
    await app.click("btnHomeNew");
    await app.ctl("galStartSites").waitFor();
    await noDefaultText("New inspection");
  });
  test("G2 Contributing questions show the whole of the longest question", async () => {
    await start("Northgate Distribution Centre", "Conveyor CV-A");
    await app.yesNo("CV-01", "No"); // the template's longest: a question plus the CRITICAL STOP tag
    await app.yesNo("CV-02", "No");
    await app.click("btnInspReview");
    await app.waitText("txtRevScore", /75\.0/);
    const rows = await app.all("txtRevContribText").evaluateAll((els) =>
      els.filter((e) => e.offsetParent !== null).map((e) => {
        const box = e.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(e);
        return { text: e.innerText.trim(), box: Math.round(box.bottom), text_bottom: Math.round(range.getBoundingClientRect().bottom) };
      }));
    expect(rows.length).toBe(2);
    for (const r of rows) expect(r.text_bottom, r.text).toBeLessThanOrEqual(r.box);
  });
  test("G3 after a submit the new inspection is the first row in view", async () => {
    const number = await start(EASTPORT, FL21);
    await app.yesNo("FL-03", "Yes");
    await app.click("btnInspReview");
    await app.waitEnabled("btnRevSubmit");
    await app.click("btnRevSubmit");
    await app.ctl("conHomeBanner").waitFor({ timeout: 60_000 });
    const { drafts, submitted } = await dv.counts();
    await app.waitKpis(drafts, submitted);
    await expect.poll(() => app.firstRowInView(), { timeout: 30_000 }).toBe(number);
  });
});

test.describe("E. Leaving an inspection", () => {
  test("E1 Exit asks first; keeping stays put, abandoning leaves an unscored Draft", async () => {
    const number = await start(EASTPORT, FL21);
    await app.yesNo("FL-03", "Yes");
    // Confirm() is a native browser dialog in the web player
    const answerDialog = (accept) => new Promise((resolve) => app.page.once("dialog", async (d) => {
      const message = d.message();
      await (accept ? d.accept() : d.dismiss());
      resolve(message);
    }));
    let asked = answerDialog(false);
    await app.click("btnInspExit");
    expect(await asked).toContain("Your answers will be lost");
    await expect(app.ctl("tabInspStages")).toBeVisible();
    asked = answerDialog(true);
    await app.click("btnInspExit");
    await asked;
    await app.ctl("btnHomeNew").waitFor();
    const row = await dv.inspection(number);
    expect(row).toMatchObject({ status: "Draft" });
    expect(row.score ?? null).toBeNull();
    expect(await dv.answers(row.id)).toEqual([]);
  });
});

test.describe("F. Photos", () => {
  // A generated test card, so no third-party photo enters the suite
  const picture = join(ROOT, "test-results", "test-photo.png");
  test.beforeAll(() => {
    mkdirSync(join(ROOT, "test-results"), { recursive: true });
    execFileSync(ffmpeg, ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=800x600:rate=1", "-frames:v", "1", picture]);
  });
  test("F1 add a photo, draw on it; strokes save apart from the photo", async () => {
    const number = await start(EASTPORT, FL21);
    await app.click("btnInspPhotos");
    await app.ctl("addPhotoPicker").waitFor();
    await expect(app.ctl("txtPhotoListEmpty")).toBeVisible();
    await expect(app.ctl("txtPhotoNothing")).toBeVisible();

    await app.ctl("addPhotoPicker").locator('input[type="file"]').first().setInputFiles(picture);
    await app.waitEnabled("btnPhotoSave");
    await app.ctl("txtPhotoCaption").locator("input, textarea").first().fill("Test card");
    await app.click("btnPhotoSave");
    await expect(app.ctl("galPhotoList")).toContainText("Test card", { timeout: 60_000 });

    const row = await dv.inspection(number);
    let saved = await dv.photos(row.id);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ caption: "Test card", hasPhoto: true, hasStrokes: false });

    await app.pickRow("galPhotoList", "Test card", "btnPhotoRowSelect");
    await app.ctl("btnPhotoAnnotate").waitFor();
    await app.click("btnPhotoAnnotate");
    await app.ctl("penPhotoAnnotate").waitFor();
    const box = await app.ctl("penPhotoAnnotate").boundingBox();
    await app.page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
    await app.page.mouse.down();
    await app.page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, { steps: 12 });
    await app.page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.7, { steps: 12 });
    await app.page.mouse.up();
    await app.click("btnPhotoSave");
    await app.ctl("conPhotoRowTagBadge").waitFor({ timeout: 60_000 });

    saved = await dv.photos(row.id);
    expect(saved[0]).toMatchObject({ hasPhoto: true, hasStrokes: true });
  });
});
