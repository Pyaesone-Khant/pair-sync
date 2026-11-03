/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

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

/**
 * Global design tokens adhering to frontend-design and Vercel React Native design principles.
 * Ensures strict cross-screen UI consistency.
 */
export const DesignTokens = {
  colors: {
    bgPrimary: '#0B0F17',
    bgCard: '#151B26',
    bgElevated: '#1E293B',
    borderSubtle: '#232B3A',
    borderFocus: '#334155',
    accentCyan: '#38BDF8',
    accentEmerald: '#10B981',
    accentRose: '#F43F5E',
    accentAmber: '#F59E0B',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
  },
  radii: {
    xs: 6,
    sm: 8,
    md: 10,
    lg: 14,
    xl: 18,
    full: 9999,
  },
  typography: {
    screenTitle: {
      fontSize: 22,
      fontWeight: '700' as const,
      letterSpacing: -0.5,
    },
    screenSubtitle: {
      fontSize: 12,
      fontWeight: '400' as const,
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: '600' as const,
      letterSpacing: -0.3,
    },
  },
} as const;
