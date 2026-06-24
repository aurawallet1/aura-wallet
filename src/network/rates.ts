import type { FiatSource, FiatUnit } from '../types/index';

const REQUEST_TIMEOUT_MS = 12_000;

const FIAT_UNITS: readonly FiatUnit[] = [
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
];

const FIAT_BY_KEY: Record<string, FiatUnit> = Object.fromEntries(FIAT_UNITS.map(unit => [unit.endPointKey, unit]));

const DEFAULT_SOURCE: FiatSource = 'Coinbase';

function normalizeCode(fiatCode: string): string {
  return (fiatCode || '').trim().toUpperCase();
}

async function requestJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function pick(obj: unknown, ...keys: string[]): unknown {
  let cursor: unknown = obj;
  for (const key of keys) {
    if (cursor == null || typeof cursor !== 'object') {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

function asPositiveNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('non-positive rate');
  }
  return parsed;
}

const sourceExtractors: Record<FiatSource, (code: string) => Promise<number>> = {
  Mempool: async code => {
    const json = await requestJson('https://mempool.space/api/v1/prices');
    return asPositiveNumber(pick(json, code));
  },
  Blockchain: async code => {
    const json = await requestJson('https://blockchain.info/ticker');
    return asPositiveNumber(pick(json, code, 'last'));
  },
  Coinbase: async code => {
    const json = await requestJson('https://api.coinbase.com/v2/exchange-rates?currency=BTC');
    return asPositiveNumber(pick(json, 'data', 'rates', code));
  },
  Binance: async code => {
    const json = await requestJson(`https://api.binance.com/api/v3/ticker/price?symbol=BTC${encodeURIComponent(code)}`);
    return asPositiveNumber(pick(json, 'price'));
  },
};

async function resolveRate(code: string): Promise<number> {
  const unit = FIAT_BY_KEY[code];
  const primary = unit ? unit.source : DEFAULT_SOURCE;
  try {
    return await sourceExtractors[primary](code);
  } catch {
    if (primary !== DEFAULT_SOURCE) {
      return sourceExtractors[DEFAULT_SOURCE](code);
    }
    return sourceExtractors.Blockchain(code);
  }
}

export async function fetchBtcRate(fiatCode: string): Promise<number> {
  const code = normalizeCode(fiatCode);
  if (!code) {
    return 0;
  }
  try {
    return await resolveRate(code);
  } catch {
    return 0;
  }
}
