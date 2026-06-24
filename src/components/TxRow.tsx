import React from 'react';
import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import loc from '../i18n';
import { SPACING, type ColorScheme } from '../theme';
import type { HistoryTx } from '../types';
import BitcoinCoinIcon from './BitcoinCoinIcon';
import PendingTxIcon from './PendingTxIcon';

dayjs.extend(relativeTime);

const IS_RTL = I18nManager.isRTL;
const CONFIRMED_THRESHOLD = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const GLYPH_SIZE = 32;

const effectiveTime = (tx: HistoryTx): number =>
  tx.blockTime > 0 ? tx.blockTime : Math.floor(Date.now() / 1000) - 30;

const describeDate = (unixSeconds: number): string => {
  const millis = unixSeconds * 1000;
  const now = dayjs();
  const elapsed = now.valueOf() - millis;
  if (elapsed >= 0 && elapsed < ONE_DAY_MS) {
    return dayjs(millis).fromNow();
  }
  const sameYear = dayjs(millis).year() === now.year();
  return dayjs(millis).format(sameYear ? 'MMM D, h:mm a' : 'MMM D, YYYY h:mm a');
};

export type TxRowProps = {
  tx: HistoryTx;
  c: ColorScheme;
  fmt: (sats: number) => string;
  onPress?: () => void;
};

const TxRow = ({ tx, c, fmt, onPress }: TxRowProps) => {
  const isInbound = tx.balance_diff >= 0;
  const isPending = isInbound ? tx.confirmations < CONFIRMED_THRESHOLD : tx.confirmations === 0;

  const glyphColor = isPending ? c.txPendingFg : isInbound ? c.txInFg : c.txOutFg;

  const heading = isPending
    ? loc.outflow.awaitingRelay
    : isInbound
      ? loc.ledger.incomingFunds
      : loc.ledger.outgoingHeading;

  const caption = isPending
    ? dayjs(effectiveTime(tx) * 1000).fromNow()
    : describeDate(tx.blockTime);

  const body = (
    <View style={[styles.row, { borderBottomColor: c.fieldBorder }]}>
      <View style={styles.glyph}>
        {isPending ? (
          <PendingTxIcon size={GLYPH_SIZE} color={glyphColor} />
        ) : (
          <BitcoinCoinIcon size={GLYPH_SIZE} color={glyphColor} />
        )}
      </View>
      <View style={styles.center}>
        <Text numberOfLines={1} style={[styles.heading, { color: c.fg }]}>
          {heading}
        </Text>
        <Text numberOfLines={1} style={[styles.caption, { color: c.muted }]}>
          {caption}
        </Text>
      </View>
      <Text numberOfLines={1} style={[styles.amount, { color: isInbound ? c.txInFg : c.fg }]}>
        {isInbound ? '' : '-'}
        {fmt(Math.abs(tx.balance_diff))}
      </Text>
    </View>
  );

  if (!onPress) {
    return body;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
      {body}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  glyph: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: SPACING.md,
  },
  center: { flex: 1 },
  heading: {
    fontSize: 16,
    fontWeight: '500',
    writingDirection: IS_RTL ? 'rtl' : 'ltr',
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
    writingDirection: IS_RTL ? 'rtl' : 'ltr',
  },
  amount: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: SPACING.sm,
    textAlign: IS_RTL ? 'left' : 'right',
    writingDirection: 'ltr',
  },
  pressed: { opacity: 0.6 },
});

export default TxRow;
