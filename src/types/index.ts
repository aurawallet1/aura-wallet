export type ScriptType = 'BIP44' | 'BIP49' | 'BIP84';

export interface WalletAddress {
  address: string;
  wif: string;
  path: string;
  addressExplorerUrl: string;
}

export interface AddressBranch {
  used: WalletAddress[];
  fresh?: WalletAddress;
}

export interface WalletAccount {
  derivationPath: string;
  description: string;
  slip132xpub: string;
  receive: AddressBranch;
  change: AddressBranch;
}

export type WalletAccountMap = Record<ScriptType, WalletAccount>;

export interface Utxo {
  tx_hash?: string;
  txid?: string;
  tx_pos?: number;
  vout?: number;
  value?: number;
  address?: string;
  height?: number;
  path?: string;
  wif?: string;
  [key: string]: unknown;
}

export interface ScriptTypeTotals {
  typeKey: ScriptType;
  typeName: string;
  basePath: string;
  slip132xpub: string;
  confirmedTxCount: number;
  unconfirmedTxCount: number;
  totalTxCount: number;
  confirmedBalance: number;
  unconfirmedBalance: number;
  totalBalance: number;
  totalUsedAddresses: number;
}

export interface GrandTotals {
  totalConfirmedTxCount: number;
  totalUnconfirmedTxCount: number;
  totalTxCount: number;
  totalConfirmedBalance: number;
  totalUnconfirmedBalance: number;
  totalBalance: number;
  utxos: Utxo[];
  byType: ScriptTypeTotals[];
  scannedAddresses: string;
}

export type TimingStats = Record<string, number>;

export interface ScanResult {
  mnemonic: string;
  passphrase: string | null;
  scanningPerformed: boolean;
  electrumServer: string;
  data: WalletAccountMap;
  grandTotals: GrandTotals;
  timingStats: TimingStats;
  sendAttempted: boolean;
}

export interface ScanResponse {
  status: string;
  message: string;
  timestamp: string;
  primaryType: ScriptType;
  scanDurationSeconds: number;
  result: ScanResult;
}

export interface HistoryInput {
  index: number;
  prevTxid: string;
  prevVout: number;
  address: string | null;
  value: number;
  error?: string;
}

export interface HistoryOutput {
  index: number;
  address: string | null;
  value: number;
}

export interface HistoryTx {
  txid: string;
  height: number;
  confirmed: boolean;
  blockTime: number;
  confirmations: number;
  fee: number;
  feeRate: number;
  isRBF: boolean;
  rawHex: string;
  inputs: HistoryInput[];
  outputs: HistoryOutput[];
  size: number;
  vsize: number;
  balance_diff: number;
  isLastTransaction: boolean;
}

export interface HistoryResult {
  addresses: string[];
  transactions: HistoryTx[];
}

export interface HistoryResponse {
  status: string;
  message: string;
  timestamp: string;
  transactionsCount: number;
  scanDurationMs: number;
  topTipHeight: number;
  rpcCallsEstimated: number;
  result: HistoryResult;
}

export type DisplayUnit = 'BTC' | 'sats';

export type FiatSource =
  | 'Mempool'
  | 'Blockchain'
  | 'Coinbase'
  | 'Binance';

export interface FiatUnit {
  endPointKey: string;
  symbol: string;
  locale: string;
  country: string;
  source: FiatSource;
}

export interface BlockExplorer {
  key: string;
  name: string;
  url: string;
  txPath?: string;
}

export interface BroadcastResult {
  success: boolean;
  txid?: string;
  error?: string;
  alreadyBroadcast?: boolean;
}

export interface MultisigCosignerPub {
  fingerprint: string;
  pubkey: string;
}

export interface MultisigAddress {
  address: string;
  path: string;
  branch: number;
  index: number;
  addressExplorerUrl: string;
  scriptPubKey: string;
  witnessScript: string;
  redeemScript: string;
  cosigners: MultisigCosignerPub[];
  balanceConfirmed: number;
  balanceUnconfirmed: number;
  balanceTotal: number;
  confirmedTxCount: number;
  unconfirmedTxCount: number;
  totalTxCount: number;
}

export interface MultisigBranch {
  used: MultisigAddress[];
  fresh?: MultisigAddress;
}

export interface MultisigAccount {
  derivationPath: string;
  description: string;
  receive: MultisigBranch;
  change: MultisigBranch;
}

export interface MultisigTypeTotals {
  typeKey: string;
  typeName: string;
  basePath: string;
  confirmedTxCount: number;
  unconfirmedTxCount: number;
  totalTxCount: number;
  confirmedBalance: number;
  unconfirmedBalance: number;
  totalBalance: number;
  totalUsedAddresses: number;
}

export interface MultisigGrandTotals {
  totalConfirmedTxCount: number;
  totalUnconfirmedTxCount: number;
  totalTxCount: number;
  totalConfirmedBalance: number;
  totalUnconfirmedBalance: number;
  totalBalance: number;
  utxos: unknown[];
  byType: MultisigTypeTotals[];
  scannedAddresses: string;
}

export interface MultisigResult {
  config: string;
  mnemonics: string;
  scanningPerformed: boolean;
  electrumServer: string;
  zpubs: string[];
  data: Record<string, MultisigAccount>;
  grandTotals: MultisigGrandTotals;
}

export interface MultisigHoldingResponse {
  status: string;
  message: string;
  timestamp: string;
  primaryType: string;
  scanDurationMs: number;
  result: MultisigResult;
}

export interface WifAddress {
  address: string;
  wif: string;
  path: string;
  addressExplorerUrl: string;
  confirmedBalance: number;
  unconfirmedBalance: number;
  totalBalance: number;
  confirmedTxCount: number;
  unconfirmedTxCount: number;
  totalTxCount: number;
  utxos: unknown[];
  used: boolean;
}

export interface WifAccount {
  derivationPath: string;
  description: string;
  receive: { used: WifAddress[]; fresh?: WifAddress };
  change: { used: WifAddress[] };
}

export interface WifResult {
  scanningPerformed: boolean;
  electrumServer: string;
  data: Record<ScriptType, WifAccount>;
  grandTotals: GrandTotals;
  sendAttempted: boolean;
}

export interface WifScanResult {
  status: string;
  key: string;
  message: string;
  timestamp: string;
  primaryType: ScriptType;
  scanDurationMs: number;
  result: WifResult;
}

export interface DecodedBech32Address {
  version: number;
  program: Uint8Array;
}

export interface DecodedBase58Payload {
  versionByte: number;
  payload: Uint8Array;
}
