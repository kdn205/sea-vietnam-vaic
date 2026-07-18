# 0008 Offline Speaker Diarization Boundary

Date: 2026-07-19

## Status

Accepted

## Context

The app needs a speaker diarization experiment without coupling recorded audio
to Gemini, speech recognition, or translation. The implementation also requires
native audio capture, downloadable ONNX models, and CPU inference that Expo Go
does not bundle.

## Decision

Implement diarization as a separate route and processing module. Capture mono
16 kHz PCM audio with `@siteed/audio-studio`, store models under the app document
directory with `expo-file-system`, and run segmentation, embedding, and
clustering locally through `@siteed/sherpa-onnx.rn`.

The baseline does not implement or claim graph-based speaker change detection.
That method remains a separate future evaluation.

## Alternatives Considered

1. Add diarization to the Gemini translation flow. Rejected because it violates
   the required offline and independent boundary.
2. Run diarization on a remote service. Rejected for this baseline because it
   uploads audio and introduces network latency and availability dependencies.
3. Treat the current Sherpa-ONNX baseline as graph-based change detection.
   Rejected because the implementation does not provide that algorithm.

## Consequences

Positive:

- Recorded audio remains on-device.
- Diarization latency does not delay translation because the flows are separate.
- The processing module can later be replaced without changing Gemini code.

Tradeoffs:

- A custom development build is required.
- The universal development APK is large because it contains native libraries
  for multiple Android ABIs.
- Model download and extraction need explicit progress and error handling.

## Follow-Up

- Evaluate graph-based speaker change detection as a separate method.
- Add device-level accuracy and latency measurements using representative
  multi-speaker recordings.
