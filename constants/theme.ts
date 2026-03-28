/**
 * Premium Fintech Light Palette
 * ─────────────────────────────
 * Warm whites and soft grays keep the product calm and readable.
 * Yellow is reserved for focus, CTA, and highlights.
 */

import { Platform } from 'react-native';

const finColor = {
  bgBase: '#f6f5f2',
  topBarBg: '#f7f9fb',
  bgCard: '#ffffff',
  bgElevated: '#efede7',
  bgInput: '#f1efea',

  textPrimary: '#111111',
  textSecondary: '#5f5a54',
  textMuted: '#6f6a63',

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
  redBorder: 'rgba(197,93,76,0.18)',
  overlayBackdrop: 'rgba(17,17,17,0.28)',
  overlayStrong: 'rgba(17,17,17,0.45)',
  surfaceOverlay: 'rgba(17,17,17,0.04)',

  border: '#dedad2',
  borderSubtle: 'rgba(17,17,17,0.08)',

  tabBg: '#ffffff',
  tabActive: '#111111',
  tabInactive: '#8f8a83',
} as const;

const finSpacing = {
  none: 0,
  xxs: 4,
  xs: 8,
  'xs-plus': 10,
  s: 12,
  's-plus': 14,
  m: 16,
  'm-plus': 20,
  l: 24,
  'l-plus': 28,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
  '4xl': 64,

  // Backward-compatible aliases
  x0: 0,
  x1: 4,
  x2: 8,
  x3: 12,
  x4: 16,
  x5: 20,
  x6: 24,
  x7: 28,
  x8: 32,
  x9: 36,
  x10: 40,
  x12: 48,
  x14: 56,
  x16: 64,
  x20: 80,
  x32: 128,
} as const;

const finRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  sheet: 34,
  pill: 999,
} as const;

const finTypography = {
  label: { fontSize: 12, lineHeight: 16, letterSpacing: 1.2 },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  'body-sm': { fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  body: { fontSize: 16, lineHeight: 24, letterSpacing: 0.1 },
  'body-lg': { fontSize: 18, lineHeight: 26, letterSpacing: 0 },
  'title-sm': { fontSize: 20, lineHeight: 28, letterSpacing: -0.2 },
  title: { fontSize: 24, lineHeight: 32, letterSpacing: -0.4 },
  h3: { fontSize: 28, lineHeight: 36, letterSpacing: -0.6 },
  h2: { fontSize: 34, lineHeight: 42, letterSpacing: -0.8 },
  h1: { fontSize: 44, lineHeight: 52, letterSpacing: -1.1 },
} as const;

const finFontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;

const finIcon = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
} as const;

export const FinTokens = {
  color: {
    ...finColor,
    surface: finColor.bgCard,
    surfaceSoft: finColor.bgElevated,
    surfaceMuted: finColor.bgInput,
    accent: finColor.yellow,
    accentText: finColor.warningText,
    success: finColor.green,
    warning: finColor.warningText,
    danger: finColor.red,
    info: '#4f73b8',
    statusGoodBg: '#e7f3a8',
    statusGoodText: '#5b6a1b',
  },
  spacing: finSpacing,
  radius: finRadius,
  typography: finTypography,
  fontWeight: finFontWeight,
  icon: finIcon,
} as const;

// Backward-compatible aliases
export const FinColors = FinTokens.color;
export const FinColorTokens = FinTokens.color;
export const FinSpacing = FinTokens.spacing;
export const FinRadius = FinTokens.radius;
export const FinTypography = FinTokens.typography;
export const FinFontWeight = FinTokens.fontWeight;
export const FinIconSize = FinTokens.icon;

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

export const FinSurfaces = {
  topLevelCard: {
    backgroundColor: FinColors.bgCard,
    borderWidth: 0,
    borderColor: "transparent",
    boxShadow: "0px 6px 12px rgba(17,17,17,0.03)",
    elevation: 1,
  },
} as const;
