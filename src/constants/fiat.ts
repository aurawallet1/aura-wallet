import type { FiatSource, FiatUnit } from '../types/index';

export type { FiatUnit, FiatSource } from '../types/index';

export const FIAT_UNITS: readonly FiatUnit[] = [
  { endPointKey: 'USD', symbol: '$', locale: 'en-US', country: 'United States', source: 'Mempool' },
  { endPointKey: 'EUR', symbol: '€', locale: 'de-DE', country: 'Germany', source: 'Mempool' },
  { endPointKey: 'GBP', symbol: '£', locale: 'en-GB', country: 'United Kingdom', source: 'Mempool' },
  { endPointKey: 'JPY', symbol: '¥', locale: 'ja-JP', country: 'Japan', source: 'Mempool' },
  { endPointKey: 'CHF', symbol: 'CHF', locale: 'de-CH', country: 'Switzerland', source: 'Mempool' },
  { endPointKey: 'CAD', symbol: '$', locale: 'en-CA', country: 'Canada', source: 'Mempool' },
  { endPointKey: 'AUD', symbol: '$', locale: 'en-AU', country: 'Australia', source: 'Mempool' },
  { endPointKey: 'NZD', symbol: '$', locale: 'en-NZ', country: 'New Zealand', source: 'Blockchain' },
  { endPointKey: 'CNY', symbol: '¥', locale: 'zh-CN', country: 'China', source: 'Blockchain' },
  { endPointKey: 'HKD', symbol: 'HK$', locale: 'zh-HK', country: 'Hong Kong', source: 'Blockchain' },
  { endPointKey: 'SGD', symbol: 'S$', locale: 'en-SG', country: 'Singapore', source: 'Blockchain' },
  { endPointKey: 'TWD', symbol: 'NT$', locale: 'zh-TW', country: 'Taiwan', source: 'Blockchain' },
  { endPointKey: 'KRW', symbol: '₩', locale: 'ko-KR', country: 'South Korea', source: 'Blockchain' },
  { endPointKey: 'INR', symbol: '₹', locale: 'en-IN', country: 'India', source: 'Blockchain' },
  { endPointKey: 'IDR', symbol: 'Rp', locale: 'id-ID', country: 'Indonesia', source: 'Coinbase' },
  { endPointKey: 'MYR', symbol: 'RM', locale: 'ms-MY', country: 'Malaysia', source: 'Coinbase' },
  { endPointKey: 'PHP', symbol: '₱', locale: 'fil-PH', country: 'Philippines', source: 'Coinbase' },
  { endPointKey: 'THB', symbol: '฿', locale: 'th-TH', country: 'Thailand', source: 'Blockchain' },
  { endPointKey: 'VND', symbol: '₫', locale: 'vi-VN', country: 'Vietnam', source: 'Coinbase' },
  { endPointKey: 'PKR', symbol: '₨', locale: 'ur-PK', country: 'Pakistan', source: 'Coinbase' },
  { endPointKey: 'BDT', symbol: '৳', locale: 'bn-BD', country: 'Bangladesh', source: 'Coinbase' },
  { endPointKey: 'LKR', symbol: 'රු.', locale: 'si-LK', country: 'Sri Lanka', source: 'Coinbase' },
  { endPointKey: 'AED', symbol: 'د.إ.', locale: 'ar-AE', country: 'United Arab Emirates', source: 'Coinbase' },
  { endPointKey: 'SAR', symbol: 'ر.س.', locale: 'ar-SA', country: 'Saudi Arabia', source: 'Coinbase' },
  { endPointKey: 'QAR', symbol: 'ر.ق.', locale: 'ar-QA', country: 'Qatar', source: 'Coinbase' },
  { endPointKey: 'KWD', symbol: 'د.ك.', locale: 'ar-KW', country: 'Kuwait', source: 'Coinbase' },
  { endPointKey: 'BHD', symbol: 'د.ب.', locale: 'ar-BH', country: 'Bahrain', source: 'Coinbase' },
  { endPointKey: 'OMR', symbol: 'ر.ع.', locale: 'ar-OM', country: 'Oman', source: 'Coinbase' },
  { endPointKey: 'JOD', symbol: 'د.ا.', locale: 'ar-JO', country: 'Jordan', source: 'Coinbase' },
  { endPointKey: 'ILS', symbol: '₪', locale: 'he-IL', country: 'Israel', source: 'Coinbase' },
  { endPointKey: 'TRY', symbol: '₺', locale: 'tr-TR', country: 'Turkey', source: 'Binance' },
  { endPointKey: 'EGP', symbol: 'ج.م.', locale: 'ar-EG', country: 'Egypt', source: 'Coinbase' },
  { endPointKey: 'ZAR', symbol: 'R', locale: 'en-ZA', country: 'South Africa', source: 'Coinbase' },
  { endPointKey: 'NGN', symbol: '₦', locale: 'en-NG', country: 'Nigeria', source: 'Coinbase' },
  { endPointKey: 'KES', symbol: 'Ksh', locale: 'sw-KE', country: 'Kenya', source: 'Coinbase' },
  { endPointKey: 'GHS', symbol: '₵', locale: 'en-GH', country: 'Ghana', source: 'Coinbase' },
  { endPointKey: 'MAD', symbol: 'د.م.', locale: 'ar-MA', country: 'Morocco', source: 'Coinbase' },
  { endPointKey: 'RUB', symbol: '₽', locale: 'ru-RU', country: 'Russia', source: 'Blockchain' },
  { endPointKey: 'UAH', symbol: '₴', locale: 'uk-UA', country: 'Ukraine', source: 'Coinbase' },
  { endPointKey: 'PLN', symbol: 'zł', locale: 'pl-PL', country: 'Poland', source: 'Blockchain' },
  { endPointKey: 'CZK', symbol: 'Kč', locale: 'cs-CZ', country: 'Czechia', source: 'Coinbase' },
  { endPointKey: 'HUF', symbol: 'Ft', locale: 'hu-HU', country: 'Hungary', source: 'Coinbase' },
  { endPointKey: 'RON', symbol: 'lei', locale: 'ro-RO', country: 'Romania', source: 'Coinbase' },
  { endPointKey: 'SEK', symbol: 'kr', locale: 'sv-SE', country: 'Sweden', source: 'Blockchain' },
  { endPointKey: 'NOK', symbol: 'kr', locale: 'nb-NO', country: 'Norway', source: 'Coinbase' },
  { endPointKey: 'DKK', symbol: 'kr', locale: 'da-DK', country: 'Denmark', source: 'Blockchain' },
  { endPointKey: 'ISK', symbol: 'kr', locale: 'is-IS', country: 'Iceland', source: 'Blockchain' },
  { endPointKey: 'MXN', symbol: '$', locale: 'es-MX', country: 'Mexico', source: 'Coinbase' },
  { endPointKey: 'BRL', symbol: 'R$', locale: 'pt-BR', country: 'Brazil', source: 'Blockchain' },
  { endPointKey: 'ARS', symbol: '$', locale: 'es-AR', country: 'Argentina', source: 'Coinbase' },
  { endPointKey: 'CLP', symbol: '$', locale: 'es-CL', country: 'Chile', source: 'Blockchain' },
  { endPointKey: 'COP', symbol: '$', locale: 'es-CO', country: 'Colombia', source: 'Coinbase' },
  { endPointKey: 'PEN', symbol: 'S/.', locale: 'es-PE', country: 'Peru', source: 'Coinbase' },
] as const;

export const FIAT_BY_KEY: Readonly<Record<string, FiatUnit>> = Object.freeze(
  FIAT_UNITS.reduce<Record<string, FiatUnit>>((acc, unit) => {
    acc[unit.endPointKey] = unit;
    return acc;
  }, {}),
);

export const DEFAULT_FIAT: FiatUnit = FIAT_BY_KEY.USD;
