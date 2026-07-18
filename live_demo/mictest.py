# -*- coding: utf-8 -*-
"""Do tin hieu cac mic. Chay: python mictest.py [giay]
In muc am luong lon nhat cua tung thiet bi input (MME).
Neu truyen so giay > 0 thi hien thanh do song song de ban vua noi vua xem.
"""
import sys
import time

import numpy as np
import sounddevice as sd

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def list_mme_inputs():
    devs = []
    for i, d in enumerate(sd.query_devices()):
        if d["max_input_channels"] > 0 and sd.query_hostapis(d["hostapi"])["name"] == "MME":
            devs.append((i, d["name"]))
    return devs


def scan(seconds=4):
    print(f"Do {seconds}s tren tung mic (cu noi lien tuc trong luc do)...\n")
    for i, name in list_mme_inputs():
        try:
            a = sd.rec(int(seconds * 16000), samplerate=16000, channels=1,
                       dtype="float32", device=i)
            sd.wait()
            peak = float(np.abs(a).max())
            rms = float(np.sqrt(np.mean(a ** 2)))
            verdict = "TOT" if peak > 0.05 else ("YEU" if peak > 0.005 else "GAN NHU CAM")
            print(f"[{i}] {name}")
            print(f"    peak={peak:.5f}  rms={rms:.5f}  -> {verdict}")
        except Exception as e:
            print(f"[{i}] {name}\n    LOI: {e}")
    print("\nChuan: peak > 0.05 khi noi binh thuong. 'GAN NHU CAM' = chinh"
          " Input volume trong Windows (Settings > System > Sound > Input).")


def live_meter(seconds):
    """Thanh do am luong truc tiep tren mic mac dinh."""
    print("Noi vao mic, nhin thanh do (Ctrl+C thoat):")
    t_end = time.time() + seconds

    def cb(indata, frames, t, status):
        rms = float(np.sqrt(np.mean(indata[:, 0] ** 2)))
        bar = "#" * min(60, int(rms * 2000))
        print(f"\r{rms:.5f} |{bar:<60}|", end="", flush=True)

    with sd.InputStream(samplerate=16000, channels=1, dtype="float32",
                        blocksize=1600, callback=cb):
        while time.time() < t_end:
            time.sleep(0.1)
    print()


if __name__ == "__main__":
    dur = float(sys.argv[1]) if len(sys.argv) > 1 else 0
    scan()
    if dur > 0:
        live_meter(dur)
