// lib/formatMonthLabel.ts

/**
 * Converts ISO dates like "2025-11-01" → "November 2025"
 * If already in "November 2025" or any non-ISO label, returns unchanged.
 */

export function formatMonthLabel(label: string): string {
  if (!label) return label;

  // Detect ISO (YYYY-MM-DD)
  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (isoRegex.test(label)) {
    const d = new Date(label);

    // Guard: invalid date → return original
    if (isNaN(d.getTime())) return label;

    return d.toLocaleString('en-GB', {
      month: 'long',
      year: 'numeric',
    });
  }

  // Already formatted or custom → return as-is
  return label;
}
