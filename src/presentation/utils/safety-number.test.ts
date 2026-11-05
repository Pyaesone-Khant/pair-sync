import { describe, it, expect } from 'vitest';
import { computeSafetyNumber } from './safety-number';

describe('computeSafetyNumber (ADR 0006 Zero-Knowledge Verification)', () => {
  it('returns default placeholder when input is empty', () => {
    expect(computeSafetyNumber('')).toBe('0000 • 0000 • 0000 • 0000');
  });

  it('produces four 4-digit numeric chunks separated by bullet points', () => {
    const result = computeSafetyNumber('test-public-key-curve25519-abc');
    expect(result).toMatch(/^\d{4} • \d{4} • \d{4} • \d{4}$/);
  });

  it('NEVER produces negative numbers or minus signs (reproducing and guarding against signed-shift bug)', () => {
    // Generate thousands of synthetic keys to ensure no high-bit signed shift regression
    for (let i = 0; i < 2000; i++) {
      const syntheticKey = `device-key-${i}-${Math.random().toString(36).substring(2)}`;
      const safetyNumber = computeSafetyNumber(syntheticKey);

      expect(safetyNumber).not.toContain('-');
      const chunks = safetyNumber.split(' • ');
      expect(chunks).toHaveLength(4);
      for (const chunk of chunks) {
        const val = parseInt(chunk, 10);
        expect(val).toBeGreaterThanOrEqual(1000);
        expect(val).toBeLessThanOrEqual(9999);
      }
    }
  });

  it('is deterministic: same key always yields the identical safety number', () => {
    const key = 'ed25519-public-key-for-pairing-ceremony-123';
    const num1 = computeSafetyNumber(key);
    const num2 = computeSafetyNumber(key);
    expect(num1).toBe(num2);
  });

  it('is order-independent when combined keys are sorted (symmetrical for both peers)', () => {
    const keyA = 'key-alice-777';
    const keyB = 'key-bob-888';
    const combined1 = [keyA, keyB].sort().join(':');
    const combined2 = [keyB, keyA].sort().join(':');
    expect(computeSafetyNumber(combined1)).toBe(computeSafetyNumber(combined2));
  });
});
