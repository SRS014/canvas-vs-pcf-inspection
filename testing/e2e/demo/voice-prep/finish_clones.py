"""Level the cloned takes like the recorded clips were (finish.sh): linear gain to -16 LUFS, a -1.5 dBFS
limiter, 48 kHz 16-bit, plus 0.12 s of silence before and 0.30 s after each line.

Run with Fusion Voice Studio's venv (for its ffmpeg):
  ...\\FusionVoiceStudio\\.venv\\Scripts\\python.exe finish_clones.py WORK DEST [--pick s04b=raw-seed7 ...]
Takes come from WORK\\raw unless --pick names another take folder for a line. Never overwrites DEST files
that aren't clone outputs (it refuses if DEST holds files it didn't write).
"""
import argparse
import json
import re
import subprocess
from pathlib import Path

from fusion_voice.audio_tools import ffmpeg_exe

TARGET, LIMIT = -16.0, 0.84  # LUFS; 0.84 linear = -1.5 dBFS
ap = argparse.ArgumentParser()
ap.add_argument("work")
ap.add_argument("dest")
ap.add_argument("--pick", nargs="*", default=[])
ap.add_argument("--only", default="", help="level only these lines, to stage a folder of retakes")
args = ap.parse_args()
work, dest = Path(args.work), Path(args.dest)
picks = dict(p.split("=") for p in args.pick)
ids = json.loads((work / "raw" / "ids.json").read_text())  # part-NNN -> id
ff = ffmpeg_exe()
manifest = dest / "clones.json"
mine = set(json.loads(manifest.read_text())) if manifest.exists() else set()
foreign = [p.name for p in dest.glob("*.wav") if p.stem not in mine]
if foreign:
    raise SystemExit(f"{dest} holds clips this script didn't write ({foreign[:3]}...). Move them first.")


def loudness(path) -> float:
    err = subprocess.run([ff, "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=framelog=quiet", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", err.rsplit("Summary:", 1)[-1])[0])


done = {}
for part, id_ in ids.items():
    if args.only and id_ not in args.only.split(","):
        continue
    src = work / picks.get(id_, "raw") / f"{part}.wav"
    gain = TARGET - loudness(src)
    out = dest / f"{id_}.wav"
    subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-af",
                    f"volume={gain:.2f}dB,alimiter=limit={LIMIT}:attack=3:release=60:level=disabled,"
                    "aresample=48000,adelay=120:all=1,apad=pad_dur=0.30", "-ac", "1", "-c:a", "pcm_s16le", str(out)],
                   check=True)
    done[id_] = {"take": f"{picks.get(id_, 'raw')}/{part}.wav", "gain_db": round(gain, 2), "lufs": round(loudness(out), 1)}
    print(f"{id_} {done[id_]}", flush=True)
manifest.write_text(json.dumps(done, indent=1))
