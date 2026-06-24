import type {
  HistoryInput,
  HistoryOutput,
  HistoryTx,
  HistoryResult,
  Utxo,
  BroadcastResult,
} from '../types/index';

export interface AddressStats {
  funded: number;
  spent: number;
  txCount: number;
  confirmedBalance: number;
  unconfirmedBalance: number;
  totalBalance: number;
}

export interface RecommendedFees {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

const MEMPOOL_API_BASE = 'https://mempool.space/api';

const ADDRESS_EXPLORER_PREFIX = 'https://mempool.space/address/';

const RBF_SEQUENCE_THRESHOLD = 0xfffffffe;

const DEFAULT_TIMEOUT_MS = 30000;

const HEX_PATTERN = /^[0-9a-fA-F]+$/;

const PRIVATE_KEY_HINT = /\b(mnemonic|seed|passphrase|xpriv|xprv|wif|privkey|private[_-]?key)\b/i;

function joinUrl(...parts: string[]): string {
  return parts.map((p, i) => (i === 0 ? p.replace(/\/+$/, '') : p.replace(/^\/+|\/+$/g, ''))).join('/');
}

function explorerUrl(address: string): string {
  return `${ADDRESS_EXPLORER_PREFIX}${address}`;
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const MAX_CONCURRENT = 8;
const MAX_RETRIES = 6;
const RETRY_BASE_MS = 600;
const RETRY_MAX_MS = 12000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

let activeRequests = 0;
const slotWaiters: Array<() => void> = [];

const acquireSlot = (): Promise<void> =>
  new Promise(resolve => {
    if (activeRequests < MAX_CONCURRENT) {
      activeRequests += 1;
      resolve();
    } else {
      slotWaiters.push(resolve);
    }
  });

const releaseSlot = (): void => {
  const next = slotWaiters.shift();
  if (next) {
    next();
  } else if (activeRequests > 0) {
    activeRequests -= 1;
  }
};

function backoffMs(retryAfter: string | null, attempt: number): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, RETRY_MAX_MS);
    }
    const dateMs = Date.parse(retryAfter);
    if (Number.isFinite(dateMs)) {
      const delta = dateMs - Date.now();
      if (delta > 0) return Math.min(delta, RETRY_MAX_MS);
    }
  }
  return Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS);
}

async function fetchJson(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<unknown> {
  let lastError: Error = new Error(`Request failed: ${url}`);
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    await acquireSlot();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let retryAfterMs = -1;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (response.ok) {
        const json = await response.json();
        clearTimeout(timer);
        releaseSlot();
        return json;
      }
      lastError = new Error(`mempool.space responded with HTTP ${response.status} for ${url}`);
      if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_RETRIES) {
        retryAfterMs = backoffMs(response.headers.get('Retry-After'), attempt);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (lastError.name === 'AbortError' && attempt < MAX_RETRIES) {
        retryAfterMs = backoffMs(null, attempt);
      }
    }
    clearTimeout(timer);
    releaseSlot();
    if (retryAfterMs < 0) {
      throw lastError;
    }
    await sleep(retryAfterMs);
  }
  throw lastError;
}

function toInt(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return fallback;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = toInt(value, NaN as unknown as number);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizeRawHex(input: string): string {
  let value = (input ?? '').trim().replace(/\s+/g, '');
  if (value.startsWith('0x') || value.startsWith('0X')) {
    value = value.slice(2);
  }
  return value;
}

export function isValidRawHex(input: string): boolean {
  const value = normalizeRawHex(input);
  return value.length > 0 && value.length % 2 === 0 && HEX_PATTERN.test(value);
}

function assertPublicOnly(value: string, label: string): void {
  if (PRIVATE_KEY_HINT.test(value)) {
    throw new Error(`Refusing to transmit ${label}: it appears to contain secret key material.`);
  }
}

export async function fetchAddrStats(address: string): Promise<AddressStats> {
  assertPublicOnly(address, 'address');
  const payload = (await fetchJson(joinUrl(MEMPOOL_API_BASE, 'address', address))) as Record<string, unknown>;
  const chain = (payload.chain_stats ?? {}) as Record<string, unknown>;
  const mempool = (payload.mempool_stats ?? {}) as Record<string, unknown>;

  const chainFunded = toInt(chain.funded_txo_sum);
  const chainSpent = toInt(chain.spent_txo_sum);
  const mempoolFunded = toInt(mempool.funded_txo_sum);
  const mempoolSpent = toInt(mempool.spent_txo_sum);

  const funded = chainFunded + mempoolFunded;
  const spent = chainSpent + mempoolSpent;
  const confirmedBalance = chainFunded - chainSpent;
  const unconfirmedBalance = mempoolFunded - mempoolSpent;

  return {
    funded,
    spent,
    txCount: toInt(chain.tx_count) + toInt(mempool.tx_count),
    confirmedBalance,
    unconfirmedBalance,
    totalBalance: confirmedBalance + unconfirmedBalance,
  };
}

export async function fetchAddrUtxos(address: string): Promise<Utxo[]> {
  assertPublicOnly(address, 'address');
  let payload: unknown;
  try {
    payload = await fetchJson(joinUrl(MEMPOOL_API_BASE, 'address', address, 'utxo'));
  } catch {
    return [];
  }
  if (!Array.isArray(payload)) return [];

  return payload
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => {
      const txid = typeof item.txid === 'string' ? item.txid : undefined;
      const vout = toInt(item.vout);
      const value = toInt(item.value);
      const status = (item.status ?? {}) as Record<string, unknown>;
      const height = status.confirmed === true ? toInt(status.block_height) : 0;
      const utxo: Utxo = {
        tx_hash: txid,
        txid,
        tx_pos: vout,
        vout,
        value,
        address,
        height,
      };
      return utxo;
    })
    .filter((utxo) => typeof utxo.txid === 'string' && utxo.txid.length > 0);
}

interface EsploraStatus {
  confirmed?: boolean;
  block_height?: number;
  block_time?: number;
}

interface EsploraPrevout {
  scriptpubkey_address?: string;
  value?: number;
}

interface EsploraVin {
  txid?: string;
  vout?: number;
  sequence?: number;
  is_coinbase?: boolean;
  prevout?: EsploraPrevout | null;
}

interface EsploraVout {
  scriptpubkey_address?: string;
  value?: number;
}

interface EsploraTx {
  txid?: string;
  size?: number;
  weight?: number;
  fee?: number;
  status?: EsploraStatus;
  vin?: EsploraVin[];
  vout?: EsploraVout[];
}

async function fetchTipHeight(): Promise<number> {
  try {
    const payload = await fetchJson(joinUrl(MEMPOOL_API_BASE, 'blocks', 'tip', 'height'));
    return toInt(payload);
  } catch {
    return 0;
  }
}

async function fetchAddressTxs(address: string): Promise<EsploraTx[]> {
  assertPublicOnly(address, 'address');
  const payload = await fetchJson(joinUrl(MEMPOOL_API_BASE, 'address', address, 'txs'));
  return Array.isArray(payload) ? (payload as EsploraTx[]) : [];
}

function buildInputs(tx: EsploraTx): HistoryInput[] {
  const vin = Array.isArray(tx.vin) ? tx.vin : [];
  return vin.map((entry, index) => {
    const prevout = entry?.prevout ?? null;
    const address = prevout && typeof prevout.scriptpubkey_address === 'string' ? prevout.scriptpubkey_address : null;
    const value = prevout ? toInt(prevout.value) : 0;
    const input: HistoryInput = {
      index,
      prevTxid: typeof entry?.txid === 'string' ? entry.txid : '',
      prevVout: toInt(entry?.vout),
      address,
      value,
    };
    if (entry?.is_coinbase) {
      input.error = 'coinbase input has no funding outpoint';
    } else if (!prevout) {
      input.error = 'previous output not available';
    }
    return input;
  });
}

function buildOutputs(tx: EsploraTx): HistoryOutput[] {
  const vout = Array.isArray(tx.vout) ? tx.vout : [];
  return vout.map((entry, index) => ({
    index,
    address: typeof entry?.scriptpubkey_address === 'string' ? entry.scriptpubkey_address : null,
    value: toInt(entry?.value),
  }));
}

function computeBalanceDiff(inputs: HistoryInput[], outputs: HistoryOutput[], owned: Set<string>): number {
  let diff = 0;
  for (const input of inputs) {
    if (input.address && owned.has(input.address)) diff -= input.value;
  }
  for (const output of outputs) {
    if (output.address && owned.has(output.address)) diff += output.value;
  }
  return diff;
}

function detectRbf(tx: EsploraTx): boolean {
  const vin = Array.isArray(tx.vin) ? tx.vin : [];
  return vin.some((entry) => toInt(entry?.sequence, RBF_SEQUENCE_THRESHOLD + 1) < RBF_SEQUENCE_THRESHOLD);
}

function toHistoryTx(tx: EsploraTx, owned: Set<string>, tipHeight: number): HistoryTx {
  const status = tx.status ?? {};
  const confirmed = status.confirmed === true;
  const height = confirmed ? toInt(status.block_height) : 0;
  const blockTime = confirmed ? toInt(status.block_time) : 0;
  const confirmations = confirmed && tipHeight > 0 && height > 0 ? tipHeight - height + 1 : 0;

  const size = toInt(tx.size);
  const weight = toInt(tx.weight);
  const vsize = weight > 0 ? Math.ceil(weight / 4) : size;
  const fee = toInt(tx.fee);
  const feeRate = vsize > 0 ? fee / vsize : 0;

  const inputs = buildInputs(tx);
  const outputs = buildOutputs(tx);

  return {
    txid: typeof tx.txid === 'string' ? tx.txid : '',
    height,
    confirmed,
    blockTime,
    confirmations,
    fee,
    feeRate,
    isRBF: !confirmed && detectRbf(tx),
    rawHex: '',
    inputs,
    outputs,
    size,
    vsize,
    balance_diff: computeBalanceDiff(inputs, outputs, owned),
    isLastTransaction: false,
  };
}

function sortHistory(a: HistoryTx, b: HistoryTx): number {
  if (a.confirmed !== b.confirmed) return a.confirmed ? 1 : -1;
  if (a.height !== b.height) return b.height - a.height;
  return b.blockTime - a.blockTime;
}

export async function fetchHistory(addresses: string[]): Promise<HistoryResult> {
  const unique: string[] = [];
  const seenAddress = new Set<string>();
  for (const raw of addresses) {
    const address = (raw ?? '').trim();
    if (!address || seenAddress.has(address)) continue;
    assertPublicOnly(address, 'address');
    seenAddress.add(address);
    unique.push(address);
  }

  const owned = new Set(unique);
  const tipHeight = await fetchTipHeight();
  const byTxid = new Map<string, HistoryTx>();

  for (const address of unique) {
    const txs = await fetchAddressTxs(address);
    for (const tx of txs) {
      if (typeof tx?.txid !== 'string' || !tx.txid) continue;
      if (byTxid.has(tx.txid)) continue;
      byTxid.set(tx.txid, toHistoryTx(tx, owned, tipHeight));
    }
  }

  const transactions = Array.from(byTxid.values()).sort(sortHistory);
  if (transactions.length > 0) {
    transactions[transactions.length - 1].isLastTransaction = true;
  }

  return {
    addresses: unique,
    transactions,
  };
}

function extractBroadcastError(body: string): string | undefined {
  const trimmed = (body ?? '').trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      const candidate = parsed.error ?? parsed.message ?? parsed.details ?? parsed.reason;
      if (typeof candidate === 'string' && candidate) return candidate;
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

function looksAlreadyBroadcast(body: string): boolean {
  return /already (in mempool|have transaction|broadcast)|txn-already-known|transaction already exists/i.test(body);
}

export async function broadcastRawTransaction(rawHex: string): Promise<BroadcastResult> {
  const normalized = normalizeRawHex(rawHex);
  if (!isValidRawHex(normalized)) {
    return { success: false, error: 'Raw transaction hex is empty or not valid hexadecimal.' };
  }
  assertPublicOnly(normalized, 'raw transaction');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(joinUrl(MEMPOOL_API_BASE, 'tx'), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Accept: 'text/plain' },
      body: normalized,
      signal: controller.signal,
    });
    const body = await response.text();
    const alreadyKnown = looksAlreadyBroadcast(body);

    if (!response.ok) {
      if (alreadyKnown) {
        return { success: false, alreadyBroadcast: true, error: 'Transaction is already known to the network.' };
      }
      return {
        success: false,
        error: extractBroadcastError(body) ?? `Broadcast failed with HTTP ${response.status}.`,
      };
    }

    const txid = body.trim();
    if (!HEX_PATTERN.test(txid) || txid.length !== 64) {
      if (alreadyKnown) {
        return { success: false, alreadyBroadcast: true, error: 'Transaction is already known to the network.' };
      }
      return { success: false, error: extractBroadcastError(body) ?? 'Broadcast returned an unexpected response.' };
    }

    return { success: true, txid };
  } catch (error) {
    const err = error as { name?: string; message?: string };
    if (err?.name === 'AbortError') {
      return { success: false, error: 'Broadcast timed out before the network responded.' };
    }
    return { success: false, error: err?.message ?? 'Could not reach the broadcast endpoint.' };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRecommendedFees(): Promise<RecommendedFees> {
  const payload = (await fetchJson(joinUrl(MEMPOOL_API_BASE, 'v1', 'fees', 'recommended'))) as Record<string, unknown>;
  return {
    fastestFee: toPositiveInt(payload.fastestFee, 10),
    halfHourFee: toPositiveInt(payload.halfHourFee, 5),
    hourFee: toPositiveInt(payload.hourFee, 3),
    economyFee: toPositiveInt(payload.economyFee, 1),
    minimumFee: toPositiveInt(payload.minimumFee, 1),
  };
}

export { explorerUrl, MEMPOOL_API_BASE };
