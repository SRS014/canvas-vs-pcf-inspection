"""Pick the most accurate take of each line from several seeds, using verify_clones.py's word files.

  python -I pick_takes.py WORK raw raw-seed7 raw-seed13
Expects WORK\\stage-<take>\\final_words.json for each take folder. Prints a table and the --pick arguments
for finish_clones.py. Ties go to the earlier take in the list.
"""
import json
import os
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

work, takes = Path(sys.argv[1]), sys.argv[2:]
SPEC = json.loads((Path(__file__).with_name(f"{os.environ.get('DEMO', 'app1')}-lines.json")).read_text(encoding="utf-8"))
spec = [line for scene in SPEC["scenes"] for line in scene["lines"]]
norm = lambda t: re.findall(r"[a-z0-9']+", t.lower().replace("’", "'").replace("-", " ").replace(",", ""))
DIGITS = {"52.5": "fifty two point five", "45": "forty five", "23": "twenty three", "12": "twelve", "15": "fifteen", "100": "one hundred", "5": "five", "6": "six", "7": "seven"}
heard = {t: json.loads((work / f"stage-{t}" / "final_words.json").read_text(encoding="utf-8")) for t in takes}
picks = []
for id_, say, _ in spec:
    scores = []
    for t in takes:
        if id_ not in heard[t]:  # a retake folder holds only the doubtful lines
            continue
        text = " ".join(w[2] for w in heard[t][id_])
        for d, words in DIGITS.items():  # Whisper writes spoken numbers as digits; that's not an error
            text = re.sub(rf"(?<![\d.]){re.escape(d)}(?![\d.])", words, text)
        text = text.replace("I am", "I'm")
        sm = SequenceMatcher(a=norm(say), b=norm(text), autojunk=False)
        scores.append((sum(b.size for b in sm.get_matching_blocks()) / len(norm(say)), t, text))
    best = max(scores, key=lambda s: (round(s[0], 3), -takes.index(s[1])))
    print(f"{id_}  " + "  ".join(f"{t}:{s:.0%}" for s, t, _ in scores) + f"  -> {best[1]}" +
          ("" if best[0] == 1 else f"   | {best[2]}"))
    if best[1] != "raw":
        picks.append(f"{id_}={best[1]}")
print("\n--pick " + " ".join(picks))
