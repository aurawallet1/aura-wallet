/**
 * BIP21 payment-URI parsing for scanned / pasted recipients.
 *
 * Accepts a bare address or a `bitcoin:` URI and pulls out the address, the optional
 * amount (BTC) and a label. Without this, scanning a standard `bitcoin:bc1q…?amount=…`
 * QR would drop the whole URI into the address field verbatim.
 */

export interface ParsedPayment {
  address: string;
  amountBtc?: string;
  label?: string;
}

const decodeParam = (value: string): string => {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
};

const parseQuery = (query: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) {
      continue;
    }
    const eq = pair.indexOf('=');
    const key = (eq >= 0 ? pair.slice(0, eq) : pair).toLowerCase();
    const value = eq >= 0 ? pair.slice(eq + 1) : '';
    if (key && !(key in out)) {
      out[key] = decodeParam(value);
    }
  }
  return out;
};

export const parsePaymentUri = (raw: string): ParsedPayment => {
  const trimmed = (raw ?? '').trim();
  const withoutScheme = trimmed.replace(/^bitcoin:/i, '');
  const queryIndex = withoutScheme.indexOf('?');
  let address = (queryIndex >= 0 ? withoutScheme.slice(0, queryIndex) : withoutScheme).trim();
  // Bech32 (bc1…, often uppercase in QR codes) → canonical lowercase. Base58
  // addresses (starting 1.. / 3..) are case-sensitive and must be left untouched.
  if (/^(bc1|tb1|bcrt1)/i.test(address)) {
    address = address.toLowerCase();
  }
  const result: ParsedPayment = { address };
  if (queryIndex >= 0) {
    const params = parseQuery(withoutScheme.slice(queryIndex + 1));
    const amount = params.amount;
    if (amount && amount.length <= 32 && /^(\d+(\.\d+)?|\.\d+)$/.test(amount) && Number(amount) > 0) {
      result.amountBtc = amount;
    }
    const label = params.label || params.message;
    if (label) {
      result.label = label;
    }
  }
  return result;
};
