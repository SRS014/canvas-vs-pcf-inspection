// Drives the Studio tab that auth/studio.mjs keeps open (CDP port 9333): save and publish, so
// changes compiled through the Canvas Authoring MCP reach Play mode without manual clicks.
//   node lib/studio.mjs publish [shotDir]
import { chromium } from "@playwright/test";

export async function studioPage() {
  const browser = await chromium.connectOverCDP("http://localhost:9333");
  const page = browser.contexts()[0].pages().find((p) => p.url().includes("make.powerapps.com"));
  if (!page) throw new Error("Studio tab not found: start node auth/studio.mjs first.");
  return { browser, page };
}

// Studio renders inside an iframe: find the first frame where the locator exists
async function inAnyFrame(page, make, timeoutMs = 60_000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    for (const f of page.frames()) {
      const loc = make(f);
      if (await loc.count().catch(() => 0)) return loc.first();
    }
    if (Date.now() > end) throw new Error("Not found in any Studio frame");
    await page.waitForTimeout(1000);
  }
}

export async function dismissDialogs(page) {
  for (const f of page.frames()) {
    for (const name of [/^Skip$/, /Notification Close/, /^Close$/]) {
      const b = f.getByRole("button", { name });
      if (await b.count().catch(() => 0)) await b.first().click({ timeout: 3000 }).catch(() => {});
    }
  }
}

export async function publish(shotDir) {
  const { browser, page } = await studioPage();
  const shot = async (n) => shotDir && page.screenshot({ path: `${shotDir}/${n}.png` });
  const studio = () => page.frames().find((f) => f.name() === "EmbeddedStudio");
  await dismissDialogs(page);
  const before = Date.now();
  // A click while Studio is still autosaving can be swallowed: retry until something happens
  for (let attempt = 1; attempt <= 4; attempt++) {
    await studio().locator('button[aria-label^="Publish"]').first().click();
    const end = Date.now() + 45_000;
    while (Date.now() < end) {
      const confirm = studio().getByRole("button", { name: /Publish this version/ });
      if (await confirm.count()) {
        await shot("1-publish-dialog");
        await confirm.first().click();
        await confirm.first().waitFor({ state: "detached", timeout: 180_000 });
      }
      // The success toast appears in the outer page, the confirm dialog (when shown) in Studio's frame
      const ok = [page, ...page.frames()].map((f) => f.getByText(/Publish successful/));
      if ((await Promise.all(ok.map((l) => l.count().catch(() => 0)))).some((n) => n > 0)) {
        await shot("2-after-publish");
        await dismissDialogs(page);
        await browser.close(); // disconnects only; Studio keeps running
        return Math.round((Date.now() - before) / 1000);
      }
      await page.waitForTimeout(1500);
    }
  }
  await shot("publish-failed");
  await browser.close();
  throw new Error("Publish didn't complete (see publish-failed.png)");
}

if (process.argv[2] === "publish") {
  console.log(`Published in ${await publish(process.argv[3])} s.`);
}

// Saves through the Save button and waits until Studio reports nothing left to save.
export async function save() {
  const { browser, page } = await studioPage();
  await dismissDialogs(page); // the "Welcome to Power Apps Studio" dialog blocks the command bar on a fresh load
  const f = page.frames().find((x) => x.name() === "EmbeddedStudio");
  const btn = f.locator('button[aria-label^="Save"]').first();
  const disabled = () => btn.evaluate((b) => b.disabled || b.getAttribute("aria-disabled") === "true");
  let clicked = false;
  for (let i = 0; i < 60; i++) {
    if (!(await disabled())) { await btn.click(); clicked = true; }
    else if (clicked || i > 2) break;
    await page.waitForTimeout(2000);
  }
  await browser.close();
  return clicked;
}
if (process.argv[2] === "save") console.log("save clicked:", await save());
