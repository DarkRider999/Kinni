#!/usr/bin/env python3
"""Regenerates the synthetic WAV fixtures used by scripts/e2e-smoke.mjs.

Each fixture is a punchy kick-like transient at a known BPM, plus a quiet
sustained triad at a known key -- enough to exercise real BPM/key detection
end to end without needing any licensed audio content. Run from this
directory: `python3 make-fixtures.py .`
"""
import math
import struct
import sys
import wave

SR = 44100


def write(path: str, bpm: float, seconds: float, root_hz: float, minor: bool) -> None:
    n = int(seconds * SR)
    period = 60.0 / bpm
    kick_len = int(0.05 * SR)  # 50 ms, closer to a real drum hit than a pure click
    buf = [0.0] * n
    t = 0.0
    while t < seconds:
        start = int(t * SR)
        for i in range(kick_len):
            if start + i < n:
                buf[start + i] += 0.9 * math.exp(-30.0 * i / kick_len) * math.sin(2 * math.pi * 90 * i / SR)
        t += period

    third = 2 ** (3 / 12) if minor else 2 ** (4 / 12)
    fifth = 2 ** (7 / 12)
    for i in range(n):
        s = (
            math.sin(2 * math.pi * root_hz * i / SR)
            + math.sin(2 * math.pi * root_hz * third * i / SR)
            + math.sin(2 * math.pi * root_hz * fifth * i / SR)
        )
        buf[i] += 0.05 * s  # quiet relative to the kick, like a pad sitting under drums

    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = b"".join(
            struct.pack("<h", max(-32768, min(32767, int(max(-1.0, min(1.0, s)) * 32767))))
            for s in buf
        )
        w.writeframes(frames)


if __name__ == "__main__":
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    write(f"{out_dir}/trackA_128_Cmaj.wav", 128.0, 15.0, 261.63, minor=False)
    write(f"{out_dir}/trackB_130_Amin.wav", 130.0, 15.0, 220.00, minor=True)
    print("wrote trackA_128_Cmaj.wav and trackB_130_Amin.wav")
