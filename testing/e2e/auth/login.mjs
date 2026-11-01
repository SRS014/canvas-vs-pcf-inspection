// One-time (or when the session expires): opens the app in the dedicated profile and waits
// for you to sign in. After that, tests and the demo recorder reuse the saved session.
//   npm run login
import { chromium } from "@playwright/test";
import { PROFILE_DIR, playUrl, LOGIN_HINT } from "../lib/env.mjs";

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: false, viewport: { width: 1280, height: 800 } });
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(playUrl("app1", { login_hint: LOGIN_HINT }));
console.log(`Sign in as ${LOGIN_HINT} in the browser window (waiting up to 10 minutes)...`);
const deadline = Date.now() + 10 * 60_000;
let ok = false;
while (Date.now() < deadline) {
  const app = page.frameLocator("#fullscreen-app-host");
  if (await app.locator('[data-control-name="btnHomeNew"]').count().catch(() => 0)) { ok = true; break; }
  // The player sometimes asks to allow the app's connections the first time
  const allow = page.getByRole("button", { name: /^Allow$/ });
  if (await allow.count().catch(() => 0)) await allow.first().click().catch(() => {});
  await page.waitForTimeout(3000);
}
console.log(ok ? "Signed in: the app loaded. Session saved." : "Timed out before the app loaded.");
await ctx.close();
process.exit(ok ? 0 : 1);
