/**
 * Premium Fintech Light Palette
 * ─────────────────────────────
 * Warm whites and soft grays keep the product calm and readable.
 * Yellow is reserved for focus, CTA, and highlights.
 */

import { Platform } from 'react-native';

export const FinColors = {
  bgBase: '#f6f5f2',
  bgCard: '#ffffff',
  bgElevated: '#efede7',
  bgInput: '#f1efea',

  textPrimary: '#111111',
  textSecondary: '#5f5a54',
  textMuted: '#8f8a83',

  green: '#2f7d57',
  greenBg: 'rgba(47,125,87,0.10)',
  greenBorder: 'rgba(47,125,87,0.18)',

  yellow: '#f2c94c',
  yellowSoft: '#fff5cc',
  warningBg: '#fff8dd',
  warningBorder: 'rgba(242,201,76,0.34)',
  warningText: '#8a6400',

  red: '#c55d4c',
  redBg: 'rgba(197,93,76,0.10)',

  border: '#dedad2',
  borderSubtle: 'rgba(17,17,17,0.08)',

  tabBg: '#ffffff',
  tabActive: '#111111',
  tabInactive: '#8f8a83',
};

export const Colors = {
  light: {
    text: '#111111',
    background: '#f6f5f2',
    tint: '#f2c94c',
    icon: '#5f5a54',
    tabIconDefault: '#8f8a83',
    tabIconSelected: '#111111',
  },
  dark: {
    text: '#111111',
    background: '#f6f5f2',
    tint: '#f2c94c',
    icon: '#5f5a54',
    tabIconDefault: '#8f8a83',
    tabIconSelected: '#111111',
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
