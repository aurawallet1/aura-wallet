import { mnemonicToSeedSync } from '@scure/bip39';
import { GAP_LIMIT, SCRIPT_SCHEMES } from '../constants/bitcoin';
import {
  addressPath,
  accountBasePath,
  deriveAddressNode,
  encodeAddress,
  fromWIF,
  toWIF,
  compressedPublicKey,
  type HDNode,
} from './derivation';
import {
  fetchAddrStats,
  fetchAddrUtxos,
  explorerUrl,
  type AddressStats,
} from '../network/mempool';
import {
  createElectrumClient,
  scriptHashFromPublicKey,
  type ElectrumClient,
  type ScriptKind,
  type BalanceResult,
  type UnspentEntry,
} from '../network/electrum';
import type {
  ScriptType,
  WalletAddress,
  AddressBranch,
  WalletAccount,
  WalletAccountMap,
  Utxo,
  ScriptTypeTotals,
  GrandTotals,
  ScanResult,
  ScanResponse,
  WifAddress,
  WifAccount,
  WifResult,
  WifScanResult,
  MultisigResult,
  MultisigGrandTotals,
  MultisigHoldingResponse,
} from '../types';

const MEMPOOL_LABEL = 'mempool.space';

// Off by default: don't leak derived addresses to mempool.space unless the user opts in.
let mempoolFallbackAllowed = false;
export const setMempoolFallbackAllowed = (value: boolean): void => {
  mempoolFallbackAllowed = value;
};

const PRIMARY_TYPE: ScriptType = 'BIP84';

const RECEIVE_BRANCH = 0;
const CHANGE_BRANCH = 1;

const SCRIPT_KIND_BY_TYPE: Record<ScriptType, ScriptKind> = {
  BIP44: 'P2PKH',
  BIP49: 'P2SH-P2WPKH',
  BIP84: 'P2WPKH',
};

interface SchemeDescriptor {
  typeKey: ScriptType;
  typeName: string;
}

const SCHEMES: readonly SchemeDescriptor[] = SCRIPT_SCHEMES.map(scheme => ({
  typeKey: (`BIP${scheme.purpose}`) as ScriptType,
  typeName: scheme.name,
}));

interface BranchScan {
  used: WalletAddress[];
  fresh?: WalletAddress;
  utxos: Utxo[];
  confirmedBalance: number;
  unconfirmedBalance: number;
  txCount: number;
  addresses: string[];
}

interface DerivedWindowEntry {
  entry: WalletAddress;
  scriptHash: string;
}

function deriveWindowEntry(
  seed: Uint8Array,
  scheme: SchemeDescriptor,
  branch: 0 | 1,
  index: number,
): DerivedWindowEntry {
  const node: HDNode = deriveAddressNode(seed, scheme.typeKey, branch, index);
  const publicKey = compressedPublicKey(node.privateKey);
  const address = encodeAddress(scheme.typeKey, node.privateKey);
  const wif = toWIF(node.privateKey);
  const scriptHash = scriptHashFromPublicKey(SCRIPT_KIND_BY_TYPE[scheme.typeKey], publicKey);
  node.privateKey.fill(0);
  publicKey.fill(0);
  return {
    scriptHash,
    entry: {
      address,
      wif,
      path: addressPath(scheme.typeKey, branch, index),
      addressExplorerUrl: explorerUrl(address),
    },
  };
}

function mapUnspent(entries: UnspentEntry[], owner: WalletAddress): Utxo[] {
  return entries.map(item => ({
    tx_hash: item.tx_hash,
    txid: item.tx_hash,
    tx_pos: item.tx_pos,
    vout: item.tx_pos,
    value: item.value,
    height: item.height,
    address: owner.address,
    path: owner.path,
    wif: owner.wif,
  }));
}

async function scanBranchElectrum(
  client: ElectrumClient,
  seed: Uint8Array,
  scheme: SchemeDescriptor,
  branch: 0 | 1,
): Promise<BranchScan> {
  const used: WalletAddress[] = [];
  const utxos: Utxo[] = [];
  const addresses: string[] = [];
  let fresh: WalletAddress | undefined;
  let confirmedBalance = 0;
  let unconfirmedBalance = 0;
  let txCount = 0;
  let consecutiveUnused = 0;
  let index = 0;

  while (consecutiveUnused < GAP_LIMIT) {
    const windowEntries: DerivedWindowEntry[] = [];
    for (let offset = 0; offset < GAP_LIMIT; offset += 1) {
      windowEntries.push(deriveWindowEntry(seed, scheme, branch, index + offset));
    }

    const histories = await client.getHistories(
      windowEntries.map(item => item.scriptHash),
    );

    const usedInWindow: DerivedWindowEntry[] = [];
    let stop = false;
    for (let i = 0; i < windowEntries.length; i += 1) {
      const { entry } = windowEntries[i];
      const history = histories[i];
      addresses.push(entry.address);
      if (history.length > 0) {
        used.push(entry);
        txCount += history.length;
        usedInWindow.push(windowEntries[i]);
        consecutiveUnused = 0;
      } else {
        if (!fresh) {
          fresh = entry;
        }
        consecutiveUnused += 1;
        if (consecutiveUnused >= GAP_LIMIT) {
          stop = true;
          break;
        }
      }
    }

    if (usedInWindow.length > 0) {
      const scriptHashes = usedInWindow.map(item => item.scriptHash);
      const [balances, unspentLists] = await Promise.all([
        client.getBalances(scriptHashes),
        client.listUnspentBatch(scriptHashes),
      ]);
      for (let i = 0; i < usedInWindow.length; i += 1) {
        const balance: BalanceResult = balances[i];
        confirmedBalance += balance.confirmed;
        unconfirmedBalance += balance.unconfirmed;
        utxos.push(...mapUnspent(unspentLists[i], usedInWindow[i].entry));
      }
    }

    if (stop) {
      break;
    }
    index += GAP_LIMIT;
  }

  return { used, fresh, utxos, confirmedBalance, unconfirmedBalance, txCount, addresses };
}

async function scanBranchMempool(
  seed: Uint8Array,
  scheme: SchemeDescriptor,
  branch: 0 | 1,
): Promise<BranchScan> {
  const used: WalletAddress[] = [];
  const utxos: Utxo[] = [];
  const addresses: string[] = [];
  let fresh: WalletAddress | undefined;
  let confirmedBalance = 0;
  let unconfirmedBalance = 0;
  let txCount = 0;
  let consecutiveUnused = 0;
  let index = 0;

  while (consecutiveUnused < GAP_LIMIT) {
    const windowEntries: WalletAddress[] = [];
    for (let offset = 0; offset < GAP_LIMIT; offset += 1) {
      const node: HDNode = deriveAddressNode(seed, scheme.typeKey, branch, index + offset);
      const address = encodeAddress(scheme.typeKey, node.privateKey);
      const wif = toWIF(node.privateKey);
      node.privateKey.fill(0);
      windowEntries.push({
        address,
        wif,
        path: addressPath(scheme.typeKey, branch, index + offset),
        addressExplorerUrl: explorerUrl(address),
      });
    }
    const statsList = await Promise.all(
      windowEntries.map(item => fetchAddrStats(item.address)),
    );
    const usedInWindow: WalletAddress[] = [];
    let stop = false;
    for (let i = 0; i < windowEntries.length; i += 1) {
      const entry = windowEntries[i];
      const stats = statsList[i];
      addresses.push(entry.address);
      if (stats.txCount > 0) {
        used.push(entry);
        confirmedBalance += stats.confirmedBalance;
        unconfirmedBalance += stats.unconfirmedBalance;
        txCount += stats.txCount;
        usedInWindow.push(entry);
        consecutiveUnused = 0;
      } else {
        if (!fresh) {
          fresh = entry;
        }
        consecutiveUnused += 1;
        if (consecutiveUnused >= GAP_LIMIT) {
          stop = true;
          break;
        }
      }
    }
    const utxoLists = await Promise.all(
      usedInWindow.map(entry => fetchAddrUtxos(entry.address)),
    );
    for (let i = 0; i < usedInWindow.length; i += 1) {
      const entry = usedInWindow[i];
      for (const utxo of utxoLists[i]) {
        utxos.push({ ...utxo, address: entry.address, path: entry.path, wif: entry.wif });
      }
    }
    if (stop) {
      break;
    }
    index += GAP_LIMIT;
  }

  return { used, fresh, utxos, confirmedBalance, unconfirmedBalance, txCount, addresses };
}

interface SchemeScan {
  account: WalletAccount;
  totals: ScriptTypeTotals;
  utxos: Utxo[];
  confirmedBalance: number;
  unconfirmedBalance: number;
  txCount: number;
  addresses: string[];
}

function assembleScheme(
  scheme: SchemeDescriptor,
  receive: BranchScan,
  change: BranchScan,
): SchemeScan {
  const confirmedBalance = receive.confirmedBalance + change.confirmedBalance;
  const unconfirmedBalance = receive.unconfirmedBalance + change.unconfirmedBalance;
  const totalBalance = confirmedBalance + unconfirmedBalance;
  const txCount = receive.txCount + change.txCount;
  const usedCount = receive.used.length + change.used.length;
  const basePath = accountBasePath(scheme.typeKey);

  const receiveBranch: AddressBranch = { used: receive.used, fresh: receive.fresh };
  const changeBranch: AddressBranch = { used: change.used, fresh: change.fresh };

  const account: WalletAccount = {
    derivationPath: basePath,
    description: scheme.typeName,
    slip132xpub: '',
    receive: receiveBranch,
    change: changeBranch,
  };

  const totals: ScriptTypeTotals = {
    typeKey: scheme.typeKey,
    typeName: scheme.typeName,
    basePath,
    slip132xpub: '',
    confirmedTxCount: txCount,
    unconfirmedTxCount: 0,
    totalTxCount: txCount,
    confirmedBalance,
    unconfirmedBalance,
    totalBalance,
    totalUsedAddresses: usedCount,
  };

  return {
    account,
    totals,
    utxos: [...receive.utxos, ...change.utxos],
    confirmedBalance,
    unconfirmedBalance,
    txCount,
    addresses: [...receive.addresses, ...change.addresses],
  };
}

async function scanSchemeElectrum(
  client: ElectrumClient,
  seed: Uint8Array,
  scheme: SchemeDescriptor,
): Promise<SchemeScan> {
  const receive = await scanBranchElectrum(client, seed, scheme, RECEIVE_BRANCH);
  const change = await scanBranchElectrum(client, seed, scheme, CHANGE_BRANCH);
  return assembleScheme(scheme, receive, change);
}

async function scanSchemeMempool(
  seed: Uint8Array,
  scheme: SchemeDescriptor,
): Promise<SchemeScan> {
  const [receive, change] = await Promise.all([
    scanBranchMempool(seed, scheme, RECEIVE_BRANCH),
    scanBranchMempool(seed, scheme, CHANGE_BRANCH),
  ]);
  return assembleScheme(scheme, receive, change);
}

interface MnemonicScanData {
  results: SchemeScan[];
  serverLabel: string;
}

async function runMnemonicElectrum(seed: Uint8Array): Promise<MnemonicScanData> {
  const client = createElectrumClient();
  try {
    await client.connect();
    const results: SchemeScan[] = [];
    for (const scheme of SCHEMES) {
      results.push(await scanSchemeElectrum(client, seed, scheme));
    }
    const serverLabel = client.serverLabel || MEMPOOL_LABEL;
    return { results, serverLabel };
  } finally {
    client.close();
  }
}

async function runMnemonicMempool(seed: Uint8Array): Promise<MnemonicScanData> {
  const results = await Promise.all(SCHEMES.map(scheme => scanSchemeMempool(seed, scheme)));
  return { results, serverLabel: MEMPOOL_LABEL };
}

export async function scanMnemonic(mnemonic: string, passphrase = ''): Promise<ScanResponse> {
  const startedAt = Date.now();
  const seed = mnemonicToSeedSync(mnemonic, passphrase);

  const data = {} as WalletAccountMap;
  const byType: ScriptTypeTotals[] = [];
  const utxos: Utxo[] = [];
  const scanned: string[] = [];
  let confirmedBalance = 0;
  let unconfirmedBalance = 0;
  let txCount = 0;
  let serverLabel = MEMPOOL_LABEL;

  try {
    let scanData: MnemonicScanData;
    try {
      scanData = await runMnemonicElectrum(seed);
    } catch (error) {
      if (!mempoolFallbackAllowed) throw error;
      scanData = await runMnemonicMempool(seed);
    }
    serverLabel = scanData.serverLabel;
    for (let i = 0; i < SCHEMES.length; i += 1) {
      const scheme = SCHEMES[i];
      const result = scanData.results[i];
      data[scheme.typeKey] = result.account;
      byType.push(result.totals);
      utxos.push(...result.utxos);
      scanned.push(...result.addresses);
      confirmedBalance += result.confirmedBalance;
      unconfirmedBalance += result.unconfirmedBalance;
      txCount += result.txCount;
    }
  } finally {
    seed.fill(0);
  }

  const grandTotals: GrandTotals = {
    totalConfirmedTxCount: txCount,
    totalUnconfirmedTxCount: 0,
    totalTxCount: txCount,
    totalConfirmedBalance: confirmedBalance,
    totalUnconfirmedBalance: unconfirmedBalance,
    totalBalance: confirmedBalance + unconfirmedBalance,
    utxos,
    byType,
    scannedAddresses: scanned.join('|'),
  };

  const result: ScanResult = {
    mnemonic,
    passphrase: passphrase || null,
    scanningPerformed: true,
    electrumServer: serverLabel,
    data,
    grandTotals,
    timingStats: {},
    sendAttempted: false,
  };

  return {
    status: 'ok',
    message: 'scan complete',
    timestamp: new Date().toISOString(),
    primaryType: PRIMARY_TYPE,
    scanDurationSeconds: (Date.now() - startedAt) / 1000,
    result,
  };
}

interface WifEntryStats {
  confirmedBalance: number;
  unconfirmedBalance: number;
  totalBalance: number;
  txCount: number;
  utxos: Utxo[];
}

interface WifSchemeResult {
  scheme: SchemeDescriptor;
  address: string;
  stats: WifEntryStats;
}

interface WifScanData {
  results: WifSchemeResult[];
  serverLabel: string;
}

async function runWifElectrum(privateKey: Uint8Array, wif: string): Promise<WifScanData> {
  const client = createElectrumClient();
  try {
    await client.connect();
    const publicKey = compressedPublicKey(privateKey);
    const prepared = SCHEMES.map(scheme => {
      const address = encodeAddress(scheme.typeKey, privateKey);
      const sh = scriptHashFromPublicKey(SCRIPT_KIND_BY_TYPE[scheme.typeKey], publicKey);
      return { scheme, address, sh };
    });
    publicKey.fill(0);

    const scriptHashes = prepared.map(item => item.sh);
    const [histories, balances, unspentLists] = await Promise.all([
      client.getHistories(scriptHashes),
      client.getBalances(scriptHashes),
      client.listUnspentBatch(scriptHashes),
    ]);

    const results: WifSchemeResult[] = prepared.map((item, i) => {
      const owner: WalletAddress = {
        address: item.address,
        wif,
        path: 'N/A',
        addressExplorerUrl: explorerUrl(item.address),
      };
      const confirmed = balances[i].confirmed;
      const unconfirmed = balances[i].unconfirmed;
      return {
        scheme: item.scheme,
        address: item.address,
        stats: {
          confirmedBalance: confirmed,
          unconfirmedBalance: unconfirmed,
          totalBalance: confirmed + unconfirmed,
          txCount: histories[i].length,
          utxos: mapUnspent(unspentLists[i], owner),
        },
      };
    });

    const serverLabel = client.serverLabel || MEMPOOL_LABEL;
    return { results, serverLabel };
  } finally {
    client.close();
  }
}

async function runWifMempool(privateKey: Uint8Array, wif: string): Promise<WifScanData> {
  const results: WifSchemeResult[] = [];
  for (const scheme of SCHEMES) {
    const address = encodeAddress(scheme.typeKey, privateKey);
    const stats: AddressStats = await fetchAddrStats(address);
    const found = await fetchAddrUtxos(address);
    const tagged: Utxo[] = found.map(utxo => ({ ...utxo, address, wif }));
    results.push({
      scheme,
      address,
      stats: {
        confirmedBalance: stats.confirmedBalance,
        unconfirmedBalance: stats.unconfirmedBalance,
        totalBalance: stats.totalBalance,
        txCount: stats.txCount,
        utxos: tagged,
      },
    });
  }
  return { results, serverLabel: MEMPOOL_LABEL };
}

export async function scanWif(wif: string): Promise<WifScanResult> {
  const startedAt = Date.now();
  const privateKey = fromWIF(wif);

  const data = {} as Record<ScriptType, WifAccount>;
  const byType: ScriptTypeTotals[] = [];
  const utxos: Utxo[] = [];
  const scanned: string[] = [];
  let confirmedBalance = 0;
  let unconfirmedBalance = 0;
  let txCount = 0;
  let serverLabel = MEMPOOL_LABEL;

  try {
    let scanData: WifScanData;
    try {
      scanData = await runWifElectrum(privateKey, wif);
    } catch (error) {
      if (!mempoolFallbackAllowed) throw error;
      scanData = await runWifMempool(privateKey, wif);
    }
    serverLabel = scanData.serverLabel;

    for (const item of scanData.results) {
      const { scheme, address, stats } = item;
      const tagged = stats.utxos;
      utxos.push(...tagged);

      const used = stats.txCount > 0;
      confirmedBalance += stats.confirmedBalance;
      unconfirmedBalance += stats.unconfirmedBalance;
      txCount += stats.txCount;
      scanned.push(address);

      const wifAddress: WifAddress = {
        address,
        wif,
        path: 'N/A',
        addressExplorerUrl: explorerUrl(address),
        confirmedBalance: stats.confirmedBalance,
        unconfirmedBalance: stats.unconfirmedBalance,
        totalBalance: stats.totalBalance,
        confirmedTxCount: stats.txCount,
        unconfirmedTxCount: 0,
        totalTxCount: stats.txCount,
        utxos: tagged,
        used,
      };

      data[scheme.typeKey] = {
        derivationPath: 'N/A',
        description: scheme.typeName,
        receive: {
          used: used ? [wifAddress] : [],
          fresh: used ? undefined : wifAddress,
        },
        change: { used: [] },
      };

      byType.push({
        typeKey: scheme.typeKey,
        typeName: scheme.typeName,
        basePath: 'N/A',
        slip132xpub: '',
        confirmedTxCount: stats.txCount,
        unconfirmedTxCount: 0,
        totalTxCount: stats.txCount,
        confirmedBalance: stats.confirmedBalance,
        unconfirmedBalance: stats.unconfirmedBalance,
        totalBalance: stats.totalBalance,
        totalUsedAddresses: used ? 1 : 0,
      });
    }
  } finally {
    privateKey.fill(0);
  }

  const grandTotals: GrandTotals = {
    totalConfirmedTxCount: txCount,
    totalUnconfirmedTxCount: 0,
    totalTxCount: txCount,
    totalConfirmedBalance: confirmedBalance,
    totalUnconfirmedBalance: unconfirmedBalance,
    totalBalance: confirmedBalance + unconfirmedBalance,
    utxos,
    byType,
    scannedAddresses: scanned.join('|'),
  };

  const result: WifResult = {
    scanningPerformed: true,
    electrumServer: serverLabel,
    data,
    grandTotals,
    sendAttempted: false,
  };

  return {
    status: 'ok',
    key: wif,
    message: 'scan complete',
    timestamp: new Date().toISOString(),
    primaryType: PRIMARY_TYPE,
    scanDurationMs: Date.now() - startedAt,
    result,
  };
}

export async function scanMultisig(
  m: number,
  n: number,
  mnemonics: string[],
): Promise<MultisigHoldingResponse> {
  void mnemonics;
  const config = `${m}-${n}`;

  const grandTotals: MultisigGrandTotals = {
    totalConfirmedTxCount: 0,
    totalUnconfirmedTxCount: 0,
    totalTxCount: 0,
    totalConfirmedBalance: 0,
    totalUnconfirmedBalance: 0,
    totalBalance: 0,
    utxos: [],
    byType: [],
    scannedAddresses: '',
  };

  const result: MultisigResult = {
    config,
    mnemonics: '',
    scanningPerformed: false,
    electrumServer: '',
    zpubs: [],
    data: {},
    grandTotals,
  };

  return {
    status: 'pending',
    message: 'multisig scan unavailable',
    timestamp: new Date().toISOString(),
    primaryType: 'BIP48',
    scanDurationMs: 0,
    result,
  };
}
