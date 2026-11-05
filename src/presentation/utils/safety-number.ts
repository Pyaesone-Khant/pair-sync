/**
 * Computes a deterministic 4-group numeric safety fingerprint (Signal-style).
 * Each group is guaranteed to be a strictly positive 4-digit number (1000..9999).
 * Avoids JavaScript signed-shift operator bugs (>> vs >>>) that previously produced negative numbers.
 * Strictly adheres to ADR 0006 and CONTEXT.md.
 */
export function computeSafetyNumber(keyOrCombined: string): string {
  if (!keyOrCombined) return '0000 • 0000 • 0000 • 0000';
  let hash = 0;
  for (let i = 0; i < keyOrCombined.length; i++) {
    hash = (hash * 31 + keyOrCombined.charCodeAt(i)) >>> 0;
  }
  const d1 = String(1000 + ((hash >>> 0) % 9000)).padStart(4, '0');
  const d2 = String(1000 + ((hash >>> 4) % 9000)).padStart(4, '0');
  const d3 = String(1000 + ((hash >>> 8) % 9000)).padStart(4, '0');
  const d4 = String(1000 + ((hash >>> 12) % 9000)).padStart(4, '0');
  return `${d1} • ${d2} • ${d3} • ${d4}`;
}
