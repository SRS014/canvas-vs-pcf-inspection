# Voice prep: the cloned narration

The demo's voice is Sohan's own, cloned locally with [Fusion Voice Studio](https://srs014.github.io/) (Chatterbox Nano, 200-character chunks). Audio stays out of git, and nothing leaves the machine. Only clone your own voice.

Each demo has a lines file, such as `app1-lines.json`. Every line is `[id, what the voice says, caption text if it differs]`, with numbers written the way they're spoken. `DEMO` selects the file (`app1` by default), and `../voice/app1` below becomes `../voice/app2`.

Keep working files in a folder outside the repo, `WORK` below.

1. **Takes:** `clone_lines.py WORK` speaks every line. Then level them into `WORK/stage-raw` with `finish_clones.py WORK WORK/stage-raw`.
2. **Check:** `verify_clones.py WORK/stage-raw WORK/stage-raw` runs Whisper on each clip and lists what differs from the script.
3. **Retake doubtful lines:** `clone_lines.py WORK --only s04a,s06a --seed 7`, then again with `--seed 13`. Stage them with `finish_clones.py WORK WORK/stage-raw-seed7 --only s04a,s06a --pick s04a=raw-seed7 s06a=raw-seed7`, and check them the same way.
4. **Pick:** `pick_takes.py WORK raw raw-seed7 raw-seed13` chooses the most accurate take per line and prints the `--pick` arguments.
5. **Level:** `finish_clones.py WORK ../voice/app1 --pick ...` sets −16 LUFS, a −1.5 dBFS limiter, 48 kHz, 0.12 s of lead and 0.30 s of tail.
6. **Light noise reduction:** `denoise_clips.py ../voice/app1 WORK <ffmpeg>` caps the reduction at 8 dB, then brings every line back to −16 LUFS. Clips from before this step stay in `WORK/before-nr`. Run it with the runtime venv (numpy, scipy, librosa, soundfile).
7. **Captions:** `verify_clones.py ../voice/app1 WORK`, then `clone_captions.py WORK` writes `../narration-app1.mjs`.

Whisper is a guide, not the final word. It writes spoken numbers as digits, which isn't an error, and it can mishear a clean line. Check flagged lines by ear.
