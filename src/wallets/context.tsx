import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, I18nManager } from 'react-native';

import loc, { setLanguage as saveLanguage } from '../i18n';
import type {
  DisplayUnit,
  FiatSource,
  FiatUnit,
  HistoryTx,
  MultisigHoldingResponse,
  ScanResponse,
  ScriptType,
  WifScanResult,
} from '../types/index';
import { DEFAULT_EXPLORER_URL } from '../network/blockExplorers';
import { fetchBtcRate } from '../network/rates';
import { scanMnemonic, scanMultisig, setMempoolFallbackAllowed } from './scan';
import { firstReceiveAddress } from './derivation';
import {
  decryptBlob,
  encryptBlob,
  sealWithKey,
  storageIsEncrypted as isEncryptedEnvelope,
} from '../utils/encryption';
import {
  ensureDeviceKey,
  deleteDeviceKey,
} from '../utils/secureStore';
import {
  isBiometricsEnabled,
  setBiometricsEnabled as persistBiometricsEnabled,
} from '../utils/biometrics';
import { setHapticsOn } from '../utils/haptics';
import {
  StorageKeys,
  getAddressBook,
  loadJson,
  loadString,
  persistJson,
  persistString,
  removeKey,
  setAddressBook,
  setCachedRate,
  setHapticsEnabled as persistHapticsEnabled,
  setAnalyticsDisabled as persistAnalyticsDisabled,
  setMempoolFallback as persistMempoolFallback,
  getCachedRate,
  clearAll,
} from '../utils/storage';

export type BitcoinUnit = DisplayUnit | 'fiat';
export type ChangeAddressOverride = 'auto' | ScriptType;
export type WalletOrigin = 'import' | 'create';

const BITCOIN_UNITS: readonly BitcoinUnit[] = ['BTC', 'sats', 'fiat'];

export interface AddressBookEntry {
  address: string;
  name?: string;
  lastUsedAt: number;
}

export interface HoldingData {
  m: number;
  n: number;
  mnemonics: string[];
  scan: MultisigHoldingResponse | null;
}

export interface WalletEntry {
  id: string;
  label: string;
  mnemonic: string;
  passphrase: string;
  wif?: string;
  scan: ScanResponse | WifScanResult | null;
  origin: WalletOrigin;
  multisig?: HoldingData;
  pathType?: ScriptType;
  receiveAddress?: string;
}

const deriveReceiveAddress = (entry: WalletEntry): string | undefined => {
  if (entry.receiveAddress || entry.multisig || !entry.mnemonic) {
    return entry.receiveAddress;
  }
  try {
    return firstReceiveAddress(entry.mnemonic, entry.passphrase, entry.pathType ?? 'BIP84');
  } catch {
    return undefined;
  }
};

const withReceiveAddress = (entry: WalletEntry): WalletEntry => {
  const receiveAddress = deriveReceiveAddress(entry);
  return receiveAddress ? { ...entry, receiveAddress } : entry;
};

const withReceiveAddresses = (entries: WalletEntry[]): WalletEntry[] =>
  entries.map(withReceiveAddress);

const FIAT_CATALOG: readonly FiatUnit[] = [
  { endPointKey: 'USD', symbol: '$', locale: 'en-US', country: 'United States (US Dollar)', source: 'Mempool' },
  { endPointKey: 'EUR', symbol: '€', locale: 'en-IE', country: 'European Union (Euro)', source: 'Mempool' },
  { endPointKey: 'GBP', symbol: '£', locale: 'en-GB', country: 'United Kingdom (British Pound)', source: 'Mempool' },
  { endPointKey: 'JPY', symbol: '¥', locale: 'ja-JP', country: 'Japan (Japanese Yen)', source: 'Mempool' },
  { endPointKey: 'AUD', symbol: '$', locale: 'en-AU', country: 'Australia (Australian Dollar)', source: 'Mempool' },
  { endPointKey: 'CAD', symbol: '$', locale: 'en-CA', country: 'Canada (Canadian Dollar)', source: 'Mempool' },
  { endPointKey: 'CHF', symbol: 'CHF', locale: 'de-CH', country: 'Switzerland (Swiss Franc)', source: 'Mempool' },
  { endPointKey: 'CNY', symbol: '¥', locale: 'zh-CN', country: 'China (Chinese Yuan)', source: 'Blockchain' },
  { endPointKey: 'BRL', symbol: 'R$', locale: 'pt-BR', country: 'Brazil (Brazilian Real)', source: 'Blockchain' },
  { endPointKey: 'INR', symbol: '₹', locale: 'hi-IN', country: 'India (Indian Rupee)', source: 'Blockchain' },
  { endPointKey: 'KRW', symbol: '₩', locale: 'ko-KR', country: 'South Korea (South Korean Won)', source: 'Blockchain' },
  { endPointKey: 'MXN', symbol: '$', locale: 'es-MX', country: 'Mexico (Mexican Peso)', source: 'Coinbase' },
  { endPointKey: 'RUB', symbol: '₽', locale: 'ru-RU', country: 'Russia (Russian Ruble)', source: 'Blockchain' },
  { endPointKey: 'SGD', symbol: 'S$', locale: 'zh-SG', country: 'Singapore (Singapore Dollar)', source: 'Blockchain' },
  { endPointKey: 'ZAR', symbol: 'R', locale: 'en-ZA', country: 'South Africa (South African Rand)', source: 'Coinbase' },
  { endPointKey: 'TRY', symbol: '₺', locale: 'tr-TR', country: 'Turkey (Turkish Lira)', source: 'Binance' },
  { endPointKey: 'ARS', symbol: '$', locale: 'es-AR', country: 'Argentina (Argentine Peso)', source: 'Coinbase' },
] as const;

const FIAT_BY_KEY: Record<string, FiatUnit> = Object.fromEntries(
  FIAT_CATALOG.map(unit => [unit.endPointKey, unit]),
);

const DEFAULT_FIAT: FiatUnit = FIAT_BY_KEY.USD;

const HOLDING_PREFIX = 0x7b;

let cachedPassword: string | false = false;
let usedBucketNum: number | false = false;
let cachedDeviceKey: string | false = false;

const resolveDeviceKey = async (): Promise<string | false> => {
  if (cachedDeviceKey) return cachedDeviceKey;
  const key = await ensureDeviceKey(false);
  if (key) cachedDeviceKey = key;
  return cachedDeviceKey;
};

const readBuckets = async (): Promise<string[]> => {
  const raw = await loadString(StorageKeys.encryptedHolding);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const decryptBucket = (cipher: string, password: string): WalletEntry[] | false => {
  if (typeof cipher !== 'string' || cipher.charCodeAt(0) !== HOLDING_PREFIX) return false;
  let plaintext: string;
  try {
    plaintext = decryptBlob(cipher, password);
  } catch {
    return false;
  }
  try {
    const opened = JSON.parse(plaintext) as { wallets?: unknown };
    if (opened && Array.isArray(opened.wallets)) {
      return opened.wallets as WalletEntry[];
    }
  } catch {}
  return false;
};

const openHolding = (buckets: string[], password: string): WalletEntry[] | false => {
  for (let index = 0; index < buckets.length; index += 1) {
    const opened = decryptBucket(buckets[index], password);
    if (opened) {
      usedBucketNum = index;
      return opened;
    }
  }
  return false;
};

const alignBucketForPassword = async (password: string): Promise<void> => {
  const buckets = await readBuckets();
  usedBucketNum = false;
  for (let index = 0; index < buckets.length; index += 1) {
    if (decryptBucket(buckets[index], password)) {
      usedBucketNum = index;
      return;
    }
  }
};

const storageIsEncrypted = async (): Promise<boolean> => {
  return (await loadString(StorageKeys.holdingEncrypted)) === '1';
};

const sealWallets = (wallets: WalletEntry[], password: string): string =>
  encryptBlob(JSON.stringify({ wallets }), password);

let persistChain: Promise<void> = Promise.resolve();

// Serialize every persist so concurrent read-modify-write of the bucket array
// can't interleave and silently drop an update (e.g. a delete resurrecting).
const persistWallets = (next: WalletEntry[]): Promise<void> => {
  const run = persistChain.then(() => doPersistWallets(next));
  persistChain = run.catch(() => {});
  return run;
};

const doPersistWallets = async (next: WalletEntry[]): Promise<void> => {
  if (cachedPassword) {
    const buckets = await readBuckets();
    const cipher = sealWallets(next, cachedPassword);
    if (typeof usedBucketNum === 'number' && usedBucketNum >= 0 && usedBucketNum < buckets.length) {
      buckets[usedBucketNum] = cipher;
    } else {
      buckets.push(cipher);
      usedBucketNum = buckets.length - 1;
    }
    await persistString(StorageKeys.encryptedHolding, JSON.stringify(buckets));
    await persistString(StorageKeys.holdingEncrypted, '1');
    return;
  }
  const key = await resolveDeviceKey();
  if (key) {
    await persistString(StorageKeys.wallets, sealWithKey(JSON.stringify({ wallets: next }), key));
    return;
  }
  // Fail closed — never write the mnemonic/passphrase/WIF as cleartext.
  throw new Error('secure storage unavailable');
};

export const enableEncryption = async (
  wallets: WalletEntry[],
  password: string,
): Promise<boolean> => {
  try {
    const sealed = JSON.stringify([sealWallets(wallets, password)]);
    await persistString(StorageKeys.encryptedHolding, sealed);
    const back = await readBuckets();
    if (!openHolding(back, password)) {
      await removeKey(StorageKeys.encryptedHolding);
      return false;
    }
    // Confirm the prior copy is actually gone before declaring success — a
    // swallowed delete must not leave a weaker copy behind.
    await removeKey(StorageKeys.wallets);
    if ((await loadString(StorageKeys.wallets)) !== null) {
      await removeKey(StorageKeys.encryptedHolding);
      return false;
    }
    await persistString(StorageKeys.holdingEncrypted, '1');
    cachedPassword = password;
    usedBucketNum = 0;
    return true;
  } catch {
    return false;
  }
};

export const disableEncryption = async (wallets: WalletEntry[]): Promise<void> => {
  try {
    const key = await resolveDeviceKey();
    if (!key) return;
    // Removing the holding wipes EVERY bucket. Never do this from a non-primary or
    // decoy session, or while a second (hidden) holding exists — it would destroy
    // the real holding. Only disable from the sole primary bucket.
    const buckets = await readBuckets();
    if (usedBucketNum !== 0 || buckets.length > 1) return;
    await persistString(StorageKeys.wallets, sealWithKey(JSON.stringify({ wallets }), key));
    await removeKey(StorageKeys.encryptedHolding);
    await persistString(StorageKeys.holdingEncrypted, '');
    cachedPassword = false;
    usedBucketNum = false;
  } catch {}
};

export const createDecoyHolding = async (decoyPassword: string): Promise<boolean> => {
  const buckets = await readBuckets();
  buckets.push(sealWallets([], decoyPassword));
  const serialized = JSON.stringify(buckets);
  await persistString(StorageKeys.encryptedHolding, serialized);
  cachedPassword = decoyPassword;
  usedBucketNum = buckets.length - 1;
  return (await loadString(StorageKeys.encryptedHolding)) === serialized;
};

export const decryptHoldingWithPassword = async (
  password: string,
): Promise<WalletEntry[] | false> => {
  const buckets = await readBuckets();
  return openHolding(buckets, password);
};

export const isPasswordInUse = async (password: string): Promise<boolean> => {
  const buckets = await readBuckets();
  for (const bucket of buckets) {
    if (decryptBucket(bucket, password)) return true;
  }
  return false;
};

const WALLET_BASE_NAME = (): string => loc.holdings.standardLabel;

const nextWalletName = (existing: WalletEntry[]): string => {
  const base = WALLET_BASE_NAME();
  const count = existing.filter(
    entry => entry.label === base || entry.label.startsWith(`${base} #`),
  ).length;
  return count === 0 ? base : `${base} #${count}`;
};

export interface WalletsContextValue {
  wallets: WalletEntry[];
  cachedTxs: HistoryTx[];
  addressBook: AddressBookEntry[];
  loaded: boolean;
  locked: boolean;
  bioEnabled: boolean;
  pwdEnabled: boolean;
  unlock: () => void;
  setBioEnabled: (value: boolean) => void;
  setPwdEnabled: (value: boolean) => void;
  applyDecryptedWallets: (entries: WalletEntry[], password: string) => void;
  addWallet: (
    mnemonic: string,
    passphrase: string,
    scan: ScanResponse | WifScanResult,
    origin: WalletOrigin,
    wif?: string,
    label?: string,
  ) => void;
  createWallet: (mnemonic: string, passphrase: string, label?: string) => void;
  createHolding: (m: number, n: number, mnemonics: string[], label?: string) => void;
  saveAddress: (address: string, name?: string) => void;
  renameWallet: (id: string, name: string) => void;
  deleteWallet: (id: string) => void;
  resetApp: () => void;
  setWalletPathType: (id: string, pathType: ScriptType) => void;
  currency: FiatUnit;
  setCurrency: (unit: FiatUnit) => void;
  language: string;
  setLanguageStorage: (language: string) => Promise<void>;
  isRTL: boolean;
  blockExplorer: string;
  setBlockExplorer: (url: string) => void;
  feePreference: string;
  setFeePreference: (preference: string) => void;
  changeAddressType: ChangeAddressOverride;
  setChangeAddressType: (mode: ChangeAddressOverride) => void;
  denomination: BitcoinUnit;
  setDenomination: (unit: BitcoinUnit) => void;
  rate: number | null;
  hapticsEnabled: boolean;
  setHapticsEnabled: (value: boolean) => void;
  analyticsDisabled: boolean;
  setAnalyticsDisabled: (value: boolean) => void;
  mempoolFallback: boolean;
  setMempoolFallback: (value: boolean) => void;
  refreshWallet: (id: string) => Promise<void>;
  refreshAllWallets: () => Promise<void>;
  frozenUtxos: Set<string>;
  utxoLabels: Record<string, string>;
  selectedUtxos: Record<string, Set<string>>;
  toggleFreezeUtxo: (key: string) => void;
  setUtxoLabel: (key: string, label: string) => void;
  setSelectedUtxos: (walletId: string, keys: Set<string>) => void;
  clearSelectedUtxos: (walletId: string) => void;
}

const noop = (): void => {};
const asyncNoop = (): Promise<void> => Promise.resolve();

export const WalletsContext = createContext<WalletsContextValue>({
  wallets: [],
  cachedTxs: [],
  addressBook: [],
  loaded: false,
  locked: false,
  bioEnabled: false,
  pwdEnabled: false,
  unlock: noop,
  setBioEnabled: noop,
  setPwdEnabled: noop,
  applyDecryptedWallets: noop,
  addWallet: noop,
  createWallet: noop,
  createHolding: noop,
  saveAddress: noop,
  renameWallet: noop,
  deleteWallet: noop,
  resetApp: noop,
  setWalletPathType: noop,
  currency: DEFAULT_FIAT,
  setCurrency: noop,
  language: 'en',
  setLanguageStorage: asyncNoop,
  isRTL: false,
  blockExplorer: DEFAULT_EXPLORER_URL,
  setBlockExplorer: noop,
  feePreference: 'fast',
  setFeePreference: noop,
  changeAddressType: 'auto',
  setChangeAddressType: noop,
  denomination: 'BTC',
  setDenomination: noop,
  rate: null,
  hapticsEnabled: true,
  setHapticsEnabled: noop,
  analyticsDisabled: false,
  setAnalyticsDisabled: noop,
  mempoolFallback: false,
  setMempoolFallback: noop,
  refreshWallet: asyncNoop,
  refreshAllWallets: asyncNoop,
  frozenUtxos: new Set(),
  utxoLabels: {},
  selectedUtxos: {},
  toggleFreezeUtxo: noop,
  setUtxoLabel: noop,
  setSelectedUtxos: noop,
  clearSelectedUtxos: noop,
});

export const useWallets = (): WalletsContextValue => useContext(WalletsContext);

export const WalletsProvider = ({ children }: { children: React.ReactNode }) => {
  const [wallets, setWallets] = useState<WalletEntry[]>([]);
  const [cachedTxs, setCachedTxs] = useState<HistoryTx[]>([]);
  const [addressBook, setAddressBookState] = useState<AddressBookEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [bioEnabled, setBioEnabledState] = useState(false);
  const [pwdEnabled, setPwdEnabledState] = useState(false);

  const [currency, setCurrencyState] = useState<FiatUnit>(DEFAULT_FIAT);
  const setCurrency = useCallback((unit: FiatUnit) => {
    setCurrencyState(unit);
    persistString(StorageKeys.fiatCurrency, unit.endPointKey).catch(() => {});
  }, []);

  const [language, setLanguageState] = useState<string>('en');
  const setLanguageStorage = useCallback(async (next: string) => {
    await saveLanguage(next);
    setLanguageState(next);
  }, []);

  const isRTL = I18nManager.isRTL;

  const [rate, setRate] = useState<number | null>(null);

  const [blockExplorer, setBlockExplorerState] = useState<string>(DEFAULT_EXPLORER_URL);
  const setBlockExplorer = useCallback((url: string) => {
    setBlockExplorerState(url);
    persistString(StorageKeys.blockExplorer, url).catch(() => {});
  }, []);

  const [feePreference, setFeePreferenceState] = useState<string>('fast');
  const setFeePreference = useCallback((preference: string) => {
    setFeePreferenceState(preference);
    persistString(StorageKeys.feePreference, preference).catch(() => {});
  }, []);

  const [changeAddressType, setChangeAddressTypeState] = useState<ChangeAddressOverride>('auto');
  const setChangeAddressType = useCallback((mode: ChangeAddressOverride) => {
    setChangeAddressTypeState(mode);
    persistString(StorageKeys.changeAddressMode, mode).catch(() => {});
  }, []);

  const [denomination, setDenominationState] = useState<BitcoinUnit>('BTC');
  const setDenomination = useCallback((unit: BitcoinUnit) => {
    setDenominationState(unit);
    persistString(StorageKeys.displayUnit, unit).catch(() => {});
  }, []);

  const [hapticsEnabled, setHapticsEnabledState] = useState(true);
  const setHapticsEnabled = useCallback((value: boolean) => {
    setHapticsEnabledState(value);
    setHapticsOn(value);
    persistHapticsEnabled(value).catch(() => {});
  }, []);

  const [mempoolFallback, setMempoolFallbackState] = useState(false);
  const setMempoolFallback = useCallback((value: boolean) => {
    setMempoolFallbackState(value);
    setMempoolFallbackAllowed(value);
    persistMempoolFallback(value).catch(() => {});
  }, []);

  const [analyticsDisabled, setAnalyticsDisabledState] = useState(false);
  const setAnalyticsDisabled = useCallback((value: boolean) => {
    setAnalyticsDisabledState(value);
    persistAnalyticsDisabled(value).catch(() => {});
  }, []);

  const [frozenUtxos, setFrozenUtxos] = useState<Set<string>>(new Set());
  const [utxoLabels, setUtxoLabels] = useState<Record<string, string>>({});
  const [selectedUtxos, setSelectedUtxosState] = useState<Record<string, Set<string>>>({});

  const toggleFreezeUtxo = useCallback((key: string) => {
    setFrozenUtxos(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      persistJson<string[]>(StorageKeys.frozenUtxos, [...next]).catch(() => {});
      return next;
    });
  }, []);

  const setUtxoLabel = useCallback((key: string, label: string) => {
    setUtxoLabels(prev => {
      const next = { ...prev };
      const trimmed = label.trim();
      if (trimmed) next[key] = trimmed;
      else delete next[key];
      persistJson<Record<string, string>>(StorageKeys.utxoLabels, next).catch(() => {});
      return next;
    });
  }, []);

  const setSelectedUtxos = useCallback((walletId: string, keys: Set<string>) => {
    setSelectedUtxosState(prev => ({ ...prev, [walletId]: new Set(keys) }));
  }, []);

  const clearSelectedUtxos = useCallback((walletId: string) => {
    setSelectedUtxosState(prev => {
      const next = { ...prev };
      delete next[walletId];
      return next;
    });
  }, []);

  const [locked, setLocked] = useState(false);
  const wasBackground = useRef(false);

  const scanAndUpdate = useCallback((id: string, mnemonic: string, passphrase: string) => {
    return scanMnemonic(mnemonic, passphrase)
      .then(scan => {
        setWallets(prev => {
          const next = prev.map(entry => (entry.id === id ? { ...entry, scan } : entry));
          persistWallets(next).catch(() => {});
          return next;
        });
      })
      .catch(() => {});
  }, []);

  const scanHoldingAndUpdate = useCallback(
    (id: string, m: number, n: number, mnemonics: string[]) => {
      return scanMultisig(m, n, mnemonics)
        .then(scan => {
          setWallets(prev => {
            const next = prev.map(entry =>
              entry.id === id && entry.multisig
                ? { ...entry, multisig: { ...entry.multisig, scan } }
                : entry,
            );
            persistWallets(next).catch(() => {});
            return next;
          });
        })
        .catch(() => {});
    },
    [],
  );

  useEffect(() => {
    getCachedRate()
      .then(cached => {
        if (cached && cached.value > 0) setRate(cached.value);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchBtcRate(currency.endPointKey)
      .then(value => {
        if (value && value > 0) {
          setRate(value);
          setCachedRate(value).catch(() => {});
        }
      })
      .catch(() => {});
  }, [currency.endPointKey]);

  useEffect(() => {
    Promise.resolve()
      .then(async () => {
        const [
          curRaw,
          beRaw,
          fpRaw,
          caRaw,
          denRaw,
          hapRaw,
          anaRaw,
          fzRaw,
          ulRaw,
          langRaw,
          mfRaw,
        ] = await Promise.all([
          loadString(StorageKeys.fiatCurrency),
          loadString(StorageKeys.blockExplorer),
          loadString(StorageKeys.feePreference),
          loadString(StorageKeys.changeAddressMode),
          loadString(StorageKeys.displayUnit),
          loadString(StorageKeys.haptics),
          loadString(StorageKeys.analyticsDisabled),
          loadString(StorageKeys.frozenUtxos),
          loadString(StorageKeys.utxoLabels),
          loadString(StorageKeys.language),
          loadString(StorageKeys.mempoolFallback),
        ]);

        if (curRaw && FIAT_BY_KEY[curRaw]) setCurrencyState(FIAT_BY_KEY[curRaw]);
        if (langRaw) setLanguageState(langRaw);
        if (beRaw) setBlockExplorerState(beRaw);
        if (fpRaw) setFeePreferenceState(fpRaw);
        if (caRaw === 'auto' || caRaw === 'BIP84' || caRaw === 'BIP49' || caRaw === 'BIP44') {
          setChangeAddressTypeState(caRaw);
        }
        if (denRaw && (BITCOIN_UNITS as readonly string[]).includes(denRaw)) {
          setDenominationState(denRaw as BitcoinUnit);
        }
        if (hapRaw === '0') {
          setHapticsEnabledState(false);
          setHapticsOn(false);
        }
        if (anaRaw === '1') setAnalyticsDisabledState(true);
        if (mfRaw === '1') {
          setMempoolFallbackState(true);
          setMempoolFallbackAllowed(true);
        }
        if (fzRaw) {
          try {
            setFrozenUtxos(new Set(JSON.parse(fzRaw) as string[]));
          } catch {}
        }
        if (ulRaw) {
          try {
            setUtxoLabels(JSON.parse(ulRaw) as Record<string, string>);
          } catch {}
        }

        const cachedTransactions = await loadJson<HistoryTx[]>(StorageKeys.transactionCache, []);
        if (Array.isArray(cachedTransactions)) setCachedTxs(cachedTransactions);

        const book = await getAddressBook();
        setAddressBookState(
          book.map(entry => ({
            address: entry.address,
            name: entry.label,
            lastUsedAt: entry.lastUsedAt ?? 0,
          })),
        );

        const bioOn = await isBiometricsEnabled();
        setBioEnabledState(bioOn);

        if (await storageIsEncrypted()) {
          setPwdEnabledState(true);
          setLocked(true);
          return;
        }

        const rawWallets = await loadString(StorageKeys.wallets);
        let parsedWallets: WalletEntry[] = [];
        if (rawWallets) {
          if (isEncryptedEnvelope(rawWallets)) {
            const key = await resolveDeviceKey();
            if (key) {
              try {
                const opened = JSON.parse(decryptBlob(rawWallets, key)) as { wallets?: WalletEntry[] };
                if (opened && Array.isArray(opened.wallets)) parsedWallets = opened.wallets;
              } catch {}
            }
          } else {
            try {
              const legacy = JSON.parse(rawWallets) as WalletEntry[];
              if (Array.isArray(legacy)) parsedWallets = legacy;
            } catch {}
            const key = await resolveDeviceKey();
            if (key) {
              await persistString(
                StorageKeys.wallets,
                sealWithKey(JSON.stringify({ wallets: parsedWallets }), key),
              );
            }
          }
        }
        const list = withReceiveAddresses(parsedWallets);
        setWallets(list);
        setPwdEnabledState(false);
        setLocked(bioOn && list.length > 0);

        if (Array.isArray(list)) {
          list
            .filter(entry => !entry.multisig && !entry.scan)
            .forEach(entry => scanAndUpdate(entry.id, entry.mnemonic, entry.passphrase));
          list
            .filter(entry => entry.multisig && !entry.multisig.scan)
            .forEach(entry =>
              scanHoldingAndUpdate(
                entry.id,
                entry.multisig!.m,
                entry.multisig!.n,
                entry.multisig!.mnemonics,
              ),
            );
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [scanAndUpdate, scanHoldingAndUpdate]);

  const addWallet = useCallback(
    (
      mnemonic: string,
      passphrase: string,
      scan: ScanResponse | WifScanResult,
      origin: WalletOrigin,
      wif = '',
      label = '',
    ) => {
      setWallets(prev => {
        const next: WalletEntry[] = [
          ...prev,
          withReceiveAddress({
            id: `${Date.now()}-${prev.length}`,
            label: label.trim() || nextWalletName(prev),
            mnemonic,
            passphrase,
            scan,
            origin,
            ...(wif ? { wif } : {}),
          }),
        ];
        persistWallets(next).catch(() => {});
        return next;
      });
    },
    [],
  );

  const createWallet = useCallback(
    (mnemonic: string, passphrase: string, label?: string) => {
      const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      setWallets(prev => {
        const next: WalletEntry[] = [
          ...prev,
          withReceiveAddress({
            id,
            label: label?.trim() || nextWalletName(prev),
            mnemonic,
            passphrase,
            scan: null,
            origin: 'create',
          }),
        ];
        persistWallets(next).catch(() => {});
        return next;
      });
      scanAndUpdate(id, mnemonic, passphrase);
    },
    [scanAndUpdate],
  );

  const createHolding = useCallback(
    (m: number, n: number, mnemonics: string[], label?: string) => {
      const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      setWallets(prev => {
        const named =
          label?.trim() && label.trim() !== loc.quorum.sharedHolding
            ? label.trim()
            : nextWalletName(prev);
        const next: WalletEntry[] = [
          ...prev,
          {
            id,
            label: named,
            mnemonic: '',
            passphrase: '',
            scan: null,
            origin: 'create',
            multisig: { m, n, mnemonics, scan: null },
          },
        ];
        persistWallets(next).catch(() => {});
        return next;
      });
      scanHoldingAndUpdate(id, m, n, mnemonics);
    },
    [scanHoldingAndUpdate],
  );

  const refreshWallet = useCallback(
    (walletId: string): Promise<void> => {
      return new Promise<void>(resolve => {
        setWallets(prev => {
          const entry = prev.find(item => item.id === walletId);
          const task = entry
            ? entry.multisig
              ? scanHoldingAndUpdate(
                  walletId,
                  entry.multisig.m,
                  entry.multisig.n,
                  entry.multisig.mnemonics,
                )
              : scanAndUpdate(walletId, entry.mnemonic, entry.passphrase)
            : Promise.resolve();
          Promise.resolve(task).finally(() => resolve());
          return prev;
        });
      });
    },
    [scanAndUpdate, scanHoldingAndUpdate],
  );

  const refreshAllWallets = useCallback((): Promise<void> => {
    return new Promise<void>(resolve => {
      setWallets(prev => {
        Promise.all(
          prev.map(entry =>
            entry.multisig
              ? scanHoldingAndUpdate(
                  entry.id,
                  entry.multisig.m,
                  entry.multisig.n,
                  entry.multisig.mnemonics,
                )
              : scanAndUpdate(entry.id, entry.mnemonic, entry.passphrase),
          ),
        ).finally(() => resolve());
        return prev;
      });
    });
  }, [scanAndUpdate, scanHoldingAndUpdate]);

  const saveAddress = useCallback((address: string, name?: string) => {
    const trimmed = address.trim();
    if (!trimmed) return;
    setAddressBookState(prev => {
      const existing = prev.find(entry => entry.address === trimmed);
      const entry: AddressBookEntry = {
        address: trimmed,
        name: name?.trim() || existing?.name,
        lastUsedAt: Date.now(),
      };
      const next = [entry, ...prev.filter(item => item.address !== trimmed)].sort(
        (a, b) => b.lastUsedAt - a.lastUsedAt,
      );
      setAddressBook(
        next.map(item => ({
          address: item.address,
          label: item.name,
          lastUsedAt: item.lastUsedAt,
        })),
      ).catch(() => {});
      return next;
    });
  }, []);

  const unlock = useCallback(() => setLocked(false), []);

  const applyDecryptedWallets = useCallback(
    async (entries: WalletEntry[], password: string) => {
      await alignBucketForPassword(password);
      cachedPassword = password;
      setWallets(withReceiveAddresses(entries));
      entries
        .filter(entry => !entry.multisig && !entry.scan)
        .forEach(entry => scanAndUpdate(entry.id, entry.mnemonic, entry.passphrase));
      entries
        .filter(entry => entry.multisig && !entry.multisig.scan)
        .forEach(entry =>
          scanHoldingAndUpdate(
            entry.id,
            entry.multisig!.m,
            entry.multisig!.n,
            entry.multisig!.mnemonics,
          ),
        );
    },
    [scanAndUpdate, scanHoldingAndUpdate],
  );

  const setBioEnabled = useCallback((value: boolean) => {
    setBioEnabledState(value);
    persistBiometricsEnabled(value).catch(() => {});
  }, []);

  const setPwdEnabled = useCallback((value: boolean) => {
    setPwdEnabledState(value);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'inactive' || state === 'background') {
        wasBackground.current = true;
        // Lock on the way out so the app-switcher snapshot and the next return
        // show the lock screen instead of wallet contents.
        if (bioEnabled || pwdEnabled) setLocked(true);
      } else if (state === 'active' && wasBackground.current) {
        wasBackground.current = false;
      }
    });
    return () => subscription.remove();
  }, [bioEnabled, pwdEnabled]);

  const renameWallet = useCallback((id: string, name: string) => {
    setWallets(prev => {
      const next = prev.map(entry => (entry.id === id ? { ...entry, label: name } : entry));
      persistWallets(next).catch(() => {});
      return next;
    });
  }, []);

  const deleteWallet = useCallback((id: string) => {
    setWallets(prev => {
      const next = prev.filter(entry => entry.id !== id);
      persistWallets(next).catch(() => {});
      return next;
    });
  }, []);

  const resetApp = useCallback(() => {
    cachedPassword = false;
    usedBucketNum = false;
    cachedDeviceKey = false;
    setWallets([]);
    setCachedTxs([]);
    setBioEnabledState(false);
    setPwdEnabledState(false);
    setLocked(false);
    clearAll().catch(() => {});
    deleteDeviceKey().catch(() => {});
  }, []);

  const setWalletPathType = useCallback((id: string, pathType: ScriptType) => {
    setWallets(prev => {
      const next = prev.map(entry =>
        entry.id === id
          ? withReceiveAddress({ ...entry, pathType, receiveAddress: undefined })
          : entry,
      );
      persistWallets(next).catch(() => {});
      return next;
    });
  }, []);

  const value: WalletsContextValue = {
    wallets,
    cachedTxs,
    addressBook,
    loaded,
    locked,
    bioEnabled,
    pwdEnabled,
    unlock,
    setBioEnabled,
    setPwdEnabled,
    applyDecryptedWallets,
    addWallet,
    createWallet,
    createHolding,
    saveAddress,
    renameWallet,
    deleteWallet,
    resetApp,
    setWalletPathType,
    currency,
    setCurrency,
    language,
    setLanguageStorage,
    isRTL,
    blockExplorer,
    setBlockExplorer,
    feePreference,
    setFeePreference,
    changeAddressType,
    setChangeAddressType,
    denomination,
    setDenomination,
    rate,
    hapticsEnabled,
    setHapticsEnabled,
    analyticsDisabled,
    setAnalyticsDisabled,
    mempoolFallback,
    setMempoolFallback,
    refreshWallet,
    refreshAllWallets,
    frozenUtxos,
    utxoLabels,
    selectedUtxos,
    toggleFreezeUtxo,
    setUtxoLabel,
    setSelectedUtxos,
    clearSelectedUtxos,
  };

  return <WalletsContext.Provider value={value}>{children}</WalletsContext.Provider>;
};

export default WalletsProvider;
