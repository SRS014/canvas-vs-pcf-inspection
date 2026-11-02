// The demo recorder's engine: Playwright drives the real app while captions (burned in) follow the
// narration; demo/mux.mjs then adds the voice track. Each demo script (record-app1.mjs) supplies the story.
import { chromium } from "@playwright/test";
import { mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROFILE_DIR, ROOT } from "../lib/env.mjs";
import { prepareVoices } from "./voices.mjs";
import { mux } from "./mux.mjs";

const SIZE = { width: 1280, height: 720 };
export const symbol = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' width='64' height='64'><defs><linearGradient id='r' gradientUnits='userSpaceOnUse' x1='10' y1='10' x2='54' y2='54'><stop offset='0' stop-color='#209CCB'/><stop offset='1' stop-color='#742774'/></linearGradient></defs><circle cx='32' cy='24.68' r='11.5' fill='none' stroke='url(#r)' stroke-width='5.4'/><circle cx='23.5' cy='39.4' r='11.5' fill='none' stroke='url(#r)' stroke-width='5.4'/><circle cx='40.5' cy='39.4' r='11.5' fill='none' stroke='url(#r)' stroke-width='5.4'/></svg>`;

const STYLE = `
  #demo-caption{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);max-width:1040px;z-index:2147483647;
    background:rgba(15,37,48,.86);color:#fff;font:600 22px/1.35 'Segoe UI',Arial,sans-serif;padding:10px 20px;border-radius:10px;
    text-align:center;box-shadow:0 4px 18px rgba(0,0,0,.25);transition:opacity .25s;opacity:0;pointer-events:none}
  #demo-chip{position:fixed;top:10px;right:300px;z-index:2147483646;background:#0B5F7E;color:#fff;
    font:700 13px 'Segoe UI',Arial;letter-spacing:.06em;text-transform:uppercase;padding:6px 12px;border-radius:999px;opacity:0;transition:opacity .25s;pointer-events:none}
  #demo-card{position:fixed;inset:0;z-index:2147483645;background:#EDF7FB;display:none;align-items:center;justify-content:center;
    font-family:'Segoe UI',Arial,sans-serif;color:#0F2530}
  #demo-card .bar{position:absolute;left:0;right:0;top:0;height:8px;background:linear-gradient(90deg,#209CCB,#742774,#E3008C)}
  #demo-card .box{background:#fff;border:1px solid #CBE2EC;border-radius:16px;padding:44px 56px;max-width:980px;position:relative;overflow:hidden}
  #demo-card .box:before{content:'';position:absolute;left:0;right:0;top:0;height:5px;background:linear-gradient(90deg,#209CCB,#742774,#E3008C)}
  #demo-card .eyebrow{color:#742774;font-weight:700;letter-spacing:.12em;font-size:15px;text-transform:uppercase;margin:14px 0 6px}
  #demo-card h1{font-size:46px;margin:0 0 10px;line-height:1.1}
  #demo-card p,#demo-card li{font-size:22px;line-height:1.45;color:#51646E;margin:6px 0}
  #demo-card ul{padding-left:24px;margin:14px 0 0}
  #demo-card .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:22px}
  #demo-card .stat{border:1px solid #CBE2EC;border-radius:12px;padding:14px 18px}
  #demo-card .stat b{display:block;font-size:34px;color:#0B5F7E}
  #demo-card .foot{margin-top:22px;font-size:16px;color:#51646E}`;

export async function createRecorder() {
  const demo = process.env.DEMO ?? "app1";
  const OUT = join(ROOT, "demo", "out", demo);
  const RAW = join(OUT, "raw");
  rmSync(RAW, { recursive: true, force: true });
  mkdirSync(RAW, { recursive: true });

  const { scenes } = await import(`./narration-${demo}.mjs`);
  const lines = await prepareVoices();
  const clip = Object.fromEntries(lines.map((l) => [l.id, l]));
  const timeline = []; // { id, text, file, start, end } in seconds from video start
  const captions = []; // { start, end, text }: one per caption phrase, for the .srt/.vtt
  const lineStart = {}, markStart = {};
  for (const l of lines) lineStart[l.id] = new Promise((r) => (markStart[l.id] = r));

  const context = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: SIZE, recordVideo: { dir: RAW, size: SIZE } });
  const page = context.pages()[0] ?? (await context.newPage());
  const videoStart = Date.now();
  const now = () => (Date.now() - videoStart) / 1000;
  const sleep = (ms) => page.waitForTimeout(ms);
  const until = async (t) => { const wait = t - now(); if (wait > 0) await sleep(wait * 1000); };

  const overlays = () => page.evaluate((css) => {
    if (document.getElementById("demo-caption")) return;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    for (const id of ["demo-caption", "demo-chip", "demo-card"]) {
      const el = document.createElement("div"); el.id = id; document.body.appendChild(el);
    }
  }, STYLE);
  const caption = (text) => page.evaluate((t) => { const c = document.getElementById("demo-caption"); if (t) c.textContent = t; c.style.opacity = t ? 1 : 0; }, text); // the text stays while it fades
  const chip = (text) => page.evaluate((t) => { const c = document.getElementById("demo-chip"); c.textContent = t; c.style.opacity = t ? 1 : 0; }, text);
  const card = (html) => page.evaluate((h) => {
    const c = document.getElementById("demo-card");
    c.innerHTML = h ? `<div class="bar"></div><div class="box">${h}</div>` : "";
    c.style.display = h ? "flex" : "none";
  }, html);

  // at(id, s): resolves `s` seconds after narration line `id` starts, so actions land on their words.
  const at = async (id, offset = 0) => until((await lineStart[id]) + offset);
  // gate(id): line `id` waits until the action calls open(id), so the voice never describes what isn't
  // on screen yet.
  const gateOpen = {}, gateWait = {};
  const gate = (...ids) => { for (const id of ids) gateWait[id] = new Promise((r) => (gateOpen[id] = r)); };
  const open = (id) => gateOpen[id]?.();

  // Speaks a scene's lines while `action` runs; ends when both are done.
  async function scene(name, action = async () => {}) {
    const s = scenes.find((x) => x.scene === name);
    const speaking = (async () => {
      for (const [id] of s.lines) {
        const l = clip[id];
        if (gateWait[id]) { await caption(""); await gateWait[id]; }
        const start = now();
        markStart[id](start);
        const cues = l.cues?.length ? l.cues : [[0, l.text]];
        for (const [k, [t, text]] of cues.entries()) {
          await until(start + t);
          await caption(text);
          captions.push({ start: start + t, end: start + (cues[k + 1]?.[0] ?? l.seconds), text });
        }
        await until(start + l.seconds + 0.25);
        timeline.push({ id, text: l.text, file: l.file, start, end: now() });
      }
      await caption("");
    })();
    await Promise.all([speaking, action()]);
  }

  // Closes the recording, keeps the main page's video and builds the MP4.
  async function finish({ contentStart, contentEnd }) {
    await page.close();
    await context.close();
    const webm = readdirSync(RAW).filter((f) => f.endsWith(".webm")).map((f) => join(RAW, f));
    webm.sort((a, b) => statSync(b).size - statSync(a).size);
    renameSync(webm[0], join(OUT, "demo-raw.webm"));
    writeFileSync(join(OUT, "timeline.json"), JSON.stringify({ contentStart, contentEnd, timeline, captions }, null, 2));
    await mux();
  }

  return { page, now, sleep, at, gate, open, scene, overlays, caption, chip, card, finish };
}
