/**
 * Aura notifications relay client.
 *
 * Talks to the opt-in notifications relay (default https://alerts.aura.app) over a
 * small REST contract. None of this runs unless the user switches notifications on
 * in Settings → Alerts. The relay never receives seeds, private keys, or balances —
 * only the device push token, watch-only addresses, and the events to watch.
 *
 * Contract (v1):
 *   POST   {relay}/v1/subscriptions          body: SubscriptionPayload  (upsert for this device)
 *   POST   {relay}/v1/test                    body: { deviceToken, platform }
 *   DELETE {relay}/v1/subscriptions/{token}   remove everything held for this device
 */

export type PushPlatform = 'ios' | 'android';

export interface AlertEvents {
  incoming: boolean;
  confirmations: boolean;
}

export interface SubscriptionWallet {
  id: string;
  label: string;
  addresses: string[];
}

export interface SubscriptionPayload {
  deviceToken: string;
  platform: PushPlatform;
  events: AlertEvents;
  wallets: SubscriptionWallet[];
}

const REQUEST_TIMEOUT_MS = 12_000;
const API_PREFIX = '/v1';

export function normalizeRelay(relay: string): string {
  return relay.trim().replace(/\/+$/, '');
}

async function relayRequest(relay: string, suffix: string, init: RequestInit): Promise<void> {
  const base = normalizeRelay(relay);
  if (!base) {
    throw new Error('missing relay endpoint');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}${API_PREFIX}${suffix}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`relay HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

/** Upsert the full subscription (token + events + watched wallets) for this device. */
export async function registerSubscription(relay: string, payload: SubscriptionPayload): Promise<void> {
  await relayRequest(relay, '/subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Ask the relay to push a test notification back to this device. */
export async function sendTestPing(relay: string, deviceToken: string, platform: PushPlatform): Promise<void> {
  await relayRequest(relay, '/test', {
    method: 'POST',
    body: JSON.stringify({ deviceToken, platform }),
  });
}

/** Wipe everything the relay holds for this device (notifications switched off). */
export async function purgeSubscription(relay: string, deviceToken: string): Promise<void> {
  await relayRequest(relay, `/subscriptions/${encodeURIComponent(deviceToken)}`, {
    method: 'DELETE',
  });
}

const PRIVATE_HOST =
  /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i;

/**
 * Validate a user-entered relay endpoint before the device push token and wallet
 * address list are sent to it. Requires HTTPS and rejects cleartext, loopback,
 * link-local and RFC1918 hosts so the data can't be exfiltrated to an internal
 * or attacker-controlled endpoint.
 */
export const isAcceptableRelay = (value: string): boolean => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return false;
  }
  if (/^http:\/\//i.test(trimmed)) {
    return false;
  }
  const withScheme = /^https:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'https:') {
      return false;
    }
    const host = url.hostname.toLowerCase();
    if (host.includes(':') || !host.includes('.') || host.length <= 3) {
      return false;
    }
    if (host.endsWith('.local') || PRIVATE_HOST.test(host)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};
