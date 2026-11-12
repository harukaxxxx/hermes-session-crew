#!/usr/bin/env python3
"""Original deterministic synthesized impact; no sampled or external material."""
import math
import random
import struct
import wave
from pathlib import Path

rate = 48000
duration = 2.0
rng = random.Random(20261111)
samples = []
filtered = 0.0
for i in range(int(rate * duration)):
    t = i / rate
    # 100 ms silence aligns the transient with the 2.40 s visual landing.
    u = t - 0.1
    if u < 0:
        samples.append  (0.0)
        continue
    attack = min(1.0, u / 0.006)
    bass_phase = 2 * math.pi * (47 * u + 24 * 0.07 * (1 - math.exp(-u / 0.07)))
    bass = 0.8 * math.sin(bass_phase) * math.exp(-u / 0.32)
    filtered = 0.88 * filtered + 0.12 * (rng.random() * 2 - 1)
    thud = 0.35 * filtered * math.exp(-u / 0.065)
    # Inharmonic metal partials and a short warm horn-like harmonic body.
    metal = sum(a * math.sin(2 * math.pi * f * u) * math.exp(-u / d) for f, a, d in [(184, .13, .65), (277, .09, .5), (431, .055, .38), (693, .025, .25)])
    horn = 0.10 * (math.sin(2 * math.pi * 110 * u) + .32 * math.sin(2 * math.pi * 220 * u)) * math.exp(-u / .55)
    fade = min(1.0, max(0.0, (duration - t) / .12))
    samples.append(attack * (bass + thud + metal + horn) * fade)
peak = max(abs(x) for x in samples)
gain = 0.40 / peak
with wave.open(str(Path(__file__).with_name('ending-impact-v4.wav')), 'wb') as wav:
    wav.setparams((1, 2, rate, len(samples), 'NONE', 'not compressed'))
    wav.writeframes(b''.join(struct.pack('<h', round(x * gain * 32767)) for x in samples))
print(f'{duration}s mono {rate}Hz, sample peak {max(abs(x * gain) for x in samples):.4f}')
