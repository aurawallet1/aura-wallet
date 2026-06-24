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
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import loc from '../i18n';
import { COLORS, RADIUS, SPACING, TYPE, type ColorScheme } from '../theme';
import type { FiatUnit, HistoryTx, ScriptType } from '../types/index';
import { useWallets, type WalletEntry } from '../wallets/context';
import { fetchWalletHistory } from '../network/history';
import { fiatDisplay, formatUnit, unitLabel } from '../utils/currency';
import type { RootStackParamList } from '../navigation/types';
import TxRow from '../components/TxRow';

const WHITE = '#FFFFFF';
const POLL_INTERVAL_MS = 4000;
const PENDING_TIME_OFFSET = 30;

type WalletDetailNavigation = NativeStackNavigationProp<RootStackParamList, 'WalletDetail'>;
type WalletDetailRoute = RouteProp<RootStackParamList, 'WalletDetail'>;

interface WalletView {
  ready: boolean;
  address: string;
  sats: number;
  addresses: string[];
}

const EMPTY_VIEW: WalletView = { ready: false, address: '', sats: 0, addresses: [] };

interface AddressBranchLike {
  used?: Array<{ address?: string }>;
  fresh?: { address?: string };
}

interface AccountLike {
  receive?: AddressBranchLike;
  change?: AddressBranchLike;
}

const readReceiveAddress = (account: unknown): string => {
  const receive = (account as AccountLike)?.receive;
  return receive?.fresh?.address ?? receive?.used?.[0]?.address ?? '';
};

const collectBranchAddresses = (branch: AddressBranchLike | undefined, into: Set<string>): void => {
  if (!branch) return;
  for (const item of branch.used ?? []) {
    if (item?.address) into.add(item.address);
  }
  if (branch.fresh?.address) into.add(branch.fresh.address);
};

const collectAccountAddresses = (data: unknown, into: Set<string>): void => {
  if (!data || typeof data !== 'object') return;
  for (const account of Object.values(data as Record<string, AccountLike>)) {
    collectBranchAddresses(account?.receive, into);
    collectBranchAddresses(account?.change, into);
  }
};

const fundedScriptType = (scan: WalletEntry['scan']): ScriptType | undefined => {
  const byType = scan?.result.grandTotals?.byType;
  if (!Array.isArray(byType)) return undefined;
  let best: { typeKey: ScriptType; txCount: number; balance: number } | undefined;
  for (const totals of byType) {
    const txCount = totals?.totalTxCount ?? 0;
    const balance = totals?.totalBalance ?? 0;
    if (txCount <= 0 && balance <= 0) continue;
    if (
      !best ||
      txCount > best.txCount ||
      (txCount === best.txCount && balance > best.balance)
    ) {
      best = { typeKey: totals.typeKey, txCount, balance };
    }
  }
  return best?.typeKey;
};

const resolveWalletView = (entry: WalletEntry): WalletView => {
  const scan = entry.multisig ? entry.multisig.scan : entry.scan;
  if (!scan) {
    return { ...EMPTY_VIEW, address: entry.receiveAddress ?? '' };
  }
  const totals = scan.result.grandTotals;
  const funded = entry.multisig ? undefined : fundedScriptType(entry.scan);
  const key = entry.multisig
    ? scan.primaryType
    : entry.pathType ?? funded ?? scan.primaryType;
  const account = (scan.result.data as Record<string, unknown>)[key as string];
  const owned = new Set<string>();
  collectAccountAddresses(scan.result.data, owned);
  for (const part of (totals?.scannedAddresses ?? '').split('|')) {
    if (part) owned.add(part);
  }
  return {
    ready: true,
    address: readReceiveAddress(account) || (entry.receiveAddress ?? ''),
    sats: totals?.totalBalance ?? 0,
    addresses: [...owned],
  };
};

const accentForWallet = (entry: WalletEntry | undefined, c: ColorScheme): string => {
  if (!entry) return c.accentBlue;
  if (entry.multisig) return c.accentPurple;
  if (entry.wif) return c.accentGreen;
  if (entry.origin === 'import') return c.accentOrange;
  return c.accentBlue;
};

const effectiveTime = (tx: HistoryTx): number =>
  tx.blockTime > 0 ? tx.blockTime : Math.floor(Date.now() / 1000) - PENDING_TIME_OFFSET;

const rtlText = (isRTL: boolean): { writingDirection: 'rtl' | 'ltr' } => ({
  writingDirection: isRTL ? 'rtl' : 'ltr',
});

const useDisplayAmount = (): { format: (sats: number) => string; suffix: string } => {
  const { denomination, currency, rate } = useWallets();
  return useMemo(() => {
    if (denomination === 'fiat') {
      const unit = currency as FiatUnit;
      return { format: (sats: number) => fiatDisplay(sats, rate, unit.symbol), suffix: '' };
    }
    return {
      format: (sats: number) => formatUnit(sats, denomination),
      suffix: unitLabel(denomination),
    };
  }, [denomination, currency, rate]);
};

const ownsAddress = (tx: HistoryTx, owned: Set<string>): boolean =>
  tx.inputs.some(input => input.address !== null && owned.has(input.address)) ||
  tx.outputs.some(output => output.address !== null && owned.has(output.address));

const WalletDetailScreen = () => {
  const isDark = useColorScheme() === 'dark';
  const c = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<WalletDetailNavigation>();
  const route = useRoute<WalletDetailRoute>();
  const insets = useSafeAreaInsets();
  const { wallets, cachedTxs, refreshWallet, isRTL } = useWallets();

  const walletId = route.params.id;
  const entry = wallets.find(wallet => wallet.id === walletId);
  const view = entry ? resolveWalletView(entry) : EMPTY_VIEW;

  const accent = accentForWallet(entry, c);
  const sats = view.sats;
  const addressKey = view.addresses.join('|');

  const { format: formatAmount, suffix: amountSuffix } = useDisplayAmount();
  const balanceText = formatAmount(sats);

  const [transactions, setTransactions] = useState<HistoryTx[]>(() => {
    const owned = new Set(view.addresses);
    return cachedTxs.filter(tx => ownsAddress(tx, owned));
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadTransactions = useCallback(
    async (manual = false, rescan = manual) => {
      const addresses = addressKey ? addressKey.split('|') : [];
      if (manual) setRefreshing(true);
      try {
        const tasks: Promise<unknown>[] = [];
        if (rescan) tasks.push(refreshWallet(walletId));
        if (addresses.length) {
          tasks.push(
            fetchWalletHistory(addresses).then(result => setTransactions(result.transactions)),
          );
        }
        await Promise.all(tasks);
      } catch {
        return;
      } finally {
        if (manual) setRefreshing(false);
      }
    },
    [addressKey, refreshWallet, walletId],
  );

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const loadRef = useRef(loadTransactions);
  loadRef.current = loadTransactions;
  const pollInFlight = useRef(false);

  const pollOnce = useCallback(() => {
    if (pollInFlight.current || AppState.currentState !== 'active') return;
    pollInFlight.current = true;
    Promise.resolve(loadRef.current(false, true)).finally(() => {
      pollInFlight.current = false;
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

  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => effectiveTime(b) - effectiveTime(a)),
    [transactions],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      statusBarStyle: 'light',
      headerStyle: { backgroundColor: accent },
      headerTintColor: WHITE,
      headerShadowVisible: false,
      headerBackButtonDisplayMode: 'minimal',
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('WalletInfo', { id: walletId })}
          hitSlop={8}
          style={styles.optionsButton}>
          <Text style={[styles.optionsText, rtlText(isRTL)]}>{loc.holdings.choicesMenu}</Text>
        </Pressable>
      ),
    });
  }, [navigation, accent, walletId, isRTL]);

  if (!entry) {
    return <View style={[styles.flex, { backgroundColor: c.bg }]} />;
  }

  const openReceive = () => {
    if (!view.address) return;
    navigation.navigate('ReceiveSheet', { address: view.address, label: entry.label });
  };

  const openSend = () => {
    navigation.navigate('SendRoot', { screen: 'SendAmount', params: { id: walletId } });
  };

  const openTransaction = (tx: HistoryTx) => {
    navigation.navigate('TransactionDetail', { tx, ownAddresses: view.addresses });
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <View style={[styles.backdrop, { backgroundColor: accent }]} pointerEvents="none" />
      <FlatList
        data={sortedTransactions}
        keyExtractor={tx => tx.txid}
        renderItem={({ item }) => (
          <View style={styles.rowWrap}>
            <TxRow tx={item} c={c} fmt={formatAmount} onPress={() => openTransaction(item)} />
          </View>
        )}
        ListHeaderComponent={
          <>
            <View style={[styles.headerCard, { backgroundColor: accent }]}>
              <Text numberOfLines={1} style={[styles.headerLabel, rtlText(isRTL)]}>
                {entry.label}
              </Text>
              <View style={styles.balanceRow}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                  style={styles.balance}>
                  {balanceText}
                </Text>
                {amountSuffix ? (
                  <View style={styles.suffix}>
                    <Text style={styles.suffixText}>{amountSuffix}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Text style={[styles.sectionTitle, { color: c.fg }, rtlText(isRTL)]}>
              {loc.txDetail.latestActivity}
            </Text>
          </>
        }
        ListEmptyComponent={
          <Text style={[TYPE.cardDesc, styles.empty, { color: c.muted }, rtlText(isRTL)]}>
            {loc.holdings.noActivityYet}
          </Text>
        }
        contentContainerStyle={[
          styles.listContent,
          { backgroundColor: c.bg, paddingBottom: insets.bottom + 88 },
        ]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadTransactions(true)}
            tintColor={WHITE}
          />
        }
      />
      <View style={[styles.dockWrap, { bottom: insets.bottom + 12 }]} pointerEvents="box-none">
        <View style={[styles.dock, { backgroundColor: c.dockBg, borderColor: c.dockBorder }]}>
          <Pressable onPress={openSend} style={styles.dockButton}>
            <MaterialIcons name="call-made" size={17} color={WHITE} />
            <Text style={[styles.dockText, rtlText(isRTL)]}>{loc.outflow.dispatchHeading}</Text>
          </Pressable>
          <View style={[styles.dockDivider, { backgroundColor: c.dockBorder }]} />
          <Pressable onPress={openReceive} style={styles.dockButton}>
            <MaterialIcons name="call-received" size={17} color={WHITE} />
            <Text style={[styles.dockText, rtlText(isRTL)]}>{loc.inflow.incomingTab}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 240,
  },
  optionsButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  optionsText: {
    color: WHITE,
    fontSize: TYPE.button.fontSize,
    fontWeight: '500',
  },
  rowWrap: {
    paddingHorizontal: SPACING.lg,
  },
  headerCard: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xxl,
  },
  headerLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: TYPE.cardSubtitle.fontSize,
    fontWeight: '500',
    marginBottom: SPACING.sm,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  balance: {
    color: WHITE,
    fontSize: TYPE.totalBalance.fontSize,
    lineHeight: TYPE.totalBalance.lineHeight,
    fontWeight: '800',
    flexShrink: 1,
  },
  suffix: {
    marginStart: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  suffixText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: TYPE.cardTitle.fontSize,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: TYPE.cardTitle.fontSize,
    fontWeight: '800',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.sm,
  },
  empty: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  listContent: {
    flexGrow: 1,
  },
  dockWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.button,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.sm,
  },
  dockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  dockText: {
    color: WHITE,
    fontSize: TYPE.button.fontSize,
    fontWeight: '600',
    marginStart: SPACING.sm,
  },
  dockDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: SPACING.sm,
  },
});

export default WalletDetailScreen;
export { WalletDetailScreen };
