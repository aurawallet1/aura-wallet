export const SATS_PER_BTC = 100_000_000;

export const HARDENED = 0x80000000;

export const GAP_LIMIT = 20;

export type ScriptScheme = {
  purpose: 44 | 49 | 84;
  name: "Legacy" | "SegWit" | "Native SegWit";
};

export const SCRIPT_SCHEMES: readonly ScriptScheme[] = [
  { purpose: 44, name: "Legacy" },
  { purpose: 49, name: "SegWit" },
  { purpose: 84, name: "Native SegWit" },
] as const;
