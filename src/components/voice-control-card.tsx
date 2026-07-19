import { GlassView } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { SensitivitySlider } from '@/components/sensitivity-slider';
import { Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

const BAR_COUNT = 20;
const MIN_HEIGHT = 5;
const MAX_EXTRA_HEIGHT = 26;

// Relative height multiplier per bar - like a real spectrum/EQ display, bars are uneven left
// to right (not one smooth bell curve bulging in the middle). Combines a few sine waves of
// different periods into an irregular but deterministic per-bar profile, so it stays stable
// across re-renders instead of re-randomizing.
const BAR_SHAPE = Array.from({ length: BAR_COUNT }, (_, i) => {
  const t = i / (BAR_COUNT - 1);
  const wave =
    Math.sin(t * Math.PI * 5.3 + 0.6) * 0.5 +
    Math.sin(t * Math.PI * 2.1 + 2.4) * 0.3 +
    Math.sin(t * Math.PI * 9.7 + 1.1) * 0.2;
  return 0.35 + 0.55 * ((wave + 1) / 2);
});

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mixHex(from: string, to: string, t: number) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

// Smooth left-to-right blend across the bar - blue into amber into violet.
const GRADIENT_STOPS = ['#1976D2', '#F5A623', '#8B5CF6'];
const BAR_COLORS = BAR_SHAPE.map((_, i) => {
  const t = i / (BAR_COUNT - 1);
  const segment = t * (GRADIENT_STOPS.length - 1);
  const idx = Math.min(GRADIENT_STOPS.length - 2, Math.floor(segment));
  return mixHex(GRADIENT_STOPS[idx], GRADIENT_STOPS[idx + 1], segment - idx);
});

function Bar({ volume, shape, color }: { volume: SharedValue<number>; shape: number; color: string }) {
  const style = useAnimatedStyle(() => ({
    height: MIN_HEIGHT + volume.value * MAX_EXTRA_HEIGHT * shape,
  }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

type Props = {
  volume: SharedValue<number>;
  isRunning: boolean;
  elapsedSec: number;
  onToggleRunning: () => void;
  micSensitivity: number;
  onMicSensitivityChange: (value: number) => void;
};

/** Single glass card combining the record button, live waveform, and mic-sensitivity slider -
 * like an iMessage voice-note bubble instead of separate boxes stacked on top of each other.
 * Uses the real iOS Liquid Glass material via expo-glass-effect; falls back to a translucent
 * tinted surface on Android/web where that native material isn't available. Wrapped in a plain
 * shadow-casting View so it visibly lifts off the grouped background instead of sitting flush. */
export function VoiceControlCard({
  volume,
  isRunning,
  elapsedSec,
  onToggleRunning,
  micSensitivity,
  onMicSensitivityChange,
}: Props) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View style={styles.shadowWrap}>
      <GlassView
        glassEffectStyle="regular"
        style={[
          styles.card,
          Platform.OS !== 'ios' && {
            backgroundColor: theme.glassBackground,
            borderColor: theme.glassBorder,
            borderWidth: 1,
          },
        ]}
      >
        <View pointerEvents="none" style={[styles.topHighlight, { backgroundColor: theme.highlight }]} />

        <View style={styles.row}>
          <View style={styles.bars}>
            {BAR_SHAPE.map((shape, i) => (
              <Bar key={i} volume={volume} shape={shape} color={BAR_COLORS[i]} />
            ))}
          </View>

          <View style={styles.trailing}>
            {isRunning && <View style={[styles.recDot, { backgroundColor: theme.danger }]} />}
            <Text style={[styles.timer, { color: theme.textSecondary }]}>{formatElapsed(elapsedSec)}</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.sensitivityRow}>
          <Text style={[styles.sensitivityLabel, { color: theme.textSecondary }]}>
            {t('micSensitivity')} · {Math.round(micSensitivity * 100)}%
          </Text>
          <SensitivitySlider value={micSensitivity} onValueChange={onMicSensitivityChange} />
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.playRow}>
          <View style={styles.playShadowWrap}>
            <Pressable onPress={onToggleRunning} style={[styles.playButton, { backgroundColor: theme.primary }]}>
              <View pointerEvents="none" style={[styles.playHighlight, { backgroundColor: theme.highlight }]} />
              <SymbolView
                name={{ ios: isRunning ? 'pause.fill' : 'play.fill', android: isRunning ? 'pause' : 'play_arrow', web: isRunning ? 'pause' : 'play_arrow' }}
                tintColor="#FFFFFF"
                size={24}
              />
            </Pressable>
          </View>
        </View>
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    ...Shadow.medium,
  },
  card: {
    borderRadius: Radius.xlarge,
    padding: 10,
    paddingTop: 12,
    overflow: 'hidden',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    borderTopLeftRadius: Radius.xlarge,
    borderTopRightRadius: Radius.xlarge,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playRow: {
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 4,
  },
  playShadowWrap: {
    ...Shadow.small,
    borderRadius: 28,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  bars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: MIN_HEIGHT + MAX_EXTRA_HEIGHT,
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
  },
  trailing: {
    alignItems: 'center',
    gap: 3,
    paddingRight: 4,
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timer: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },
  sensitivityRow: {
    gap: 8,
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  sensitivityLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
