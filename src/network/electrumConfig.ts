/**
 * Electrum server selection.
 *
 * Pure (no native imports) so it can be unit-tested under node. The node-connection
 * settings screen persists the user's own server under ELECTRUM_CONFIG_KEY; this
 * resolves which servers the client actually dials — the user's own node when one
 * is saved, otherwise the public defaults. (Previously the saved server was written
 * but never read, so "use your own server" silently did nothing.)
 */

export interface ElectrumServer {
  host: string;
  port: number;
  ssl?: boolean;
}

export const ELECTRUM_CONFIG_KEY = 'walletapp.electrumServer';

export const DEFAULT_SERVERS: readonly ElectrumServer[] = [
  { host: 'electrum.blockstream.info', port: 50002 },
  { host: 'fulcrum.sethforprivacy.com', port: 50002 },
  { host: 'bitcoin.aranguren.org', port: 50002 },
  { host: 'electrum.bitaroo.net', port: 50002 },
];

/**
 * Map the persisted node-connection config to the server list to dial.
 * When the user has saved a valid own server it is used exclusively (so a private
 * node actually takes effect); otherwise the public defaults are returned.
 * A non-SSL toggle yields a plain-TCP server (for local / .onion nodes).
 */
export const serversFromConfig = (raw: string | null): readonly ElectrumServer[] => {
  if (!raw) {
    return DEFAULT_SERVERS;
  }
  let parsed: { savedHost?: unknown; savedPort?: unknown; ssl?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_SERVERS;
  }
  const host = typeof parsed?.savedHost === 'string' ? parsed.savedHost.trim() : '';
  const port = Number(parsed?.savedPort);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    return DEFAULT_SERVERS;
  }
  return [{ host, port, ssl: parsed?.ssl !== false }];
};
