/**
 * Premium Fintech Ink Wash Color Palette
 * ──────────────────────────────────────
 * Charcoal black, cool gray, and soft ivory create
 * a gallery-like aesthetic with high contrast and elegance.
 *
 * Base:   #121212 (charcoal black)
 * Card:   #1a1a1a (soft elevated surface)
 * Ivory:  #f5f5f0 (warm white text)
 * Gray:   #6b6b6b (muted elements)
 * Accent: #7dd3a1 (soft sage green — muted, not vibrant)
 */

import { Platform } from 'react-native';

export const FinColors = {
  // backgrounds — charcoal tones
  bgBase: '#0d0d0d',       // deepest charcoal — main screen bg
  bgCard: '#171717',       // card background — soft elevation
  bgElevated: '#222222',   // elevated surfaces / filter pills
  bgInput: '#1a1a1a',

  // text — ivory & cool grays
  textPrimary: '#f5f5f0',   // soft ivory
  textSecondary: '#a3a3a3', // warm gray
  textMuted: '#6b6b6b',     // cool muted gray

  // accent — soft sage green (muted, not vibrant)
  green: '#7dd3a1',
  greenBg: 'rgba(125,211,161,0.08)',
  greenBorder: 'rgba(125,211,161,0.20)',

  // negative
  red: '#e57373',
  redBg: 'rgba(229,115,115,0.08)',

  // borders — subtle charcoal
  border: '#1f1f1f',
  borderSubtle: 'rgba(245,245,240,0.06)',

  // tab bar
  tabBg: '#0a0a0a',
  tabActive: '#f5f5f0',     // ivory for active tab
  tabInactive: '#525252',
};

export const Colors = {
  light: {
    text: '#f5f5f0',
    background: '#0d0d0d',
    tint: '#7dd3a1',
    icon: '#a3a3a3',
    tabIconDefault: '#525252',
    tabIconSelected: '#f5f5f0',
  },
  dark: {
    text: '#f5f5f0',
    background: '#0d0d0d',
    tint: '#7dd3a1',
    icon: '#a3a3a3',
    tabIconDefault: '#525252',
    tabIconSelected: '#f5f5f0',
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
