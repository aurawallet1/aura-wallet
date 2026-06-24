import type { BlockExplorer } from '../types/index';

const DEFAULT_TX_PATH = '/tx/';
const HTTP_URL_PATTERN = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const TRAILING_SLASH_PATTERN = /\/+$/;

export const BLOCK_EXPLORERS: readonly BlockExplorer[] = [
  { key: 'mempool', name: 'mempool.space', url: 'https://mempool.space', txPath: DEFAULT_TX_PATH },
  { key: 'blockstream', name: 'Blockstream.info', url: 'https://blockstream.info', txPath: DEFAULT_TX_PATH },
] as const;

export const DEFAULT_EXPLORER_URL: string = BLOCK_EXPLORERS[0].url;

export const normalizeExplorerUrl = (url: string): string => {
  const trimmed = url.trim();
  return trimmed.replace(TRAILING_SLASH_PATTERN, '');
};

export const isValidExplorerUrl = (url: string): boolean => {
  const candidate = url.trim();
  if (candidate.length === 0) return false;
  return HTTP_URL_PATTERN.test(candidate);
};

const findExplorerByUrl = (normalizedUrl: string): BlockExplorer | undefined =>
  BLOCK_EXPLORERS.find((explorer) => normalizeExplorerUrl(explorer.url) === normalizedUrl);

const normalizeTxPath = (txPath: string): string => {
  const withLeading = txPath.startsWith('/') ? txPath : `/${txPath}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
};

export const explorerTxUrl = (explorerUrl: string, txid: string): string => {
  const base = normalizeExplorerUrl(explorerUrl);
  const matched = findExplorerByUrl(base);
  const path = normalizeTxPath(matched?.txPath ?? DEFAULT_TX_PATH);
  const id = txid.trim().replace(/^\/+/, '');
  return `${base}${path}${id}`;
};
