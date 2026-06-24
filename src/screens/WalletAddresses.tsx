import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Clipboard,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MenuAction } from '@react-native-menu/menu';

import { COLORS, ms } from '../theme';
import { copyEphemeralSecret } from '../utils/clipboard';
import loc from '../i18n';
import type {
  AddressBranch,
  MultisigAccount,
  MultisigBranch,
  ScanResponse,
  ScriptType,
  WalletAddress,
} from '../types/index';
import { fetchHistory } from '../network/mempool';
import { formatUnit, unitLabel } from '../utils/currency';
import { triggerHaptic } from '../utils/haptics';
import AddrRowItem, {
  type AddressRow,
  type UnitFormatter,
} from '../components/AddrRowItem';
import { useWallets, type WalletEntry } from '../wallets/context';
import type { RootStackParamList } from '../navigation/types';

type AddressBranchTab = 'receive' | 'change';

type BranchRows = { receive: AddressRow[]; change: AddressRow[] };

const SCHEME_ORDER: ScriptType[] = ['BIP84', 'BIP49', 'BIP44'];

const MULTISIG_SCHEME = 'BIP48';

const indexFromPath = (path: string): number => {
  const tail = (path || '').split('/').pop() ?? '';
  const parsed = Number.parseInt(tail, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sortByIndex = (a: AddressRow, b: AddressRow): number =>
  a.index - b.index || a.address.localeCompare(b.address);

const isStandardWallet = (entry: WalletEntry | undefined): boolean =>
  !!entry && !entry.multisig && !entry.wif;

export const WalletAddressesScreen = (): React.ReactElement => {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? COLORS.dark : COLORS.light;
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'WalletAddresses'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'WalletAddresses'>>();

  const { wallets, refreshWallet, denomination } = useWallets();
  const walletId = route.params.id;
  const entry = wallets.find(item => item.id === walletId);

  const standardScan = isStandardWallet(entry)
    ? (entry?.scan as ScanResponse | null)
    : null;
  const accountMap = useMemo(() => standardScan?.result?.data, [standardScan]);
  const utxos = useMemo(
    () => standardScan?.result?.grandTotals?.utxos ?? [],
    [standardScan],
  );

  const isMultisig = !!entry?.multisig;
  const multisigData = entry?.multisig?.scan?.result ?? null;
  const multisigPrimary = entry?.multisig?.scan?.primaryType ?? MULTISIG_SCHEME;

  const [tab, setTab] = useState<AddressBranchTab>('receive');
  const [txCounts, setTxCounts] = useState<Record<string, number>>({});
  const [txLoaded, setTxLoaded] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isStandardWallet(entry)) {
      refreshWallet(walletId);
    }
  }, [walletId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: loc.addrBook.walletReceiveSlotsHeading,
      headerShadowVisible: false,
      headerBackButtonDisplayMode: 'minimal',
      headerStyle: { backgroundColor: palette.customHeader },
      headerTintColor: palette.fg,
      headerTitleStyle: { color: palette.fg, fontWeight: '600' },
      headerSearchBarOptions: {
        onChangeText: (event: { nativeEvent: { text: string } }) =>
          setSearch(event.nativeEvent.text),
        placeholder: loc.shared.lookupField,
        textColor: palette.fg,
        hintTextColor: palette.txdMuted,
      },
    });
  }, [navigation, palette.customHeader, palette.fg, palette.txdMuted]);

  const balanceOf = useCallback(
    (address: string): number =>
      utxos.reduce(
        (sum, utxo) => (utxo.address === address ? sum + (utxo.value ?? 0) : sum),
        0,
      ),
    [utxos],
  );

  const buildBranch = useCallback(
    (
      branch: AddressBranch | undefined,
      isInternal: boolean,
      scheme: ScriptType,
    ): AddressRow[] => {
      if (!branch) {
        return [];
      }
      const rows: AddressRow[] = [];
      const seen = new Set<string>();
      const push = (
        address: WalletAddress | undefined,
        used: boolean,
        isFresh: boolean,
      ) => {
        if (!address || seen.has(address.address)) {
          return;
        }
        seen.add(address.address);
        rows.push({
          address: address.address,
          wif: address.wif,
          path: address.path,
          explorerUrl: address.addressExplorerUrl,
          isInternal,
          isFresh,
          used,
          balance: balanceOf(address.address),
          index: indexFromPath(address.path),
          scheme,
        });
      };
      branch.used.forEach(item => push(item, true, false));
      push(branch.fresh ?? branch.used[0], false, true);
      return rows;
    },
    [balanceOf],
  );

  const buildScheme = useCallback(
    (scheme: ScriptType, isInternal: boolean): AddressRow[] =>
      buildBranch(
        isInternal ? accountMap?.[scheme]?.change : accountMap?.[scheme]?.receive,
        isInternal,
        scheme,
      ).sort(sortByIndex),
    [buildBranch, accountMap],
  );

  const standardRows = useMemo(
    () =>
      SCHEME_ORDER.flatMap(scheme => [
        ...buildScheme(scheme, false),
        ...buildScheme(scheme, true),
      ]),
    [buildScheme],
  );

  const multisigRows = useMemo((): BranchRows => {
    const account = multisigData?.data?.[multisigPrimary] as MultisigAccount | undefined;
    if (!isMultisig || !account) {
      return { receive: [], change: [] };
    }
    const build = (branch: MultisigBranch | undefined, isInternal: boolean): AddressRow[] => {
      if (!branch) {
        return [];
      }
      const rows: AddressRow[] = [];
      const seen = new Set<string>();
      const push = (
        item: MultisigBranch['used'][number] | undefined,
        used: boolean,
        isFresh: boolean,
      ) => {
        if (!item || seen.has(item.address)) {
          return;
        }
        seen.add(item.address);
        rows.push({
          address: item.address,
          wif: '',
          path: item.path,
          explorerUrl: item.addressExplorerUrl,
          isInternal,
          isFresh,
          used,
          balance: item.balanceTotal,
          index: item.index,
          scheme: MULTISIG_SCHEME,
          txCount: item.totalTxCount,
        });
      };
      branch.used.forEach(item => push(item, true, false));
      push(branch.fresh ?? branch.used[0], false, true);
      return rows.sort(sortByIndex);
    };
    return { receive: build(account.receive, false), change: build(account.change, true) };
  }, [isMultisig, multisigData, multisigPrimary]);

  const visibleRows = useMemo(() => {
    const source = isMultisig
      ? tab === 'change'
        ? multisigRows.change
        : multisigRows.receive
      : SCHEME_ORDER.flatMap(scheme => buildScheme(scheme, tab === 'change'));
    const query = search.trim().toLowerCase();
    return query
      ? source.filter(row => row.address.toLowerCase().includes(query))
      : source;
  }, [isMultisig, multisigRows, buildScheme, tab, search]);

  const ready = isMultisig ? !!multisigData : !!accountMap;

  useEffect(() => {
    if (isMultisig) {
      return;
    }
    const addresses = standardRows.map(row => row.address);
    if (addresses.length === 0) {
      return;
    }
    let active = true;
    fetchHistory(addresses)
      .then(result => {
        if (!active) {
          return;
        }
        const counts: Record<string, number> = {};
        for (const tx of result.transactions) {
          const touched = new Set<string>();
          for (const input of tx.inputs) {
            if (input.address) {
              touched.add(input.address);
            }
          }
          for (const output of tx.outputs) {
            if (output.address) {
              touched.add(output.address);
            }
          }
          touched.forEach(address => {
            counts[address] = (counts[address] ?? 0) + 1;
          });
        }
        setTxCounts(counts);
        setTxLoaded(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [standardRows, isMultisig]);

  const unit: UnitFormatter = useMemo(() => {
    const displayUnit = denomination === 'sats' ? 'sats' : 'BTC';
    return {
      fmt: (sats: number) => formatUnit(sats, displayUnit),
      label: unitLabel(displayUnit),
    };
  }, [denomination]);

  const standardActions = useMemo<MenuAction[]>(
    () => [
      { id: 'copy', title: loc.ledger.grabHashIdentifier, image: 'doc.on.clipboard', imageColor: palette.fg },
      { id: 'share', title: loc.inflow.distributeQr, image: 'square.and.arrow.up', imageColor: palette.fg },
      { id: 'signVerify', title: loc.addrBook.cryptoProofScreenHeading, image: 'signature', imageColor: palette.fg },
      { id: 'copyWif', title: loc.addrBook.duplicateSecretKey, image: 'key', imageColor: palette.fg },
    ],
    [palette.fg],
  );

  const multisigActions = useMemo<MenuAction[]>(
    () => [
      { id: 'copy', title: loc.ledger.grabHashIdentifier, image: 'doc.on.clipboard', imageColor: palette.fg },
      { id: 'share', title: loc.inflow.distributeQr, image: 'square.and.arrow.up', imageColor: palette.fg },
    ],
    [palette.fg],
  );

  const onMenu = useCallback(
    (event: string, item: AddressRow) => {
      if (event === 'copy') {
        Clipboard.setString(item.address);
        triggerHaptic();
      } else if (event === 'share') {
        Share.share({ message: item.address }).catch(() => {});
      } else if (event === 'signVerify') {
        navigation.navigate('SignVerify', { address: item.address, wif: item.wif });
      } else if (event === 'copyWif' && item.wif) {
        // WIF is a spendable private key — auto-clear it from the clipboard.
        copyEphemeralSecret(item.wif);
        triggerHaptic();
      }
    },
    [navigation],
  );

  const onOpen = useCallback(
    (item: AddressRow) =>
      navigation.navigate('ReceiveSheet', { address: item.address, label: entry?.label }),
    [navigation, entry?.label],
  );

  const renderItem = useCallback(
    ({ item }: { item: AddressRow }) => (
      <AddrRowItem
        item={item}
        c={palette}
        isDark={isDark}
        actions={isMultisig ? multisigActions : standardActions}
        onMenu={onMenu}
        onOpen={onOpen}
        txLoaded={isMultisig ? true : txLoaded}
        txCount={item.txCount ?? txCounts[item.address] ?? 0}
        unit={unit}
        transactionsLabel={loc.holdings.movementsCaption}
      />
    ),
    [palette, isDark, isMultisig, multisigActions, standardActions, onMenu, onOpen, txLoaded, txCounts, unit],
  );

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={[styles.listBody, { backgroundColor: palette.elevated }]}
      data={ready ? visibleRows : []}
      keyExtractor={row => row.address}
      extraData={`${tab}|${txLoaded}|${search}`}
      initialNumToRender={20}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={styles.tabsWrap}>
          <View style={[styles.tabsTrack, { backgroundColor: isDark ? '#3A3A3C' : '#eef0f4' }]}>
            {(['receive', 'change'] as const).map(value => {
              const active = tab === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setTab(value)}
                  style={[
                    styles.tab,
                    active && { backgroundColor: isDark ? '#202020' : '#ffffff' },
                  ]}>
                  <Text
                    style={[
                      styles.tabText,
                      { color: palette.fg, fontWeight: active ? 'bold' : 'normal' },
                    ]}>
                    {value === 'receive' ? loc.inflow.incomingTab : loc.coinSelect.modify}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      }
      ListEmptyComponent={
        ready ? null : <ActivityIndicator style={styles.spinner} color={palette.accentBlue} />
      }
      renderItem={renderItem}
    />
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  listBody: {
    flexGrow: 1,
  },
  tabsWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  tabsTrack: {
    flexDirection: 'row',
    borderRadius: ms(10),
    padding: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: ms(8),
  },
  tabText: {
    fontSize: 15,
  },
  spinner: {
    marginTop: 48,
  },
});

export default WalletAddressesScreen;
