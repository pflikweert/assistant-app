/**
 * Fintech dark mode color palette.
 * Primary: #0f172a (deep navy background)
 * Accent:  #22c55e (green for positive values)
 * Cards:   #1e293b (slightly lighter navy for cards)
 * Muted:   #64748b (muted text / icons)
 */

import { Platform } from 'react-native';

export const FinColors = {
  // backgrounds
  bgBase: '#0f172a',       // deep navy — main screen bg
  bgCard: '#1e293b',       // card background
  bgElevated: '#273549',   // slightly elevated surfaces / filter pills
  bgInput: '#1e293b',

  // text
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',

  // accent
  green: '#22c55e',
  greenBg: 'rgba(34,197,94,0.12)',
  greenBorder: 'rgba(34,197,94,0.35)',

  // negative / neutral
  red: '#f87171',
  redBg: 'rgba(248,113,113,0.12)',

  // borders
  border: '#1e293b',
  borderSubtle: 'rgba(148,163,184,0.12)',

  // tab bar
  tabBg: '#0d1526',
  tabActive: '#22c55e',
  tabInactive: '#64748b',
};

export const Colors = {
  light: {
    text: '#f1f5f9',
    background: '#0f172a',
    tint: '#22c55e',
    icon: '#94a3b8',
    tabIconDefault: '#64748b',
    tabIconSelected: '#22c55e',
  },
  dark: {
    text: '#f1f5f9',
    background: '#0f172a',
    tint: '#22c55e',
    icon: '#94a3b8',
    tabIconDefault: '#64748b',
    tabIconSelected: '#22c55e',
  },
};

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
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
