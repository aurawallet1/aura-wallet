import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  I18nManager,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import { COLORS, RADIUS, SPACING, TYPE, ms } from '../theme';
import loc from '../i18n';
import type {
  MultisigHoldingResponse,
  ScanResponse,
  Utxo,
  WifScanResult,
} from '../types/index';
import { fiatDisplay, formatUnit, unitLabel } from '../utils/currency';
import { triggerSuccessHaptic } from '../utils/haptics';
import { useWallets, type WalletEntry } from '../wallets/context';
import type { SendStackParamList } from '../navigation/types';
import { PrimaryButton } from '../components/PrimaryButton';

type OutputNavigation = NativeStackNavigationProp<SendStackParamList, 'CoinControlOutput'>;
type OutputRoute = RouteProp<SendStackParamList, 'CoinControlOutput'>;

const PERSIST_DELAY_MS = 400;
const TINT_HEX_LENGTH = 6;
const FALLBACK_TINT = '#888888';
const TINT_OVERLAY_ALPHA = '1F';

const RESIZE_TRANSITION = {
  duration: 200,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
};

const directionalMirror = { transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] };

interface SelectedCoin {
  txid: string;
  vout: number;
  value: number;
  address: string;
}

const parseUtxoKey = (key: string): { txid: string; vout: number } | null => {
  const separator = key.lastIndexOf(':');
  if (separator <= 0) {
    return null;
  }
  const head = key.slice(0, separator);
  const txid = head.slice(head.lastIndexOf(':') + 1);
  const vout = Number.parseInt(key.slice(separator + 1), 10);
  if (!txid || !Number.isFinite(vout)) {
    return null;
  }
  return { txid, vout };
};

const readUtxos = (entry: WalletEntry | undefined): Utxo[] => {
  if (!entry) {
    return [];
  }
  const scan = (entry.multisig ? entry.multisig.scan : entry.scan) as
    | ScanResponse
    | WifScanResult
    | MultisigHoldingResponse
    | null;
  const utxos = scan?.result?.grandTotals?.utxos;
  return Array.isArray(utxos) ? (utxos as Utxo[]) : [];
};

const matchUtxo = (utxo: Utxo, txid: string, vout: number): boolean => {
  const candidateTxid = utxo.txid ?? utxo.tx_hash;
  const candidateVout = utxo.vout ?? utxo.tx_pos;
  return candidateTxid === txid && candidateVout === vout;
};

const findCoin = (
  entry: WalletEntry | undefined,
  txid: string,
  vout: number,
): SelectedCoin | undefined => {
  const utxo = readUtxos(entry).find(item => matchUtxo(item, txid, vout));
  if (!utxo) {
    return undefined;
  }
  return {
    txid,
    vout,
    value: typeof utxo.value === 'number' ? utxo.value : 0,
    address: typeof utxo.address === 'string' ? utxo.address : '',
  };
};

export const CoinControlOutputScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<OutputNavigation>();
  const route = useRoute<OutputRoute>();
  const { id, utxoKey } = route.params;

  const {
    wallets,
    frozenUtxos,
    utxoLabels,
    toggleFreezeUtxo,
    setUtxoLabel,
    setSelectedUtxos,
    denomination,
    currency,
    rate,
  } = useWallets();

  const entry = wallets.find(item => item.id === id);
  const parsed = useMemo(() => parseUtxoKey(utxoKey), [utxoKey]);
  const coin = useMemo(
    () => (parsed ? findCoin(entry, parsed.txid, parsed.vout) : undefined),
    [entry, parsed],
  );

  const formatAmount = useMemo(() => {
    if (denomination === 'fiat') {
      return (sats: number) => fiatDisplay(sats, rate, currency.symbol);
    }
    return (sats: number) => formatUnit(sats, denomination);
  }, [denomination, currency.symbol, rate]);
  const amountLabel = denomination === 'fiat' ? '' : unitLabel(denomination);

  const [note, setNote] = useState(utxoLabels[utxoKey] ?? '');
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const frozen = frozenUtxos.has(utxoKey);

  const noteRef = useRef(note);
  noteRef.current = note;

  useEffect(() => {
    const timer = setTimeout(() => setUtxoLabel(utxoKey, note), PERSIST_DELAY_MS);
    return () => clearTimeout(timer);
  }, [note, utxoKey, setUtxoLabel]);

  useEffect(
    () => () => {
      setUtxoLabel(utxoKey, noteRef.current);
    },
    [utxoKey, setUtxoLabel],
  );

  const tint = coin ? `#${coin.txid.slice(0, TINT_HEX_LENGTH)}` : FALLBACK_TINT;

  const toggleDetails = () => {
    LayoutAnimation.configureNext(RESIZE_TRANSITION);
    setDetailsExpanded(open => !open);
  };

  if (!coin) {
    return <View style={[styles.root, { backgroundColor: palette.elevated }]} />;
  }

  const useCoin = () => {
    setUtxoLabel(utxoKey, note);
    setSelectedUtxos(id, new Set([utxoKey]));
    triggerSuccessHaptic();
    navigation.popTo('SendAmount', { id });
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.elevated }]}>
      <View style={styles.hero}>
        <View
          style={[
            styles.heroAvatar,
            { backgroundColor: tint + TINT_OVERLAY_ALPHA, borderColor: tint },
          ]}>
          <MaterialIcons
            name={frozen ? 'ac-unit' : 'currency-bitcoin'}
            size={24}
            color={tint}
          />
        </View>
        <View style={styles.heroAmountRow}>
          <Text style={[styles.heroAmount, { color: palette.fg }]} numberOfLines={1}>
            {formatAmount(coin.value)}
          </Text>
          {amountLabel ? (
            <Text style={[styles.heroUnit, { color: palette.txdMuted }]}>{amountLabel}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.card}>
        <Pressable
          onPress={toggleDetails}
          style={({ pressed }) => [
            styles.cardHeader,
            { backgroundColor: palette.txdHeaderBg },
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.cardHeaderTitle, { color: palette.fg }]}>
            {loc.utxoControl.outputInfoTitle}
          </Text>
          <MaterialIcons
            name={detailsExpanded ? 'expand-less' : 'expand-more'}
            size={20}
            color={palette.txdMuted}
          />
        </Pressable>
        {detailsExpanded ? (
          <View style={[styles.cardBody, { backgroundColor: palette.txdRowBg }]}>
            <View
              style={[
                styles.kvRow,
                { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.txdBorder },
              ]}>
              <Text style={[styles.kvLabel, { color: palette.txdMuted }]}>
                {loc.outflow.destinationField}
              </Text>
              <Text
                style={[styles.kvValue, { color: palette.fg }]}
                numberOfLines={1}
                ellipsizeMode="middle"
                selectable>
                {coin.address}
              </Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={[styles.kvLabel, { color: palette.txdMuted }]}>
                {loc.ledger.destinationLeg}
              </Text>
              <Text
                style={[styles.kvValue, { color: palette.fg }]}
                numberOfLines={1}
                ellipsizeMode="middle"
                selectable>
                {`${coin.txid}:${coin.vout}`}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder={loc.outflow.personalMemoHint}
        placeholderTextColor={palette.txdMuted}
        autoCapitalize="none"
        style={[
          styles.noteField,
          { backgroundColor: palette.inputBg, borderColor: palette.inputBorder, color: palette.fg },
        ]}
      />

      <View style={styles.card}>
        <View style={[styles.cardBody, styles.cardBodySolo, { backgroundColor: palette.txdRowBg }]}>
          <View style={styles.freezeRow}>
            <Text style={[styles.freezeLabel, { color: palette.fg }]}>{loc.coinSelect.lockUtxo}</Text>
            <Switch
              value={frozen}
              onValueChange={() => toggleFreezeUtxo(utxoKey)}
              style={directionalMirror}
            />
          </View>
        </View>
      </View>

      <PrimaryButton
        label={loc.coinSelect.spendSingle}
        color={palette.accentBlue}
        onPress={useCoin}
        style={styles.useButton}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  heroAvatar: {
    width: ms(56),
    height: ms(56),
    borderRadius: ms(28),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroAmount: {
    ...TYPE.totalBalance,
  },
  heroUnit: {
    ...TYPE.cardSubtitle,
    marginLeft: SPACING.sm,
  },
  card: {
    borderRadius: RADIUS.control,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  cardHeaderTitle: {
    ...TYPE.button,
  },
  cardBody: {
    paddingHorizontal: SPACING.lg,
  },
  cardBodySolo: {
    borderRadius: RADIUS.control,
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  kvLabel: {
    ...TYPE.caption,
    marginRight: SPACING.lg,
  },
  kvValue: {
    ...TYPE.caption,
    flexShrink: 1,
    textAlign: 'right',
  },
  noteField: {
    height: ms(50),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    ...TYPE.cardDesc,
  },
  freezeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  freezeLabel: {
    ...TYPE.toggle,
  },
  useButton: {
    marginTop: SPACING.sm,
  },
  pressed: {
    opacity: 0.6,
  },
});

export default CoinControlOutputScreen;
