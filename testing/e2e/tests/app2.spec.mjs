// App 2 (Canvas + PCF), tested against the published app. Scores come from the seeded forklift
// template and compound rules: FL-07 is High criticality (x1.50), FL-21 is Low (x1.00).
// Every inspection a test creates is recorded and deleted by number afterwards.
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import { ChecklistApp, openBrowser } from "../lib/app.mjs";
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
const openApp = async () => new ChecklistApp((await ChecklistApp.open(browser.context, { app: "app2" })).page);
const openBranch = async () => {
  await app.yesNo("FL-01", "No");
  await app.choice("FL-01.1", "Damaged");
  await app.choice("FL-01.1.1", "Hydraulics");
  await app.yesNo("FL-01.1.1.1", "Yes");
};
const submit = async () => {
  await app.click("btnInspReview");
  await app.waitEnabled("btnRevSubmit");
  await app.click("btnRevSubmit");
  await app.ctl("conHomeBanner").waitFor({ timeout: 60_000 });
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
  app = await openApp();
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
    await app.pickRow("galStartSites", NORTHGATE, "btnStartSiteSelect");
    expect(await app.disabled("btnStartGo")).toBe(true);
    await app.pickRow("galStartEquipment", FL07, "btnStartEquipSelect");
    await app.waitEnabled("btnStartGo");
  });
  test("B2 Start creates a Draft marked Canvas + PCF, and the component renders the checklist", async () => {
    const number = await start(EASTPORT, FL21);
    expect(await dv.inspection(number)).toMatchObject({ status: "Draft", builtWith: "Canvas + PCF" });
    await app.waitShows("FL-01");
    await expect(app.ctl("pcfInspChecklist").getByRole("tab", { name: /^Pre-use/ })).toBeVisible();
    await app.score(0, "Low");
  });
});

test.describe("C. The checklist component", () => {
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
  test("C2 the sixth level appears and scores, with a compound rule on the way", async () => {
    await start(NORTHGATE, FL07);
    await openBranch();
    await app.score(30, "Medium");
    await app.yesNo("FL-01.1.1.1.1", "No");
    // (20 + 15 + the 15-point rule) x 1.50: App 1 scores the same answers 52.5, High
    await app.score(75, "Critical");
    await expect(app.riskPanel()).toContainText("Rule RR-FL-02");
    await app.waitShows("FL-01.1.1.1.1.1");
    await expect(app.question("FL-01.1.1.1.1.1")).toContainText("level 6");
    await app.yesNo("FL-01.1.1.1.1.1", "No");
    await app.score(100, "Critical"); // 75 x 1.50 = 112.5, capped
    await expect(app.riskPanel()).toContainText("critical stop");
  });
  test("C3 answers on a collapsed branch stop scoring", async () => {
    await start(NORTHGATE, FL07);
    await openBranch();
    await app.score(30);
    await app.yesNo("FL-01", "Yes");
    await app.score(0, "Low");
  });
  test("C4 a critical stop forces the top band, and pressing the answer again clears it", async () => {
    await start(EASTPORT, FL21);
    await app.yesNo("FL-03", "No");
    await app.score(30, "Critical");
    await expect(app.riskPanel()).toContainText("critical stop");
    await app.yesNo("FL-03", "No");
    await app.score(0, "Low");
    await expect(app.riskPanel()).not.toContainText("critical stop");
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
  test("C6 the rule stored on FL-32 decides when it shows, for either condition", async () => {
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
  test("C7 a compound rule adds its bonus and explains itself", async () => {
    await start(EASTPORT, FL21);
    await app.stage("Visual and structural");
    await app.yesNo("FL-13", "Yes");
    await app.score(15, "Low");
    await app.stage("Safety sign-off");
    await app.yesNo("FL-30", "No");
    await app.score(45, "Medium"); // 15 + 10 + the 20-point rule, not 25
    await expect(app.riskPanel()).toContainText("Rule RR-FL-01");
    await expect(app.riskPanel()).toContainText("+20");
  });
  test("C8 the bands change at 25, 50 and 75", async () => {
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
    await app.choice("FL-12", "Damaged");
    await app.score(80, "Critical");
  });
  test("C9 the score caps at 100", async () => {
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
    await app.score(100, "Critical");
  });
  test("C10 the keyboard can answer a question", async () => {
    await start(EASTPORT, FL21);
    const no = app.answerButton("FL-03", "No");
    await no.focus();
    await app.page.keyboard.press("Enter");
    await expect(no).toHaveAttribute("aria-pressed", "true");
    await app.score(30, "Critical");
  });
});

test.describe("D. Review and submit", () => {
  test("D1 Submit is disabled with no answers", async () => {
    const number = await start(EASTPORT, FL21);
    await app.click("btnInspReview");
    await app.ctl("btnRevSubmit").waitFor();
    expect(await app.disabled("btnRevSubmit")).toBe(true);
    expect((await dv.inspection(number)).status).toBe("Draft");
  });
  test("D2 Submit writes the score, the band and each answer's contribution from the component", async () => {
    const number = await start(NORTHGATE, FL07);
    await openBranch();
    await app.yesNo("FL-01.1.1.1.1", "No");
    await app.score(75, "Critical");
    await app.stage("Safety sign-off");
    await app.note("FL-33", "Hydraulic leak under the mast. Taken out of service.");
    await app.answered(6);
    await app.click("btnInspReview");
    await app.waitText("txtRevScore", /75\.0/);
    await app.waitEnabled("btnRevSubmit");
    await app.click("btnRevSubmit");
    await app.ctl("conHomeBanner").waitFor({ timeout: 60_000 });
    await expect(app.ctl("txtHomeBannerText")).toContainText(`${number} submitted with risk 75.0`);

    const row = await dv.inspection(number);
    expect(row).toMatchObject({ status: "Submitted", score: 75, band: "Critical", builtWith: "Canvas + PCF" });
    const saved = await dv.answers(row.id);
    expect(saved.map((a) => a.code).sort()).toEqual(["FL-01", "FL-01.1", "FL-01.1.1", "FL-01.1.1.1", "FL-01.1.1.1.1", "FL-33"]);
    expect(saved.find((a) => a.code === "FL-01.1.1.1").points).toBe(30);
    expect(saved.find((a) => a.code === "FL-01.1.1.1.1").points).toBe(22.5);
    expect(saved.find((a) => a.code === "FL-33").value).toContain("Hydraulic leak");
  });
  test("D3 an answer on a collapsed branch is not saved", async () => {
    const number = await start(EASTPORT, FL21);
    await app.yesNo("FL-01", "No");
    await app.yesNo("FL-01.2", "Yes");
    await app.yesNo("FL-01", "Yes");
    await app.waitShows("FL-01.2", false);
    await app.answered(1);
    await submit();
    const row = await dv.inspection(number);
    expect((await dv.answers(row.id)).map((a) => a.code)).toEqual(["FL-01"]);
  });
  test("D4 a critical stop is saved as Critical", async () => {
    const number = await start(EASTPORT, FL21);
    await app.yesNo("FL-03", "No");
    await app.score(30, "Critical");
    await submit();
    expect(await dv.inspection(number)).toMatchObject({ status: "Submitted", score: 30, band: "Critical" });
  });
});

test.describe("E. Leaving an inspection", () => {
  test("E1 Exit asks first; keeping stays put, abandoning leaves an unscored Draft", async () => {
    const number = await start(EASTPORT, FL21);
    await app.yesNo("FL-03", "Yes");
    await app.answered(1);
    // In this app Confirm() shows the player's own dialog, inside the page
    const dialogButton = (name) => app.frame.getByRole("button", { name }).or(app.page.getByRole("button", { name })).first();
    await app.click("btnInspExit");
    await dialogButton("Keep inspecting").click();
    await expect(dialogButton("Keep inspecting")).toBeHidden();
    await expect(app.ctl("pcfInspChecklist")).toBeVisible();
    await app.click("btnInspExit");
    await dialogButton("Abandon inspection").click();
    await app.ctl("btnHomeNew").waitFor();
    const row = await dv.inspection(number);
    expect(row).toMatchObject({ status: "Draft" });
    expect(row.score ?? null).toBeNull();
    expect(await dv.answers(row.id)).toEqual([]);
  });
});

test.describe("F. The photo annotator component", () => {
  // A generated test card, so no third-party photo enters the suite
  const picture = join(ROOT, "test-results", "test-photo-app2.png");
  test.beforeAll(() => {
    mkdirSync(join(ROOT, "test-results"), { recursive: true });
    execFileSync(ffmpeg, ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=800x600:rate=1", "-frames:v", "1", picture]);
  });
  test("F1 marks save as data and burned into a copy; the original photo stays, and marks reopen for editing", async () => {
    const number = await start(EASTPORT, FL21);
    await app.click("btnInspPhotos");
    await app.ctl("addPhotoPicker").waitFor();
    await app.ctl("addPhotoPicker").locator('input[type="file"]').first().setInputFiles(picture);
    await app.waitEnabled("btnPhotoSave");
    await app.ctl("txtPhotoCaption").locator("input, textarea").first().fill("Test card");
    await app.click("btnPhotoSave");
    await app.waitText("galPhotoList", /Test card/, 60_000);
    expect(await app.waitPhotoShown()).toBe(800);

    await app.click("btnPhotoAnnotate");
    await app.annotatorReady();
    await app.placeMark("Numbered marker", { x: 0.3, y: 0.4 });
    await app.placeMark("Arrow", { x: 0.5, y: 0.2 }, { x: 0.7, y: 0.4 });
    await app.placeMark("Box", { x: 0.2, y: 0.6 }, { x: 0.5, y: 0.85 });
    await app.placeMark("Freehand", { x: 0.6, y: 0.6 }, { x: 0.85, y: 0.8 });
    await app.markCount(4);
    await app.ctl("pcfPhotoAnnotator").getByRole("button", { name: "Undo" }).click();
    await app.markCount(3);
    await app.click("btnPhotoSave");
    await app.ctl("conPhotoRowTagBadge").waitFor({ timeout: 60_000 });

    const row = await dv.inspection(number);
    const [saved] = await dv.photos(row.id);
    expect(saved).toMatchObject({ hasPhoto: true, hasAnnotated: true });
    expect(JSON.parse(saved.annotationJson).marks.map((m) => m.type)).toEqual(["marker", "arrow", "box"]);

    await app.click("btnPhotoAnnotate");
    await app.annotatorReady();
    await app.markCount(3); // the saved marks come back, still editable
  });
});

test.describe("G. What the screen shows", () => {
  test("G1 no control on any screen shows the default word Text", async () => {
    expect(await app.defaultTextControls(), "Home").toEqual([]);
    await start(EASTPORT, FL21);
    expect(await app.defaultTextControls(), "Inspection").toEqual([]);
    await app.yesNo("FL-03", "No");
    await app.score(30, "Critical");
    await app.answered(1);
    await app.click("btnInspPhotos");
    await app.ctl("addPhotoPicker").waitFor();
    expect(await app.defaultTextControls(), "Photos").toEqual([]);
    await app.click("btnPhotoBackNav");
    await app.ctl("pcfInspChecklist").waitFor();
    await app.click("btnInspReview");
    await app.waitText("txtRevScore", /30\.0/);
    expect(await app.defaultTextControls(), "Review").toEqual([]);
    await app.page.close();
    app = await openApp();
    await app.click("btnHomeNew");
    await app.ctl("galStartSites").waitFor();
    expect(await app.defaultTextControls(), "New inspection").toEqual([]);
  });
  test("G2 Contributing questions show the whole of the longest question", async () => {
    await start(NORTHGATE, "Conveyor CV-A");
    app.stageType = "Conveyor";
    await app.yesNo("CV-01", "No"); // the template's longest: a question plus the CRITICAL STOP tag
    await app.yesNo("CV-02", "No");
    await app.answered(2);
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
    await app.answered(1);
    await submit();
    const { drafts, submitted } = await dv.counts();
    await app.waitKpis(drafts, submitted);
    await expect.poll(() => app.firstRowInView(), { timeout: 30_000 }).toBe(number);
  });
});
