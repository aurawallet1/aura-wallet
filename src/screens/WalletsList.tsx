import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import loc from '../i18n';
import { COLORS, RADIUS, SIZE, SPACING, TYPE, type ColorScheme } from '../theme';
import type { HistoryTx } from '../types/index';
import { fetchWalletHistory } from '../network/history';
import { fiatDisplay, formatUnit, unitLabel } from '../utils/currency';
import { useWallets, type WalletEntry } from '../wallets/context';
import type { RootStackParamList } from '../navigation/types';
import TxRow from '../components/TxRow';
import WalletCardViewComponent, {
  type WalletEntry as CardEntry,
} from '../components/WalletCardView';

const TRANSACTION_CACHE_KEY = 'aura.txs';
const RECENT_LIMIT = 10;
const POLL_INTERVAL_MS = 4000;
const PENDING_BACKDATE_SECONDS = 30;

type WalletsListNavigation = NativeStackNavigationProp<RootStackParamList, 'WalletsList'>;
type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

interface WalletScanView {
  ready: boolean;
  sats: number;
  addresses: string[];
}

interface AddressBranchLike {
  used?: Array<{ address?: string }>;
  fresh?: { address?: string };
}

interface AccountLike {
  receive?: AddressBranchLike;
  change?: AddressBranchLike;
}

const collectBranchAddresses = (branch: AddressBranchLike | undefined, into: Set<string>): void => {
  if (!branch) return;
  for (const item of branch.used ?? []) {
    if (item?.address) into.add(item.address.trim());
  }
  if (branch.fresh?.address) into.add(branch.fresh.address.trim());
};

const collectAccountAddresses = (data: unknown, into: Set<string>): void => {
  if (!data || typeof data !== 'object') return;
  for (const account of Object.values(data as Record<string, AccountLike>)) {
    collectBranchAddresses(account?.receive, into);
    collectBranchAddresses(account?.change, into);
  }
};

const scanViewFor = (entry: WalletEntry): WalletScanView => {
  const scan = entry.multisig ? entry.multisig.scan : entry.scan;
  if (!scan) {
    return { ready: false, sats: 0, addresses: [] };
  }
  const totals = scan.result.grandTotals;
  const owned = new Set<string>();
  collectAccountAddresses(scan.result.data, owned);
  for (const part of (totals?.scannedAddresses ?? '').split('|')) {
    const trimmed = part.trim();
    if (trimmed) owned.add(trimmed);
  }
  return {
    ready: true,
    sats: totals?.totalBalance ?? 0,
    addresses: [...owned].filter(item => item.length > 0),
  };
};

const effectiveTxTime = (tx: HistoryTx): number =>
  tx.blockTime > 0 ? tx.blockTime : Math.floor(Date.now() / 1000) - PENDING_BACKDATE_SECONDS;

const useAmountFormatter = (): {
  format: (sats: number) => string;
  label: string;
} => {
  const { denomination, rate, currency } = useWallets();
  return useMemo(() => {
    if (denomination === 'fiat') {
      return {
        format: (sats: number) => fiatDisplay(sats, rate, currency.symbol),
        label: currency.endPointKey,
      };
    }
    return {
      format: (sats: number) => formatUnit(sats, denomination),
      label: unitLabel(denomination),
    };
  }, [denomination, rate, currency.symbol, currency.endPointKey]);
};

export function WalletsListScreen(): React.ReactElement {
  const isDark = useColorScheme() === 'dark';
  const palette: ColorScheme = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<WalletsListNavigation>();
  const { wallets, cachedTxs, refreshAllWallets, isRTL } = useWallets();
  const { format, label } = useAmountFormatter();
  const cardUnit = useWallets().denomination === 'sats' ? 'sats' : 'BTC';

  const aggregateSats = useMemo(
    () => wallets.reduce((running, entry) => running + scanViewFor(entry).sats, 0),
    [wallets],
  );

  const ownedAddresses = useMemo(
    () => Array.from(new Set(wallets.flatMap(entry => scanViewFor(entry).addresses))),
    [wallets],
  );

  const [transactions, setTransactions] = useState<HistoryTx[]>(cachedTxs);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(
    async (showSpinner = false, rescanBalances = showSpinner) => {
      if (showSpinner) setRefreshing(true);
      try {
        const pending: Promise<unknown>[] = [];
        if (rescanBalances) pending.push(refreshAllWallets());
        if (ownedAddresses.length === 0) {
          setTransactions([]);
          AsyncStorage.removeItem(TRANSACTION_CACHE_KEY).catch(() => {});
        } else {
          pending.push(
            fetchWalletHistory(ownedAddresses).then(result => {
              setTransactions(result.transactions);
              AsyncStorage.setItem(
                TRANSACTION_CACHE_KEY,
                JSON.stringify(result.transactions),
              ).catch(() => {});
            }),
          );
        }
        await Promise.all(pending);
      } catch {
      } finally {
        if (showSpinner) setRefreshing(false);
      }
    },
    [ownedAddresses, refreshAllWallets],
  );

  useEffect(() => {
    reload(false);
  }, [reload]);

  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const pollBusy = useRef(false);

  const pollOnce = useCallback(() => {
    if (pollBusy.current || AppState.currentState !== 'active') return;
    pollBusy.current = true;
    Promise.resolve(reloadRef.current(false, true)).finally(() => {
      pollBusy.current = false;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(pollOnce, POLL_INTERVAL_MS);
      const subscription = AppState.addEventListener('change', state => {
        if (state === 'active') pollOnce();
      });
      return () => {
        clearInterval(timer);
        subscription.remove();
      };
    }, [pollOnce]),
  );

  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => effectiveTxTime(b) - effectiveTxTime(a))
        .slice(0, RECENT_LIMIT),
    [transactions],
  );

  const cardNavigate = useCallback<
    (route: string, params?: Record<string, unknown>) => void
  >(
    (route, params) => {
      const dispatch = navigation.navigate as (
        name: string,
        params?: Record<string, unknown>,
      ) => void;
      dispatch(route, params);
    },
    [navigation],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerShadowVisible: false,
      headerStyle: { backgroundColor: palette.customHeader },
      headerTintColor: palette.fg,
      headerTitleStyle: {
        fontSize: TYPE.headerTitle.fontSize,
        fontWeight: TYPE.headerTitle.fontWeight,
        color: palette.fg,
      },
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => navigation.navigate('AddWalletRoot')}
            hitSlop={SIZE.closeHit}
            style={[styles.headerButton, { backgroundColor: palette.accentSoftBg }]}>
            <MaterialIcons name={'add' as IconName} size={22} color={palette.accentSoftFg} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            hitSlop={SIZE.closeHit}
            style={[styles.headerButton, { backgroundColor: palette.lightButton }]}>
            <MaterialIcons name={'more-horiz' as IconName} size={22} color={palette.fg} />
          </Pressable>
        </View>
      ),
    });
  }, [
    navigation,
    palette.fg,
    palette.customHeader,
    palette.accentSoftBg,
    palette.accentSoftFg,
    palette.lightButton,
  ]);

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} />
      }>
      <View style={styles.totalBlock}>
        <Text style={[TYPE.caption, styles.totalLabel, { color: palette.muted }]}>
          {loc.prefs.aggregateFunds}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          style={[TYPE.totalBalance, styles.forceLtr, { color: palette.fg }]}>
          {format(aggregateSats)}{' '}
          <Text style={[styles.totalUnit, { color: palette.fg }]}>{label}</Text>
        </Text>
      </View>

      <Text style={[styles.sectionHeader, { color: palette.fg }]}>{loc.holdings.collectionHeading}</Text>
      {wallets.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: palette.cardGray }]}>
          <Text style={[styles.emptyTitle, { color: palette.fg }]}>
            {loc.holdings.startAnAccount}
          </Text>
          <Text style={[styles.emptyBody, { color: palette.altText }]}>
            {loc.holdingItem.freeUnlimitedCreation}
          </Text>
          <Pressable
            onPress={() => navigation.navigate('AddWalletRoot')}
            style={({ pressed }) => [
              styles.emptyButton,
              { backgroundColor: palette.accentBlue },
              pressed && styles.pressed,
            ]}>
            <Text style={styles.emptyButtonLabel}>{loc.holdings.createNowButton}</Text>
          </Pressable>
        </View>
      ) : (
        wallets.map(entry => (
          <WalletCardViewComponent
            key={entry.id}
            entry={entry as unknown as CardEntry}
            navigate={cardNavigate}
            unit={cardUnit}
            isRTL={isRTL}
          />
        ))
      )}

      <View style={styles.recentSection}>
        <Text style={[styles.sectionHeader, { color: palette.fg }]}>
          {loc.txDetail.latestActivity}
        </Text>
        {recentTransactions.length > 0 ? (
          recentTransactions.map(tx => (
            <TxRow
              key={tx.txid}
              tx={tx}
              c={palette}
              fmt={format}
              onPress={() =>
                navigation.navigate('TransactionDetail', { tx, ownAddresses: ownedAddresses })
              }
            />
          ))
        ) : !refreshing ? (
          <Text style={[styles.recentEmpty, { color: palette.muted }]}>
            {loc.holdings.noActivityYet}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.huge,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: SIZE.iconBox - 12,
    height: SIZE.iconBox - 12,
    borderRadius: (SIZE.iconBox - 12) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
  totalBlock: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
  totalLabel: {
    marginBottom: SPACING.xs,
  },
  totalUnit: {
    fontSize: TYPE.cardTitle.fontSize,
    fontWeight: '600',
  },
  forceLtr: {
    writingDirection: 'ltr',
  },
  sectionHeader: {
    fontSize: TYPE.cardTitle.fontSize,
    fontWeight: '700',
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  emptyCard: {
    borderRadius: RADIUS.card,
    padding: SIZE.cardPad,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: TYPE.cardTitle.fontSize,
    fontWeight: '700',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: TYPE.cardDesc.fontSize,
    lineHeight: TYPE.cardDesc.lineHeight,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  emptyButton: {
    height: SIZE.buttonHeight,
    borderRadius: RADIUS.button,
    paddingHorizontal: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonLabel: {
    color: '#FFFFFF',
    fontSize: TYPE.button.fontSize,
    fontWeight: TYPE.button.fontWeight,
  },
  recentSection: {
    marginTop: SPACING.sm,
  },
  recentEmpty: {
    fontSize: TYPE.cardDesc.fontSize,
    lineHeight: TYPE.cardDesc.lineHeight,
    paddingVertical: SPACING.md,
  },
  pressed: {
    opacity: 0.8,
  },
});

export default WalletsListScreen;
