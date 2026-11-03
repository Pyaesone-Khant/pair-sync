import { describe, it, expect } from 'vitest';
import { CiphertextEnvelope } from './ciphertext-envelope';

describe('CiphertextEnvelope (ADR 0004)', () => {
  const validPayload = {
    id: 'env-1',
    senderDeviceId: 'device-alice',
    recipientDeviceId: 'device-bob',
    iv: 'aXYxMjM0NTY3ODkwMTI=',
    ciphertext: 'Y2lwaGVydGV4dERhdGE=',
    sequenceNumber: 0,
    ratchetPublicKey: 'cmF0Y2hldEtleTEyMw==',
    timestamp: 1710000000000,
  };

  it('instantiates a valid CiphertextEnvelope with cryptographic parameters', () => {
    const envelope = new CiphertextEnvelope(validPayload);

    expect(envelope.id).toBe('env-1');
    expect(envelope.senderDeviceId).toBe('device-alice');
    expect(envelope.recipientDeviceId).toBe('device-bob');
    expect(envelope.sequenceNumber).toBe(0);
    expect(envelope.ciphertext).toBe('Y2lwaGVydGV4dERhdGE=');
  });

  it('rejects envelope creation with empty ciphertext', () => {
    expect(() => {
      new CiphertextEnvelope({
        ...validPayload,
        ciphertext: '   ',
      });
    }).toThrow('Ciphertext cannot be empty');
  });

  it('rejects envelope creation with empty initialization vector (IV)', () => {
    expect(() => {
      new CiphertextEnvelope({
        ...validPayload,
        iv: '',
      });
    }).toThrow('Initialization vector (IV) cannot be empty');
  });

  it('rejects negative sequence numbers', () => {
    expect(() => {
      new CiphertextEnvelope({
        ...validPayload,
        sequenceNumber: -1,
      });
    }).toThrow('Sequence number must be non-negative');
  });

  it('serializes and deserializes accurately to JSON wire format', () => {
    const envelope = new CiphertextEnvelope(validPayload);
    const jsonString = envelope.serialize();
    const restored = CiphertextEnvelope.deserialize(jsonString);

    expect(restored.id).toBe(envelope.id);
    expect(restored.ciphertext).toBe(envelope.ciphertext);
    expect(restored.sequenceNumber).toBe(envelope.sequenceNumber);
  });
});
