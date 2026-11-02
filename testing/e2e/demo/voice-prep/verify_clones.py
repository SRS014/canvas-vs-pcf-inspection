"""Check every cloned clip against the words it should say, and save word times for the captions.

Run with a Python that has faster-whisper (the voice-prep 'stt' venv):
  python -I verify_clones.py DEST WORK
Prints, per line: word accuracy, anything missing or changed, and the first/last word (a cut-off line loses its
last word). Writes WORK\\final_words.json ({id: [[start, end, word, prob], ...]}) for clone_captions.py.
"""
import json
import os
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

import subprocess

import numpy as np
from faster_whisper import WhisperModel

FFMPEG = r"D:\Master\02-Career\Content\Sohan\FusionVoiceStudio\.venv\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe"


def read_16k(path):
    raw = subprocess.run([FFMPEG, "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0

dest, work = Path(sys.argv[1]), Path(sys.argv[2])
SPEC = json.loads((Path(__file__).with_name(f"{os.environ.get('DEMO', 'app1')}-lines.json")).read_text(encoding="utf-8"))
spec = [line for scene in SPEC["scenes"] for line in scene["lines"]]
SNAP = Path(r"C:\Users\hp\.cache\huggingface\hub\models--Systran--faster-whisper-small.en\snapshots")
m = WhisperModel(str(next(SNAP.iterdir())), device="cpu", compute_type="int8", cpu_threads=2)
hint = "Sohan, Power Apps Canvas, Dataverse, forklifts, conveyors, criticality, hydraulics, spill kit, Power Fx, Playwright, GitHub."
norm =lambda t: [w for w in re.findall(r"[a-z0-9']+", t.lower().replace("’", "'").replace("-", " ").replace(",", ""))]

res, flagged = {}, []
for id_, say, _ in spec:
    if not (dest / f"{id_}.wav").is_file():  # a folder of retakes holds only some lines
        continue
    x = read_16k(dest / f"{id_}.wav")
    segs, _ = m.transcribe(x, beam_size=5, word_timestamps=True, initial_prompt=hint, condition_on_previous_text=False)
    words = [[round(w.start, 2), round(w.end, 2), w.word.strip(), round(w.probability, 2)] for s in segs for w in s.words]
    res[id_] = words
    heard = " ".join(w[2] for w in words)
    a, b = norm(say), norm(heard)
    sm = SequenceMatcher(a=a, b=b, autojunk=False)
    diffs = [(t, " ".join(a[i1:i2]), " ".join(b[j1:j2])) for t, i1, i2, j1, j2 in sm.get_opcodes() if t != "equal"]
    ratio = sum(k.size for k in sm.get_matching_blocks()) / max(len(a), 1)
    if diffs:
        flagged.append(id_)
    print(f"{id_} match {ratio:.0%} | {heard}" + (f"\n      differs: {diffs}" if diffs else ""), flush=True)
(work / "final_words.json").write_text(json.dumps(res, indent=1), encoding="utf-8")
print(f"\nlines with any difference: {flagged}")
