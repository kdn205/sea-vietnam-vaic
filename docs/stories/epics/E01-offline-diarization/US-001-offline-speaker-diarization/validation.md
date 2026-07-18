# Validation

## Proof Strategy

Prove that the dependency graph installs, TypeScript compiles, Expo resolves
the native plugins, navigation includes the isolated route, and the branch
contains no APK or unrelated `main` changes. Device accuracy and runtime
performance remain platform evidence.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Type checking for output mapping and UI states |
| Integration | Expo config resolves both native plugins and microphone permission |
| E2E | Manual model install, record, stop, and timeline review |
| Platform | Android development APK loads native modules and processes local audio |
| Performance | Measure processing time for recordings up to 15 seconds |
| Logs/Audit | Confirm no Gemini/network upload path receives recorded audio |

## Fixtures

- A short recording containing two alternating speakers.
- A recording with a known three-speaker sequence.
- Offline launch after models have already been installed.

## Commands

```text
npm install
npx tsc --noEmit
npx expo config --type public
git diff --check
```

## Acceptance Evidence

- `npm install`: passed; resolved `@siteed/audio-studio@3.2.1`,
  `@siteed/sherpa-onnx.rn@1.3.1`, and `expo-file-system@57.0.1`.
- `npx tsc --noEmit`: passed after adding the CSS module declaration required
  by existing web style imports.
- `npx expo config --type public`: passed and resolved both native plugins plus
  the existing microphone permission.
- `npx expo export --platform android`: passed; Metro bundled 2,039 modules and
  the temporary export directory was removed.
- `git diff --check`: passed.
- Device execution of this target-branch build remains pending; the previously
  built APK came from an older repository base and is not counted as proof for
  this branch.
