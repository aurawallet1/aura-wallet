import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, SPACING } from '../theme';
import loc from '../i18n';
import { SATS_PER_BTC } from '../constants/bitcoin';
import type {
  ScanResponse,
  ScriptType,
  Utxo,
  WalletAddress,
} from '../types/index';
import type { SendStackParamList } from '../navigation/types';
import { useWallets, type ChangeAddressOverride, type WalletEntry } from '../wallets/context';
import {
  buildSignedTransaction,
  type SignableScript,
  type SigningInput,
} from '../wallets/signing';
import {
  broadcastRawTransaction,
  fetchRecommendedFees,
  type RecommendedFees,
} from '../network/mempool';
import { triggerSuccessHaptic } from '../utils/haptics';
import ConfirmRow from '../components/ConfirmRow';
import PrimaryButton from '../components/PrimaryButton';

const NOTES_STORAGE_KEY = 'walletapp.txNotes';

const DUST_FLOOR_SATS = 546;

const ESTIMATED_INPUT_VBYTES: Record<ScriptType, number> = {
  BIP44: 148,
  BIP49: 91,
  BIP84: 68,
};
const OVERHEAD_VBYTES = 11;
const OUTPUT_VBYTES = 34;

const SIGNABLE_BY_SCRIPT: Record<ScriptType, SignableScript> = {
  BIP44: 'P2PKH',
  BIP49: 'P2SH-P2WPKH',
  BIP84: 'P2WPKH',
};

const FEE_PRIORITY_KEYS: Record<string, keyof RecommendedFees> = {
  fast: 'fastestFee',
  medium: 'halfHourFee',
  slow: 'hourFee',
};

interface SpendableCoin {
  txid: string;
  vout: number;
  value: number;
  wif: string;
  scriptType: ScriptType;
}

interface ChangeTarget {
  address: string;
  scriptType: ScriptType;
}

const outpointId = (txid: string, vout: number): string => `${txid}:${vout}`;

const coinIdentity = (walletId: string, utxo: Utxo): string => {
  const txid = (utxo.txid ?? utxo.tx_hash ?? '') as string;
  const vout = (utxo.vout ?? utxo.tx_pos ?? 0) as number;
  return `${walletId}:${txid}:${vout}`;
};

const trimmedBtc = (sats: number): string => {
  const text = (sats / SATS_PER_BTC).toFixed(8);
  const tidy = text.replace(/0+$/, '').replace(/\.$/, '');
  return tidy.length ? tidy : '0';
};

const scanData = (entry: WalletEntry | undefined): ScanResponse['result']['data'] | null => {
  if (!entry || entry.multisig || entry.wif) return null;
  const scan = entry.scan as ScanResponse | null;
  return scan ? scan.result.data : null;
};

const primaryScriptType = (entry: WalletEntry | undefined): ScriptType => {
  if (!entry) return 'BIP84';
  if (entry.pathType) return entry.pathType;
  const scan = entry.scan as ScanResponse | null;
  return scan ? scan.primaryType : 'BIP84';
};

const indexAddressBook = (
  data: ScanResponse['result']['data'] | null,
): Map<string, { wif: string; scriptType: ScriptType }> => {
  const map = new Map<string, { wif: string; scriptType: ScriptType }>();
  if (!data) return map;
  (Object.keys(data) as ScriptType[]).forEach(scriptType => {
    const account = data[scriptType];
    if (!account) return;
    const register = (item: WalletAddress | undefined) => {
      if (item && item.wif) map.set(item.address, { wif: item.wif, scriptType });
    };
    account.receive.used.forEach(register);
    register(account.receive.fresh);
    account.change.used.forEach(register);
    register(account.change.fresh);
  });
  return map;
};

const freshChangeAddress = (
  entry: WalletEntry | undefined,
  override: ChangeAddressOverride,
): ChangeTarget | null => {
  const data = scanData(entry);
  if (!data) return null;
  const scriptType: ScriptType = override === 'auto' ? primaryScriptType(entry) : override;
  const account = data[scriptType];
  if (!account) return null;
  const candidate = account.change.fresh ?? account.change.used[0] ?? account.receive.fresh;
  if (!candidate) return null;
  return { address: candidate.address, scriptType };
};

const estimateVBytes = (coins: SpendableCoin[], outputs: number): number => {
  let total = OVERHEAD_VBYTES + outputs * OUTPUT_VBYTES;
  for (const coin of coins) total += ESTIMATED_INPUT_VBYTES[coin.scriptType];
  return Math.max(1, Math.ceil(total));
};

const SendConfirmScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const c = isDark ? COLORS.dark : COLORS.light;
  const navigation = useNavigation<NativeStackNavigationProp<SendStackParamList, 'SendConfirm'>>();
  const route = useRoute<RouteProp<SendStackParamList, 'SendConfirm'>>();
  const { id, address, amountSats } = route.params;

  const {
    wallets,
    refreshWallet,
    saveAddress,
    feePreference,
    changeAddressType,
    frozenUtxos,
    selectedUtxos,
    clearSelectedUtxos,
  } = useWallets();

  const entry = wallets.find(item => item.id === id);
  const insets = useSafeAreaInsets();

  const [note, setNote] = useState('');
  const requestedSats = amountSats > 0 ? amountSats : 0;
  const [feeRate, setFeeRate] = useState(1);
  const [vbytes, setVbytes] = useState(140);
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);

  const feeSats = Math.max(1, Math.round(feeRate * vbytes));
  const feeBtc = trimmedBtc(feeSats);

  const spendableCoins = useMemo<SpendableCoin[]>(() => {
    if (!entry || entry.multisig || entry.wif) return [];
    const scan = entry.scan as ScanResponse | null;
    if (!scan) return [];
    const lookup = indexAddressBook(scan.result.data);
    const subset = selectedUtxos[id];
    const out: SpendableCoin[] = [];
    for (const utxo of scan.result.grandTotals.utxos) {
      const identity = coinIdentity(id, utxo);
      if (frozenUtxos.has(identity)) continue;
      if (subset && subset.size && !subset.has(identity)) continue;
      const ownerAddress = (utxo.address ?? '') as string;
      const owner = lookup.get(ownerAddress);
      const txid = (utxo.txid ?? utxo.tx_hash ?? '') as string;
      const vout = (utxo.vout ?? utxo.tx_pos ?? 0) as number;
      const value = (utxo.value ?? 0) as number;
      if (!owner || !txid || value <= 0) continue;
      out.push({ txid, vout, value, wif: owner.wif, scriptType: owner.scriptType });
    }
    return out;
  }, [entry, id, frozenUtxos, selectedUtxos]);

  const totalAvailable = useMemo(
    () => spendableCoins.reduce((sum, coin) => sum + coin.value, 0),
    [spendableCoins],
  );

  const hasFrozenCoins = useMemo(() => {
    if (!entry || entry.multisig || entry.wif) return false;
    const scan = entry.scan as ScanResponse | null;
    if (!scan) return false;
    return scan.result.grandTotals.utxos.some(utxo => frozenUtxos.has(coinIdentity(id, utxo)));
  }, [entry, id, frozenUtxos]);

  const sendsAllCoins = totalAvailable > 0 && requestedSats >= totalAvailable - feeSats;
  const displayedSats = sendsAllCoins ? Math.max(0, requestedSats - feeSats) : requestedSats;
  const amountBtc = trimmedBtc(displayedSats);

  const composeOutputs = useCallback(
    (
      coins: SpendableCoin[],
      rate: number,
      change: ChangeTarget | null,
    ): { inputs: SigningInput[]; outputs: { address: string; value: number }[] } | null => {
      if (!coins.length) return null;
      const inputs: SigningInput[] = coins.map(coin => ({
        txid: coin.txid,
        vout: coin.vout,
        value: coin.value,
        wif: coin.wif,
        scriptType: SIGNABLE_BY_SCRIPT[coin.scriptType],
      }));
      const inputTotal = coins.reduce((sum, coin) => sum + coin.value, 0);
      const baseFee = Math.max(1, Math.round(rate * estimateVBytes(coins, 2)));
      const changeValue = inputTotal - requestedSats - baseFee;

      const outputs: { address: string; value: number }[] = [
        { address, value: requestedSats },
      ];
      if (change && changeValue >= DUST_FLOOR_SATS) {
        outputs.push({ address: change.address, value: changeValue });
      } else {
        const noChangeFee = Math.max(1, Math.round(rate * estimateVBytes(coins, 1)));
        const trimmed = inputTotal - noChangeFee;
        if (trimmed < DUST_FLOOR_SATS) return null;
        const sendValue = Math.min(requestedSats, trimmed);
        // Without a change output any non-dust remainder would be paid to miners.
        // Refuse to build such a transaction (e.g. no valid change address) rather
        // than silently burning the leftover to fees.
        if (trimmed - sendValue >= DUST_FLOOR_SATS) return null;
        outputs[0] = { address, value: sendValue };
      }
      return { inputs, outputs };
    },
    [address, requestedSats],
  );

  const assemble = useCallback(
    (rate: number): { hex: string; txid: string; vsize: number } | null => {
      const change = freshChangeAddress(entry, changeAddressType);
      const plan = composeOutputs(spendableCoins, rate, change);
      if (!plan) return null;
      // Defense-in-depth: never broadcast a tx whose real fee exceeds the quote by
      // more than dust — guards against any miscomputed/burned remainder.
      const inTotal = plan.inputs.reduce((sum, item) => sum + item.value, 0);
      const outTotal = plan.outputs.reduce((sum, item) => sum + item.value, 0);
      const actualFee = inTotal - outTotal;
      const quotedFee = Math.max(1, Math.round(rate * estimateVBytes(spendableCoins, plan.outputs.length)));
      if (actualFee < 0 || actualFee > quotedFee + DUST_FLOOR_SATS) return null;
      const signed = buildSignedTransaction(plan.inputs, plan.outputs);
      return { hex: signed.hex, txid: signed.txid, vsize: signed.vsize };
    },
    [entry, changeAddressType, composeOutputs, spendableCoins],
  );

  useEffect(() => {
    let alive = true;
    fetchRecommendedFees()
      .then(fees => {
        if (!alive) return;
        const preference = feePreference;
        const mapped = FEE_PRIORITY_KEYS[preference];
        const numeric = Number(preference);
        const next = mapped
          ? fees[mapped]
          : Number.isFinite(numeric) && numeric > 0
            ? numeric
            : fees.fastestFee;
        setFeeRate(next > 0 ? next : fees.minimumFee);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [feePreference]);

  useEffect(() => {
    if (!entry || requestedSats <= 0 || spendableCoins.length === 0) {
      setReady(true);
      return;
    }
    try {
      const built = assemble(feeRate);
      if (built && built.vsize > 0) setVbytes(built.vsize);
    } catch {}
    setReady(true);
  }, [entry, requestedSats, spendableCoins.length, feeRate, assemble]);

  const persistNote = useCallback(async (txid: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      const raw = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
      const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      map[txid] = trimmed;
      await AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(map));
    } catch {}
  }, []);

  const onSend = useCallback(async () => {
    if (sending) return;
    if (!entry) {
      Alert.alert(loc.outflow.dispatchHeading, loc.outflow.walletMissing);
      return;
    }
    if (!entry.scan) {
      Alert.alert(loc.outflow.dispatchHeading, loc.outflow.walletLinkingUp);
      return;
    }
    if (spendableCoins.length === 0) {
      Alert.alert(loc.outflow.dispatchHeading, loc.outflow.emptyPickWallet);
      return;
    }
    if (totalAvailable > 0) {
      if (requestedSats > totalAvailable) {
        Alert.alert(
          loc.outflow.dispatchHeading,
          hasFrozenCoins ? loc.outflow.overSpendableLockedExcluded : loc.outflow.overWalletHoldings,
        );
        return;
      }
      if (feeSats >= requestedSats) {
        Alert.alert(loc.outflow.dispatchHeading, loc.outflow.minerCostBeatsValue);
        return;
      }
      if (displayedSats < DUST_FLOOR_SATS) {
        Alert.alert(loc.outflow.dispatchHeading, loc.outflow.belowDustThreshold);
        return;
      }
    }

    setSending(true);
    try {
      const built = assemble(feeRate);
      if (!built || !built.hex) {
        throw new Error(loc.outflow.relayUnsuccessful);
      }
      if (built.vsize > 0 && built.vsize !== vbytes) setVbytes(built.vsize);

      const result = await broadcastRawTransaction(built.hex);
      const txid = result.success ? result.txid : undefined;
      if (!result.success || !txid) {
        throw new Error(result.error || loc.outflow.relayUnsuccessful);
      }

      await persistNote(txid, note);
      saveAddress(address);
      clearSelectedUtxos(id);
      refreshWallet(id);
      triggerSuccessHaptic();
      navigation.navigate('SendSuccess', { amountSats: displayedSats, feeSats });
    } catch (error) {
      Alert.alert(
        loc.outflow.dispatchErrorHeading,
        error instanceof Error ? error.message : loc.faults.unexpectedIssue,
      );
    } finally {
      setSending(false);
    }
  }, [
    sending,
    entry,
    spendableCoins.length,
    totalAvailable,
    requestedSats,
    hasFrozenCoins,
    feeSats,
    displayedSats,
    assemble,
    feeRate,
    vbytes,
    persistNote,
    note,
    saveAddress,
    address,
    clearSelectedUtxos,
    id,
    refreshWallet,
    navigation,
  ]);

  const openFeeSheet = useCallback(() => {
    navigation.navigate('SelectFeeSheet', { current: feeRate, onPick: setFeeRate, vsize: vbytes });
  }, [navigation, feeRate, vbytes]);

  const openNoteSheet = useCallback(() => {
    navigation.navigate('SendNoteSheet', { note, onSave: setNote });
  }, [navigation, note]);

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.content, { paddingBottom: SPACING.lg }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <ConfirmRow c={c} label={loc.outflow.destinationLabel} value={address} />
        <ConfirmRow
          c={c}
          label={loc.outflow.valueLabel}
          value={`${amountBtc} ${loc.denom.coinTicker}`}
          loading={!ready}
        />
        <ConfirmRow
          c={c}
          label={loc.ledger.minerCharge}
          value={`${feeBtc} ${loc.denom.coinTicker}`}
          pencil
          onPencil={openFeeSheet}
          editLabel={loc.outflow.tweakMinerCost}
          loading={!ready}
        />
        <ConfirmRow
          c={c}
          label={loc.outflow.payloadWeight}
          value={`${vbytes} ${loc.denom.virtualWeightUnit}`}
          loading={!ready}
        />
        <ConfirmRow
          c={c}
          label={loc.outflow.satsPerVirtualByte}
          value={`${feeRate} ${loc.denom.feeRateMetric}`}
        />
        <View style={[styles.divider, { backgroundColor: c.inputBorder }]} />
        <Pressable onPress={openNoteSheet}>
          <Text style={[styles.note, { color: note ? c.fg : c.labelText }]}>
            {note || loc.outflow.memoHint}
          </Text>
        </Pressable>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>
        {sending ? (
          <View style={styles.footerLoading}>
            <ActivityIndicator color={c.accentBlue} />
          </View>
        ) : (
          <PrimaryButton
            label={loc.outflow.dispatchImmediately}
            color={c.accentBlue}
            onPress={onSend}
            disabled={!ready}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: SPACING.lg,
  },
  note: {
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
  },
  footerLoading: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SendConfirmScreen;
export { SendConfirmScreen };
