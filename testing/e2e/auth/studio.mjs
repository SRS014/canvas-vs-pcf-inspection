// Keeps Power Apps Studio open on the app (dedicated signed-in profile) with a CDP port, so the
// Canvas Authoring MCP can join the co-authoring session and lib/studio.mjs can Save/Publish.
//   node auth/studio.mjs app1   (runs until stopped)
import { chromium } from "@playwright/test";
import { PROFILE_DIR, ENV_ID, APP_IDS } from "../lib/env.mjs";

export const CDP_PORT = 9333;
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: process.env.HEADED ? false : true,
  viewport: { width: 1600, height: 900 },
  args: [`--remote-debugging-port=${CDP_PORT}`],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
const url = `https://make.powerapps.com/e/${ENV_ID}/canvas/?action=edit&app-id=${encodeURIComponent(`/providers/Microsoft.PowerApps/apps/${APP_IDS[process.argv[2] ?? "app1"]}`)}`;
await page.goto(url);
console.log("Studio loading...");
// Studio is ready when its command bar shows a Publish button. Since 2026-11 the command bar is inside the
// EmbeddedStudio iframe, so look in every frame, not just the top page.
const end = Date.now() + 300_000;
for (;;) {
  const found = await Promise.all(page.frames().map((f) =>
    f.locator('button[aria-label^="Publish"]').count().catch(() => 0)));
  if (found.some((n) => n > 0)) break;
  if (Date.now() > end) throw new Error("Studio didn't show its Publish button within 5 minutes");
  await page.waitForTimeout(2000);
}
console.log(`STUDIO READY on CDP port ${CDP_PORT}`);
await new Promise(() => {}); // stay open
