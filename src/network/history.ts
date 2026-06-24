import type { HistoryResult } from '../types/index';
import { ElectrumClient, createElectrumClient } from './electrum';
import { fetchHistory as fetchHistoryMempool } from './mempool';

let shared: ElectrumClient | null = null;
let connecting: Promise<ElectrumClient> | null = null;

const getClient = async (): Promise<ElectrumClient> => {
  if (shared) {
    try {
      await shared.connect();
      return shared;
    } catch (error) {
      shared.close();
      shared = null;
      throw error;
    }
  }
  if (!connecting) {
    const client = createElectrumClient();
    connecting = client
      .connect()
      .then(() => {
        shared = client;
        return client;
      })
      .catch(error => {
        client.close();
        throw error;
      })
      .finally(() => {
        connecting = null;
      });
  }
  return connecting;
};

const dedupeAddresses = (addresses: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of addresses) {
    const value = (raw ?? '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
};

const fetchHistoryElectrum = async (addresses: string[]): Promise<HistoryResult> => {
  const client = await getClient();
  return client.buildHistory(addresses, { ownedAddresses: addresses });
};

export const fetchWalletHistory = async (addresses: string[]): Promise<HistoryResult> => {
  const unique = dedupeAddresses(addresses);
  if (unique.length === 0) {
    return { addresses: [], transactions: [] };
  }
  try {
    return await fetchHistoryElectrum(unique);
  } catch {
    if (shared) {
      shared.close();
      shared = null;
    }
    return fetchHistoryMempool(unique);
  }
};

export const closeHistoryClient = (): void => {
  if (shared) {
    shared.close();
    shared = null;
  }
};
