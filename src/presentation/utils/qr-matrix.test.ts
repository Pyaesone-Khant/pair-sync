import { describe, it, expect } from 'vitest';
import { generateQrSpans } from './qr-matrix';

describe('generateQrSpans (Vector-sharp Pure Module Matrix)', () => {
  it('returns empty matrix on blank input value', () => {
    const res = generateQrSpans('', 200);
    expect(res.rows).toEqual([]);
    expect(res.matrixSize).toBe(0);
  });

  it('correctly constructs QR matrix and groups horizontal spans', () => {
    const url = 'pairsync://pair?deviceId=test-dev-1&publicKey=ed25519-key-1';
    const res = generateQrSpans(url, 220, 2);

    expect(res.matrixSize).toBeGreaterThan(20);
    expect(res.rows).toHaveLength(res.matrixSize);
    expect(res.moduleSize).toBeGreaterThan(0);
    expect(res.totalDimension).toBeLessThanOrEqual(220);

    // Verify row spans span the exact matrix width
    for (const row of res.rows) {
      const sum = row.reduce((acc, span) => acc + span.count, 0);
      expect(sum).toBe(res.matrixSize);
    }
  });

  it('preserves high-contrast finder patterns at corners', () => {
    const res = generateQrSpans('pairsync://test', 200, 2);
    const topRow = res.rows[0];

    // Standard QR finder pattern starts with 7 consecutive dark modules
    expect(topRow[0]).toEqual({ isDark: true, count: 7 });
  });
});
