type Shares = {
  electricity: number;
  fuel: number;
  refrigerant: number;
};

/**
 * Forces percentages to sum to exactly 100.0
 * Option B:
 * - Round all but largest slice
 * - Largest = 100 − sum(others)
 */
export function normaliseSharesTo100(raw: Shares): Shares {
  const entries = Object.entries(raw) as [keyof Shares, number][];

  // Sort descending by raw value
  entries.sort((a, b) => b[1] - a[1]);

  const [largestKey, largestVal] = entries[0];
  const others = entries.slice(1);

  const roundedOthers = others.map(([k, v]) => [
    k,
    Math.round(v * 10) / 10,
  ]) as [keyof Shares, number][];

  const sumOthers = roundedOthers.reduce((s, [, v]) => s + v, 0);

  const fixedLargest =
    Math.round((100 - sumOthers) * 10) / 10;

  const result: Shares = {
    electricity: 0,
    fuel: 0,
    refrigerant: 0,
  };

  result[largestKey] = fixedLargest;

  for (const [k, v] of roundedOthers) {
    result[k] = v;
  }

  return result;
}
