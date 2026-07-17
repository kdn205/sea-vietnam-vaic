# -*- coding: utf-8 -*-
"""
Tao bo test audio bang edge-tts + file testset.json chua dap an chuan.

Chay: python make_testset.py
"""
import asyncio
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIO_DIR = os.path.join(HERE, "audio")

# (id, lang, voice, cau goc, ban dich chuan)
SENTENCES = [
    # --- Tieng Viet -> Anh ---
    ("vi1", "vi", "vi-VN-HoaiMyNeural",
     "Xin chào các anh chị, hôm nay chúng ta sẽ thảo luận về kế hoạch hợp tác giữa hai công ty.",
     "Hello everyone, today we will discuss the cooperation plan between our two companies."),
    ("vi2", "vi", "vi-VN-NamMinhNeural",
     "Bên mình đề xuất mức giá là hai trăm nghìn đô la Mỹ cho giai đoạn đầu tiên.",
     "We propose a price of two hundred thousand US dollars for the first phase."),
    ("vi3", "vi", "vi-VN-HoaiMyNeural",
     "Team mình sẽ follow up cái proposal này và confirm lại deadline với bên đối tác.",
     "Our team will follow up on this proposal and confirm the deadline with the partner."),
    ("vi4", "vi", "vi-VN-NamMinhNeural",
     "Chúng tôi mong muốn ký biên bản ghi nhớ trong quý ba năm nay.",
     "We would like to sign the memorandum of understanding in the third quarter of this year."),
    ("vi5", "vi", "vi-VN-HoaiMyNeural",
     "Anh có thể gửi cho tôi báo cáo tài chính của năm ngoái được không?",
     "Could you send me last year's financial report?"),
    ("vi6", "vi", "vi-VN-NamMinhNeural",
     "Sản phẩm của chúng tôi đã có mặt tại thị trường Singapore và Malaysia.",
     "Our products are already available in the Singapore and Malaysia markets."),
    # --- Tieng Anh -> Viet ---
    ("en1", "en", "en-SG-WayneNeural",
     "Thank you for coming to Singapore, we are excited about this partnership.",
     "Cảm ơn quý vị đã đến Singapore, chúng tôi rất hào hứng với quan hệ hợp tác này."),
    ("en2", "en", "en-SG-LunaNeural",
     "Our company specializes in artificial intelligence solutions for logistics.",
     "Công ty chúng tôi chuyên về các giải pháp trí tuệ nhân tạo cho ngành logistics."),
    ("en3", "en", "en-US-GuyNeural",
     "Can we schedule a follow-up meeting next Tuesday morning?",
     "Chúng ta có thể sắp xếp một cuộc họp tiếp theo vào sáng thứ Ba tuần sau không?"),
    ("en4", "en", "en-US-AriaNeural",
     "We need to finalize the contract terms before the end of this month.",
     "Chúng ta cần hoàn thiện các điều khoản hợp đồng trước cuối tháng này."),
]


async def synth(voice, text, path, tries=5):
    import edge_tts
    for i in range(tries):
        try:
            await edge_tts.Communicate(text, voice).save(path)
            return
        except edge_tts.exceptions.NoAudioReceived:
            if i == tries - 1:
                raise
            print(f"    (loi NoAudioReceived, thu lai {i + 2}/{tries}...)")
            await asyncio.sleep(2)


async def main():
    os.makedirs(AUDIO_DIR, exist_ok=True)
    testset = []
    for sid, lang, voice, text, translation in SENTENCES:
        path = os.path.join(AUDIO_DIR, f"{sid}.mp3")
        if not os.path.exists(path):
            print(f"Tao {sid}.mp3 ({voice})...")
            await synth(voice, text, path)
        testset.append({
            "id": sid, "lang": lang, "audio": path,
            "text_ref": text, "translation_ref": translation,
        })
    out = os.path.join(HERE, "testset.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(testset, f, ensure_ascii=False, indent=2)
    print(f"Xong: {len(testset)} cau -> {out}")


if __name__ == "__main__":
    asyncio.run(main())
