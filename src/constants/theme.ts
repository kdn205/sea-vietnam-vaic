/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Apple Human Interface Guidelines-style palette: system blue accent, iOS label/secondary-label
// grays, and a grouped-list background/card split (screen background vs. elevated card surface).
export const Colors = {
  light: {
    text: '#000000',
    textSecondary: '#6E6E73',
    background: '#FFFFFF',
    // Screen-level backdrop for grouped/list layouts (iOS systemGroupedBackground) - sits
    // just behind `card` surfaces so cards read as elevated instead of flat.
    groupedBackground: '#F2F2F7',
    card: '#FFFFFF',
    border: '#E5E5EA',
    primary: '#007AFF',
    primaryPressed: '#0064D1',
    primarySoft: '#E8F1FE',
    primarySoftBorder: '#CFE3FE',
    success: '#34C759',
    danger: '#FF3B30',
    star: '#FF9F0A',
    chatBubbleMine: '#E8F1FE',
    chatBubbleTheirs: '#F2F2F7',
    speakerHost: '#B8442A',
    speakerGuest: '#7C4DBF',
    // Frosted-glass fallback for platforms without expo-glass-effect's native Liquid Glass
    // material (Android/web) - a translucent tinted surface standing in for the real blur.
    glassBackground: 'rgba(255, 255, 255, 0.78)',
    glassBorder: 'rgba(255, 255, 255, 0.9)',
    // Faint top-edge highlight painted over solid buttons/cards for a glossier, raised feel.
    highlight: 'rgba(255, 255, 255, 0.35)',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    background: '#000000',
    groupedBackground: '#000000',
    card: '#1C1C1E',
    border: '#38383A',
    primary: '#0A84FF',
    primaryPressed: '#409CFF',
    primarySoft: '#0F2A4A',
    primarySoftBorder: '#1D3A5F',
    success: '#30D158',
    danger: '#FF453A',
    star: '#FF9F0A',
    chatBubbleMine: '#0F2A4A',
    chatBubbleTheirs: '#1C1C1E',
    speakerHost: '#E38C6C',
    speakerGuest: '#B896EE',
    glassBackground: 'rgba(28, 28, 30, 0.78)',
    glassBorder: 'rgba(255, 255, 255, 0.16)',
    highlight: 'rgba(255, 255, 255, 0.08)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// Corner-radius scale matching iOS's rounded-rect language, from small chips to sheet corners.
export const Radius = {
  small: 10,
  medium: 14,
  large: 20,
  xlarge: 28,
  pill: 999,
} as const;

// Elevation presets - a soft, diffuse drop shadow so cards/buttons/floating bars read as
// physically raised above the screen instead of flat, à la iOS's layered depth.
export const Shadow = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
