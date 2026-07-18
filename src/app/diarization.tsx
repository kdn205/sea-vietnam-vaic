import { useAudioRecorder } from '@siteed/audio-studio';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  diarizeAudioFile,
  installOfflineDiarization,
  isOfflineDiarizationInstalled,
  type OfflineDiarizationOutput,
  releaseOfflineDiarization,
} from '@/lib/offline-diarization';

const SPEAKER_OPTIONS = [-1, 2, 3, 4];

function formatTime(milliseconds: number) {
  const totalSeconds = milliseconds / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(1).padStart(4, '0');
  return `${minutes}:${seconds}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default function OfflineDiarizationScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const recorder = useAudioRecorder();
  const [installed, setInstalled] = useState(false);
  const [checking, setChecking] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Đang kiểm tra model trên thiết bị...');
  const [processing, setProcessing] = useState(false);
  const [speakerCount, setSpeakerCount] = useState(-1);
  const [result, setResult] = useState<OfflineDiarizationOutput | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    isOfflineDiarizationInstalled()
      .then((ready) => {
        setInstalled(ready);
        setStatus(ready ? 'Sẵn sàng chạy hoàn toàn offline.' : 'Cần tải model một lần.');
      })
      .catch((reason) => setError(errorMessage(reason)))
      .finally(() => setChecking(false));

    return () => {
      void releaseOfflineDiarization();
    };
  }, []);

  const installModels = useCallback(async () => {
    setError('');
    setInstalling(true);
    try {
      await installOfflineDiarization((value, message) => {
        setProgress(value);
        setStatus(message);
      });
      setInstalled(true);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setInstalling(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError('');
    setResult(null);
    try {
      await recorder.startRecording({
        sampleRate: 16000,
        channels: 1,
        encoding: 'pcm_16bit',
        enableProcessing: false,
        keepAwake: true,
      });
      setStatus('Đang ghi WAV 16 kHz trên thiết bị...');
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, [recorder]);

  const stopAndProcess = useCallback(async () => {
    setError('');
    setProcessing(true);
    try {
      const recording = await recorder.stopRecording();
      if (!recording?.fileUri) {
        throw new Error('Không tạo được file ghi âm WAV.');
      }
      setStatus('Đang phân tách người nói trên thiết bị...');
      const output = await diarizeAudioFile(recording.fileUri, speakerCount);
      setResult(output);
      setStatus(`Hoàn tất offline: tìm thấy ${output.numSpeakers} người nói.`);
    } catch (reason) {
      setError(errorMessage(reason));
      setStatus('Không thể xử lý bản ghi.');
    } finally {
      setProcessing(false);
    }
  }, [recorder, speakerCount]);

  const unavailable = Platform.OS === 'web';
  const busy = checking || installing || processing;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing.four,
          paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
        },
      ]}>
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle">Speaker diarization offline</ThemedText>
        <ThemedText themeColor="textSecondary">
          Chức năng riêng: thu audio PCM/WAV và chạy Sherpa-ONNX trên thiết bị để tạo timeline
          người nói. Audio không được gửi tới Gemini hoặc luồng phiên dịch.
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Model trên thiết bị</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {status}
          </ThemedText>
          {installing && (
            <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(progress * 100)}%`, backgroundColor: theme.primary },
                ]}
              />
            </View>
          )}
          {!installed && !unavailable && (
            <Pressable
              disabled={busy}
              onPress={installModels}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.primary },
                pressed && styles.pressed,
              ]}>
              <ThemedText style={styles.buttonText}>
                {installing ? `${Math.round(progress * 100)}%` : 'Tải model một lần (~35 MB)'}
              </ThemedText>
            </Pressable>
          )}
          {unavailable && (
            <ThemedText type="small" style={{ color: theme.star }}>
              Web chỉ hiển thị giao diện. Engine native cần Android/iOS development build.
            </ThemedText>
          )}
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Số người nói dự kiến</ThemedText>
          <View style={styles.options}>
            {SPEAKER_OPTIONS.map((value) => {
              const selected = value === speakerCount;
              return (
                <Pressable
                  key={value}
                  disabled={recorder.isRecording || processing}
                  onPress={() => setSpeakerCount(value)}
                  style={[
                    styles.option,
                    { backgroundColor: selected ? theme.primary : theme.backgroundSelected },
                  ]}>
                  <ThemedText type="smallBold" style={selected && styles.buttonText}>
                    {value === -1 ? 'Tự động' : value}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </ThemedView>

        <Pressable
          disabled={!installed || busy || unavailable}
          onPress={recorder.isRecording ? stopAndProcess : startRecording}
          style={({ pressed }) => [
            styles.recordButton,
            { backgroundColor: recorder.isRecording ? theme.danger : theme.primary },
            (!installed || busy || unavailable) && styles.disabled,
            pressed && styles.pressed,
          ]}>
          <ThemedText style={styles.buttonText}>
            {processing
              ? 'Đang xử lý offline...'
              : recorder.isRecording
                ? `Dừng và xử lý (${formatTime(recorder.durationMs)})`
                : 'Bắt đầu ghi âm'}
          </ThemedText>
        </Pressable>

        {!!error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}

        {result && (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">
              Kết quả: {result.numSpeakers} người nói · {formatTime(result.durationMs)}
            </ThemedText>
            {result.segments.map((segment, index) => (
              <View
                key={`${segment.speakerId}-${segment.startMs}-${index}`}
                style={[styles.segment, { borderBottomColor: theme.backgroundSelected }]}>
                <View
                  style={[styles.speakerDot, { backgroundColor: speakerColor(segment.speakerId) }]}
                />
                <ThemedText type="smallBold" style={styles.speakerLabel}>
                  {segment.speakerLabel}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatTime(segment.startMs)} – {formatTime(segment.endMs)}
                </ThemedText>
              </View>
            ))}
          </ThemedView>
        )}
      </ThemedView>
    </ScrollView>
  );
}

function speakerColor(speakerId: number) {
  const colors = ['#208AEF', '#E5484D', '#30A46C', '#AB4ABA', '#F5A524'];
  return colors[speakerId % colors.length];
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', paddingHorizontal: Spacing.four },
  container: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.four },
  card: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.three },
  progressTrack: { height: 8, overflow: 'hidden', borderRadius: 4 },
  progressFill: { height: '100%', borderRadius: 4 },
  primaryButton: {
    minHeight: 48,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  recordButton: {
    minHeight: 56,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  buttonText: { color: '#FFFFFF' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  option: { borderRadius: 999, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  segment: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  speakerDot: { width: 10, height: 10, borderRadius: 5 },
  speakerLabel: { flex: 1 },
});
