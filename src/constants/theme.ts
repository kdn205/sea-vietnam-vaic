/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Tokens lifted from Gemini's own Material 3 palette (light: white surface + soft
// blue-gray chips; dark: near-black #131314 surface) rather than a generic blue theme.
export const Colors = {
  light: {
    text: '#1F1F1F',
    background: '#FFFFFF',
    backgroundElement: '#F0F4F9',
    backgroundSelected: '#E1E7F5',
    textSecondary: '#5F6368',
    primary: '#0B57D0',
    primaryPressed: '#0842A0',
    primarySoft: '#E8F0FE',
    primarySoftBorder: '#D2E3FC',
    success: '#1E8E3E',
    border: '#E1E3E1',
    card: '#F0F4F9',
    chatBubbleMine: '#F0F4F9',
    chatBubbleTheirs: '#FFFFFF',
    danger: '#D93025',
    star: '#F9AB00',
    sidebarBackground: '#FFFFFF',
    hostName: '#9A3B32',
    participantName: '#7C3AED',
  },
  dark: {
    text: '#E3E3E3',
    background: '#131314',
    backgroundElement: '#1E1F20',
    backgroundSelected: '#2D2F31',
    textSecondary: '#9AA0A6',
    primary: '#A8C7FA',
    primaryPressed: '#8AB4F8',
    primarySoft: '#1F3760',
    primarySoftBorder: '#2F4A78',
    success: '#81C995',
    border: '#3C4043',
    card: '#1E1F20',
    chatBubbleMine: '#333537',
    chatBubbleTheirs: '#131314',
    danger: '#F28B82',
    star: '#FDD663',
    sidebarBackground: '#131314',
    hostName: '#D98C7F',
    participantName: '#C4B5FD',
  },
} as const;

/** The blue -> violet -> coral gradient Gemini uses for its spark/"auto_awesome" mark. */
export const SparkleGradient = ['#4C8DF6', '#9168C0', '#D96570'] as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

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
