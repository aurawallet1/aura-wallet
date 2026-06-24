import type { DisplayUnit } from '../types/index';
import { SATS_PER_BTC } from '../constants/bitcoin';

export type { DisplayUnit };

const BTC_DECIMALS = 8;

const groupThousands = (digits: string): string =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const stripTrailingZeros = (value: string): string => {
  if (value.indexOf('.') === -1) return value;
  return value.replace(/\.?0+$/, '');
};

const satsToBtc = (sats: number): number => sats / SATS_PER_BTC;

export function formatBtc(sats: number): string {
  return satsToBtc(sats).toFixed(BTC_DECIMALS);
}

export function formatBtcTrim(sats: number): string {
  return stripTrailingZeros(satsToBtc(sats).toFixed(BTC_DECIMALS));
}

export function unitLabel(unit: DisplayUnit): string {
  return unit === 'sats' ? 'sats' : 'BTC';
}

export function formatUnit(sats: number, unit: DisplayUnit): string {
  if (unit === 'sats') {
    const whole = Math.round(sats);
    const sign = whole < 0 ? '-' : '';
    return sign + groupThousands(String(Math.abs(whole)));
  }
  return stripTrailingZeros(satsToBtc(sats).toFixed(BTC_DECIMALS));
}

export function fiatDisplay(
  sats: number,
  rate: number | null | undefined,
  symbol = '$',
): string {
  if (!rate || rate <= 0) return '…';
  const value = satsToBtc(sats) * rate;
  const magnitude = Math.abs(value);
  const rendered =
    magnitude === 0 || magnitude >= 0.005
      ? value.toFixed(2)
      : Number(value.toPrecision(2)).toString();
  const negative = rendered.startsWith('-');
  const unsigned = negative ? rendered.slice(1) : rendered;
  const [integerPart, fraction = ''] = unsigned.split('.');
  const grouped = groupThousands(integerPart);
  const fractionPart = fraction ? '.' + fraction : '';
  return `${negative ? '-' : ''}${symbol}${grouped}${fractionPart}`;
}

export function formatFiat(btc: number, rate: number, code = 'USD'): string {
  const fixed = (btc * rate).toFixed(2);
  const [integerPart, fraction] = fixed.split('.');
  const negative = integerPart.startsWith('-');
  const unsigned = negative ? integerPart.slice(1) : integerPart;
  const grouped = groupThousands(unsigned);
  return `${negative ? '-' : ''}${grouped}.${fraction} ${code}`;
}
