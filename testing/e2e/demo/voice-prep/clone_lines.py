"""Speak the demo's lines in Sohan's cloned voice with Fusion Voice Studio's local engine (Chatterbox Nano).

Run with Fusion Voice Studio's venv (it supplies the engine, its memory/C: safety and pronunciations.json):
  D:\\Master\\02-Career\\Content\\Sohan\\FusionVoiceStudio\\.venv\\Scripts\\python.exe clone_lines.py WORK [--only s04b,s07a --seed 7]
Each line is one chunk (all are under the 200-character chunk size). Raw takes go to WORK\\raw (outside
the repo); finish_clones.py levels them into demo/voice/. Rerunning skips lines already made.
--only/--seed regenerate chosen lines with a different seed (a new take), into WORK\\raw-seed<N>.
"""
import argparse
import json
import os
from pathlib import Path
from types import SimpleNamespace

import fusion_voice.engines as engines
from fusion_voice.config import load_settings
from fusion_voice.engines import ChatterboxEngine
from fusion_voice.file_manager import FileManager
from fusion_voice.text_processor import apply_pronunciations, apply_shorthand, load_pronunciations

ap = argparse.ArgumentParser()
ap.add_argument("work")
ap.add_argument("--only", default="")
ap.add_argument("--seed", type=int, default=0)
args = ap.parse_args()

settings = load_settings()
assert settings.engine == "chatterbox-nano" and settings.local_chunk_chars == 200, (settings.engine, settings.local_chunk_chars)
SPEC = json.loads((Path(__file__).with_name(f"{os.environ.get('DEMO', 'app1')}-lines.json")).read_text(encoding="utf-8"))
spec = [line for scene in SPEC["scenes"] for line in scene["lines"]]
sounds = load_pronunciations(settings.root / "pronunciations.json")
ids = [i for i, _, _ in spec]
speech = [apply_pronunciations(apply_shorthand(say), sounds) for _, say, _ in spec]
assert all(len(t) <= settings.local_chunk_chars for t in speech), [len(t) for t in speech]

if args.seed:
    engines.SEED = args.seed  # a different take: part n uses seed SEED + n
raw = Path(args.work) / ("raw" if not args.seed else f"raw-seed{args.seed}")
raw.mkdir(parents=True, exist_ok=True)
only = set(filter(None, args.only.split(",")))
wanted = [k for k, i in enumerate(ids) if not only or i in only]
pending = [k for k in wanted if not (raw / f"part-{k + 1:03}.json").is_file()]
(raw / "ids.json").write_text(json.dumps(dict(zip([f"part-{k + 1:03}" for k in range(len(ids))], ids)), indent=1))
(raw / "speech.json").write_text(json.dumps(dict(zip(ids, speech)), indent=1, ensure_ascii=False), encoding="utf-8")
reference = json.loads(settings.reference_info.read_text(encoding="utf-8"))
print(f"{len(pending)} line(s) to speak, seed {engines.SEED}; reference: {reference.get('note')}", flush=True)
if pending:
    engine = ChatterboxEngine(settings, FileManager(settings.root), log=lambda m: print(m, flush=True))
    engine.preflight(SimpleNamespace(), sum(len(speech[k]) for k in pending))
    engine.synthesize(SimpleNamespace(chunks=speech), raw, pending)
print("done", flush=True)
