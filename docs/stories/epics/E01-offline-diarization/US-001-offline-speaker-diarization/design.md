# Design

## Domain Model

`OfflineDiarizationOutput` contains total duration, speaker count, and ordered
segments. Each segment contains a numeric local speaker id, display label, and
millisecond start/end times.

## Application Flow

1. Check whether both model files exist.
2. Download and extract missing models with progress callbacks.
3. Initialize the native diarization engine once.
4. Record a mono 16 kHz PCM WAV file.
5. Process the local file with automatic or requested speaker count.
6. Map native seconds and speaker ids into the UI output contract.
7. Release the native engine when leaving the route.

## Interface Contract

The dedicated route reports model, recording, processing, completion, and error
states. It disables invalid actions while an operation is active.

The processing module exports:

- `isOfflineDiarizationInstalled`
- `installOfflineDiarization`
- `diarizeAudioFile`
- `releaseOfflineDiarization`

## Data Model

No server or database schema changes are introduced. Model files live under the
application document directory. Recordings are managed by the native audio
recorder.

## UI / Platform Impact

- Native tabs add a Diarization destination without altering the home route.
- Web navigation may expose the page, but the page explains that a native build
  is required.
- Android/iOS builds include the audio and Sherpa-ONNX config plugins.

## Observability

The UI exposes progress and error messages. No audio, model contents, or speaker
segments are logged or uploaded.

## Alternatives Considered

1. Reuse the deleted Explore route name. Rejected because the redesigned target
   app removed that product surface.
2. Embed diarization in the translation screen. Rejected to preserve latency and
   data-flow isolation.
3. Add a remote diarization API. Rejected for the offline baseline.
