import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  Clipboard,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import loc from '../i18n';
import { COLORS, TYPE } from '../theme';
import type { FiatUnit } from '../types/index';
import { SATS_PER_BTC } from '../constants/bitcoin';
import { useWallets } from '../wallets/context';
import { explorerTxUrl } from '../network/blockExplorers';
import { fetchBtcRate } from '../network/rates';
import { fiatDisplay, formatFiat, formatUnit, unitLabel } from '../utils/currency';
import { triggerHaptic } from '../utils/haptics';
import type { RootStackParamList } from '../navigation/types';

type DetailNavigation = NativeStackNavigationProp<RootStackParamList, 'TransactionDetail'>;
type DetailRoute = RouteProp<RootStackParamList, 'TransactionDetail'>;

const MEMO_STORE_KEY = 'walletapp.transactionMemos';

const formatTimestamp = (unixSeconds: number): string => dayjs.unix(unixSeconds).format('LLL');

const uniqueAddresses = (values: (string | null)[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (value && !seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
};

const readMemoMap = async (): Promise<Record<string, string>> => {
  try {
    const raw = await AsyncStorage.getItem(MEMO_STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
};

export const TransactionDetailScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<DetailNavigation>();
  const route = useRoute<DetailRoute>();
  const { tx } = route.params;

  const { currency, blockExplorer, denomination, rate: contextRate } = useWallets();
  const [memo, setMemo] = useState('');
  const [fiatRate, setFiatRate] = useState<number | null>(null);

  const isPending = !tx.confirmed || tx.confirmations === 0;
  const isInbound = tx.balance_diff >= 0;
  const amountSats = Math.abs(tx.balance_diff);

  const headline = isPending
    ? loc.outflow.awaitingRelay
    : isInbound
      ? loc.ledger.incomingFunds
      : loc.ledger.outgoingHeading;

  const timestampLabel = tx.blockTime ? formatTimestamp(tx.blockTime) : '';

  const amountFormatter = useMemo(() => {
    if (denomination === 'fiat') {
      const unit = currency as FiatUnit;
      return {
        render: (sats: number) => fiatDisplay(sats, contextRate, unit.symbol),
        suffix: '',
      };
    }
    return {
      render: (sats: number) => formatUnit(sats, denomination),
      suffix: unitLabel(denomination),
    };
  }, [denomination, currency, contextRate]);

  const fiatValue = fiatRate
    ? formatFiat(amountSats / SATS_PER_BTC, fiatRate, currency.endPointKey)
    : `${currency.symbol}0.00`;

  useEffect(() => {
    let active = true;
    fetchBtcRate(currency.endPointKey)
      .then(value => {
        if (active && value > 0) setFiatRate(value);
      })
      .catch(() => {});
    readMemoMap()
      .then(map => {
        if (active && map[tx.txid]) setMemo(map[tx.txid]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [tx.txid, currency.endPointKey]);

  const persistMemo = useCallback(
    async (next: string) => {
      const map = await readMemoMap();
      if (next) map[tx.txid] = next;
      else delete map[tx.txid];
      await AsyncStorage.setItem(MEMO_STORE_KEY, JSON.stringify(map));
    },
    [tx.txid],
  );

  const handleEditMemo = useCallback(() => {
    Alert.prompt(
      loc.outflow.personalMemoHint,
      undefined,
      [
        { text: loc.core.dismissAction, style: 'cancel' },
        {
          text: loc.core.acknowledge,
          onPress: (text?: string) => {
            const next = (text ?? '').trim();
            setMemo(next);
            persistMemo(next)
              .then(() => triggerHaptic())
              .catch(() => {});
          },
        },
      ],
      'plain-text',
      memo,
    );
  }, [memo, persistMemo]);

  const inboundAddresses = useMemo(
    () => uniqueAddresses(tx.inputs.map(input => input.address)),
    [tx.inputs],
  );
  const outboundAddresses = useMemo(() => {
    const destinations = uniqueAddresses(tx.outputs.map(output => output.address));
    return destinations.filter(address => !inboundAddresses.includes(address));
  }, [tx.outputs, inboundAddresses]);

  const copyValue = useCallback((value: string) => {
    Clipboard.setString(value);
    triggerHaptic();
  }, []);

  const openInExplorer = useCallback(() => {
    const url = explorerTxUrl(blockExplorer, tx.txid);
    Linking.canOpenURL(url)
      .then(supported => {
        if (supported) Linking.openURL(url).catch(() => {});
      })
      .catch(() => {});
  }, [blockExplorer, tx.txid]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLargeTitle: false,
      headerShadowVisible: false,
      headerBackButtonDisplayMode: 'minimal',
      headerTitleAlign: 'left',
      headerStyle: { backgroundColor: palette.customHeader },
      headerTintColor: palette.fg,
      headerTitle: () => (
        <View style={styles.headerTitle}>
          <Text style={[styles.headerHeadline, { color: palette.fg }]}>{headline}</Text>
          {timestampLabel ? (
            <Text style={[styles.headerTimestamp, { color: palette.txdMuted }]}>
              {timestampLabel}
            </Text>
          ) : null}
        </View>
      ),
    });
  }, [navigation, palette.customHeader, palette.fg, palette.txdMuted, headline, timestampLabel]);

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <View style={styles.valueCard}>
        <Text
          selectable
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.55}
          style={[styles.valueAmount, { color: palette.fg }]}>
          {(isInbound ? '' : '-') + amountFormatter.render(amountSats)}{' '}
          <Text style={[styles.valueUnit, { color: palette.fg }]}>{amountFormatter.suffix}</Text>
        </Text>
        <Text style={[styles.valueFiat, { color: palette.txdMuted }]}>{fiatValue}</Text>
      </View>

      <View style={[styles.memoRow, { marginBottom: memo ? 4 : 26 }]}>
        <Text style={[styles.memoLabel, { color: palette.fg }]}>{loc.ledger.memoLabel}</Text>
        <Pressable
          onPress={handleEditMemo}
          style={({ pressed }) => [
            styles.memoAction,
            { backgroundColor: palette.lightButton },
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.memoActionText, { color: palette.fg }]}>
            {memo ? loc.holdings.modifyLink : loc.ledger.attachMemo}
          </Text>
        </Pressable>
      </View>
      {memo ? <Text style={[styles.memoText, { color: palette.fg }]}>{memo}</Text> : null}

      {inboundAddresses.length > 0 ? (
        <>
          <View style={styles.fieldHeader}>
            <Text style={[styles.fieldLabel, { color: palette.fg }]}>{loc.ledger.sourceLeg}</Text>
            <Pressable
              onPress={() => copyValue(inboundAddresses.join(', '))}
              hitSlop={8}
              accessibilityRole="button">
              <Text style={[styles.copyText, { color: palette.accentBlue }]}>
                {loc.ledger.duplicateToClipboard}
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.fieldValue, { color: palette.muted }]}>
            {inboundAddresses.join(', ')}
          </Text>
        </>
      ) : null}

      {outboundAddresses.length > 0 ? (
        <>
          <View style={styles.fieldHeader}>
            <Text style={[styles.fieldLabel, { color: palette.fg }]}>{loc.ledger.destinationLeg}</Text>
            <Pressable
              onPress={() => copyValue(outboundAddresses.join(', '))}
              hitSlop={8}
              accessibilityRole="button">
              <Text style={[styles.copyText, { color: palette.accentBlue }]}>
                {loc.ledger.duplicateToClipboard}
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.fieldValue, { color: palette.muted }]}>
            {outboundAddresses.join(', ')}
          </Text>
        </>
      ) : null}

      {tx.fee && tx.balance_diff < 0 ? (
        <>
          <Text style={[styles.fieldLabel, { color: palette.fg }]}>{loc.outflow.minerCostField}</Text>
          <Text style={[styles.fieldValue, { color: palette.muted }]}>
            {Math.abs(tx.fee) + loc.denom.satoshiUnit}
          </Text>
        </>
      ) : null}

      <Text style={[styles.fieldLabel, { color: palette.fg }]}>{loc.ledger.byteFootprint}</Text>
      <Text style={[styles.fieldValue, { color: palette.muted }]}>
        {tx.size ? `${tx.size} ${loc.denom.byteAbbrev}` : '-'}
      </Text>

      <Text style={[styles.fieldLabel, { color: palette.fg }]}>
        {loc.ledger.weightedFootprint}
      </Text>
      <Text style={[styles.fieldValue, { color: palette.muted }]}>
        {tx.vsize ? `${tx.vsize} ${loc.denom.virtualWeightAbbrev}` : '-'}
      </Text>

      {tx.rawHex ? (
        <View style={[styles.fieldHeader, { marginBottom: 26 }]}>
          <Text style={[styles.fieldLabel, { color: palette.fg }]}>
            {loc.ledger.rawPayload}
          </Text>
          <Pressable onPress={() => copyValue(tx.rawHex)} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.copyText, { color: palette.accentBlue }]}>
              {loc.ledger.duplicateToClipboard}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        onPress={openInExplorer}
        style={({ pressed }) => [
          styles.explorerButton,
          { backgroundColor: palette.txdHeaderBg },
          pressed && styles.pressed,
        ]}>
        <Text style={[styles.explorerButtonText, { color: palette.fg }]}>
          {loc.ledger.openOnChainBrowser}
        </Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  headerTitle: {
    justifyContent: 'center',
  },
  headerHeadline: {
    fontSize: TYPE.headerTitle.fontSize,
    fontWeight: '600',
  },
  headerTimestamp: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 1,
  },
  valueCard: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 30,
  },
  valueAmount: {
    fontSize: 40,
    fontWeight: '700',
    textAlign: 'center',
  },
  valueUnit: {
    fontSize: 22,
    fontWeight: '600',
  },
  valueFiat: {
    fontSize: 15,
    fontWeight: '400',
    marginTop: 6,
  },
  memoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memoLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  memoAction: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  memoActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  memoText: {
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 26,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: '400',
    marginBottom: 26,
  },
  copyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  explorerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 6,
  },
  explorerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.6,
  },
});

export default TransactionDetailScreen;
