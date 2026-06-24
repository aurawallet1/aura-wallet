import React, { useCallback, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import { COLORS, RADIUS, SPACING, TYPE, ms } from '../theme';
import loc from '../i18n';
import type { Utxo } from '../types/index';
import { fiatDisplay, formatUnit, unitLabel } from '../utils/currency';
import { triggerSuccessHaptic } from '../utils/haptics';
import { useWallets, type WalletEntry } from '../wallets/context';
import type { SendStackParamList } from '../navigation/types';

const MIRROR = { transform: [{ scaleX: 1 }] };

const RELAYOUT = {
  duration: 200,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
};

type CoinRow = {
  key: string;
  txid: string;
  vout: number;
  value: number;
  address: string;
};

const outpointId = (walletId: string, source: Utxo): string => {
  const hash = source.tx_hash ?? source.txid ?? '';
  const index = source.tx_pos ?? source.vout ?? 0;
  return `${walletId}:${hash}:${index}`;
};

const readUtxos = (entry: WalletEntry | undefined): Utxo[] => {
  if (!entry) {
    return [];
  }
  const scan = entry.multisig ? entry.multisig.scan : entry.scan;
  const list = (scan as { result?: { grandTotals?: { utxos?: unknown } } } | null)?.result
    ?.grandTotals?.utxos;
  return Array.isArray(list) ? (list as Utxo[]) : [];
};

const collectCoins = (entry: WalletEntry | undefined, walletId: string): CoinRow[] =>
  readUtxos(entry).map(source => ({
    key: outpointId(walletId, source),
    txid: source.tx_hash ?? source.txid ?? '',
    vout: source.tx_pos ?? source.vout ?? 0,
    value: source.value ?? 0,
    address: source.address ?? '',
  }));

const swatchFor = (txid: string): string => `#${(txid || '000000').substring(0, 6)}`;

export const CoinControlScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation =
    useNavigation<NativeStackNavigationProp<SendStackParamList, 'CoinControl'>>();
  const route = useRoute<RouteProp<SendStackParamList, 'CoinControl'>>();
  const { id } = route.params;

  const {
    wallets,
    frozenUtxos,
    utxoLabels,
    toggleFreezeUtxo,
    setSelectedUtxos,
    denomination,
    currency,
    rate,
  } = useWallets();
  const insets = useSafeAreaInsets();

  const formatAmount = useCallback(
    (sats: number): string =>
      denomination === 'fiat'
        ? fiatDisplay(sats, rate, currency.symbol)
        : formatUnit(sats, denomination),
    [denomination, currency.symbol, rate],
  );
  const amountSuffix = denomination === 'fiat' ? '' : unitLabel(denomination);

  const entry = wallets.find(item => item.id === id);
  const coins = useMemo(() => collectCoins(entry, id), [entry, id]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const inSelection = selected.size > 0;
  const everyFrozen = inSelection && [...selected].every(key => frozenUtxos.has(key));

  const [expanded, setExpanded] = useState(false);

  const spendableTotal = useMemo(
    () =>
      coins
        .filter(coin => !frozenUtxos.has(coin.key))
        .reduce((sum, coin) => sum + coin.value, 0),
    [coins, frozenUtxos],
  );
  const frozenTotal = useMemo(
    () =>
      coins
        .filter(coin => frozenUtxos.has(coin.key))
        .reduce((sum, coin) => sum + coin.value, 0),
    [coins, frozenUtxos],
  );
  const spendableShare =
    spendableTotal + frozenTotal > 0
      ? (spendableTotal / (spendableTotal + frozenTotal)) * 100
      : 100;

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(RELAYOUT);
    setExpanded(prev => !prev);
  }, []);

  const captionText = useMemo(() => {
    if (!inSelection) {
      return loc.utxoControl.pickingHint;
    }
    const sum = coins
      .filter(coin => selected.has(coin.key))
      .reduce((total, coin) => total + coin.value, 0);
    return loc.formatString(loc.utxoControl.chosenTotal, {
      amount: `${formatAmount(sum)}${amountSuffix ? ` ${amountSuffix}` : ''}`,
    }) as string;
  }, [inSelection, selected, coins, formatAmount, amountSuffix]);

  const toggleCoin = useCallback((key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const onFreeze = useCallback(() => {
    selected.forEach(key => {
      const frozen = frozenUtxos.has(key);
      if (everyFrozen ? frozen : !frozen) {
        toggleFreezeUtxo(key);
      }
    });
    setSelected(new Set());
    triggerSuccessHaptic();
  }, [selected, frozenUtxos, everyFrozen, toggleFreezeUtxo]);

  const onUse = useCallback(() => {
    setSelectedUtxos(id, new Set(selected));
    triggerSuccessHaptic();
    navigation.popTo('SendAmount', { id });
  }, [setSelectedUtxos, id, selected, navigation]);

  if (!entry) {
    return <View style={[styles.root, { backgroundColor: palette.elevated }]} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.elevated }]}>
      {coins.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyTile, { backgroundColor: `${palette.accentBlue}1F` }]}>
            <MaterialIcons name="account-balance-wallet" size={26} color={palette.accentBlue} />
          </View>
          <Text style={[styles.emptyText, { color: palette.fg }]}>{loc.coinSelect.noUtxosNotice}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.tip}>
            <MaterialIcons
              name={inSelection ? 'check-circle' : 'touch-app'}
              size={18}
              color={inSelection ? palette.accentGreen : palette.accentBlue}
              style={styles.tipIcon}
            />
            <Text style={[styles.tipText, { color: palette.txdMuted }]}>{captionText}</Text>
          </View>

          <View style={styles.card}>
            <Pressable
              onPress={toggleExpanded}
              style={({ pressed }) => [
                styles.cardHeader,
                { backgroundColor: palette.txdHeaderBg },
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.cardHeaderTitle, { color: palette.fg }]}>
                {loc.formatString(loc.utxoControl.outputsTally, { count: coins.length })}
              </Text>
              <MaterialIcons
                name={expanded ? 'expand-less' : 'expand-more'}
                size={20}
                color={palette.txdMuted}
              />
            </Pressable>

            {expanded && frozenTotal > 0 ? (
              <View style={[styles.shareWrap, { backgroundColor: palette.txdHeaderBg }]}>
                <View style={[styles.shareTrack, { backgroundColor: palette.ccFrozenBg }]}>
                  <View
                    style={[
                      styles.shareFill,
                      { width: `${spendableShare}%`, backgroundColor: palette.accentGreen },
                    ]}
                  />
                </View>
              </View>
            ) : null}

            {expanded ? (
              <View style={[styles.cardBody, { backgroundColor: palette.txdRowBg }]}>
                {coins.map((coin, index) => {
                  const picked = selected.has(coin.key);
                  const frozen = frozenUtxos.has(coin.key);
                  const note = utxoLabels[coin.key] || '';
                  const tint = swatchFor(coin.txid);
                  const last = index === coins.length - 1;
                  return (
                    <Pressable
                      key={coin.key}
                      onPress={() =>
                        inSelection
                          ? toggleCoin(coin.key)
                          : navigation.navigate('CoinControlOutput', {
                              id,
                              utxoKey: coin.key,
                            })
                      }
                      style={({ pressed }) => [
                        styles.row,
                        { backgroundColor: picked ? palette.ccSelectedBg : 'transparent' },
                        !last && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: palette.txdBorder,
                        },
                        frozen && !picked && styles.rowFrozen,
                        pressed && styles.pressed,
                      ]}>
                      <Pressable
                        onPress={() => toggleCoin(coin.key)}
                        hitSlop={8}
                        style={[
                          styles.avatar,
                          picked
                            ? { backgroundColor: palette.accentGreen, borderColor: palette.accentGreen }
                            : { backgroundColor: `${tint}1F`, borderColor: tint },
                        ]}>
                        {picked ? (
                          <MaterialIcons name="check" size={20} color="#FFFFFF" />
                        ) : (
                          <MaterialIcons
                            name={frozen ? 'ac-unit' : 'currency-bitcoin'}
                            size={18}
                            color={tint}
                          />
                        )}
                      </Pressable>

                      <View style={styles.rowContent}>
                        <View style={styles.amountRow}>
                          <Text
                            style={[styles.amount, { color: palette.fg }]}
                            numberOfLines={1}>
                            {formatAmount(coin.value)}
                          </Text>
                          {amountSuffix ? (
                            <Text style={[styles.unit, { color: palette.txdMuted }]}>
                              {amountSuffix}
                            </Text>
                          ) : null}
                          {frozen ? (
                            <View style={[styles.chip, { backgroundColor: palette.ccFrozenBg }]}>
                              <MaterialIcons
                                name="ac-unit"
                                size={11}
                                color={palette.txOutFg}
                                style={styles.chipIcon}
                              />
                              <Text style={[styles.chipText, { color: palette.txOutFg }]}>
                                {loc.utxoControl.lockedState}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text
                          style={[styles.sub, { color: palette.txdMuted }]}
                          numberOfLines={1}
                          ellipsizeMode="middle">
                          {note || coin.address}
                        </Text>
                      </View>

                      {!inSelection ? (
                        <MaterialIcons
                          name="chevron-right"
                          size={22}
                          color={palette.txdMuted}
                          style={[styles.rowChevron, MIRROR]}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}

      {inSelection ? (
        <View
          style={[styles.floatBar, { bottom: insets.bottom > 0 ? insets.bottom + 10 : 30 }]}
          pointerEvents="box-none">
          <Pressable
            onPress={onFreeze}
            style={({ pressed }) => [
              styles.floatBtn,
              { backgroundColor: isDark ? '#1c1c1d' : '#ccddf9' },
              pressed && styles.pressed,
            ]}>
            <MaterialIcons name="ac-unit" size={22} color={isDark ? '#ffffff' : '#2f5fb3'} />
            <Text style={[styles.floatBtnText, { color: isDark ? '#ffffff' : '#2f5fb3' }]}>
              {everyFrozen ? loc.coinSelect.unlockUtxo : loc.coinSelect.lockUtxo}
            </Text>
          </Pressable>
          <Pressable
            onPress={onUse}
            style={({ pressed }) => [
              styles.floatBtn,
              { backgroundColor: isDark ? '#1c1c1d' : '#ccddf9' },
              pressed && styles.pressed,
            ]}>
            <MaterialIcons
              name="north-east"
              size={22}
              color={isDark ? '#ffffff' : '#2f5fb3'}
              style={MIRROR}
            />
            <Text style={[styles.floatBtnText, { color: isDark ? '#ffffff' : '#2f5fb3' }]}>
              {selected.size > 1 ? loc.coinSelect.spendMultiple : loc.coinSelect.spendSingle}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  emptyTile: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  emptyText: {
    ...TYPE.cardDesc,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.huge * 2,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  tipIcon: {
    marginTop: 1,
    marginRight: SPACING.sm,
  },
  tipText: {
    ...TYPE.caption,
    flex: 1,
  },
  card: {
    borderRadius: RADIUS.control,
    overflow: 'hidden',
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
  shareWrap: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  shareTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  shareFill: {
    height: '100%',
    borderRadius: 3,
  },
  cardBody: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  rowFrozen: {
    opacity: 0.55,
  },
  avatar: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  rowContent: {
    flex: 1,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amount: {
    ...TYPE.balance,
    flexShrink: 1,
  },
  unit: {
    ...TYPE.caption,
    marginLeft: SPACING.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.chip,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    marginLeft: SPACING.sm,
  },
  chipIcon: {
    marginRight: 3,
  },
  chipText: {
    ...TYPE.caption,
    fontWeight: '600',
  },
  sub: {
    ...TYPE.cardSubtitle,
    marginTop: 2,
  },
  rowChevron: {
    marginLeft: SPACING.sm,
  },
  floatBar: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  floatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.button,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    marginHorizontal: SPACING.sm,
  },
  floatBtnText: {
    ...TYPE.button,
    marginLeft: SPACING.sm,
  },
  pressed: {
    opacity: 0.6,
  },
});

export default CoinControlScreen;
