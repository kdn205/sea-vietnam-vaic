import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { onTranslateTask } from 'expo-translate-text';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Network from 'expo-network';
import * as Clipboard from 'expo-clipboard';

import { VoiceControlCard } from '@/components/voice-control-card';
import { EndSessionModal } from '@/components/end-session-modal';
import { ExplainPanel } from '@/components/explain-panel';
import { HistoryDrawer } from '@/components/history-drawer';
import { SessionTopBar } from '@/components/session-top-bar';
import { HostQrScreen } from '@/components/screens/host-qr-screen';
import { JoinQrScreen } from '@/components/screens/join-qr-screen';
import { SessionChatScreen } from '@/components/screens/session-chat-screen';
import { SessionParticipantsScreen } from '@/components/screens/session-participants-screen';
import { WelcomeScreen } from '@/components/screens/welcome-screen';
import { PrimaryButton, SecondaryButton } from '@/components/ui/buttons';
import { Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';
import {
  startHost,
  joinHost,
  type HostSession,
  type JoinSession,
  type CaptionMessage,
  type NetMessage,
} from '@/lib/session-network';
import {
  createSessionId,
  saveSessionEntries,
  endSession,
  listSessions,
  deleteSession,
  type StoredSession,
} from '@/lib/history-storage';
import { explainText, summarizeSession, MissingApiKeyError, type GeminiConfig } from '@/lib/gemini';
import { getGeminiConfig, setGeminiConfig } from '@/lib/api-key-storage';
import { getGeminiConsent, setGeminiConsent } from '@/lib/consent-storage';

/**
 * Spike: validates the "stream raw EN text immediately, batch-translate to VI at a
 * sentence/word-count boundary" pipeline using stock APIs (SpeechRecognizer via
 * expo-speech-recognition + ML Kit Translate via expo-translate-text), before investing
 * in a custom sherpa-onnx + Qwen stack. Also supports a multi-device "workshop" session:
 * one Host device runs a small TCP server on the LAN, Join devices connect to it, and
 * every device's own locally-finalized captions get relayed to everyone else.
 */

const RESTART_DELAY_AFTER_END_MS = 0;
// How long volume has to stay below PAUSE_VOLUME_THRESHOLD before we treat it as "user
// paused speaking" and cut the segment there. Fixed - not user-configurable, unrelated to
// the mic sensitivity slider below.
const SILENCE_CUT_DURATION_MS = 400;
const PAUSE_VOLUME_THRESHOLD = 0.12;

type Lang = 'en' | 'vi';
type LogEntry = {
  id: string;
  speaker: string;
  sourceLang: Lang;
  targetLang: Lang;
  source: string;
  translated: string;
};

type Role = 'solo' | 'host' | 'join';
type SetupStep = 'select' | 'host-qr' | 'join-scan';
type SessionTab = 'chat' | 'participants';

export default function HomeScreen() {
  const theme = useTheme();
  const { t } = useI18n();

  // ---- Session setup (solo / host / join) ----------------------------------------------
  const [role, setRole] = useState<Role | null>(null);
  const [setupStep, setSetupStep] = useState<SetupStep>('select');
  const [nameInput, setNameInput] = useState('');
  const [peerCount, setPeerCount] = useState(0);
  const [hostAddress, setHostAddress] = useState<{ host: string; port: number } | null>(null);
  const [joinStatus, setJoinStatus] = useState('');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  // Solo/Host can always speak; Join must request and wait for the Host to approve.
  const [micApproved, setMicApproved] = useState(true);
  const [micRequestPending, setMicRequestPending] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<{ deviceId: string; name: string }[]>([]);

  const sessionRef = useRef<HostSession | JoinSession | null>(null);
  const scannedRef = useRef(false);
  const deviceIdRef = useRef(`dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  // Set right before we close our own socket as part of the local leave flow, so the
  // resulting 'close' event doesn't get misread as the host having ended the meeting.
  const intentionalDisconnectRef = useRef(false);
  // requestLeaveSession is redefined every render but the join socket's onDisconnect callback
  // is only bound once (at connect time) - it calls this ref instead so it always reaches the
  // latest closure rather than the stale one captured when the socket first connected.
  const requestLeaveSessionRef = useRef<(reason: 'self' | 'disconnected') => void>(() => {});

  // ---- End-of-session save/summary prompt ------------------------------------------------
  const [endSessionVisible, setEndSessionVisible] = useState(false);
  const [endSessionReason, setEndSessionReason] = useState<'self' | 'disconnected'>('self');
  const [saveAsSummaryChecked, setSaveAsSummaryChecked] = useState(false);
  const [endSessionSaving, setEndSessionSaving] = useState(false);

  // ---- History + explain (Gemini) ---------------------------------------------------------
  // Past sessions are persisted via history-storage.ts and shown in the in-session HistoryDrawer
  // sidebar (opened from SessionTopBar) - not reachable from the pre-session welcome screen.
  const [historyVisible, setHistoryVisible] = useState(false);
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [explainVisible, setExplainVisible] = useState(false);
  const [explainSelectedText, setExplainSelectedText] = useState('');
  const [explainResult, setExplainResult] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  // Gemini is always reached via the small shared proxy server (see /server), which holds
  // one Gemini key server-side - the app itself never handles a raw key. Requires explicit
  // consent since the transcript/selection gets sent through it to Google.
  const [geminiConfig, setGeminiConfigState] = useState<GeminiConfig | null>(null);
  const [geminiConsent, setGeminiConsentState] = useState<boolean | null>(null);
  const [apiKeySettingsVisible, setApiKeySettingsVisible] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState('');
  const [consentInput, setConsentInput] = useState(false);
  const [serverQrScanVisible, setServerQrScanVisible] = useState(false);

  const geminiReady = geminiConsent === true && geminiConfig !== null;

  const currentSessionIdRef = useRef<string | null>(null);
  const sessionStartedAtRef = useRef(0);
  // When the Gemini setup popup is opened from the "save as summary" checkbox mid-leave, this
  // remembers to bring the end-session modal back once setup is closed.
  const [reopenEndSessionAfterGeminiSetup, setReopenEndSessionAfterGeminiSetup] = useState(false);

  // ---- Main transcript state -------------------------------------------------------------
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [partialText, setPartialText] = useState('');
  const [draftTranslated, setDraftTranslated] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);
  // Mirrors `log` for the network-callback closures below (onDisconnect etc.) which are bound
  // once at connection time and would otherwise only ever see the log as of that render.
  const logRef = useRef<LogEntry[]>([]);
  logRef.current = log;
  // 0..1 noise-gate sensitivity - NOT related to pause/cut detection. A segment's peak
  // volume must clear (1 - micSensitivity) or it's discarded as background noise/cross-talk.
  // Higher = picks up quieter voices too (more noise gets through). Lower = requires louder,
  // more deliberate speech - turn this down in a noisy room and speak up.
  const [micSensitivity, setMicSensitivity] = useState(0.5);
  // Seconds elapsed since the current recording started - purely for the waveform's mm:ss
  // display, ticks via recordingIntervalRef while isRunning.
  const [recordingElapsedSec, setRecordingElapsedSec] = useState(0);

  // ---- Presentation-only UI state (no effect on the pipeline above) ----------------------
  const [sessionTab, setSessionTab] = useState<SessionTab>('chat');

  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);
  const useOnDeviceRef = useRef(true);
  // Best-effort guess of who's currently talking; updated by the native 'languagedetection'
  // event. Only actually switches mid-session on Android 14+ on-device recognition - see
  // startSegment() below.
  const currentSourceLangRef = useRef<Lang>('en');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cutRequestedRef = useRef(false);
  const micSensitivityRef = useRef(micSensitivity);
  micSensitivityRef.current = micSensitivity;
  // Tracks the loudest volume seen during the current in-progress utterance, to decide at
  // finalize time whether it was the user talking or just background noise/cross-talk.
  const segmentPeakVolumeRef = useRef(0);
  const translateChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const logIdRef = useRef(0);
  const volumeLevel = useSharedValue(0);
  // Some recognizer implementations never emit isFinal=true, even after stop() -
  // they just go straight to 'end'. Track the latest partial so 'end' can promote it.
  const lastPartialRef = useRef('');

  // Local-agreement incremental translation: the prefix that's stayed identical across
  // consecutive partial hypotheses is treated as "confirmed" and translated+locked; only
  // the still-changing tail is retranslated as a cheap draft. Reset per utterance.
  const stableWordsRef = useRef<string[]>([]);
  const stableTranslatedRef = useRef('');
  const tentativeTranslatedRef = useRef('');
  const previousPartialWordsRef = useRef<string[]>([]);
  const lastTentativeThrottleRef = useRef(0);

  // Pre-warm the ML Kit EN->VI model once at startup so the first real segment doesn't stall.
  // Goes through translateChainRef so it can't race with a real segment's translate call -
  // expo-translate-text throws TRANSLATION_IN_PROGRESS on overlapping calls.
  useEffect(() => {
    translateChainRef.current = translateChainRef.current
      .then(() =>
        onTranslateTask({
          input: 'hello',
          sourceLangCode: 'en',
          targetLangCode: 'vi',
          // expo-translate-text forwards every field as-is to the native bridge, and the
          // Android side chokes converting an `undefined` value to its Kotlin Map<String, Any> -
          // so every field must be given a concrete value, not omitted.
          preferredStrategy: 'lowLatency',
          requiresWifi: false,
          requireCharging: false,
        })
      )
      .then(() => setStatus(t('statusReady')))
      .catch((error: any) => setStatus(t('statusLoadError', String(error?.message ?? error))));

    if (Platform.OS === 'android') {
      // Calling start({ requiresOnDeviceRecognition: true }) when the device truly has no
      // on-device recognizer throws an uncaught native UnsupportedOperationException that
      // crashes the whole app (not a catchable JS error event) - check support up front and
      // never attempt the on-device path at all if it's not there.
      const supportsOnDevice = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
      useOnDeviceRef.current = supportsOnDevice;
      console.log(`[LiveTranslate] supportsOnDeviceRecognition() = ${supportsOnDevice}`);

      if (supportsOnDevice) {
        // androidTriggerOfflineModelDownload() shows a system dialog/notification every single
        // time it's called while a locale isn't fully installed yet - so calling it unconditionally
        // on every launch nagged the user repeatedly. Check what's already installed first and
        // only trigger the download for locales that are actually still missing.
        ExpoSpeechRecognitionModule.getSupportedLocales({})
          .then(({ installedLocales }) => {
            const missingLocales = ['en-US', 'vi-VN'].filter((locale) => !installedLocales.includes(locale));
            for (const locale of missingLocales) {
              ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale }).catch(() => {
                // Best-effort only; start() will still fall back to the network recognizer.
              });
            }
          })
          .catch(() => {
            // Can't tell what's installed (e.g. service package not found) - skip silently
            // rather than nagging with a download prompt on every launch.
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the Gemini config + consent decision from device storage once at startup.
  useEffect(() => {
    getGeminiConfig().then((config) => {
      if (config?.mode === 'server') {
        setGeminiConfigState(config);
        setServerUrlInput(config.serverUrl);
      }
    });
    getGeminiConsent().then((consent) => {
      setGeminiConsentState(consent);
      setConsentInput(consent === true);
    });
  }, []);

  // Closes the Gemini settings popup and, if it was opened from the "save as summary"
  // checkbox mid-leave, brings the end-session modal back so the user can pick up where
  // they left off.
  const closeGeminiSettings = () => {
    setApiKeySettingsVisible(false);
    if (reopenEndSessionAfterGeminiSetup) {
      setReopenEndSessionAfterGeminiSetup(false);
      setEndSessionVisible(true);
    }
  };

  const saveGeminiSettings = async () => {
    await setGeminiConsent(consentInput);
    setGeminiConsentState(consentInput);

    if (!consentInput) {
      // Declined - don't persist a config even if a URL was filled in, keep it fully off.
      closeGeminiSettings();
      return;
    }

    const config: GeminiConfig = { mode: 'server', serverUrl: serverUrlInput.trim() };
    await setGeminiConfig(config);
    setGeminiConfigState(config);
    closeGeminiSettings();
  };

  const openGeminiSetupFromEndSession = () => {
    setEndSessionVisible(false);
    setReopenEndSessionAfterGeminiSetup(true);
    setApiKeySettingsVisible(true);
  };

  const startServerQrScan = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) return;
    }
    setServerQrScanVisible(true);
  };

  const onServerQrScanned = (data: string) => {
    setServerUrlInput(data.trim());
    setServerQrScanVisible(false);
  };

  // Persist every finalized entry (local or from the network) into the current session's
  // history record, so it survives app restarts and shows up in the history drawer.
  useEffect(() => {
    if (!currentSessionIdRef.current || log.length === 0) return;
    saveSessionEntries(currentSessionIdRef.current, sessionStartedAtRef.current, log);
  }, [log]);

  const beginPersistedSession = () => {
    currentSessionIdRef.current = createSessionId();
    sessionStartedAtRef.current = Date.now();
  };

  // Finalizes the just-finished session in storage per the end-session modal's choice:
  // discard removes the auto-saved partial record entirely, save keeps it (optionally as a
  // Gemini summary instead of the raw transcript).
  const finalizePersistedSession = async (shouldSave: boolean, asSummary: boolean) => {
    const sessionId = currentSessionIdRef.current;
    currentSessionIdRef.current = null;
    if (!sessionId || logRef.current.length === 0) return;

    if (!shouldSave) {
      await deleteSession(sessionId);
      return;
    }
    if (!asSummary || !geminiReady || !geminiConfig) {
      await endSession(sessionId);
      return;
    }
    const transcript = logRef.current
      .map((e) => `${e.speaker} (${e.sourceLang}): ${e.source}\n-> (${e.targetLang}): ${e.translated}`)
      .join('\n\n');
    try {
      const summary = await summarizeSession(geminiConfig, transcript);
      await endSession(sessionId, summary);
    } catch (err: any) {
      console.log(`[LiveTranslate] summarizeSession failed: ${err?.message ?? err}`);
      await endSession(sessionId);
    }
  };

  const openHistory = async () => {
    setSessions(await listSessions());
    setHistoryVisible(true);
  };

  const handleDeleteSession = async (id: string) => {
    await deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleExplain = async (selectedText: string, contextText: string) => {
    if (!selectedText.trim()) return;
    if (!geminiReady) {
      // There's no persistent settings entry point anymore (see VoiceControlCard - the
      // control bar is down to just the record button), so this is the only way in: pop the
      // Gemini setup dialog straight up rather than a dead-end inline error.
      setApiKeySettingsVisible(true);
      return;
    }
    setExplainSelectedText(selectedText);
    setExplainResult(null);
    setExplainError(null);
    setExplainVisible(true);
    setExplainLoading(true);
    try {
      const result = await explainText(geminiConfig, selectedText, contextText);
      setExplainResult(result);
    } catch (err: any) {
      if (err instanceof MissingApiKeyError) {
        setExplainError(t('notConfiguredMessage'));
      } else {
        setExplainError(err?.message ?? String(err));
      }
    } finally {
      setExplainLoading(false);
    }
  };

  // ---- Session (host/join) wiring ---------------------------------------------------------

  const handleIncomingMessage = (msg: NetMessage) => {
    if (msg.kind === 'caption') {
      console.log(`[LiveTranslate] handleIncomingMessage(caption): ${msg.speaker} - ${msg.source}`);
      setLog((prev) => [
        ...prev,
        {
          id: msg.id,
          speaker: msg.speaker,
          sourceLang: msg.sourceLang,
          targetLang: msg.targetLang,
          source: msg.source,
          translated: msg.translated,
        },
      ]);
      return;
    }
    if (msg.kind === 'request-speak') {
      console.log(`[LiveTranslate] handleIncomingMessage(request-speak): ${msg.name}`);
      setPendingRequests((prev) =>
        prev.some((r) => r.deviceId === msg.deviceId)
          ? prev
          : [...prev, { deviceId: msg.deviceId, name: msg.name }]
      );
      return;
    }
    if (msg.kind === 'speak-decision') {
      if (msg.deviceId === deviceIdRef.current) {
        console.log(`[LiveTranslate] handleIncomingMessage(speak-decision): approved=${msg.approved}`);
        setMicApproved(msg.approved);
        setMicRequestPending(false);
        setJoinStatus(msg.approved ? '' : t('micRequestDeclined'));
      }
      return;
    }
    // 'hello' - only the host's network layer needs this (to map deviceId -> socket).
  };

  const enterSolo = () => {
    setMicApproved(true);
    beginPersistedSession();
    setRole('solo');
  };

  const startHostMode = async () => {
    const host = await Network.getIpAddressAsync().catch(() => '0.0.0.0');
    const session = startHost(
      (msg) => handleIncomingMessage(msg),
      (count) => setPeerCount(count),
      (error) => setJoinStatus(t('statusDisconnected', error.message))
    );
    sessionRef.current = session;
    setMicApproved(true);
    setHostAddress({ host, port: session.port });
    setSetupStep('host-qr');
  };

  const startJoinScan = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        setJoinStatus(t('statusCameraPermissionDenied'));
        return;
      }
    }
    scannedRef.current = false;
    setJoinStatus('');
    setSetupStep('join-scan');
  };

  const onQrScanned = (data: string) => {
    if (scannedRef.current) return;
    let parsed: { host: string; port: number };
    try {
      parsed = JSON.parse(data);
    } catch {
      setJoinStatus(t('statusInvalidQr'));
      return;
    }
    scannedRef.current = true;
    setJoinStatus(t('statusConnectingTo', parsed.host, parsed.port));
    const session = joinHost(parsed.host, parsed.port, {
      onConnected: () => {
        sessionRef.current = session;
        session.send({
          kind: 'hello',
          deviceId: deviceIdRef.current,
          name: nameInput.trim() || t('you'),
        });
        setMicApproved(false);
        setMicRequestPending(false);
        beginPersistedSession();
        setRole('join');
      },
      onMessage: handleIncomingMessage,
      onDisconnect: (error) => {
        sessionRef.current = null;
        scannedRef.current = false;
        if (intentionalDisconnectRef.current) {
          // We closed our own socket as part of requestLeaveSession('self') below - that
          // flow is already showing/handling the save prompt, so don't show it a second time.
          intentionalDisconnectRef.current = false;
          return;
        }
        setJoinStatus(error ? t('statusDisconnected', error.message) : t('statusDisconnectedGeneric'));
        requestLeaveSessionRef.current('disconnected');
      },
    });
  };

  const enterHostSession = () => {
    beginPersistedSession();
    setRole('host');
  };

  // Clears the recording timer, saves/discards the transcript per the caller's choice, tears
  // down the network session, and returns to the welcome screen.
  const finalizeAndReset = async (shouldSave: boolean, asSummary: boolean) => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setRecordingElapsedSec(0);

    await finalizePersistedSession(shouldSave, asSummary);

    intentionalDisconnectRef.current = true;
    sessionRef.current?.close();
    sessionRef.current = null;
    setRole(null);
    setSetupStep('select');
    setPeerCount(0);
    setHostAddress(null);
    setJoinStatus('');
    setLog([]);
    setPendingRequests([]);
    setMicApproved(true);
    setMicRequestPending(false);
    setSessionTab('chat');
    setEndSessionVisible(false);
    setEndSessionSaving(false);
  };

  // Entry point for "leave" everywhere in the UI (back button, Leave button, cancelling
  // host-qr setup, or the host having ended the meeting). Skips the save prompt when there's
  // nothing to save yet.
  const requestLeaveSession = (reason: 'self' | 'disconnected') => {
    if (logRef.current.length === 0) {
      void finalizeAndReset(false, false);
      return;
    }
    setEndSessionReason(reason);
    setSaveAsSummaryChecked(false);
    setEndSessionVisible(true);
  };
  requestLeaveSessionRef.current = requestLeaveSession;

  const confirmEndSession = async (shouldSave: boolean) => {
    setEndSessionSaving(true);
    await finalizeAndReset(shouldSave, shouldSave && saveAsSummaryChecked);
  };

  const requestToSpeak = () => {
    if (!sessionRef.current || role !== 'join') return;
    (sessionRef.current as JoinSession).send({
      kind: 'request-speak',
      deviceId: deviceIdRef.current,
      name: nameInput.trim() || t('you'),
    });
    setMicRequestPending(true);
    setJoinStatus(t('statusRequestSent'));
  };

  const decideSpeakRequest = (deviceId: string, approved: boolean) => {
    if (!sessionRef.current || role !== 'host') return;
    (sessionRef.current as HostSession).sendTo(deviceId, {
      kind: 'speak-decision',
      deviceId,
      approved,
    });
    setPendingRequests((prev) => prev.filter((r) => r.deviceId !== deviceId));
  };

  const broadcastCaption = (entry: LogEntry) => {
    console.log(
      `[LiveTranslate] broadcastCaption called: role=${role} hasSession=${!!sessionRef.current} text="${entry.source}"`
    );
    if (!sessionRef.current || !role) return;
    const msg: CaptionMessage = {
      kind: 'caption',
      id: entry.id,
      speaker: entry.speaker,
      sourceLang: entry.sourceLang,
      targetLang: entry.targetLang,
      source: entry.source,
      translated: entry.translated,
    };
    if (role === 'host') {
      (sessionRef.current as HostSession).broadcast(msg);
    } else if (role === 'join') {
      (sessionRef.current as JoinSession).send(msg);
    }
  };

  // ---- Speech pipeline (unchanged from solo mode, just tags + broadcasts entries) --------

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const forceCheckpoint = () => {
    if (!isRunningRef.current || cutRequestedRef.current) return;
    console.log('[LiveTranslate] forceCheckpoint -> stop()');
    cutRequestedRef.current = true;
    ExpoSpeechRecognitionModule.stop();
  };

  const startSegment = () => {
    cutRequestedRef.current = false;
    clearSilenceTimer();
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      // Keeps the recognizer alive across natural pauses instead of stopping after every
      // isFinal result - avoids the stop()->start() dead zone that was dropping words right
      // at the cut point. We still restart manually when our own silence detection forces
      // a stop() (see the 'volumechange' handler below).
      continuous: true,
      requiresOnDeviceRecognition: useOnDeviceRef.current,
      androidIntentOptions: {
        // Loose fallback thresholds for the recognizer's own (often-ignored) endpointing;
        // our 'volumechange'-based silence detection below is the real cut mechanism now.
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 900,
        EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 700,
        // Auto-detect EN vs VI mid-session and switch the recognizer language.
        // Android 14+ only, requires the "com.google.android.as" on-device service with
        // both en-US and vi-VN offline packs downloaded - falls back to fixed EN-only
        // detection (no effect) on older Android or the network recognizer.
        EXTRA_ENABLE_LANGUAGE_DETECTION: true,
        EXTRA_ENABLE_LANGUAGE_SWITCH: 'balanced',
        EXTRA_LANGUAGE_SWITCH_ALLOWED_LANGUAGES: ['en-US', 'vi-VN'],
        EXTRA_LANGUAGE_DETECTION_ALLOWED_LANGUAGES: ['en-US', 'vi-VN'],
      },
      volumeChangeEventOptions: {
        enabled: true,
        intervalMillis: 100,
      },
    });
  };

  const restartSegment = () => {
    if (!isRunningRef.current) return;
    setTimeout(() => {
      if (isRunningRef.current) startSegment();
    }, RESTART_DELAY_AFTER_END_MS);
  };

  const resetIncrementalTranslation = () => {
    stableWordsRef.current = [];
    stableTranslatedRef.current = '';
    tentativeTranslatedRef.current = '';
    previousPartialWordsRef.current = [];
    setDraftTranslated('');
  };

  const updateDraftDisplay = () => {
    setDraftTranslated(`${stableTranslatedRef.current} ${tentativeTranslatedRef.current}`.trim());
  };

  // Best-effort draft translation for a chunk of the in-progress utterance. Failures are
  // silently ignored - the confident translate in finalizeSegment is what actually counts.
  const translateDraftChunk = (chunkText: string, kind: 'stable' | 'tentative') => {
    if (!chunkText.trim()) return;
    const sourceLang = currentSourceLangRef.current;
    const targetLang: Lang = sourceLang === 'vi' ? 'en' : 'vi';
    translateChainRef.current = translateChainRef.current
      .then(() =>
        onTranslateTask({
          input: chunkText,
          sourceLangCode: sourceLang,
          targetLangCode: targetLang,
          preferredStrategy: 'lowLatency',
          requiresWifi: false,
          requireCharging: false,
        })
      )
      .then((result) => {
        const translated = Array.isArray(result.translatedTexts)
          ? result.translatedTexts.join(' ')
          : String(result.translatedTexts);
        if (kind === 'stable') {
          stableTranslatedRef.current = translated;
        } else {
          tentativeTranslatedRef.current = translated;
        }
        updateDraftDisplay();
      })
      .catch(() => {});
  };

  const queueTranslate = (
    entryId: string,
    text: string,
    sourceLang: Lang,
    targetLang: Lang,
    speaker: string
  ) => {
    console.log(`[LiveTranslate] queueTranslate: enqueue id=${entryId} ${sourceLang}->${targetLang}`);
    translateChainRef.current = translateChainRef.current
      .then(() =>
        onTranslateTask({
          input: text,
          sourceLangCode: sourceLang,
          targetLangCode: targetLang,
          preferredStrategy: 'lowLatency',
          requiresWifi: false,
          requireCharging: false,
        })
      )
      .then((result) => {
        const translated = Array.isArray(result.translatedTexts)
          ? result.translatedTexts.join(' ')
          : String(result.translatedTexts);
        console.log(`[LiveTranslate] translate OK id=${entryId} -> "${translated}"`);
        setLog((prev) =>
          prev.map((e) => (e.id === entryId ? { ...e, translated } : e))
        );
        // Built directly from values already in scope here, rather than pulled out of the
        // setLog updater as a side effect - React doesn't guarantee that updater runs
        // synchronously, so relying on it left broadcastCaption silently never firing.
        broadcastCaption({ id: entryId, speaker, sourceLang, targetLang, source: text, translated });
      })
      .catch((error: any) => {
        console.log(`[LiveTranslate] translate FAILED id=${entryId}: ${error?.code ?? ''} ${error?.message ?? error}`);
        setLog((prev) =>
          prev.map((e) =>
            e.id === entryId
              ? { ...e, translated: `[${t('statusError', error?.code ?? '', String(error?.message ?? error))}]` }
              : e
          )
        );
      });
  };

  const finalizeSegment = (text: string) => {
    setPartialText('');
    resetIncrementalTranslation();
    const peakVolume = segmentPeakVolumeRef.current;
    segmentPeakVolumeRef.current = 0;
    if (!text.trim()) {
      console.log('[LiveTranslate] finalizeSegment: blank text, skipping');
      return;
    }
    const noiseGateThreshold = 1 - micSensitivityRef.current;
    if (peakVolume < noiseGateThreshold) {
      console.log(
        `[LiveTranslate] finalizeSegment: discarded as noise (peak=${peakVolume.toFixed(2)} < gate=${noiseGateThreshold.toFixed(2)}): "${text}"`
      );
      return;
    }
    const id = `me-${Date.now()}-${++logIdRef.current}`;
    console.log(`[LiveTranslate] finalizeSegment: id=${id} text="${text}"`);
    const sourceLang = currentSourceLangRef.current;
    const targetLang: Lang = sourceLang === 'vi' ? 'en' : 'vi';
    // 'Host' is a stable cross-device identifier (broadcast as the `speaker` field), not
    // user-facing chrome - it must not be swapped per the local device's UI language, or
    // the isPresenter check below would break for peers running a different UI language.
    const speaker = nameInput.trim() || (role === 'host' ? 'Host' : t('you'));
    setLog((prev) => [
      ...prev,
      { id, speaker, sourceLang, targetLang, source: text, translated: '...' },
    ]);
    queueTranslate(id, text, sourceLang, targetLang, speaker);
  };

  useSpeechRecognitionEvent('start', () => {
    console.log('[LiveTranslate] event: start');
    setStatus(t('statusListening'));
  });

  useSpeechRecognitionEvent('end', () => {
    console.log('[LiveTranslate] event: end');
    clearSilenceTimer();
    volumeLevel.value = withTiming(0, { duration: 300 });
    if (lastPartialRef.current.trim()) {
      console.log(`[LiveTranslate] end: promoting last partial to final: "${lastPartialRef.current}"`);
      finalizeSegment(lastPartialRef.current);
      lastPartialRef.current = '';
    }
    restartSegment();
  });

  useSpeechRecognitionEvent('volumechange', (event) => {
    // event.value ranges roughly -2 (inaudible) to 10; normalize to 0..1.
    const normalized = Math.max(0, Math.min(1, (event.value + 2) / 12));
    volumeLevel.value = withTiming(normalized, {
      duration: 100,
      easing: Easing.out(Easing.ease),
    });

    segmentPeakVolumeRef.current = Math.max(segmentPeakVolumeRef.current, normalized);

    // Silence-based cut: once volume dips below a fixed threshold and stays there for
    // SILENCE_CUT_DURATION_MS, treat it as the end of the thought and cut there. Any volume
    // back above threshold cancels a pending cut. Uses a fixed threshold, not the mic
    // sensitivity slider (that's a separate noise-gate concern - see finalizeSegment).
    if (normalized < PAUSE_VOLUME_THRESHOLD) {
      if (!silenceTimerRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          console.log('[LiveTranslate] silence detected, forcing checkpoint');
          forceCheckpoint();
        }, SILENCE_CUT_DURATION_MS);
      }
    } else {
      clearSilenceTimer();
    }
  });

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript ?? '';
    console.log(
      `[LiveTranslate] result isFinal=${event.isFinal} len=${text.length} text="${text}"`
    );
    if (event.isFinal) {
      lastPartialRef.current = '';
      finalizeSegment(text);
      return;
    }
    // Some results come back blank mid-session (e.g. around a language switch) - ignore
    // those rather than clobbering the last good transcript we're buffering for 'end'.
    if (!text.trim()) {
      return;
    }
    setPartialText(text);
    lastPartialRef.current = text;

    const words = text.trim().split(/\s+/).filter(Boolean);
    const prevWords = previousPartialWordsRef.current;
    let commonLen = 0;
    while (
      commonLen < words.length &&
      commonLen < prevWords.length &&
      words[commonLen] === prevWords[commonLen]
    ) {
      commonLen++;
    }
    previousPartialWordsRef.current = words;

    if (commonLen > stableWordsRef.current.length) {
      stableWordsRef.current = words.slice(0, commonLen);
      translateDraftChunk(stableWordsRef.current.join(' '), 'stable');
    }

    const tentativeWords = words.slice(stableWordsRef.current.length);
    const now = Date.now();
    if (tentativeWords.length > 0 && now - lastTentativeThrottleRef.current > 400) {
      lastTentativeThrottleRef.current = now;
      translateDraftChunk(tentativeWords.join(' '), 'tentative');
    }
  });

  useSpeechRecognitionEvent('languagedetection', (event) => {
    console.log(
      `[LiveTranslate] event: languagedetection detected=${event.detectedLanguage} confidence=${event.confidence}`
    );
    const lang: Lang = event.detectedLanguage.toLowerCase().startsWith('vi') ? 'vi' : 'en';
    currentSourceLangRef.current = lang;
    setStatus(
      t(
        'statusListeningWithLang',
        lang === 'vi' ? t('langVietnamese') : t('langEnglish'),
        Math.round(event.confidence * 100)
      )
    );
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.log(`[LiveTranslate] event: error code=${event.error} message=${event.message}`);
    // On-device pack missing -> fall back to the network recognizer so the demo still works.
    if (
      useOnDeviceRef.current &&
      (event.error === 'language-not-supported' || event.error === 'service-not-allowed')
    ) {
      useOnDeviceRef.current = false;
      setStatus(t('statusFallbackOnline'));
      return;
    }
    setStatus(t('statusError', event.error, event.message ?? ''));
  });

  const onToggle = async () => {
    if (isRunning) {
      isRunningRef.current = false;
      setIsRunning(false);
      clearSilenceTimer();
      ExpoSpeechRecognitionModule.stop();
      setStatus(t('statusStopped'));
      setPartialText('');
      resetIncrementalTranslation();
      volumeLevel.value = withTiming(0, { duration: 300 });
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      setRecordingElapsedSec(0);
      return;
    }

    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setStatus(t('statusMicPermissionDenied'));
      return;
    }

    isRunningRef.current = true;
    setIsRunning(true);
    setRecordingElapsedSec(0);
    recordingIntervalRef.current = setInterval(() => {
      setRecordingElapsedSec((s) => s + 1);
    }, 1000);
    startSegment();
  };

  // ---- Render: setup screens (mode not chosen yet) ---------------------------------------

  if (role === null) {
    if (setupStep === 'join-scan') {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.groupedBackground }}>
          <JoinQrScreen
            onBack={() => setSetupStep('select')}
            onScanned={onQrScanned}
            statusMessage={joinStatus || undefined}
          />
        </SafeAreaView>
      );
    }

    if (setupStep === 'host-qr' && hostAddress) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.groupedBackground }}>
          <HostQrScreen
            host={hostAddress.host}
            port={hostAddress.port}
            peerCount={peerCount}
            onStart={enterHostSession}
            onCancel={() => requestLeaveSession('self')}
          />
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.groupedBackground }}>
        <WelcomeScreen
          nameInput={nameInput}
          onNameChange={setNameInput}
          onJoinQr={startJoinScan}
          onPresenter={startHostMode}
          onSolo={enterSolo}
          statusMessage={joinStatus || undefined}
        />
      </SafeAreaView>
    );
  }

  // ---- Render: main session UI (solo, or an active host/join session) -------------------

  const selfName = nameInput.trim() || (role === 'host' ? 'Host' : t('you'));
  const speakerLangByName = new Map<string, string>();
  for (const entry of log) {
    speakerLangByName.set(entry.speaker, entry.sourceLang.toUpperCase());
  }
  if (!speakerLangByName.has(selfName)) speakerLangByName.set(selfName, 'EN');
  const participants = Array.from(speakerLangByName.entries()).map(([name, lang]) => ({
    name,
    isYou: name === selfName,
    isPresenter: name === 'Host',
    lang,
  }));

  const chatLog = log.map((entry) => ({
    id: entry.id,
    sourceLang: entry.sourceLang.toUpperCase(),
    targetLang: entry.targetLang.toUpperCase(),
    source: entry.source,
    translated: entry.translated,
    speaker: entry.speaker,
  }));

  const canControlSession = role !== 'join' || micApproved;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.groupedBackground }}>
      <View
        style={{
          flex: 1,
          padding: 16,
          gap: 12,
        }}
      >
        <SessionTopBar
          showSessionInfo={role !== 'solo'}
          sessionId={hostAddress ? String(hostAddress.port) : 'LAN'}
          peopleCount={peerCount}
          leaveLabel={t('leave')}
          onBack={() => requestLeaveSession('self')}
          onLeave={() => requestLeaveSession('self')}
          onOpenHistory={openHistory}
        />

        {sessionTab === 'chat' ? (
          <SessionChatScreen
            sessionTab={sessionTab}
            onChangeSessionTab={setSessionTab}
            log={chatLog}
            partialText={partialText}
            draftTranslated={draftTranslated}
            status={status}
            onExplain={handleExplain}
            pendingRequestCount={role === 'host' ? pendingRequests.length : 0}
          />
        ) : (
          <SessionParticipantsScreen
            sessionTab={sessionTab}
            onChangeSessionTab={setSessionTab}
            participants={participants}
            isHost={role === 'host'}
            pendingRequests={pendingRequests}
            onApprove={(deviceId) => decideSpeakRequest(deviceId, true)}
            onDecline={(deviceId) => decideSpeakRequest(deviceId, false)}
          />
        )}

        {canControlSession ? (
          <VoiceControlCard
            volume={volumeLevel}
            isRunning={isRunning}
            elapsedSec={recordingElapsedSec}
            onToggleRunning={onToggle}
            micSensitivity={micSensitivity}
            onMicSensitivityChange={setMicSensitivity}
          />
        ) : (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <SecondaryButton
              label={micRequestPending ? t('waitingForApproval') : t('requestToSpeak')}
              onPress={requestToSpeak}
              disabled={micRequestPending}
              icon={{ ios: 'mic.fill', android: 'mic', web: 'mic' }}
            />
            {joinStatus.length > 0 && (
              <Text style={{ fontSize: 12.5, color: theme.textSecondary }}>{joinStatus}</Text>
            )}
          </View>
        )}
      </View>

      <ExplainPanel
        visible={explainVisible}
        selectedText={explainSelectedText}
        explanation={explainResult}
        loading={explainLoading}
        error={explainError}
        onClose={() => setExplainVisible(false)}
      />

      <Modal
        visible={apiKeySettingsVisible}
        transparent
        animationType="fade"
        onRequestClose={closeGeminiSettings}
      >
        <View
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}
        >
          {serverQrScanVisible ? (
            <View style={{ backgroundColor: theme.card, borderRadius: 20, padding: 20, gap: 14, ...Shadow.large }}>
              <Text style={{ fontSize: 20, fontWeight: '600', color: theme.text }}>
                {t('scanQrServerTitle')}
              </Text>
              <View style={{ width: '100%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden' }}>
                <CameraView
                  style={{ flex: 1 }}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={(result) => onServerQrScanned(result.data)}
                />
              </View>
              <SecondaryButton label={t('cancel')} onPress={() => setServerQrScanVisible(false)} />
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: '85%', backgroundColor: theme.card, borderRadius: 20, ...Shadow.large }}
              contentContainerStyle={{ padding: 20, paddingBottom: 14, gap: 14 }}
            >
              <Text style={{ fontSize: 20, fontWeight: '600', color: theme.text }}>
                {t('geminiSettingsTitle')}
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Switch value={consentInput} onValueChange={setConsentInput} />
                <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: theme.textSecondary }}>
                  {t('geminiConsentText')}
                </Text>
              </View>

              {consentInput && (
                <>
                  <Text style={{ fontSize: 13, color: theme.textSecondary }}>{t('serverUrlHint')}</Text>
                  <SecondaryButton label={t('scanQr')} onPress={startServerQrScan} />
                  <TextInput
                    style={{
                      backgroundColor: theme.groupedBackground,
                      borderRadius: 14,
                      padding: 14,
                      fontSize: 15,
                      color: theme.text,
                    }}
                    value={serverUrlInput}
                    onChangeText={setServerUrlInput}
                    placeholder={t('serverUrlPlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </>
              )}

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <SecondaryButton
                  label={t('close')}
                  onPress={closeGeminiSettings}
                  style={{ flex: 1 }}
                />
                <PrimaryButton label={t('save')} onPress={saveGeminiSettings} style={{ flex: 1 }} />
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      <HistoryDrawer
        visible={historyVisible}
        sessions={sessions}
        onClose={() => setHistoryVisible(false)}
        onDelete={handleDeleteSession}
      />

      <EndSessionModal
        visible={endSessionVisible}
        reason={endSessionReason}
        saveAsSummary={saveAsSummaryChecked}
        onToggleSaveAsSummary={setSaveAsSummaryChecked}
        summaryAvailable={geminiReady}
        onRequestGeminiSetup={openGeminiSetupFromEndSession}
        saving={endSessionSaving}
        onDiscard={() => void confirmEndSession(false)}
        onSave={() => void confirmEndSession(true)}
      />
    </SafeAreaView>
  );
}
