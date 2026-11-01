// Page helpers for the published canvas apps. Canvas controls render with a data-control-name
// attribute inside the #fullscreen-app-host iframe; these helpers address controls by that name.
import { chromium } from "@playwright/test";
import { PROFILE_DIR, playUrl } from "./env.mjs";

export async function openBrowser({ headless = true, viewport = { width: 1280, height: 720 }, recordVideo } = {}) {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, { headless, viewport, recordVideo });
  return { context, close: () => context.close(), viewport };
}

export class App {
  constructor(page) {
    this.page = page;
    this.frame = page.frameLocator("#fullscreen-app-host");
  }
  // Opens a published app in a new tab. A cold load occasionally stalls in the player, so each
  // attempt has a time budget and a stuck one is retried on a fresh page.
  static async open(context, { app = "app1", readyControl = "btnHomeNew", viewport = { width: 1280, height: 720 } } = {}) {
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      let page;
      try {
        return await Promise.race([
          App.#openOnce(context, { app, readyControl, viewport }, (p) => (page = p)),
          new Promise((_, reject) => setTimeout(() => reject(new Error(`app didn't load within 150 s (attempt ${attempt})`)), 150_000)),
        ]);
      } catch (e) {
        lastError = e;
        await page?.close().catch(() => {});
      }
    }
    throw lastError;
  }
  static async #openOnce(context, { app: appName, readyControl, viewport }, track) {
    const page = await context.newPage();
    track(page);
    await page.setViewportSize(viewport);
    await page.goto(playUrl(appName, { v: String(Date.now()) }));
    const app = new App(page);
    await app.ctl(readyControl).waitFor({ timeout: 120_000 });
    // The player serves its cached copy first; after a publish it offers a Refresh. Take it.
    const stale = page.getByText(/You're using an old version of this app/);
    if (await stale.waitFor({ timeout: 8000 }).then(() => true).catch(() => false)) {
      await page.getByRole("button", { name: /^Refresh$/ }).first().click();
      await page.waitForLoadState("load");
      await app.ctl(readyControl).waitFor({ timeout: 120_000 });
    }
    await app.closeBanners();
    return app;
  }
  // Power Apps' own "Developer environment" notices sit over the app's header: close them
  async closeBanners() {
    for (const banner of await this.page.locator('[role="status"], [role="alert"], .ms-MessageBar').all()) {
      const x = banner.getByRole("button", { name: /close|dismiss/i });
      if (await x.count()) await x.first().click().catch(() => {});
    }
  }
  ctl(name) { return this.frame.locator(`[data-control-name="${name}"]`).first(); }
  all(name) { return this.frame.locator(`[data-control-name="${name}"]`); }
  async text(name) { return (await this.ctl(name).innerText()).trim(); }
  async waitText(name, re, timeout = 30_000) {
    const end = Date.now() + timeout;
    let last = "";
    while (Date.now() < end) {
      last = await this.text(name).catch(() => "");
      if (re.test(last)) return last;
      await this.page.waitForTimeout(250);
    }
    throw new Error(`${name} never matched ${re} (last: "${last}")`);
  }
  async visible(name) { return this.ctl(name).isVisible().catch(() => false); }
  async click(name) {
    const c = this.ctl(name);
    const inner = c.locator("button");
    await ((await inner.count()) ? inner.first() : c).click();
  }
  async disabled(name) {
    const c = this.ctl(name);
    const inner = c.locator("button");
    return ((await inner.count()) ? inner.first() : c).isDisabled();
  }
  // Clicks the transparent select button in the gallery row that shows `text`
  async pickRow(galleryName, text, button) {
    const row = this.ctl(galleryName).locator('[role="listitem"]').filter({ hasText: text }).first();
    await row.waitFor({ timeout: 30_000 });
    await row.locator(`[data-control-name="${button}"] button`).first().click();
  }
  async shot(path) { await this.page.screenshot({ path }); }
}

// One question from each stage of each template, to tell that a stage's rows have loaded
const STAGE_ANCHOR = {
  Forklift: { "Pre-use": "FL-01", "Visual and structural": "FL-10", "Operational test": "FL-20", "Safety sign-off": "FL-30" },
  Conveyor: { "Pre-use": "CV-01", "Visual and structural": "CV-10", "Operational test": "CV-20", "Safety sign-off": "CV-30" },
};

// App 1 and App 2 share these screens and control names
export class InspectionApp extends App {
  stageType = "Forklift";
  // New inspection → site → equipment → Start. Returns the new inspection's number.
  async startInspection(site, equipment) {
    await this.click("btnHomeNew");
    await this.ctl("galStartSites").waitFor();
    await this.pickRow("galStartSites", site, "btnStartSiteSelect");
    await this.pickRow("galStartEquipment", equipment, "btnStartEquipSelect");
    await this.waitEnabled("btnStartGo");
    await this.click("btnStartGo");
    await this.ctl("tabInspStages").waitFor({ timeout: 60_000 });
    return (await this.waitText("txtInspTitle", /INS-\d+/, 30_000)).match(/INS-\d+/)[0];
  }
  async waitEnabled(name, timeout = 30_000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (!(await this.disabled(name).catch(() => true))) return;
      await this.page.waitForTimeout(250);
    }
    throw new Error(`${name} never became enabled`);
  }
  // Switches stage and waits for a question from that stage, so the gallery has swapped its rows
  async stage(name) {
    await this.ctl("tabInspStages").getByRole("tab", { name: new RegExp(`^${name}`) }).click();
    await this.waitShows(STAGE_ANCHOR[this.stageType][name]);
  }
  // Waits for the live panel to count an answer, so a check that something stayed hidden is settled
  async answered(n) { await this.waitText("txtInspAnswered", new RegExp(`^Answered ${n} of`)); }
  // Waits for the home KPI cards to show these counts (they refresh a moment after a submit)
  async waitKpis(drafts, submitted, timeout = 60_000) {
    const end = Date.now() + timeout;
    const want = (label, n, text) => text.includes(`${label} ${n} `);
    let text = "";
    while (Date.now() < end) {
      text = (await this.text("galHomeKpis").catch(() => "")).replace(/\s+/g, " ").replace(/Item \d+ /g, "");
      if (want("Drafts", drafts, text) && want("Submitted", submitted, text)) return;
      await this.page.waitForTimeout(250);
    }
    throw new Error(`KPI cards never showed ${drafts} drafts and ${submitted} submitted (last: "${text}")`);
  }
  // Question row by exact code; the code label reads "FL-01   ·   level 1"
  question(code) {
    const label = this.frame.locator('[data-control-name="txtInspQCode"]').filter({ hasText: new RegExp(`^\\s*${code.replace(/\./g, "\\.")}\\s+·`) });
    return this.ctl("galInspQuestions").locator('[role="listitem"]').filter({ has: label }).first();
  }
  async shows(code) { return this.question(code).isVisible().catch(() => false); }
  async waitShows(code, want = true, timeout = 15_000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if ((await this.shows(code)) === want) return true;
      await this.page.waitForTimeout(200);
    }
    throw new Error(`${code} ${want ? "never appeared" : "never went away"}`);
  }
  async yesNo(code, value) {
    await this.waitShows(code);
    await this.question(code).locator(`[data-control-name="${value === "Yes" ? "btnInspYes" : "btnInspNo"}"] button`).first().click();
  }
  async clearAnswer(code) {
    await this.question(code).locator('[data-control-name="btnInspClear"] button').first().click();
  }
  async choice(code, option) {
    await this.waitShows(code);
    await this.question(code).locator('[data-control-name="ddInspChoice"]').getByRole("combobox").click();
    const opt = this.frame.getByRole("option", { name: option, exact: true }).first();
    await opt.waitFor({ timeout: 15_000 });
    await opt.click();
  }
  async number(code, value) {
    await this.waitShows(code);
    const input = this.question(code).locator('[data-control-name="numInspNumber"] input').first();
    await input.fill(String(value));
    await input.press("Tab");
  }
  async note(code, value) {
    await this.waitShows(code);
    const input = this.question(code).locator('[data-control-name="txtInspText"] input, [data-control-name="txtInspText"] textarea').first();
    await input.fill(value);
    await input.press("Tab");
  }
  // Waits for the live panel: "52.5 / 100" and its band
  async score(value, band) {
    await this.waitText("txtInspRiskScore", new RegExp(`^${value.toFixed(1).replace(".", "\\.")} / 100`));
    if (band) await this.waitText("txtInspRiskBadge", new RegExp(band, "i"));
  }
}
