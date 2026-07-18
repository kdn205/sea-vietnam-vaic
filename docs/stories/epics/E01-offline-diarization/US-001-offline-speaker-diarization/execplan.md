# Exec Plan

## Goal

Integrate the existing offline speaker diarization baseline into the redesigned
mobile app as an independent, testable route.

## Scope

In scope:

- Native audio capture and local model installation.
- On-device diarization with timestamped speaker segments.
- A dedicated Diarization tab and route.
- Android/iOS development-build configuration.
- Documentation and validation evidence.

Out of scope:

- Gemini, speech recognition, or translation integration.
- Identity recognition for named speakers.
- Graph-based speaker change detection.
- Background or streaming diarization.

## Risk Classification

Risk flags:

- External systems: native libraries and model release downloads.
- Cross-platform: native Android/iOS engine with a web fallback.
- Existing behavior: adds navigation to the redesigned app.
- Weak proof: accuracy and device performance lack automated fixtures.

Hard gates:

- External provider/native SDK behavior.

## Work Phases

1. Preserve the target repository `main` in a separate worktree.
2. Add the product contract, decision, and story records.
3. Add native dependencies and config plugins.
4. Add the isolated processing module and route.
5. Integrate navigation without changing the home/translation flow.
6. Run dependency, type, Expo config, and diff validation.
7. Record proof and push only the feature branch.

## Stop Conditions

Pause for human confirmation if:

- The feature must alter Gemini or translation behavior.
- Graph-based change detection is required in this same branch.
- Existing home/session behavior must be replaced.
- Validation requirements need to be weakened.
