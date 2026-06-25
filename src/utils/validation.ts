import { validateMnemonic } from '@scure/bip39';
import { wordlist as wordlistEnglish } from '@scure/bip39/wordlists/english.js';
import { wordlist as wordlistFrench } from '@scure/bip39/wordlists/french.js';
import { wordlist as wordlistSpanish } from '@scure/bip39/wordlists/spanish.js';
import { wordlist as wordlistItalian } from '@scure/bip39/wordlists/italian.js';
import { wordlist as wordlistJapanese } from '@scure/bip39/wordlists/japanese.js';
import { wordlist as wordlistKorean } from '@scure/bip39/wordlists/korean.js';
import { wordlist as wordlistChineseSimplified } from '@scure/bip39/wordlists/simplified-chinese.js';
import { wordlist as wordlistChineseTraditional } from '@scure/bip39/wordlists/traditional-chinese.js';
import { wordlist as wordlistCzech } from '@scure/bip39/wordlists/czech.js';
import { wordlist as wordlistPortuguese } from '@scure/bip39/wordlists/portuguese.js';
import { base58check, bech32, bech32m } from '@scure/base';
import { sha256 } from '@noble/hashes/sha2.js';
import type { DecodedBech32Address } from '../types/index';

const MAINNET_HRP = 'bc';

const WIF_VERSION_BYTE = 0x80;
const WIF_COMPRESSION_FLAG = 0x01;
const WIF_UNCOMPRESSED_LENGTH = 33;
const WIF_COMPRESSED_LENGTH = 34;

const P2PKH_VERSION_BYTE = 0x00;
const P2SH_VERSION_BYTE = 0x05;
const BASE58_PAYLOAD_LENGTH = 21;

const WITNESS_V0_PROGRAM_LENGTHS = new Set<number>([20, 32]);
const WITNESS_V1_PROGRAM_LENGTH = 32;
const BECH32_DECODE_LIMIT = 90;

const SUPPORTED_WORDLISTS: ReadonlyArray<readonly string[]> = [
  wordlistEnglish,
  wordlistFrench,
  wordlistSpanish,
  wordlistItalian,
  wordlistJapanese,
  wordlistKorean,
  wordlistChineseSimplified,
  wordlistChineseTraditional,
  wordlistCzech,
  wordlistPortuguese,
];

const base58checkCodec = base58check(sha256);

export function isValidMnemonic(mnemonic: string): boolean {
  const normalized = (mnemonic ?? '').trim();
  if (!normalized) return false;
  for (const list of SUPPORTED_WORDLISTS) {
    try {
      if (validateMnemonic(normalized, list as string[])) return true;
    } catch {
      continue;
    }
  }
  return false;
}

export function isMainnetWif(text: string): boolean {
  const candidate = (text ?? '').trim();
  if (!candidate) return false;
  try {
    const decoded = base58checkCodec.decode(candidate);
    if (decoded[0] !== WIF_VERSION_BYTE) return false;
    // Only compressed WIFs are accepted: derivation always uses the compressed
    // pubkey, so an uncompressed key would resolve to different addresses than the
    // ones holding its funds. Rejecting avoids silently importing to the wrong set.
    if (decoded.length === WIF_COMPRESSED_LENGTH) {
      return decoded[WIF_UNCOMPRESSED_LENGTH] === WIF_COMPRESSION_FLAG;
    }
    return false;
  } catch {
    return false;
  }
}

function decodeWitnessAddress(address: string): DecodedBech32Address | null {
  const variants: ReadonlyArray<readonly [typeof bech32, boolean]> = [
    [bech32, false],
    [bech32m, true],
  ];
  for (const [codec, isModern] of variants) {
    try {
      const decoded = codec.decode(address as `${string}1${string}`, BECH32_DECODE_LIMIT);
      if (decoded.prefix !== MAINNET_HRP) continue;
      const version = decoded.words[0];
      const program = Uint8Array.from(bech32.fromWords(decoded.words.slice(1)));
      if (version === 0 && isModern) continue;
      if (version >= 1 && !isModern) continue;
      return { version, program };
    } catch {
      continue;
    }
  }
  return null;
}

export function isValidBitcoinAddress(address: string): boolean {
  const candidate = (address ?? '').trim();
  if (!candidate) return false;

  if (candidate.toLowerCase().startsWith(`${MAINNET_HRP}1`)) {
    const witness = decodeWitnessAddress(candidate);
    if (!witness) return false;
    if (witness.version === 0) return WITNESS_V0_PROGRAM_LENGTHS.has(witness.program.length);
    if (witness.version === 1) return witness.program.length === WITNESS_V1_PROGRAM_LENGTH;
    return false;
  }

  try {
    const decoded = base58checkCodec.decode(candidate);
    if (decoded.length !== BASE58_PAYLOAD_LENGTH) return false;
    return decoded[0] === P2PKH_VERSION_BYTE || decoded[0] === P2SH_VERSION_BYTE;
  } catch {
    return false;
  }
}
