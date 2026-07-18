# -*- coding: utf-8 -*-
"""Test cach ly nguoi noi: A noi that (to), B ngoi canh - mic B nghe ke
cung cau do o muc 8%. Ky vong: chi A duoc ghi nhan, B bi loc."""
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
URL = sys.argv[1] if len(sys.argv) > 1 else "wss://localhost:8443/ws"


async def phone(name, lang, audio, results):
    import websockets

    ssl_ctx = None
    if URL.startswith("wss"):
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE

    async with websockets.connect(URL, ssl=ssl_ctx, max_size=None) as ws:
        await ws.send(json.dumps({"type": "join", "name": name, "lang": lang}))

        async def listen():
            async for msg in ws:
                m = json.loads(msg)
                if m.get("type") in ("final", "drop"):
                    results.append(m)

        task = asyncio.create_task(listen())
        for _ in range(20):
            await ws.send(((np.random.randn(640) * 1e-4 * 32768).astype(np.int16)).tobytes())
            await asyncio.sleep(0.02)
        for i in range(0, len(audio), 1600):
            await ws.send((np.clip(audio[i:i + 1600] * 32768, -32768, 32767).astype(np.int16)).tobytes())
            await asyncio.sleep(0.1)  # toc do thoi gian thuc
        for _ in range(10):
            await ws.send(np.zeros(1600, dtype=np.int16).tobytes())
            await asyncio.sleep(0.1)
        await asyncio.sleep(3)
        task.cancel()


async def main():
    audio = load_audio(os.path.join(BENCH, "audio", "vi4.mp3"))
    results = []
    print("A (chinh chu, 100% am luong) + B (ngoi canh, nghe ke 8%)\n")
    await asyncio.gather(
        phone("A_chinh_chu", "vi", audio, results),
        phone("B_ngoi_canh", "vi", audio * 0.08, results),
    )
    # mo phong man hinh client: final tao bubble, drop xoa bubble
    screen = {}
    for m in results:
        if m["type"] == "final":
            screen[m["id"]] = m
        else:  # drop
            screen.pop(m["id"], None)
    for m in screen.values():
        print(f"  [{m['name']}] {m['text']}")
    names = {m["name"] for m in screen.values()}
    ok = "A_chinh_chu" in names and "B_ngoi_canh" not in names
    print("\nTEST " + ("PASS: man hinh chi con chinh chu" if ok
                       else f"FAIL: tren man hinh co {names}"))


if __name__ == "__main__":
    asyncio.run(main())
