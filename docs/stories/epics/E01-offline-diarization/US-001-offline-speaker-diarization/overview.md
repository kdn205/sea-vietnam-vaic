# Overview

## Current Behavior

The redesigned target branch exposes the real-time translation experience on
its home route. It has no route for offline speaker diarization.

## Target Behavior

Users can open a separate Diarization tab, install the required models once,
record local audio, process it on-device, and view speaker-labelled timestamp
segments. The existing home, Gemini, recognition, and translation flows remain
unchanged.

## Affected Users

- Mobile developers building the native development client.
- Android/iOS testers evaluating the diarization baseline.

## Affected Product Docs

- `docs/product/offline-speaker-diarization.md`
- `docs/decisions/0008-offline-speaker-diarization-boundary.md`

## Non-Goals

- Graph-based speaker change detection.
- Speaker identity enrollment.
- Sending diarization audio to Gemini or another server.
