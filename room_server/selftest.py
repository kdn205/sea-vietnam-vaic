# -*- coding: utf-8 -*-
"""Gia lap 2 dien thoai join room va noi (khong can mic).
Chay server truoc: python server.py   (o cua so khac)
Roi:               python selftest.py [wss URL, mac dinh ws://localhost:8000/ws]
"""
import asyncio
import json
import os
import ssl
import sys
import time

import numpy as np

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "benchmark"))
from bench_cpu import load_audio  # noqa: E402

BENCH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "benchmark")
URL = sys.argv[1] if len(sys.argv) > 1 else "ws://localhost:8000/ws"


async def phone(name, lang, file_ids, results, code_future, is_creator=False):
    import websockets

    ssl_ctx = None
    if URL.startswith("wss"):
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE

    join = {"type": "join", "name": name, "lang": lang}
    if is_creator:
        join["create"] = True
    else:
        join["room"] = await code_future  # cho nguoi tao phong bao ma

    async with websockets.connect(URL, ssl=ssl_ctx, max_size=None) as ws:
        await ws.send(json.dumps(join))

        async def listen():
            async for msg in ws:
                m = json.loads(msg)
                if m.get("type") == "joined" and is_creator:
                    print(f"  Phong duoc tao: {m['room']}")
                    code_future.set_result(m["room"])
                if m.get("type") == "final":
                    results.append(m)
                if m.get("type") in ("partial", "final") and name == "Giap":
                    tag = "NHAP " if m["type"] == "partial" else "FINAL"
                    print(f"  [{tag}] {m['name']}({m['lang']}): {m['text']}")
                    print(f"          => {m['translation']}")

        task = asyncio.create_task(listen())

        # 0.6s nhieu nen de VAD chinh nguong
        for _ in range(20):
            await ws.send(((np.random.randn(640) * 1e-4 * 32768).astype(np.int16)).tobytes())
            await asyncio.sleep(0.01)

        for fid in file_ids:
            audio = load_audio(os.path.join(BENCH, "audio", f"{fid}.mp3"))
            for i in range(0, len(audio), 1600):
                await ws.send((np.clip(audio[i:i + 1600] * 32768, -32768, 32767).astype(np.int16)).tobytes())
                await asyncio.sleep(0.01)
            for _ in range(12):  # im lang -> ket thuc cau
                await ws.send(np.zeros(1600, dtype=np.int16).tobytes())
                await asyncio.sleep(0.01)
            await asyncio.sleep(1.0)

        await asyncio.sleep(4)
        task.cancel()


async def main():
    results = []
    print("3 'dien thoai' NOI CUNG LUC: Giap (vi) + Sarah (en) + Nam (vi)\n")
    t0 = time.perf_counter()
    code_future = asyncio.get_running_loop().create_future()
    await asyncio.gather(
        phone("Giap", "vi", ["vi1", "vi4"], results, code_future, is_creator=True),
        phone("Sarah", "en", ["en3", "en4"], results, code_future),
        phone("Nam", "vi", ["vi5", "vi6"], results, code_future),
    )
    # moi nguoi noi 2 cau lien tiep -> server GOP thanh 1 bubble co du noi dung
    latest = {}
    for m in results:
        latest[m["id"]] = m
    by_name = {}
    for m in latest.values():
        by_name.setdefault(m["name"], []).append(m["text"])
    expects = {
        "Giap": ["Xin chào", "biên bản ghi nhớ"],
        "Sarah": ["schedule", "contract terms"],
        "Nam": ["báo cáo tài chính", "thị trường"],
    }
    ok = True
    for name, needles in expects.items():
        joined = " ".join(by_name.get(name, []))
        got = all(n.lower() in joined.lower() for n in needles)
        merged = len(by_name.get(name, [])) == 1
        print(f"  {name}: du noi dung={got} | gop thanh 1 bubble={merged}")
        ok = ok and got
    print(f"\n(tong {time.perf_counter()-t0:.0f}s)")
    print("SELFTEST " + ("PASS" if ok else "FAIL (thieu noi dung cau)"))


if __name__ == "__main__":
    asyncio.run(main())
