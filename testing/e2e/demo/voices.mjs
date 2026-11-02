// Prepares one audio clip per narration line and measures it.
// Finished clips win: demo/voice/<demo>/<id>.wav|.m4a|.mp3. Missing lines get a placeholder from the
// built-in Windows voice (System.Speech), so the video can be timed before the clips exist.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ffmpeg from "ffmpeg-static";
import { ROOT } from "../lib/env.mjs";

const DEMO = process.env.DEMO ?? "app1";
const VOICE_DIR = join(ROOT, "demo", "voice", DEMO);
const OUT = join(ROOT, "demo", "out", DEMO, "audio");
mkdirSync(OUT, { recursive: true });
const PLACEHOLDER_VOICE = process.env.DEMO_TTS_VOICE ?? "Microsoft David Desktop";

function speak(text, file) {
  const ps = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; ` +
    `$s.SelectVoice('${PLACEHOLDER_VOICE}'); $s.Rate = 0; $s.SetOutputToWaveFile('${file}'); ` +
    `$s.Speak([IO.File]::ReadAllText('${file}.txt')); $s.Dispose()`;
  writeFileSync(`${file}.txt`, text, "utf8");
  execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], { stdio: "ignore" });
}
function duration(file) {
  try { execFileSync(ffmpeg, ["-i", file], { stdio: "pipe" }); } catch (e) {
    const m = String(e.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/);
    if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  }
  throw new Error(`Couldn't read the duration of ${file}`);
}

export async function prepareVoices() {
  const { allLines } = await import(`./narration-${DEMO}.mjs`);
  const lines = allLines.map((l) => {
    const own = ["wav", "m4a", "mp3"].map((x) => join(VOICE_DIR, `${l.id}.${x}`)).find(existsSync);
    let file = own;
    if (!file) {
      file = join(OUT, `${l.id}.wav`);
      speak(l.text, file);
    }
    return { ...l, file, own: !!own, seconds: duration(file) };
  });
  writeFileSync(join(OUT, "lines.json"), JSON.stringify(lines, null, 2));
  const mine = lines.filter((l) => l.own).length;
  console.log(`Narration: ${lines.length} lines, ${mine} in your voice, ${lines.length - mine} placeholder. ` +
    `Total ${lines.reduce((t, l) => t + l.seconds, 0).toFixed(0)} s.`);
  return lines;
}
if (process.argv[1]?.endsWith("voices.mjs")) await prepareVoices();
