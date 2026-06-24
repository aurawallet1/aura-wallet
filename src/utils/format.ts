const GAP = '....';

export function truncateAddress(value: string, head = 6, tail = 8): string {
  if (typeof value !== 'string') return '';
  if (head < 0 || tail < 0) return value;
  if (value.length <= head + tail + GAP.length) return value;
  return value.slice(0, head) + GAP + value.slice(value.length - tail);
}
