import { Dimensions, PixelRatio, type TextStyle } from 'react-native';

export const COLORS = {
  light: {
    bg: '#FFFFFF',
    elevated: '#FFFFFF',
    fg: '#162a4d',
    muted: '#6B7280',
    customHeader: '#FFFFFF',
    lightButton: 'rgba(0, 0, 0, 0.05)',
    modalButton: '#d4e2fb',
    cardGray: '#F2F2F7',
    tileBg: '#eef0f4',
    fieldBg: '#FFFFFF',
    fieldBorder: '#E4E5EA',
    inputBg: '#f5f5f5',
    inputBorder: '#d2d2d2',
    altText: '#8A8F98',
    labelText: '#81868E',
    accentBlue: '#0A84FF',
    accentSoftBg: 'rgba(10, 132, 255, 0.12)',
    accentSoftFg: '#0A84FF',
    accentPurple: '#7C3AED',
    accentOrange: '#F7931A',
    accentGreen: '#23b694',
    dockBg: 'rgba(28,28,30,0.82)',
    dockBorder: 'rgba(255,255,255,0.2)',
    buttonText: '#FFFFFF',
    txInBg: 'rgba(31, 221, 26, 0.2)',
    txInFg: '#23b694',
    txOutBg: 'rgba(234, 51, 47, 0.2)',
    txOutFg: '#dc2433',
    txPendingBg: 'rgba(0, 60, 240, 0.1)',
    txPendingFg: '#2e63d6',
    skeleton: '#E9EBEE',
    txdMuted: '#9aa0aa',
    txdBorder: 'rgba(0,0,0,0.05)',
    txdRowBg: '#F9F9F9',
    txdHeaderBg: '#F2F2F2',
    txdInCardBg: '#d2f8d6',
    txdOutCardBg: '#f8d2d2',
    txdPendingCardBg: '#DBEFFD',
    txdInLabel: '#63BDA2',
    txdOutLabel: '#BF2828',
    txdPendingLabel: '#2e63d6',
    ccFrozenBg: '#F8D2D2',
    ccSelectedBg: '#EEF0F4',
    ccDivider: '#ededed',
  },
  dark: {
    bg: '#000000',
    elevated: '#121212',
    fg: '#FFFFFF',
    muted: '#98989F',
    customHeader: '#000000',
    lightButton: 'rgba(255,255,255,0.1)',
    modalButton: '#000000',
    cardGray: '#1C1C1E',
    tileBg: '#3A3A3C',
    fieldBg: '#2C2C2E',
    fieldBorder: '#3A3A3C',
    inputBg: '#262626',
    inputBorder: '#202020',
    altText: '#98989F',
    labelText: '#FFFFFF',
    accentBlue: '#0A84FF',
    accentSoftBg: 'rgba(10, 132, 255, 0.22)',
    accentSoftFg: '#409CFF',
    accentPurple: '#9466FF',
    accentOrange: '#F7931A',
    accentGreen: '#37C0A1',
    dockBg: 'rgba(118,118,122,0.42)',
    dockBorder: 'rgba(255,255,255,0.2)',
    buttonText: '#FFFFFF',
    txInBg: 'rgba(31, 221, 26, 0.2)',
    txInFg: '#37C0A1',
    txOutBg: 'rgba(234, 51, 47, 0.2)',
    txOutFg: '#FC6D6D',
    txPendingBg: 'rgba(90, 158, 255, 0.3)',
    txPendingFg: '#5A9EFF',
    skeleton: '#3A3A3C',
    txdMuted: '#9aa0aa',
    txdBorder: 'rgba(255,255,255,0.08)',
    txdRowBg: '#1C1C1E',
    txdHeaderBg: '#2C2C2E',
    txdInCardBg: 'rgba(5,159,54,0.3)',
    txdOutCardBg: 'rgba(187,6,6,0.2)',
    txdPendingCardBg: 'rgba(10,132,255,0.15)',
    txdInLabel: '#37C0A1',
    txdOutLabel: '#FC6D6D',
    txdPendingLabel: '#5A9EFF',
    ccFrozenBg: '#5A4E4E',
    ccSelectedBg: '#202020',
    ccDivider: '#313030',
  },
};

export type ColorScheme = typeof COLORS.light;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHORT_SIDE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT);
const BASE_WIDTH = 375;

export const ms = (size: number, factor = 0.5): number =>
  PixelRatio.roundToNearestPixel(size + (SHORT_SIDE / BASE_WIDTH - 1) * size * factor);

export const fs = (size: number): number => {
  const scaled = ms(size, 0.4);
  const lo = Math.round(size * 0.88);
  const hi = Math.round(size * 1.12);
  return Math.max(lo, Math.min(hi, scaled));
};

type Role = { fontSize: number; lineHeight: number; fontWeight: TextStyle['fontWeight'] };

const role = (size: number, weight: TextStyle['fontWeight'], lineHeightRatio = 1.3): Role => {
  const fontSize = fs(size);
  return { fontSize, lineHeight: Math.round(fontSize * lineHeightRatio), fontWeight: weight };
};

export const TYPE = {
  welcomeTitle: role(34, '700', 1.14),
  balance: role(32, '700', 1.1),
  totalBalance: role(36, '700', 1.05),
  welcomeSub: role(14, '400', 1.45),
  headerTitle: role(19, '600', 1.2),
  cardTitle: role(18, '700', 1.25),
  cardSubtitle: role(13, '400', 1.35),
  cardDesc: role(14, '400', 1.45),
  button: role(16, '600', 1.2),
  toggle: role(16, '600', 1.2),
  seedWord: role(17, '700', 1.3),
  phraseIntro: role(16, '500', 1.4),
  caption: role(13, '400', 1.45),
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
};

export const RADIUS = {
  chip: 4,
  control: 14,
  card: 20,
  button: 25,
};

export const SIZE = {
  buttonHeight: 48,
  buttonMinHeight: 45,
  buttonPadH: 16,
  iconBox: 46,
  iconGlyph: ms(24),
  headerHeight: 56,
  cardPad: 18,
  closeHit: 12,
};
