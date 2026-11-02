// Turns the raw recording + narration clips into demo/out/<demo>/<video name>.mp4,
// matching .srt and .vtt caption files and a poster frame.
//
// Long waits are shortened: where nothing is said for more than MAX_WAIT seconds (a flow running), the
// edit keeps the first KEEP_AFTER and the last KEEP_BEFORE seconds and cuts the middle. A small label
// ("Skipped 9 s of waiting") shows at each cut, because the narration says the flow times are real.
// Voice and captions shift with the cuts. The cuts are listed in demo/out/<demo>/cuts.json.
//   node demo/mux.mjs            (MAX_WAIT=0 node demo/mux.mjs keeps every wait)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ffmpeg from "ffmpeg-static";
import { ROOT } from "../lib/env.mjs";

const DEMO = process.env.DEMO ?? "app1";
const OUT = join(ROOT, "demo", "out", DEMO);
const NAME = { app1: "equipment-inspections-demo", app2: "rules-driven-inspections-demo" }[DEMO];
// "About 4 s": waits up to 4.5 s stay as they are (cutting a fraction of a second only adds a jump).
const MAX_WAIT = Number(process.env.MAX_WAIT ?? 4.5), KEEP_AFTER = 1.5, KEEP_BEFORE = 2.0, LABEL_S = 2.0;
const FONT = "C\\:/Windows/Fonts/segoeuib.ttf";
const stamp = (t) => {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = String(Math.floor(ms / 3600000)).padStart(2, "0"), m = String(Math.floor(ms / 60000) % 60).padStart(2, "0");
  const s = String(Math.floor(ms / 1000) % 60).padStart(2, "0"), r = String(ms % 1000).padStart(3, "0");
  return `${h}:${m}:${s},${r}`;
};

// Silent waits between narration lines, in seconds from content start: [{from, to}] to cut out.
export function findCuts(timeline, contentStart) {
  const lines = [...timeline].sort((a, b) => a.start - b.start);
  const cuts = [];
  for (let i = 1; i < lines.length; i++) {
    const quietFrom = lines[i - 1].end - contentStart, quietTo = lines[i].start - contentStart;
    if (MAX_WAIT > 0 && quietTo - quietFrom > MAX_WAIT) cuts.push({ from: quietFrom + KEEP_AFTER, to: quietTo - KEEP_BEFORE });
  }
  return cuts;
}
// Content time -> edited time
const shift = (cuts) => (t) => t - cuts.reduce((s, c) => s + Math.min(Math.max(t - c.from, 0), c.to - c.from), 0);

export async function mux() {
  const { contentStart, contentEnd, timeline, captions = timeline } = JSON.parse(readFileSync(join(OUT, "timeline.json"), "utf8"));
  const length = contentEnd - contentStart;
  const cuts = findCuts(timeline, contentStart);
  const edit = shift(cuts);
  const kept = [];
  let from = 0;
  for (const c of cuts) { kept.push([from, c.from]); from = c.to; }
  kept.push([from, length]);
  const edited = edit(length);

  const mp4 = join(OUT, `${NAME}.mp4`);
  const args = ["-y", "-ss", contentStart.toFixed(3), "-t", length.toFixed(3), "-i", join(OUT, "demo-raw.webm")];
  for (const l of timeline) args.push("-i", l.file);
  const select = kept.map(([a, b]) => `between(t\\,${a.toFixed(3)}\\,${b.toFixed(3)})`).join("+");
  const labels = cuts.map((c) => {
    const at = edit(c.from), secs = Math.round(c.to - c.from);
    return `drawtext=fontfile='${FONT}':text='Skipped ${secs} s of waiting':fontsize=20:fontcolor=white:` +
      `box=1:boxcolor=0x0B5F7E@0.92:boxborderw=12:x=w-tw-36:y=96:enable='between(t\\,${at.toFixed(2)}\\,${(at + LABEL_S).toFixed(2)})'`;
  });
  const video = `[0:v]fps=25,select='${select}',setpts=N/25/TB${labels.length ? "," + labels.join(",") : ""}[vout]`;
  const delays = timeline.map((l, i) => `[${i + 1}:a]aresample=48000,adelay=${Math.round(edit(l.start - contentStart) * 1000)}:all=1[a${i}]`);
  const mix = `${timeline.map((_, i) => `[a${i}]`).join("")}amix=inputs=${timeline.length}:normalize=0,apad[aout]`;
  args.push("-filter_complex", `${video};${delays.join(";")};${mix}`, "-map", "[vout]", "-map", "[aout]",
    "-t", edited.toFixed(3), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "25",
    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", mp4);
  execFileSync(ffmpeg, args, { stdio: "ignore" });

  const srt = captions.map((l, i) =>
    `${i + 1}\n${stamp(edit(l.start - contentStart))} --> ${stamp(edit(l.end - contentStart))}\n${l.text}\n`).join("\n");
  writeFileSync(join(OUT, `${NAME}.srt`), srt);
  // WebVTT for the <track> element on the portfolio page
  writeFileSync(join(OUT, `${NAME}.vtt`), "WEBVTT\n\n" + srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2"));
  writeFileSync(join(OUT, "cuts.json"), JSON.stringify({ maxWait: MAX_WAIT, keepAfter: KEEP_AFTER, keepBefore: KEEP_BEFORE,
    recorded: +length.toFixed(2), edited: +edited.toFixed(2),
    cuts: cuts.map((c) => ({ from: +c.from.toFixed(2), to: +c.to.toFixed(2), skipped: +(c.to - c.from).toFixed(2), at: +edit(c.from).toFixed(2) })) }, null, 2));
  execFileSync(ffmpeg, ["-y", "-ss", "2", "-i", mp4, "-frames:v", "1", "-q:v", "3", join(OUT, `${NAME}-poster.jpg`)], { stdio: "ignore" });
  console.log(`Video: ${mp4} (${edited.toFixed(0)} s; ${cuts.length} wait(s) shortened, ${(length - edited).toFixed(0)} s cut), captions .srt/.vtt and poster written.`);
}
if (process.argv[1]?.endsWith("mux.mjs")) await mux();
