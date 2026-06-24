import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DisplayUnit, ScriptType, HistoryTx } from '../types';

export type ChangeAddressMode = 'auto' | ScriptType;
export type FeePreference = 'fast' | 'medium' | 'slow' | string;

export interface AddressBookEntry {
  address: string;
  label?: string;
  lastUsedAt?: number;
}

export interface CachedRate {
  value: number;
  updatedAt: number;
}

const NAMESPACE = 'walletapp';

const key = (name: string): string => `${NAMESPACE}.${name}`;

export const StorageKeys = {
  wallets: key('wallets'),
  encryptedHolding: key('holding'),
  holdingEncrypted: key('holdingEncrypted'),
  biometricsEnabled: key('biometricsEnabled'),
  displayUnit: key('displayUnit'),
  fiatCurrency: key('fiatCurrency'),
  cachedRate: key('cachedRate'),
  blockExplorer: key('blockExplorer'),
  feePreference: key('feePreference'),
  changeAddressMode: key('changeAddressMode'),
  frozenUtxos: key('frozenUtxos'),
  utxoLabels: key('utxoLabels'),
  addressBook: key('addressBook'),
  transactionCache: key('transactionCache'),
  haptics: key('haptics'),
  notifications: key('notifications'),
  analyticsDisabled: key('analyticsDisabled'),
  language: key('language'),
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

export async function persistString(name: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(name, value);
  } catch {}
}

export async function loadString(name: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(name);
  } catch {
    return null;
  }
}

export async function removeKey(name: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(name);
  } catch {}
}

export async function persistJson<T>(name: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(name, JSON.stringify(value));
  } catch {}
}

export async function loadJson<T>(name: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(name);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export async function persistBool(name: string, value: boolean): Promise<void> {
  await persistString(name, value ? '1' : '0');
}

export async function loadBool(name: string, fallback = false): Promise<boolean> {
  const raw = await loadString(name);
  if (raw == null || raw === '') return fallback;
  return raw === '1' || raw === 'true';
}

export async function persistNumber(name: string, value: number): Promise<void> {
  await persistString(name, String(value));
}

export async function loadNumber(name: string, fallback: number): Promise<number> {
  const raw = await loadString(name);
  if (raw == null || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getBiometricsEnabled(): Promise<boolean> {
  return loadBool(StorageKeys.biometricsEnabled, false);
}

export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
  await persistBool(StorageKeys.biometricsEnabled, enabled);
}

export async function getHapticsEnabled(): Promise<boolean> {
  return loadBool(StorageKeys.haptics, true);
}

export async function setHapticsEnabled(enabled: boolean): Promise<void> {
  await persistBool(StorageKeys.haptics, enabled);
}

export async function getNotificationsEnabled(): Promise<boolean> {
  return loadBool(StorageKeys.notifications, false);
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await persistBool(StorageKeys.notifications, enabled);
}

export async function getAnalyticsDisabled(): Promise<boolean> {
  return loadBool(StorageKeys.analyticsDisabled, false);
}

export async function setAnalyticsDisabled(disabled: boolean): Promise<void> {
  await persistBool(StorageKeys.analyticsDisabled, disabled);
}

const DISPLAY_UNITS: DisplayUnit[] = ['BTC', 'sats'];

export async function getDisplayUnit(): Promise<DisplayUnit> {
  const raw = await loadString(StorageKeys.displayUnit);
  return DISPLAY_UNITS.includes(raw as DisplayUnit) ? (raw as DisplayUnit) : 'BTC';
}

export async function setDisplayUnit(unit: DisplayUnit): Promise<void> {
  await persistString(StorageKeys.displayUnit, unit);
}

export async function getFiatCurrency(): Promise<string> {
  const raw = await loadString(StorageKeys.fiatCurrency);
  return raw && raw.length > 0 ? raw : 'USD';
}

export async function setFiatCurrency(code: string): Promise<void> {
  await persistString(StorageKeys.fiatCurrency, code);
}

export async function getCachedRate(): Promise<CachedRate | null> {
  const stored = await loadJson<CachedRate | null>(StorageKeys.cachedRate, null);
  if (!stored || typeof stored.value !== 'number' || !Number.isFinite(stored.value)) {
    return null;
  }
  return {
    value: stored.value,
    updatedAt: typeof stored.updatedAt === 'number' ? stored.updatedAt : 0,
  };
}

export async function setCachedRate(value: number): Promise<void> {
  await persistJson<CachedRate>(StorageKeys.cachedRate, { value, updatedAt: Date.now() });
}

export async function getBlockExplorerUrl(): Promise<string | null> {
  return loadString(StorageKeys.blockExplorer);
}

export async function setBlockExplorerUrl(url: string): Promise<void> {
  await persistString(StorageKeys.blockExplorer, url);
}

export async function getFeePreference(): Promise<FeePreference> {
  const raw = await loadString(StorageKeys.feePreference);
  return raw && raw.length > 0 ? raw : 'medium';
}

export async function setFeePreference(preference: FeePreference): Promise<void> {
  await persistString(StorageKeys.feePreference, String(preference));
}

const CHANGE_MODES: ChangeAddressMode[] = ['auto', 'BIP84', 'BIP49', 'BIP44'];

export async function getChangeAddressMode(): Promise<ChangeAddressMode> {
  const raw = await loadString(StorageKeys.changeAddressMode);
  return CHANGE_MODES.includes(raw as ChangeAddressMode) ? (raw as ChangeAddressMode) : 'auto';
}

export async function setChangeAddressMode(mode: ChangeAddressMode): Promise<void> {
  await persistString(StorageKeys.changeAddressMode, mode);
}

export function outpointKey(walletId: string, txid: string, vout: number): string {
  return `${walletId}:${txid}:${vout}`;
}

export async function getFrozenUtxos(): Promise<Set<string>> {
  const list = await loadJson<string[]>(StorageKeys.frozenUtxos, []);
  return new Set(Array.isArray(list) ? list.filter(v => typeof v === 'string') : []);
}

export async function setFrozenUtxos(frozen: Set<string>): Promise<void> {
  await persistJson<string[]>(StorageKeys.frozenUtxos, Array.from(frozen));
}

export async function getUtxoLabels(): Promise<Record<string, string>> {
  const stored = await loadJson<Record<string, string>>(StorageKeys.utxoLabels, {});
  if (!stored || typeof stored !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(stored)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

export async function setUtxoLabels(labels: Record<string, string>): Promise<void> {
  await persistJson<Record<string, string>>(StorageKeys.utxoLabels, labels);
}

export async function getAddressBook(): Promise<AddressBookEntry[]> {
  const list = await loadJson<AddressBookEntry[]>(StorageKeys.addressBook, []);
  if (!Array.isArray(list)) return [];
  return list.filter(entry => entry && typeof entry.address === 'string' && entry.address.length > 0);
}

export async function setAddressBook(entries: AddressBookEntry[]): Promise<void> {
  await persistJson<AddressBookEntry[]>(StorageKeys.addressBook, entries);
}

export async function upsertAddressBookEntry(entry: AddressBookEntry): Promise<AddressBookEntry[]> {
  const book = await getAddressBook();
  const index = book.findIndex(existing => existing.address === entry.address);
  if (index >= 0) {
    book[index] = { ...book[index], ...entry };
  } else {
    book.push(entry);
  }
  await setAddressBook(book);
  return book;
}

export async function getCachedTransactions(walletId: string): Promise<HistoryTx[]> {
  const cache = await loadJson<Record<string, HistoryTx[]>>(StorageKeys.transactionCache, {});
  const txs = cache && typeof cache === 'object' ? cache[walletId] : undefined;
  return Array.isArray(txs) ? txs : [];
}

export async function setCachedTransactions(walletId: string, txs: HistoryTx[]): Promise<void> {
  const cache = await loadJson<Record<string, HistoryTx[]>>(StorageKeys.transactionCache, {});
  const next = cache && typeof cache === 'object' ? { ...cache } : {};
  next[walletId] = txs;
  await persistJson<Record<string, HistoryTx[]>>(StorageKeys.transactionCache, next);
}

export async function getLanguage(): Promise<string | null> {
  return loadString(StorageKeys.language);
}

export async function setLanguage(language: string): Promise<void> {
  await persistString(StorageKeys.language, language);
}

export async function clearAll(): Promise<void> {
  try {
    const all = await AsyncStorage.getAllKeys();
    const owned = all.filter(k => k.startsWith(`${NAMESPACE}.`));
    await Promise.all(owned.map(k => AsyncStorage.removeItem(k)));
  } catch {}
}
