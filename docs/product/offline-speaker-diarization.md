# Offline Speaker Diarization

## Purpose

Speaker diarization is an independent mobile feature that records a local audio
sample and returns a timeline of speaker-labelled segments.

It is not part of speech recognition, translation, Gemini explanation, or
Gemini summarization flows. Audio captured by this feature must not be sent to
Gemini or the translation pipeline.

## User Flow

1. Open the Diarization tab.
2. Download the segmentation and speaker-embedding models once.
3. Choose automatic speaker-count estimation or a known count.
4. Record mono 16 kHz PCM audio.
5. Stop recording and wait for on-device processing.
6. Review speaker labels and timestamp ranges.

The initial model download requires network access. Recording and diarization
run locally after both models are installed.

## Platform Contract

- Android and iOS require a development or production build containing the
  native audio and Sherpa-ONNX modules.
- Web may render navigation, but the diarization engine is unavailable.
- Model files are stored in the app document directory and remain until app
  data is cleared or the app removes them.

## Output Contract

The processing layer returns:

- total audio duration in milliseconds;
- estimated or requested number of speakers;
- ordered segments containing a speaker id, display label, start time, and end
  time.

Speaker labels are local ordinal labels such as `Speaker 1`; they do not identify
real people.

## Current Method

The baseline uses a Pyannote segmentation ONNX model, a CAM++ speaker embedding
model, and Sherpa-ONNX diarization/clustering on CPU.

Graph-based speaker change detection is not implemented by this baseline and
must not be claimed as completed.

## Privacy and Failure Behavior

- Recorded audio stays on the device.
- A failed model download or extraction leaves the feature unavailable and
  reports an error.
- The UI must disable recording while models are unavailable or processing is
  active.
- Releasing the screen releases the native diarization engine.
