"""Gentle, stationary-noise reduction (fan, room hum) for voice clips. Speech is left alone; only noise is lowered.

  python -I gentle_denoise.py IN OUT [--max-db 12] [--profile NOISE_SOURCE]

How: STFT (43 ms windows) -> noise spectrum = mean of the clip's quietest 15% frames (or of --profile's) ->
Wiener-style gain per bin, never below -max_db -> gains smoothed across time and frequency so there's no
"musical noise" -> inverse STFT. Prints noise floor, speech level and per-band change, before and after.
Digital silence (padding) is ignored when measuring.
"""
import argparse

import librosa
import numpy as np
import soundfile as sf
from scipy.ndimage import uniform_filter

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("dst")
ap.add_argument("--max-db", type=float, default=12.0)
ap.add_argument("--profile")
ap.add_argument("--quiet-pct", type=float, default=15.0)
ap.add_argument("--oversub", type=float, default=1.5)
args = ap.parse_args()

y, sr = sf.read(args.src, dtype="float32")
if y.ndim > 1:
    y = y.mean(axis=1)
N_FFT = 2048 if sr >= 32000 else 1024
HOP = N_FFT // 4


def frame_db(x):
    r = librosa.feature.rms(y=x, frame_length=N_FFT, hop_length=HOP)[0]
    return 20 * np.log10(r + 1e-9)


def noise_spectrum(x):
    S = np.abs(librosa.stft(x, n_fft=N_FFT, hop_length=HOP))
    db = frame_db(x)[:S.shape[1]]
    live = db > -80  # ignore digital silence (padding)
    quiet = live & (db <= np.percentile(db[live], args.quiet_pct))
    return S[:, quiet].mean(axis=1)


noise = noise_spectrum(sf.read(args.profile, dtype="float32")[0] if args.profile else y)
X = librosa.stft(y, n_fft=N_FFT, hop_length=HOP)
power, npow = np.abs(X) ** 2, (noise ** 2)[:, None]
floor = 10 ** (-args.max_db / 20)
gain = np.maximum(1.0 - args.oversub * npow / np.maximum(power, 1e-12), 0.0) ** 0.5  # Wiener-style, with oversubtraction
gain = np.maximum(gain, floor)
gain = uniform_filter(gain, size=(3, 5), mode="nearest")  # 3 bins x 5 frames: smooth, no warbles
gain = np.maximum(gain, floor)
out = librosa.istft(X * gain, hop_length=HOP, length=len(y)).astype("float32")
sf.write(args.dst, out, sr, subtype="PCM_16" if args.dst.endswith(".wav") else None)


def report(name, x):
    db = frame_db(x)
    live = db > -80
    q, s = np.percentile(db[live], 10), np.percentile(db[live], 90)
    return q, s


qa, sa = report("before", y)
qb, sb = report("after", out)
print(f"noise floor (p10 of non-silent frames): {qa:.1f} -> {qb:.1f} dBFS  ({qa - qb:.1f} dB removed)")
print(f"speech level (p90):                     {sa:.1f} -> {sb:.1f} dBFS  ({sb - sa:+.1f} dB)")
f = librosa.fft_frequencies(sr=sr, n_fft=N_FFT)
quiet_mask = frame_db(y)[:X.shape[1]]
quiet_mask = (quiet_mask > -80) & (quiet_mask <= np.percentile(quiet_mask[quiet_mask > -80], 15))
for lo, hi in [(20, 120), (120, 300), (300, 1000), (1000, 3000), (3000, 6000), (6000, 12000)]:
    m = (f >= lo) & (f < hi)
    before = np.abs(X[m][:, quiet_mask]).mean()
    after = np.abs((X * gain)[m][:, quiet_mask]).mean()
    print(f"  {lo:>5}-{hi:<5} Hz noise reduced by {20 * np.log10(before / max(after, 1e-12)):4.1f} dB")
