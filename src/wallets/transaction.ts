import { base58check, bech32, bech32m } from '@scure/base';
import { sha256 } from '@noble/hashes/sha2.js';
import loc from '../i18n';
import { SATS_PER_BTC } from '../constants/bitcoin';
import { fetchRecommendedFees, type RecommendedFees } from '../network/mempool';
import type { ScriptType } from '../types/index';

export const DUST_THRESHOLD_SATS = 546;

const MAINNET_HRP = 'bc';

const P2PKH_VERSION_BYTE = 0x00;
const P2SH_VERSION_BYTE = 0x05;
const BASE58_PAYLOAD_LENGTH = 21;

const WITNESS_V0_KEYHASH_LENGTH = 20;
const WITNESS_V0_SCRIPTHASH_LENGTH = 32;
const WITNESS_V1_PROGRAM_LENGTH = 32;
const BECH32_DECODE_LIMIT = 90;

const OP_DUP = 0x76;
const OP_HASH160 = 0xa9;
const OP_EQUAL = 0x87;
const OP_EQUALVERIFY = 0x88;
const OP_CHECKSIG = 0xac;
const PUSH_20 = 0x14;
const PUSH_32 = 0x20;

const TX_VERSION = 2;
const RBF_SEQUENCE = 0xfffffffd;
const FINAL_SEQUENCE = 0xffffffff;

const OVERHEAD_VBYTES = 11;
const OUTPUT_VBYTES = 34;

const INPUT_VBYTES_BY_TYPE: Record<ScriptType, number> = {
  BIP44: 148,
  BIP49: 91,
  BIP84: 68,
};

const base58Codec = base58check(sha256);

export type FeePriority = 'fast' | 'medium' | 'slow' | 'economy';

export interface SpendableInput {
  txid: string;
  vout: number;
  value: number;
  address: string;
  scriptType: ScriptType;
  derivationPath?: string;
}

export interface TransactionRecipient {
  address: string;
  value: number;
}

export interface UnsignedInput {
  txid: string;
  vout: number;
  value: number;
  scriptType: ScriptType;
  scriptPubKey: Uint8Array;
  sequence: number;
  derivationPath?: string;
}

export interface UnsignedOutput {
  address: string;
  value: number;
  scriptPubKey: Uint8Array;
  isChange: boolean;
}

export interface UnsignedTransaction {
  version: number;
  locktime: number;
  inputs: UnsignedInput[];
  outputs: UnsignedOutput[];
}

export interface BuildTransactionParams {
  spendable: SpendableInput[];
  recipients: TransactionRecipient[];
  feeRateSatPerVByte: number;
  changeAddress: string;
  changeScriptType: ScriptType;
  sendMax?: boolean;
  enableRbf?: boolean;
  locktime?: number;
}

export interface BuildTransactionResult {
  unsigned: UnsignedTransaction;
  selectedInputs: UnsignedInput[];
  inputTotal: number;
  recipientTotal: number;
  changeValue: number;
  feeSats: number;
  estimatedVBytes: number;
  feeRateSatPerVByte: number;
}

const fail = (message: string): never => {
  throw new Error(message);
};

const isPositiveInteger = (value: number): boolean =>
  Number.isFinite(value) && Number.isInteger(value) && value > 0;

const concat = (...chunks: Uint8Array[]): Uint8Array => {
  let length = 0;
  for (const chunk of chunks) length += chunk.length;
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
};

const decodeWitnessProgram = (
  address: string,
): { version: number; program: Uint8Array } | null => {
  const codecs: ReadonlyArray<readonly [typeof bech32, boolean]> = [
    [bech32, false],
    [bech32m, true],
  ];
  for (const [codec, modern] of codecs) {
    try {
      const decoded = codec.decode(address as `${string}1${string}`, BECH32_DECODE_LIMIT);
      if (decoded.prefix !== MAINNET_HRP) continue;
      const version = decoded.words[0];
      const program = Uint8Array.from(bech32.fromWords(decoded.words.slice(1)));
      if (version === 0 && modern) continue;
      if (version >= 1 && !modern) continue;
      return { version, program };
    } catch {
      continue;
    }
  }
  return null;
};

export const scriptPubKeyForAddress = (address: string): Uint8Array => {
  const candidate = (address ?? '').trim();
  if (!candidate) {
    return fail(loc.outflow.destinationFieldMalformed);
  }

  if (candidate.toLowerCase().startsWith(`${MAINNET_HRP}1`)) {
    const witness = decodeWitnessProgram(candidate);
    if (!witness) {
      return fail(loc.outflow.destinationFieldMalformed);
    }
    const { version, program } = witness;
    if (version === 0) {
      if (
        program.length !== WITNESS_V0_KEYHASH_LENGTH &&
        program.length !== WITNESS_V0_SCRIPTHASH_LENGTH
      ) {
        return fail(loc.outflow.destinationFieldMalformed);
      }
    } else if (version === 1) {
      if (program.length !== WITNESS_V1_PROGRAM_LENGTH) {
        return fail(loc.outflow.destinationFieldMalformed);
      }
    } else {
      return fail(loc.outflow.destinationFieldMalformed);
    }
    const opcode = version === 0 ? 0x00 : 0x50 + version;
    return concat(Uint8Array.of(opcode, program.length), program);
  }

  let decoded: Uint8Array;
  try {
    decoded = base58Codec.decode(candidate);
  } catch {
    return fail(loc.outflow.destinationFieldMalformed);
  }
  if (decoded.length !== BASE58_PAYLOAD_LENGTH) {
    return fail(loc.outflow.destinationFieldMalformed);
  }
  const versionByte = decoded[0];
  const payload = decoded.slice(1);
  if (versionByte === P2PKH_VERSION_BYTE) {
    return concat(
      Uint8Array.of(OP_DUP, OP_HASH160, PUSH_20),
      payload,
      Uint8Array.of(OP_EQUALVERIFY, OP_CHECKSIG),
    );
  }
  if (versionByte === P2SH_VERSION_BYTE) {
    return concat(Uint8Array.of(OP_HASH160, PUSH_20), payload, Uint8Array.of(OP_EQUAL));
  }
  return fail(loc.outflow.destinationFieldMalformed);
};

const dustThresholdForScript = (scriptPubKey: Uint8Array): number => {
  if (
    scriptPubKey.length === 22 &&
    scriptPubKey[0] === 0x00 &&
    scriptPubKey[1] === PUSH_20
  ) {
    return 294;
  }
  if (
    scriptPubKey.length === 34 &&
    scriptPubKey[0] === 0x00 &&
    scriptPubKey[1] === PUSH_32
  ) {
    return 330;
  }
  return DUST_THRESHOLD_SATS;
};

const estimateVBytes = (inputs: SpendableInput[], outputCount: number): number => {
  let total = OVERHEAD_VBYTES + outputCount * OUTPUT_VBYTES;
  for (const input of inputs) {
    total += INPUT_VBYTES_BY_TYPE[input.scriptType];
  }
  return Math.ceil(total);
};

const sumValues = <T extends { value: number }>(items: T[]): number =>
  items.reduce((total, item) => total + item.value, 0);

const sortBySizeDescending = (inputs: SpendableInput[]): SpendableInput[] =>
  [...inputs].sort((a, b) => b.value - a.value);

const validateRecipients = (recipients: TransactionRecipient[]): void => {
  if (recipients.length === 0) {
    fail(loc.outflow.minOnePayeeNeeded);
  }
  for (const recipient of recipients) {
    if (!recipient.address || !recipient.address.trim()) {
      fail(loc.outflow.payeeDestinationMissing);
    }
    if (!isPositiveInteger(recipient.value)) {
      fail(loc.outflow.malformedValue);
    }
  }
};

const buildOutputs = (
  recipients: TransactionRecipient[],
): UnsignedOutput[] =>
  recipients.map(recipient => {
    const address = recipient.address.trim();
    const scriptPubKey = scriptPubKeyForAddress(address);
    if (recipient.value < dustThresholdForScript(scriptPubKey)) {
      fail(loc.outflow.belowDustThreshold);
    }
    return {
      address,
      value: recipient.value,
      scriptPubKey,
      isChange: false,
    };
  });

const toUnsignedInput = (input: SpendableInput, sequence: number): UnsignedInput => ({
  txid: input.txid,
  vout: input.vout,
  value: input.value,
  scriptType: input.scriptType,
  scriptPubKey: scriptPubKeyForAddress(input.address),
  sequence,
  derivationPath: input.derivationPath,
});

const selectForExactSpend = (
  candidates: SpendableInput[],
  recipientTotal: number,
  feeRate: number,
  outputCountWithoutChange: number,
  changeDustThreshold: number,
): { chosen: SpendableInput[]; feeSats: number; vbytes: number; withChange: boolean } => {
  const chosen: SpendableInput[] = [];
  for (const candidate of candidates) {
    chosen.push(candidate);
    const inputTotal = sumValues(chosen);

    const vbytesNoChange = estimateVBytes(chosen, outputCountWithoutChange);
    const feeNoChange = Math.ceil(vbytesNoChange * feeRate);
    if (inputTotal < recipientTotal + feeNoChange) {
      continue;
    }

    const vbytesWithChange = estimateVBytes(chosen, outputCountWithoutChange + 1);
    const feeWithChange = Math.ceil(vbytesWithChange * feeRate);
    const change = inputTotal - recipientTotal - feeWithChange;

    if (change >= changeDustThreshold) {
      return { chosen: [...chosen], feeSats: feeWithChange, vbytes: vbytesWithChange, withChange: true };
    }
    return { chosen: [...chosen], feeSats: feeNoChange, vbytes: vbytesNoChange, withChange: false };
  }
  return fail(loc.outflow.fundsShortReduceAmount);
};

export const buildTransaction = (params: BuildTransactionParams): BuildTransactionResult => {
  const {
    spendable,
    recipients,
    feeRateSatPerVByte,
    changeAddress,
    changeScriptType,
    sendMax = false,
    enableRbf = true,
    locktime = 0,
  } = params;

  if (!spendable || spendable.length === 0) {
    fail(loc.outflow.nothingSpendable);
  }
  if (!(feeRateSatPerVByte > 0) || !Number.isFinite(feeRateSatPerVByte)) {
    fail(loc.outflow.malformedMinerCost);
  }
  validateRecipients(recipients);

  const sequence = enableRbf ? RBF_SEQUENCE : FINAL_SEQUENCE;
  const availableTotal = sumValues(spendable);

  if (sendMax) {
    if (recipients.length !== 1) {
      fail(loc.outflow.payeeValuePairingOff);
    }
    const allInputs = spendable.map(input => toUnsignedInput(input, sequence));
    const recipientScript = scriptPubKeyForAddress(recipients[0].address.trim());
    const vbytes = estimateVBytes(spendable, 1);
    const feeSats = Math.ceil(vbytes * feeRateSatPerVByte);
    const sendValue = availableTotal - feeSats;
    if (sendValue < dustThresholdForScript(recipientScript)) {
      fail(loc.outflow.belowDustThreshold);
    }
    const outputs: UnsignedOutput[] = [
      {
        address: recipients[0].address.trim(),
        value: sendValue,
        scriptPubKey: recipientScript,
        isChange: false,
      },
    ];
    const unsigned: UnsignedTransaction = {
      version: TX_VERSION,
      locktime,
      inputs: allInputs,
      outputs,
    };
    return {
      unsigned,
      selectedInputs: allInputs,
      inputTotal: availableTotal,
      recipientTotal: sendValue,
      changeValue: 0,
      feeSats,
      estimatedVBytes: vbytes,
      feeRateSatPerVByte,
    };
  }

  const recipientTotal = sumValues(recipients);
  if (recipientTotal <= 0) {
    fail(loc.outflow.malformedValue);
  }
  if (recipientTotal > availableTotal) {
    fail(loc.outflow.overWalletHoldings);
  }

  const recipientOutputs = buildOutputs(recipients);
  const candidates = sortBySizeDescending(spendable);

  const trimmedChange = (changeAddress ?? '').trim();
  if (!trimmedChange) {
    fail(loc.outflow.returnDestinationMissing);
  }
  const changeScript = scriptPubKeyForAddress(trimmedChange);
  const changeDustThreshold = dustThresholdForScript(changeScript);

  const selection = selectForExactSpend(
    candidates,
    recipientTotal,
    feeRateSatPerVByte,
    recipientOutputs.length,
    changeDustThreshold,
  );

  if (selection.feeSats >= recipientTotal) {
    fail(loc.outflow.minerCostBeatsValue);
  }

  const selectedInputs = selection.chosen.map(input => toUnsignedInput(input, sequence));
  const inputTotal = sumValues(selection.chosen);
  const outputs = [...recipientOutputs];
  let changeValue = 0;

  if (selection.withChange) {
    changeValue = inputTotal - recipientTotal - selection.feeSats;
    if (changeValue >= changeDustThreshold) {
      outputs.push({
        address: trimmedChange,
        value: changeValue,
        scriptPubKey: changeScript,
        isChange: true,
      });
    } else {
      changeValue = 0;
    }
  }

  void changeScriptType;

  const unsigned: UnsignedTransaction = {
    version: TX_VERSION,
    locktime,
    inputs: selectedInputs,
    outputs,
  };

  return {
    unsigned,
    selectedInputs,
    inputTotal,
    recipientTotal,
    changeValue,
    feeSats: selection.feeSats,
    estimatedVBytes: selection.vbytes,
    feeRateSatPerVByte,
  };
};

const FEE_RATE_BY_PRIORITY: Record<FeePriority, keyof RecommendedFees> = {
  fast: 'fastestFee',
  medium: 'halfHourFee',
  slow: 'hourFee',
  economy: 'economyFee',
};

export const resolveFeeRate = (
  fees: RecommendedFees,
  priority: FeePriority,
): number => {
  const rate = fees[FEE_RATE_BY_PRIORITY[priority]];
  return rate > 0 ? rate : fees.minimumFee;
};

export const buildTransactionAtPriority = async (
  params: Omit<BuildTransactionParams, 'feeRateSatPerVByte'>,
  priority: FeePriority = 'medium',
): Promise<BuildTransactionResult> => {
  let fees: RecommendedFees;
  try {
    fees = await fetchRecommendedFees();
  } catch (error) {
    const reason = error instanceof Error ? error.message : '';
    throw new Error(loc.formatString(loc.nodeConn.requestStatusFault, { status: reason }) as string);
  }
  return buildTransaction({ ...params, feeRateSatPerVByte: resolveFeeRate(fees, priority) });
};

export const formatBtcFromSats = (sats: number): string =>
  (sats / SATS_PER_BTC).toFixed(8);
