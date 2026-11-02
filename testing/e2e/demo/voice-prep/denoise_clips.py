"""Light noise reduction on the final clips, then every clip back to the same loudness.

Run with Fusion Voice Studio's runtime venv (numpy, scipy, librosa, soundfile):
  python -I denoise_clips.py VOICE_DIR WORK FFMPEG [--max-db 8]
The noise profile comes from all clips joined, so every line loses the same noise. Clips before noise
reduction are kept in WORK\\before-nr. Prints the noise removed, as gentle_denoise.py measures it.
"""
import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

ap = argparse.ArgumentParser()
ap.add_argument("voice")
ap.add_argument("work")
ap.add_argument("ffmpeg")
ap.add_argument("--max-db", type=float, default=8.0)
ap.add_argument("--target", type=float, default=-16.0)
args = ap.parse_args()

voice, work, ff = Path(args.voice), Path(args.work), args.ffmpeg
before = work / "before-nr"
before.mkdir(parents=True, exist_ok=True)
clips = sorted(voice.glob("*.wav"))
for c in clips:
    if not (before / c.name).exists():  # a rerun starts again from the untouched clips
        shutil.copy(c, before / c.name)

joined = np.concatenate([sf.read(before / c.name, dtype="float32")[0] for c in clips])
sr = sf.info(clips[0]).samplerate
profile = work / "noise-profile.wav"
sf.write(profile, joined, sr)


def loudness(path):
    err = subprocess.run([ff, "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=framelog=quiet", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", err.rsplit("Summary:", 1)[-1])[0])


denoise = Path(__file__).with_name("gentle_denoise.py")
removed = []
for c in clips:
    tmp = work / f"nr-{c.name}"
    report = subprocess.run([sys.executable, "-I", str(denoise), str(before / c.name), str(tmp), "--max-db", str(args.max_db), "--profile", str(profile)],
                            check=True, capture_output=True, text=True).stdout
    removed.append(float(re.search(r"\(([\d.-]+) dB removed\)", report).group(1)))
    gain = args.target - loudness(tmp)
    subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-i", str(tmp), "-af",
                    f"volume={gain:.2f}dB,alimiter=limit=0.84:attack=3:release=60:level=disabled", "-ac", "1", "-c:a", "pcm_s16le", str(c)], check=True)
    tmp.unlink()
    print(f"{c.stem}: noise -{removed[-1]:.1f} dB, {loudness(c):.1f} LUFS", flush=True)
levels = [loudness(c) for c in clips]
print(f"Noise floor lowered: mean {np.mean(removed):.1f} dB (cap {args.max_db} dB). Loudness: {min(levels):.1f} to {max(levels):.1f} LUFS.")
