import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

const BAR_COUNT = 28;
const MIN_HEIGHT = 4;
const MAX_EXTRA_HEIGHT = 30;

// Colorful stops matching a voice-memo style waveform (violet -> blue -> orange -> red),
// fading to a muted tail on the right rather than one flat color for every bar.
const COLOR_STOPS: [number, string][] = [
  [0, '#7C3AED'],
  [0.25, '#4F46E5'],
  [0.45, '#0EA5E9'],
  [0.65, '#F59E0B'],
  [0.8, '#EF4444'],
  [1, '#9CA3AF'],
];

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function colorAt(t: number) {
  let lo = COLOR_STOPS[0];
  let hi = COLOR_STOPS[COLOR_STOPS.length - 1];
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (t >= COLOR_STOPS[i][0] && t <= COLOR_STOPS[i + 1][0]) {
      lo = COLOR_STOPS[i];
      hi = COLOR_STOPS[i + 1];
      break;
    }
  }
  const span = hi[0] - lo[0] || 1;
  const localT = (t - lo[0]) / span;
  const [r1, g1, b1] = hexToRgb(lo[1]);
  const [r2, g2, b2] = hexToRgb(hi[1]);
  const r = Math.round(r1 + (r2 - r1) * localT);
  const g = Math.round(g1 + (g2 - g1) * localT);
  const b = Math.round(b1 + (b2 - b1) * localT);
  return `rgb(${r}, ${g}, ${b})`;
}

// Full-height oscillation through the first ~60% of the bars, then tapering down toward
// the right edge, so the strip reads as "lively" on the left and "quiet" on the right.
const BAR_SHAPE = Array.from({ length: BAR_COUNT }, (_, i) => {
  const t = i / (BAR_COUNT - 1);
  const envelope = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
  return (0.3 + 0.7 * Math.sin(t * Math.PI * 3 + i)) * Math.max(0.12, envelope);
});
const BAR_COLORS = BAR_SHAPE.map((_, i) => colorAt(i / (BAR_COUNT - 1)));

function Bar({ volume, shape, color }: { volume: SharedValue<number>; shape: number; color: string }) {
  const style = useAnimatedStyle(() => ({
    height: MIN_HEIGHT + volume.value * MAX_EXTRA_HEIGHT * Math.abs(shape),
  }));
  return <Animated.View style={[styles.bar, style, { backgroundColor: color }]} />;
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type Props = {
  volume: SharedValue<number>;
  /** When provided, shows an M:SS elapsed timer underneath, counting up while true. */
  isRunning?: boolean;
};

/** Reacts in real time to the recognizer's `volumechange` event (see index.tsx). */
export function Waveform({ volume, isRunning }: Props) {
  const theme = useTheme();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning) {
      setElapsed(0);
      return;
    }
    const startedAt = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {BAR_SHAPE.map((shape, i) => (
          <Bar key={i} volume={volume} shape={shape} color={BAR_COLORS[i]} />
        ))}
      </View>
      {isRunning !== undefined && (
        <Text style={[styles.timer, { color: theme.textSecondary }]}>{formatElapsed(elapsed)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
    height: MIN_HEIGHT + MAX_EXTRA_HEIGHT,
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
  },
  timer: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
