/**
 * Turns the in-memory wallets into the watch-only address lists the notifications
 * relay needs. Only addresses leave the device here — never seeds, WIFs, or balances.
 */
import type { WalletEntry } from '../wallets/context';
import type { SubscriptionWallet } from '../network/alerts';

function addAddress(out: Set<string>, value: unknown): void {
  if (value && typeof value === 'object') {
    const addr = (value as { address?: unknown }).address;
    if (typeof addr === 'string' && addr.length > 0) {
      out.add(addr);
    }
  }
}

// Both ScanResponse and WifScanResult expose result.data[scriptType] with
// receive/change branches of { used: [...], fresh? }, so one walk covers both.
function collectFromScan(out: Set<string>, scan: unknown): void {
  const data = (scan as { result?: { data?: unknown } } | null | undefined)?.result?.data;
  if (!data || typeof data !== 'object') {
    return;
  }
  for (const account of Object.values(data as Record<string, unknown>)) {
    if (!account || typeof account !== 'object') {
      continue;
    }
    const { receive, change } = account as {
      receive?: { used?: unknown[]; fresh?: unknown };
      change?: { used?: unknown[]; fresh?: unknown };
    };
    for (const branch of [receive, change]) {
      if (!branch) {
        continue;
      }
      if (Array.isArray(branch.used)) {
        branch.used.forEach(entry => addAddress(out, entry));
      }
      addAddress(out, branch.fresh);
    }
  }
}

export function walletAddresses(entry: WalletEntry): string[] {
  const out = new Set<string>();
  if (entry.receiveAddress) {
    out.add(entry.receiveAddress);
  }
  collectFromScan(out, entry.scan);
  return Array.from(out);
}

export function buildSubscriptionWallets(wallets: WalletEntry[]): SubscriptionWallet[] {
  return wallets
    .map(entry => ({ id: entry.id, label: entry.label, addresses: walletAddresses(entry) }))
    .filter(wallet => wallet.addresses.length > 0);
}
