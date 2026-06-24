import TcpSocket from "react-native-tcp-socket";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex, bech32, bech32m, base58check } from "@scure/base";
import { hash160, compressedPublicKey } from "../wallets/derivation";
import type {
  HistoryInput,
  HistoryOutput,
  HistoryTx,
  HistoryResult,
} from "../types/index";

const base58Check = base58check(sha256);

const P2PKH_VERSION_MAINNET = 0x00;
const P2SH_VERSION_MAINNET = 0x05;
const BECH32_HRP_MAINNET = "bc";
const SEGWIT_V0 = 0;

const SATS_PER_BTC = 100_000_000;
const RBF_SEQUENCE_THRESHOLD = 0xfffffffe;
const COINBASE_PREV_VOUT = 0xffffffff;
const TX_BATCH_SIZE = 20;
const BECH32_DECODE_LIMIT = 1023;

const OP_DUP = 0x76;
const OP_HASH160 = 0xa9;
const OP_EQUALVERIFY = 0x88;
const OP_CHECKSIG = 0xac;
const OP_EQUAL = 0x87;
const OP_RETURN = 0x6a;
const PUSH_20 = 0x14;

const PROTOCOL_MIN = "1.4";
const PROTOCOL_MAX = "1.4.2";
const CLIENT_NAME = "aura";

const CONNECT_TIMEOUT_MS = 12000;
const REQUEST_TIMEOUT_MS = 25000;
const IDLE_TIMEOUT_MS = 60000;

export interface ElectrumServer {
  host: string;
  port: number;
}

export const DEFAULT_SERVERS: readonly ElectrumServer[] = [
  { host: "electrum.blockstream.info", port: 50002 },
  { host: "fulcrum.sethforprivacy.com", port: 50002 },
  { host: "bitcoin.aranguren.org", port: 50002 },
  { host: "electrum.bitaroo.net", port: 50002 },
];

export type ScriptKind = "P2PKH" | "P2SH-P2WPKH" | "P2WPKH";

export interface BalanceResult {
  confirmed: number;
  unconfirmed: number;
}

export interface HistoryEntry {
  tx_hash: string;
  height: number;
}

export interface UnspentEntry {
  tx_hash: string;
  tx_pos: number;
  value: number;
  height: number;
}

export interface BatchItem {
  method: string;
  params: unknown[];
}

export interface DecodedTxInput {
  txid?: string;
  vout?: number;
  sequence?: number;
  coinbase?: string;
}

export interface DecodedTxScriptPubKey {
  hex?: string;
  address?: string;
  addresses?: string[];
  type?: string;
}

export interface DecodedTxOutput {
  value?: number;
  n?: number;
  scriptPubKey?: DecodedTxScriptPubKey;
}

export interface DecodedTransaction {
  txid: string;
  hash?: string;
  size: number;
  vsize: number;
  weight: number;
  version: number;
  locktime: number;
  confirmations: number;
  time?: number;
  blocktime?: number;
  vin: DecodedTxInput[];
  vout: DecodedTxOutput[];
  [key: string]: unknown;
}

export interface BuildHistoryOptions {
  ownedAddresses?: Iterable<string>;
  tipHeight?: number;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown[];
}

interface JsonRpcResponse {
  jsonrpc?: string;
  id?: number | null;
  result?: unknown;
  error?: { code?: number; message?: string } | string | null;
}

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

type Socket = ReturnType<typeof TcpSocket.connectTLS>;

const PRIVATE_KEY_HINT =
  /\b(mnemonic|seed|passphrase|xpriv|xprv|wif|privkey|private[_-]?key)\b/i;

const HEX_PATTERN = /^[0-9a-fA-F]+$/;

const concatBytes = (...chunks: Uint8Array[]): Uint8Array => {
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
};

const reverseBytes = (bytes: Uint8Array): Uint8Array => {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    out[i] = bytes[bytes.length - 1 - i];
  }
  return out;
};

const assertHash160 = (h: Uint8Array): Uint8Array => {
  if (h.length !== 20) {
    throw new Error("hash160 must be exactly 20 bytes");
  }
  return h;
};

const scriptForP2PKH = (h: Uint8Array): Uint8Array =>
  concatBytes(
    Uint8Array.of(0x76, 0xa9, 0x14),
    assertHash160(h),
    Uint8Array.of(0x88, 0xac),
  );

const scriptForP2SHP2WPKH = (h: Uint8Array): Uint8Array =>
  concatBytes(Uint8Array.of(0xa9, 0x14), assertHash160(h), Uint8Array.of(0x87));

const scriptForP2WPKH = (h: Uint8Array): Uint8Array =>
  concatBytes(Uint8Array.of(0x00, 0x14), assertHash160(h));

const scriptFromHash160 = (kind: ScriptKind, h: Uint8Array): Uint8Array => {
  switch (kind) {
    case "P2PKH":
      return scriptForP2PKH(h);
    case "P2SH-P2WPKH":
      return scriptForP2SHP2WPKH(h);
    case "P2WPKH":
      return scriptForP2WPKH(h);
    default:
      throw new Error("unsupported script kind");
  }
};

const scriptFromAddress = (address: string): Uint8Array => {
  const trimmed = address.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith(`${BECH32_HRP_MAINNET}1`)) {
    const decoded = bech32.decode(lower as `${string}1${string}`);
    if (decoded.prefix !== BECH32_HRP_MAINNET) {
      throw new Error("unexpected bech32 prefix");
    }
    const version = decoded.words[0];
    const program = bech32.fromWords(decoded.words.slice(1));
    if (version === SEGWIT_V0 && program.length === 20) {
      return scriptForP2WPKH(program);
    }
    if (version === SEGWIT_V0 && program.length === 32) {
      return concatBytes(Uint8Array.of(0x00, 0x20), program);
    }
    const op = version === 0 ? 0x00 : 0x50 + version;
    return concatBytes(Uint8Array.of(op, program.length), program);
  }
  const payload = base58Check.decode(trimmed);
  const versionByte = payload[0];
  const body = payload.slice(1);
  if (versionByte === P2PKH_VERSION_MAINNET) {
    return scriptForP2PKH(body);
  }
  if (versionByte === P2SH_VERSION_MAINNET) {
    return concatBytes(Uint8Array.of(0xa9, 0x14), body, Uint8Array.of(0x87));
  }
  throw new Error("unsupported base58 address version");
};

export const scriptHashFromScript = (script: Uint8Array): string =>
  hex.encode(reverseBytes(sha256(script)));

export const scriptHashFromHash160 = (
  kind: ScriptKind,
  h: Uint8Array,
): string => scriptHashFromScript(scriptFromHash160(kind, h));

export const scriptHashFromPublicKey = (
  kind: ScriptKind,
  publicKey: Uint8Array,
): string => scriptHashFromHash160(kind, hash160(publicKey));

export const scriptHashFromPrivateKey = (
  kind: ScriptKind,
  privateKey: Uint8Array,
): string =>
  scriptHashFromHash160(kind, hash160(compressedPublicKey(privateKey)));

export const scriptHash = (addressOrScript: string): string => {
  const value = addressOrScript.trim();
  if (HEX_PATTERN.test(value) && value.length % 2 === 0 && value.length >= 4) {
    return scriptHashFromScript(hex.decode(value.toLowerCase()));
  }
  return scriptHashFromScript(scriptFromAddress(value));
};

const assertPublicOnly = (value: string, label: string): void => {
  if (PRIVATE_KEY_HINT.test(value)) {
    throw new Error(`Refusing to transmit ${label}: it looks like secret key material.`);
  }
};

const toInt = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return fallback;
};

const errorMessage = (error: JsonRpcResponse["error"]): string => {
  if (!error) return "unknown Electrum error";
  if (typeof error === "string") return error;
  return error.message ?? `Electrum error ${error.code ?? ""}`.trim();
};

const btcToSats = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * SATS_PER_BTC);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.round(parsed * SATS_PER_BTC);
  }
  return 0;
};

const encodeSegwitAddress = (version: number, program: Uint8Array): string => {
  const words = [version, ...bech32.toWords(program)];
  if (version === SEGWIT_V0) {
    return bech32.encode(BECH32_HRP_MAINNET, words, BECH32_DECODE_LIMIT);
  }
  return bech32m.encode(BECH32_HRP_MAINNET, words, BECH32_DECODE_LIMIT);
};

const addressFromScriptPubKey = (script: Uint8Array): string | null => {
  if (script.length === 25 &&
    script[0] === OP_DUP &&
    script[1] === OP_HASH160 &&
    script[2] === PUSH_20 &&
    script[23] === OP_EQUALVERIFY &&
    script[24] === OP_CHECKSIG) {
    return base58Check.encode(
      concatBytes(Uint8Array.of(P2PKH_VERSION_MAINNET), script.slice(3, 23)),
    );
  }
  if (script.length === 23 &&
    script[0] === OP_HASH160 &&
    script[1] === PUSH_20 &&
    script[22] === OP_EQUAL) {
    return base58Check.encode(
      concatBytes(Uint8Array.of(P2SH_VERSION_MAINNET), script.slice(2, 22)),
    );
  }
  if (script.length >= 2 && script[0] === OP_RETURN) {
    return null;
  }
  if (script.length >= 4 && script.length <= 42) {
    const opcode = script[0];
    const pushLen = script[1];
    const program = script.slice(2);
    if (pushLen === program.length) {
      if (opcode === SEGWIT_V0 && (program.length === 20 || program.length === 32)) {
        return encodeSegwitAddress(SEGWIT_V0, program);
      }
      if (opcode >= 0x51 && opcode <= 0x60 && program.length >= 2 && program.length <= 40) {
        return encodeSegwitAddress(opcode - 0x50, program);
      }
    }
  }
  return null;
};

const outputAddress = (out: DecodedTxOutput): string | null => {
  const spk = out.scriptPubKey;
  if (spk) {
    if (typeof spk.address === "string" && spk.address.length > 0) {
      return spk.address;
    }
    if (Array.isArray(spk.addresses) &&
      spk.addresses.length === 1 &&
      typeof spk.addresses[0] === "string") {
      return spk.addresses[0];
    }
    if (typeof spk.hex === "string" && HEX_PATTERN.test(spk.hex) && spk.hex.length % 2 === 0) {
      try {
        return addressFromScriptPubKey(hex.decode(spk.hex.toLowerCase()));
      } catch {
        return null;
      }
    }
  }
  return null;
};

const normalizeDecodedTx = (raw: unknown): DecodedTransaction => {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const vinRaw = Array.isArray(obj.vin) ? obj.vin : [];
  const voutRaw = Array.isArray(obj.vout) ? obj.vout : [];
  const vin: DecodedTxInput[] = vinRaw.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    return {
      txid: typeof item.txid === "string" ? item.txid : undefined,
      vout: typeof item.vout === "number" ? item.vout : undefined,
      sequence: typeof item.sequence === "number" ? item.sequence : undefined,
      coinbase: typeof item.coinbase === "string" ? item.coinbase : undefined,
    };
  });
  const vout: DecodedTxOutput[] = voutRaw.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    const spkRaw = (item.scriptPubKey ?? {}) as Record<string, unknown>;
    const addresses = Array.isArray(spkRaw.addresses)
      ? spkRaw.addresses.filter((a): a is string => typeof a === "string")
      : undefined;
    return {
      value: typeof item.value === "number" ? item.value : Number(item.value),
      n: typeof item.n === "number" ? item.n : undefined,
      scriptPubKey: {
        hex: typeof spkRaw.hex === "string" ? spkRaw.hex : undefined,
        address: typeof spkRaw.address === "string" ? spkRaw.address : undefined,
        addresses,
        type: typeof spkRaw.type === "string" ? spkRaw.type : undefined,
      },
    };
  });
  return {
    txid: typeof obj.txid === "string" ? obj.txid : "",
    hash: typeof obj.hash === "string" ? obj.hash : undefined,
    size: toInt(obj.size),
    vsize: toInt(obj.vsize),
    weight: toInt(obj.weight),
    version: toInt(obj.version),
    locktime: toInt(obj.locktime),
    confirmations: toInt(obj.confirmations),
    time: typeof obj.time === "number" ? obj.time : undefined,
    blocktime: typeof obj.blocktime === "number" ? obj.blocktime : undefined,
    vin,
    vout,
  };
};

const ZERO_PREV_TXID = "0".repeat(64);

class ByteReader {
  private offset = 0;

  public constructor(private readonly data: Uint8Array) {}

  public get position(): number {
    return this.offset;
  }

  public get remaining(): number {
    return this.data.length - this.offset;
  }

  public readByte(): number {
    if (this.offset >= this.data.length) {
      throw new Error("raw transaction truncated");
    }
    const value = this.data[this.offset];
    this.offset += 1;
    return value;
  }

  public readBytes(length: number): Uint8Array {
    if (this.offset + length > this.data.length) {
      throw new Error("raw transaction truncated");
    }
    const slice = this.data.slice(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  public readUint32LE(): number {
    const b = this.readBytes(4);
    return (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0;
  }

  public readUint64LE(): number {
    const b = this.readBytes(8);
    let value = 0;
    for (let i = 7; i >= 0; i -= 1) {
      value = value * 256 + b[i];
    }
    return value;
  }

  public readVarInt(): number {
    const first = this.readByte();
    if (first < 0xfd) return first;
    if (first === 0xfd) {
      const b = this.readBytes(2);
      return b[0] | (b[1] << 8);
    }
    if (first === 0xfe) {
      return this.readUint32LE();
    }
    return this.readUint64LE();
  }
}

const decodeRawTransaction = (rawHex: string): DecodedTransaction => {
  const bytes = hex.decode(rawHex.toLowerCase());
  const doubleSha = sha256(sha256(bytes));
  const reader = new ByteReader(bytes);
  const version = reader.readUint32LE();

  let hasWitness = false;
  if (reader.remaining >= 2) {
    const marker = bytes[reader.position];
    const flag = bytes[reader.position + 1];
    if (marker === 0x00 && flag !== 0x00) {
      hasWitness = true;
      reader.readByte();
      reader.readByte();
    }
  }

  const baseStart = hasWitness ? reader.position : 4;
  const inputCount = reader.readVarInt();
  const vin: DecodedTxInput[] = [];
  for (let i = 0; i < inputCount; i += 1) {
    const prevTxidLe = reader.readBytes(32);
    const prevVout = reader.readUint32LE();
    const scriptLen = reader.readVarInt();
    reader.readBytes(scriptLen);
    const sequence = reader.readUint32LE();
    const prevTxid = hex.encode(reverseBytes(prevTxidLe));
    const isCoinbase = prevTxid === ZERO_PREV_TXID && prevVout === COINBASE_PREV_VOUT;
    vin.push({
      txid: isCoinbase ? undefined : prevTxid,
      vout: prevVout,
      sequence,
      coinbase: isCoinbase ? "" : undefined,
    });
  }

  const outputCount = reader.readVarInt();
  const vout: DecodedTxOutput[] = [];
  for (let i = 0; i < outputCount; i += 1) {
    const value = reader.readUint64LE();
    const scriptLen = reader.readVarInt();
    const script = reader.readBytes(scriptLen);
    vout.push({
      value: value / SATS_PER_BTC,
      n: i,
      scriptPubKey: { hex: hex.encode(script) },
    });
  }

  const baseEndBeforeLocktime = hasWitness ? reader.position : bytes.length - 4;
  if (hasWitness) {
    for (let i = 0; i < inputCount; i += 1) {
      const stackItems = reader.readVarInt();
      for (let j = 0; j < stackItems; j += 1) {
        const itemLen = reader.readVarInt();
        reader.readBytes(itemLen);
      }
    }
  }
  const locktime = reader.readUint32LE();

  const baseSize = hasWitness
    ? 4 + (baseEndBeforeLocktime - baseStart) + 4
    : bytes.length;
  const totalSize = bytes.length;
  const weight = baseSize * 3 + totalSize;
  const vsize = Math.ceil(weight / 4);

  let txidBytes: Uint8Array;
  if (hasWitness) {
    const stripped = concatBytes(
      bytes.slice(0, 4),
      bytes.slice(baseStart, baseEndBeforeLocktime),
      bytes.slice(bytes.length - 4),
    );
    txidBytes = sha256(sha256(stripped));
  } else {
    txidBytes = doubleSha;
  }

  return {
    txid: hex.encode(reverseBytes(txidBytes)),
    hash: hex.encode(reverseBytes(sha256(sha256(bytes)))),
    size: totalSize,
    vsize,
    weight,
    version,
    locktime,
    confirmations: 0,
    vin,
    vout,
  };
};

const isCoinbaseInput = (input: DecodedTxInput): boolean =>
  typeof input.coinbase === "string" ||
  input.txid === undefined ||
  input.vout === COINBASE_PREV_VOUT;

export class ElectrumClient {
  private readonly servers: readonly ElectrumServer[];

  private socket: Socket | null = null;

  private active: ElectrumServer | null = null;

  private serverIndex = 0;

  private nextId = 1;

  private buffer = "";

  private readonly pending = new Map<number, PendingCall>();

  private connecting: Promise<void> | null = null;

  private negotiatedVersion: string | null = null;

  private readonly txCache = new Map<string, DecodedTransaction>();

  private verboseUnsupported = false;

  public constructor(servers: readonly ElectrumServer[] = DEFAULT_SERVERS) {
    if (servers.length === 0) {
      throw new Error("at least one Electrum server is required");
    }
    this.servers = servers;
  }

  public get currentServer(): ElectrumServer | null {
    return this.active;
  }

  public get serverLabel(): string {
    return this.active ? `${this.active.host}:${this.active.port}` : "";
  }

  public get protocolVersion(): string | null {
    return this.negotiatedVersion;
  }

  public async connect(): Promise<void> {
    if (this.socket && !this.socket.destroyed) return;
    if (this.connecting) return this.connecting;
    this.connecting = this.connectAny();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  public close(): void {
    this.teardown(new Error("client closed"));
  }

  public async request<T = unknown>(
    method: string,
    params: unknown[] = [],
  ): Promise<T> {
    await this.connect();
    return this.dispatch<T>(method, params);
  }

  public async requestBatch(
    items: BatchItem[],
  ): Promise<Array<{ result?: unknown; error?: string }>> {
    if (items.length === 0) return [];
    await this.connect();
    return this.attempt(() => this.sendBatch(items));
  }

  public async getBalance(sh: string): Promise<BalanceResult> {
    const raw = await this.request<Record<string, unknown>>(
      "blockchain.scripthash.get_balance",
      [sh],
    );
    return {
      confirmed: toInt(raw?.confirmed),
      unconfirmed: toInt(raw?.unconfirmed),
    };
  }

  public async getBalances(
    scriptHashes: string[],
  ): Promise<BalanceResult[]> {
    const responses = await this.requestBatch(
      scriptHashes.map((sh) => ({
        method: "blockchain.scripthash.get_balance",
        params: [sh],
      })),
    );
    return responses.map((entry) => {
      const raw = (entry.result ?? {}) as Record<string, unknown>;
      return {
        confirmed: toInt(raw.confirmed),
        unconfirmed: toInt(raw.unconfirmed),
      };
    });
  }

  public async getHistory(sh: string): Promise<HistoryEntry[]> {
    const raw = await this.request<unknown>(
      "blockchain.scripthash.get_history",
      [sh],
    );
    return ElectrumClient.parseHistory(raw);
  }

  public async getHistories(
    scriptHashes: string[],
  ): Promise<HistoryEntry[][]> {
    const responses = await this.requestBatch(
      scriptHashes.map((sh) => ({
        method: "blockchain.scripthash.get_history",
        params: [sh],
      })),
    );
    return responses.map((entry) => ElectrumClient.parseHistory(entry.result));
  }

  public async listUnspent(sh: string): Promise<UnspentEntry[]> {
    const raw = await this.request<unknown>(
      "blockchain.scripthash.listunspent",
      [sh],
    );
    return ElectrumClient.parseUnspent(raw);
  }

  public async listUnspentBatch(
    scriptHashes: string[],
  ): Promise<UnspentEntry[][]> {
    const responses = await this.requestBatch(
      scriptHashes.map((sh) => ({
        method: "blockchain.scripthash.listunspent",
        params: [sh],
      })),
    );
    return responses.map((entry) => ElectrumClient.parseUnspent(entry.result));
  }

  public async broadcast(rawHex: string): Promise<string> {
    const normalized = rawHex.trim().replace(/\s+/g, "").toLowerCase();
    if (normalized.length === 0 || normalized.length % 2 !== 0 || !HEX_PATTERN.test(normalized)) {
      throw new Error("raw transaction hex is empty or invalid");
    }
    assertPublicOnly(normalized, "raw transaction");
    const txid = await this.request<unknown>(
      "blockchain.transaction.broadcast",
      [normalized],
    );
    if (typeof txid !== "string" || !HEX_PATTERN.test(txid) || txid.length !== 64) {
      throw new Error(`broadcast rejected: ${String(txid)}`);
    }
    return txid;
  }

  public async estimateFee(blocks: number): Promise<number> {
    const target = Number.isInteger(blocks) && blocks > 0 ? blocks : 1;
    const btcPerKb = await this.request<unknown>("blockchain.estimatefee", [
      target,
    ]);
    const value = typeof btcPerKb === "number" ? btcPerKb : Number(btcPerKb);
    if (!Number.isFinite(value) || value <= 0) return 1;
    const satPerVb = (value * 1e8) / 1000;
    return Math.max(1, Math.round(satPerVb * 100) / 100);
  }

  public async estimateFees(
    blockTargets: number[],
  ): Promise<Record<number, number>> {
    const targets = blockTargets.filter(
      (b) => Number.isInteger(b) && b > 0,
    );
    const responses = await this.requestBatch(
      targets.map((b) => ({ method: "blockchain.estimatefee", params: [b] })),
    );
    const out: Record<number, number> = {};
    responses.forEach((entry, index) => {
      const target = targets[index];
      const value =
        typeof entry.result === "number" ? entry.result : Number(entry.result);
      if (!Number.isFinite(value) || value <= 0) {
        out[target] = 1;
        return;
      }
      out[target] = Math.max(1, Math.round(((value * 1e8) / 1000) * 100) / 100);
    });
    return out;
  }

  public async getTipHeight(): Promise<number> {
    const raw = await this.request<unknown>("blockchain.headers.subscribe", []);
    if (raw && typeof raw === "object") {
      const height = (raw as Record<string, unknown>).height;
      return toInt(height);
    }
    return 0;
  }

  public async getTransaction(txid: string): Promise<DecodedTransaction> {
    const normalized = txid.trim().toLowerCase();
    if (normalized.length !== 64 || !HEX_PATTERN.test(normalized)) {
      throw new Error("txid must be 64 hex characters");
    }
    const cached = this.txCache.get(normalized);
    if (cached) return cached;
    const decoded = this.verboseUnsupported
      ? await this.fetchTransactionRaw(normalized)
      : await this.fetchTransactionVerbose(normalized);
    const key = decoded.txid.length === 64 ? decoded.txid : normalized;
    this.txCache.set(key, decoded);
    return decoded;
  }

  private async fetchTransactionVerbose(
    txid: string,
  ): Promise<DecodedTransaction> {
    try {
      const raw = await this.request<unknown>("blockchain.transaction.get", [
        txid,
        true,
      ]);
      return normalizeDecodedTx(raw);
    } catch (error) {
      if (ElectrumClient.isVerboseUnsupported(error)) {
        this.verboseUnsupported = true;
        return this.fetchTransactionRaw(txid);
      }
      throw error;
    }
  }

  private async fetchTransactionRaw(txid: string): Promise<DecodedTransaction> {
    const raw = await this.request<unknown>("blockchain.transaction.get", [
      txid,
      false,
    ]);
    if (typeof raw !== "string" || !HEX_PATTERN.test(raw) || raw.length % 2 !== 0) {
      throw new Error(`unexpected raw transaction for ${txid}`);
    }
    return decodeRawTransaction(raw);
  }

  private static isVerboseUnsupported(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /verbose/i.test(message) && /unsupported|not\s+supported/i.test(message);
  }

  public async getTransactions(
    txids: string[],
  ): Promise<Map<string, DecodedTransaction>> {
    const out = new Map<string, DecodedTransaction>();
    const missing: string[] = [];
    const seen = new Set<string>();
    for (const raw of txids) {
      const id = (raw ?? "").trim().toLowerCase();
      if (id.length !== 64 || !HEX_PATTERN.test(id) || seen.has(id)) continue;
      seen.add(id);
      const cached = this.txCache.get(id);
      if (cached) {
        out.set(id, cached);
      } else {
        missing.push(id);
      }
    }
    for (let start = 0; start < missing.length; start += TX_BATCH_SIZE) {
      const slice = missing.slice(start, start + TX_BATCH_SIZE);
      const resolved = await this.fetchTransactionBatch(slice);
      for (const [id, decoded] of resolved) {
        const key = decoded.txid.length === 64 ? decoded.txid : id;
        this.txCache.set(key, decoded);
        out.set(id, decoded);
      }
    }
    return out;
  }

  private async fetchTransactionBatch(
    ids: string[],
  ): Promise<Map<string, DecodedTransaction>> {
    const out = new Map<string, DecodedTransaction>();
    if (!this.verboseUnsupported) {
      const responses = await this.requestBatch(
        ids.map((id) => ({
          method: "blockchain.transaction.get",
          params: [id, true],
        })),
      );
      const fallbackIds: string[] = [];
      responses.forEach((entry, index) => {
        const id = ids[index];
        if (entry.error) {
          if (ElectrumClient.isVerboseUnsupported(entry.error)) {
            this.verboseUnsupported = true;
            fallbackIds.push(id);
          }
          return;
        }
        if (entry.result === undefined) return;
        out.set(id, normalizeDecodedTx(entry.result));
      });
      if (fallbackIds.length === 0) return out;
      const rawResolved = await this.fetchRawTransactionBatch(
        this.verboseUnsupported ? ids : fallbackIds,
      );
      for (const [id, decoded] of rawResolved) out.set(id, decoded);
      return out;
    }
    return this.fetchRawTransactionBatch(ids);
  }

  private async fetchRawTransactionBatch(
    ids: string[],
  ): Promise<Map<string, DecodedTransaction>> {
    const out = new Map<string, DecodedTransaction>();
    const responses = await this.requestBatch(
      ids.map((id) => ({
        method: "blockchain.transaction.get",
        params: [id, false],
      })),
    );
    responses.forEach((entry, index) => {
      const id = ids[index];
      if (entry.error || typeof entry.result !== "string") return;
      const rawHex = entry.result;
      if (!HEX_PATTERN.test(rawHex) || rawHex.length % 2 !== 0) return;
      try {
        out.set(id, decodeRawTransaction(rawHex));
      } catch {
        out.delete(id);
      }
    });
    return out;
  }

  public async buildHistory(
    scriptHashesOrAddresses: string[],
    options: BuildHistoryOptions = {},
  ): Promise<HistoryResult> {
    const scriptHashes: string[] = [];
    const seenSh = new Set<string>();
    for (const raw of scriptHashesOrAddresses) {
      const value = (raw ?? "").trim();
      if (!value) continue;
      assertPublicOnly(value, "address");
      const sh = scriptHash(value);
      if (seenSh.has(sh)) continue;
      seenSh.add(sh);
      scriptHashes.push(sh);
    }

    const owned = new Set<string>();
    for (const addr of options.ownedAddresses ?? scriptHashesOrAddresses) {
      const value = (addr ?? "").trim();
      if (value && !HEX_PATTERN.test(value)) owned.add(value);
    }

    const tipHeight =
      typeof options.tipHeight === "number" && options.tipHeight > 0
        ? options.tipHeight
        : await this.getTipHeight();

    const histories = await this.getHistories(scriptHashes);
    const heightByTxid = new Map<string, number>();
    const order: string[] = [];
    for (const entries of histories) {
      for (const entry of entries) {
        if (!heightByTxid.has(entry.tx_hash)) {
          heightByTxid.set(entry.tx_hash, entry.height);
          order.push(entry.tx_hash);
        } else if (entry.height > 0) {
          heightByTxid.set(entry.tx_hash, entry.height);
        }
      }
    }

    const decodedById = await this.getTransactions(order);

    const prevoutIds: string[] = [];
    for (const txid of order) {
      const tx = decodedById.get(txid);
      if (!tx) continue;
      for (const input of tx.vin) {
        if (isCoinbaseInput(input) || typeof input.txid !== "string") continue;
        prevoutIds.push(input.txid);
      }
    }
    const prevoutById = await this.getTransactions(prevoutIds);

    const transactions: HistoryTx[] = [];
    for (const txid of order) {
      const tx = decodedById.get(txid);
      if (!tx) continue;
      transactions.push(
        this.shapeHistoryTx(tx, heightByTxid.get(txid) ?? 0, owned, tipHeight, prevoutById),
      );
    }

    transactions.sort(ElectrumClient.sortHistory);
    if (transactions.length > 0) {
      transactions[transactions.length - 1].isLastTransaction = true;
    }

    return {
      addresses: Array.from(owned),
      transactions,
    };
  }

  private shapeHistoryTx(
    tx: DecodedTransaction,
    historyHeight: number,
    owned: Set<string>,
    tipHeight: number,
    prevoutById: Map<string, DecodedTransaction>,
  ): HistoryTx {
    const height = historyHeight > 0 ? historyHeight : 0;
    const confirmed = height > 0;
    const blockTime = confirmed
      ? toInt(tx.blocktime ?? tx.time)
      : toInt(tx.time);
    const confirmations =
      confirmed && tipHeight > 0 && height > 0 ? tipHeight - height + 1 : 0;

    const size = tx.size;
    const weight = tx.weight;
    const vsize = tx.vsize > 0 ? tx.vsize : weight > 0 ? Math.ceil(weight / 4) : size;

    const inputs = this.buildInputs(tx, prevoutById);
    const outputs = ElectrumClient.buildOutputs(tx);

    const hasCoinbase = tx.vin.some(isCoinbaseInput);
    const allInputsResolved = inputs.every((input) => !input.error);
    let fee = 0;
    let feeRate = 0;
    if (!hasCoinbase && allInputsResolved) {
      const inputSum = inputs.reduce((acc, input) => acc + input.value, 0);
      const outputSum = outputs.reduce((acc, output) => acc + output.value, 0);
      fee = Math.max(0, inputSum - outputSum);
      feeRate = vsize > 0 ? fee / vsize : 0;
    }

    const isRBF =
      !confirmed &&
      tx.vin.some(
        (input) =>
          typeof input.sequence === "number" &&
          input.sequence < RBF_SEQUENCE_THRESHOLD,
      );

    return {
      txid: tx.txid,
      height,
      confirmed,
      blockTime,
      confirmations,
      fee,
      feeRate,
      isRBF,
      rawHex: "",
      inputs,
      outputs,
      size,
      vsize,
      balance_diff: ElectrumClient.computeBalanceDiff(inputs, outputs, owned),
      isLastTransaction: false,
    };
  }

  private buildInputs(
    tx: DecodedTransaction,
    prevoutById: Map<string, DecodedTransaction>,
  ): HistoryInput[] {
    return tx.vin.map((entry, index) => {
      const input: HistoryInput = {
        index,
        prevTxid: typeof entry.txid === "string" ? entry.txid : "",
        prevVout: typeof entry.vout === "number" ? entry.vout : 0,
        address: null,
        value: 0,
      };
      if (isCoinbaseInput(entry)) {
        input.error = "coinbase input has no funding outpoint";
        return input;
      }
      const prev = entry.txid ? prevoutById.get(entry.txid) : undefined;
      if (!prev) {
        input.error = "previous output not available";
        return input;
      }
      const prevOut =
        prev.vout.find((o) => o.n === entry.vout) ?? prev.vout[entry.vout ?? -1];
      if (!prevOut) {
        input.error = "previous output index out of range";
        return input;
      }
      input.address = outputAddress(prevOut);
      input.value = btcToSats(prevOut.value);
      return input;
    });
  }

  private static buildOutputs(tx: DecodedTransaction): HistoryOutput[] {
    return tx.vout.map((entry, index) => ({
      index: typeof entry.n === "number" ? entry.n : index,
      address: outputAddress(entry),
      value: btcToSats(entry.value),
    }));
  }

  private static computeBalanceDiff(
    inputs: HistoryInput[],
    outputs: HistoryOutput[],
    owned: Set<string>,
  ): number {
    let diff = 0;
    for (const input of inputs) {
      if (input.address && owned.has(input.address)) diff -= input.value;
    }
    for (const output of outputs) {
      if (output.address && owned.has(output.address)) diff += output.value;
    }
    return diff;
  }

  private static sortHistory(a: HistoryTx, b: HistoryTx): number {
    if (a.confirmed !== b.confirmed) return a.confirmed ? 1 : -1;
    if (a.height !== b.height) return b.height - a.height;
    return b.blockTime - a.blockTime;
  }

  private static parseHistory(raw: unknown): HistoryEntry[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => ({
        tx_hash: typeof item.tx_hash === "string" ? item.tx_hash : "",
        height: toInt(item.height),
      }))
      .filter((entry) => entry.tx_hash.length === 64);
  }

  private static parseUnspent(raw: unknown): UnspentEntry[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => ({
        tx_hash: typeof item.tx_hash === "string" ? item.tx_hash : "",
        tx_pos: toInt(item.tx_pos),
        value: toInt(item.value),
        height: toInt(item.height),
      }))
      .filter((entry) => entry.tx_hash.length === 64);
  }

  private async attempt<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      const failed = error instanceof Error ? error : new Error(String(error));
      this.teardown(failed);
      await this.connectAny(this.serverIndex + 1);
      return action();
    }
  }

  private async dispatch<T>(method: string, params: unknown[]): Promise<T> {
    return this.attempt(() => this.send<T>(method, params));
  }

  private send<T>(method: string, params: unknown[]): Promise<T> {
    const socket = this.socket;
    if (!socket || socket.destroyed) {
      return Promise.reject(new Error("Electrum socket is not connected"));
    }
    const id = this.nextId;
    this.nextId += 1;
    const payload: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) {
          reject(new Error(`Electrum request timed out: ${method}`));
        }
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });
      socket.write(`${JSON.stringify(payload)}\n`, "utf8", (err) => {
        if (err && this.pending.delete(id)) {
          clearTimeout(timer);
          reject(err);
        }
      });
    });
  }

  private sendBatch(
    items: BatchItem[],
  ): Promise<Array<{ result?: unknown; error?: string }>> {
    const socket = this.socket;
    if (!socket || socket.destroyed) {
      return Promise.reject(new Error("Electrum socket is not connected"));
    }
    const ids: number[] = [];
    const requests: JsonRpcRequest[] = items.map((item) => {
      const id = this.nextId;
      this.nextId += 1;
      ids.push(id);
      return {
        jsonrpc: "2.0",
        id,
        method: item.method,
        params: item.params,
      };
    });
    return new Promise<Array<{ result?: unknown; error?: string }>>(
      (resolve, reject) => {
        const collected = new Map<number, { result?: unknown; error?: string }>();
        let settled = false;
        const finish = (fn: () => void): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          fn();
        };
        const timer = setTimeout(() => {
          for (const id of ids) this.pending.delete(id);
          finish(() =>
            reject(new Error("Electrum batch request timed out")),
          );
        }, REQUEST_TIMEOUT_MS);
        for (const id of ids) {
          this.pending.set(id, {
            timer,
            resolve: (value: unknown) => {
              collected.set(id, { result: value });
              if (collected.size === ids.length) {
                finish(() => resolve(ids.map((rid) => collected.get(rid) ?? {})));
              }
            },
            reject: (reason: Error) => {
              collected.set(id, { error: reason.message });
              if (collected.size === ids.length) {
                finish(() => resolve(ids.map((rid) => collected.get(rid) ?? {})));
              }
            },
          });
        }
        socket.write(`${JSON.stringify(requests)}\n`, "utf8", (err) => {
          if (err) {
            for (const id of ids) this.pending.delete(id);
            finish(() => reject(err));
          }
        });
      },
    );
  }

  private async connectAny(startIndex = 0): Promise<void> {
    const total = this.servers.length;
    let lastError: Error = new Error("no Electrum servers reachable");
    for (let offset = 0; offset < total; offset += 1) {
      const index = (startIndex + offset) % total;
      const server = this.servers[index];
      try {
        await this.openSocket(server);
        this.serverIndex = index;
        this.active = server;
        await this.handshake();
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.teardown(lastError);
      }
    }
    throw lastError;
  }

  private openSocket(server: ElectrumServer): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          socket.destroy();
        } catch {
          this.socket = null;
        }
        reject(new Error(`connection to ${server.host} timed out`));
      }, CONNECT_TIMEOUT_MS);

      const socket = TcpSocket.connectTLS(
        {
          host: server.host,
          port: server.port,
          tls: true,
          tlsCheckValidity: true,
        },
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve();
        },
      );

      this.socket = socket;
      this.buffer = "";
      socket.setEncoding("utf8");
      socket.setNoDelay(true);
      socket.setTimeout(IDLE_TIMEOUT_MS);

      socket.on("data", (chunk: string | { toString(): string }) => {
        this.onData(typeof chunk === "string" ? chunk : chunk.toString());
      });
      socket.on("error", (err: Error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        } else {
          this.teardown(err);
        }
      });
      socket.on("close", () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error(`connection to ${server.host} closed`));
        } else {
          this.teardown(new Error("connection closed"));
        }
      });
      socket.on("timeout", () => {
        this.teardown(new Error("Electrum socket idle timeout"));
      });
    });
  }

  private async handshake(): Promise<void> {
    const result = await this.send<unknown>("server.version", [
      CLIENT_NAME,
      [PROTOCOL_MIN, PROTOCOL_MAX],
    ]);
    if (Array.isArray(result) && typeof result[1] === "string") {
      this.negotiatedVersion = result[1];
    } else if (typeof result === "string") {
      this.negotiatedVersion = result;
    }
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let newlineIndex = this.buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (line.length > 0) {
        this.handleLine(line);
      }
      newlineIndex = this.buffer.indexOf("\n");
    }
  }

  private handleLine(line: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return;
    }
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        this.resolveResponse(entry as JsonRpcResponse);
      }
      return;
    }
    this.resolveResponse(parsed as JsonRpcResponse);
  }

  private resolveResponse(message: JsonRpcResponse): void {
    if (!message || typeof message.id !== "number") return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) {
      pending.reject(new Error(errorMessage(message.error)));
      return;
    }
    pending.resolve(message.result);
  }

  private teardown(reason: Error): void {
    const socket = this.socket;
    this.socket = null;
    this.active = null;
    this.buffer = "";
    this.negotiatedVersion = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(reason);
    }
    this.pending.clear();
    if (socket) {
      try {
        socket.removeAllListeners();
        socket.destroy();
      } catch {
        this.buffer = "";
      }
    }
  }
}

export const createElectrumClient = (
  servers: readonly ElectrumServer[] = DEFAULT_SERVERS,
): ElectrumClient => new ElectrumClient(servers);
