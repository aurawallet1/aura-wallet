import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { COLORS } from '../theme';
import type { FiatUnit } from '../types/index';

export type SendUnit = 'BTC' | 'sats' | 'fiat';

const SATS_PER_BTC = 100_000_000;

const reverseRoundTrip: Record<string, string> = {};

const fiatCacheKey = (value: string, rate: number | null): string => `${value}|${rate ?? 0}|fiat`;

const trimBtc = (sats: number): string => {
  const btc = sats / SATS_PER_BTC;
  if (!Number.isFinite(btc)) return '0';
  let text = btc.toFixed(8);
  if (text.indexOf('.') !== -1) {
    text = text.replace(/0+$/, '').replace(/\.$/, '');
  }
  return text.length ? text : '0';
};

const fiatPlain = (sats: number, rate: number): string => {
  const value = (sats / SATS_PER_BTC) * rate;
  const magnitude = Math.abs(value);
  const rendered = magnitude === 0 || magnitude >= 0.005 ? value.toFixed(2) : Number(value.toPrecision(2)).toString();
  return rendered.replace(/\.00$/, '');
};

const fiatGrouped = (sats: number, rate: number, locale: string, symbol: string): string => {
  const value = (sats / SATS_PER_BTC) * rate;
  try {
    const body = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    return `${symbol}${body}`;
  } catch {
    return `${symbol}${value.toFixed(2)}`;
  }
};

const cleanInput = (raw: string, unit: SendUnit): string => {
  if (unit === 'sats') return raw.replace(/[^0-9]/g, '');
  return raw
    .replace(/[^0-9.,]/g, '')
    .replace(',', '.')
    .replace(/(\..*)\./g, '$1');
};

export const amountToSats = (amount: string, unit: SendUnit, rate: number | null): number => {
  if (unit === 'fiat') {
    const pinned = reverseRoundTrip[fiatCacheKey(amount, rate)];
    if (pinned != null) return Number(pinned);
  }
  const parsed = parseFloat(amount);
  const value = Number.isFinite(parsed) ? parsed : 0;
  if (unit === 'BTC') return Math.round(value * SATS_PER_BTC);
  if (unit === 'sats') return Math.round(value);
  return rate ? Math.round((value / rate) * SATS_PER_BTC) : 0;
};

const nextUnit = (unit: SendUnit): SendUnit => {
  if (unit === 'BTC') return 'sats';
  if (unit === 'sats') return 'fiat';
  return 'BTC';
};

export interface SendAmountFieldProps {
  isDark: boolean;
  rate: number | null;
  amount: string;
  onChangeAmount: (next: string) => void;
  unit: SendUnit;
  setUnit: React.Dispatch<React.SetStateAction<SendUnit>>;
  accessoryID: string;
  currency: FiatUnit;
  changeCurrencyLabel: string;
}

const SendAmountField: React.FC<SendAmountFieldProps> = ({
  isDark,
  rate,
  amount,
  onChangeAmount,
  unit,
  setUnit,
  accessoryID,
  currency,
  changeCurrencyLabel,
}) => {
  const [measuredWidth, setMeasuredWidth] = useState(0);

  const shown = amount || '0';
  const glyphSize = shown.length > 10 ? 20 : 36;
  const lineHeight = Math.round(glyphSize * 1.15);
  const tint = isDark ? COLORS.dark.accentBlue : '#0f5cc0';

  const onToggleUnit = useCallback(() => {
    const target = nextUnit(unit);
    const baseSats = amountToSats(amount, unit, rate);
    let converted: string;
    if (target === 'sats') {
      converted = String(baseSats);
    } else if (target === 'BTC') {
      converted = trimBtc(baseSats);
    } else {
      converted = rate ? fiatPlain(baseSats, rate) : '0';
    }
    if (target === 'fiat' && rate) {
      reverseRoundTrip[fiatCacheKey(converted, rate)] = String(baseSats);
    }
    onChangeAmount(converted);
    setUnit(target);
  }, [amount, unit, rate, onChangeAmount, setUnit]);

  const subline = useMemo(() => {
    const baseSats = amountToSats(amount, unit, rate);
    if (unit === 'fiat') {
      return rate ? `${trimBtc(baseSats)} BTC` : '0 BTC';
    }
    return rate ? fiatGrouped(baseSats, rate, currency.locale, currency.symbol) : `${currency.symbol}0.00`;
  }, [amount, unit, rate, currency]);

  return (
    <View style={styles.root}>
      <View style={styles.rail} />
      <View style={styles.center}>
        <View style={[styles.row, unit !== 'fiat' && styles.cryptoShift]}>
          {unit === 'fiat' ? <Text style={[styles.fiatSymbol, { color: tint }]}>{currency.symbol}</Text> : null}
          <Text
            style={[styles.sizer, { fontSize: glyphSize, lineHeight }]}
            allowFontScaling={false}
            onLayout={event => setMeasuredWidth(event.nativeEvent.layout.width)}>
            {shown}
          </Text>
          <TextInput
            style={[styles.input, { width: Math.max(measuredWidth, 14), fontSize: glyphSize, lineHeight, color: tint }]}
            value={amount}
            onChangeText={text => onChangeAmount(cleanInput(text, unit))}
            inputAccessoryViewID={Platform.OS === 'ios' ? accessoryID : undefined}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={tint}
            maxLength={unit === 'BTC' ? 11 : 15}
            allowFontScaling={false}
            selectionColor={tint}
          />
          {unit !== 'fiat' ? <Text style={[styles.unitSuffix, { color: tint }]}>{unit}</Text> : null}
        </View>
        <Text style={styles.subline}>{subline}</Text>
      </View>
      <Pressable style={styles.rail} onPress={onToggleUnit} hitSlop={8} accessibilityLabel={changeCurrencyLabel}>
        <MaterialIcons name="sync-alt" size={24} color={tint} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  rail: { width: 24, alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  center: { flex: 1, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 16, paddingBottom: 2, direction: 'ltr' },
  cryptoShift: { marginLeft: -12 },
  sizer: { position: 'absolute', opacity: 0, fontWeight: 'bold' },
  input: { fontWeight: 'bold', padding: 0, textAlign: 'center', writingDirection: 'ltr' },
  fiatSymbol: { fontSize: 18, fontWeight: 'bold', marginRight: 2 },
  unitSuffix: { fontSize: 15, fontWeight: '600', marginLeft: 2 },
  subline: { fontSize: 16, color: '#9BA0A9', fontWeight: '600', marginTop: 6, marginBottom: 22, writingDirection: 'ltr' },
});

export default SendAmountField;
