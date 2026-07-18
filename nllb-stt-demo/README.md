# NLLB-STT Demo

**Bidirectional English ↔ Vietnamese Speech-to-Text + Translation**

A complete demo that pairs Whisper (speech-to-text) with Facebook's NLLB-200 (translation) to convert spoken English or Vietnamese into text and translate it to the other language — all running locally.

## Pipeline

```
Audio  ─→  Whisper (STT)  ─→  Text (source)  ─→  NLLB-200  ─→  Text (target)
```

## Models

| Component | Model | Size |
|-----------|-------|------|
| Speech-to-text | [faster-whisper-small](https://github.com/SYSTRAN/faster-whisper) | ~460 MB |
| Translation | [facebook/nllb-200-distilled-600M](https://huggingface.co/facebook/nllb-200-distilled-600M) | ~1.2 GB |

Both are downloaded once and cached locally in `~/.cache/huggingface/hub/`.

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Download models (one-time)
python download_models.py

# 3. Launch the web app
python app.py

# 4. Open http://localhost:7860
```

## Usage

### Web UI (default)
- Record audio from your microphone or upload a file
- Select the source language (English or Vietnamese)
- Click "Transcribe & Translate"
- See the transcription and translation side by side

### CLI Mode
```bash
python app.py --cli
```
Lets you transcribe audio files or translate text directly in the terminal.

### Share with others
```bash
python app.py --share
```
Creates a temporary public URL via Gradio.

## Directory Structure

```
nllb-stt-demo/
├── app.py              # Gradio web UI + CLI
├── download_models.py  # One-time model downloader
├── requirements.txt
└── README.md
```
