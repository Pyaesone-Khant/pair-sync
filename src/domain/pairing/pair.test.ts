import { describe, it, expect } from 'vitest';
import { Pair, PairStatus } from './pair';

describe('Pair Domain Entity (ADR 0001 & CONTEXT.md)', () => {
  it('instantiates a Pair in PendingHandshake status during initial ceremony', () => {
    const pair = new Pair({
      id: 'pair-1',
      localDeviceId: 'device-alice',
      peerDeviceId: 'device-bob',
      peerPublicKey: 'peer-pub-key-123',
    });

    expect(pair.id).toBe('pair-1');
    expect(pair.status).toBe(PairStatus.PendingHandshake);
    expect(pair.isActive()).toBe(false);
  });

  it('rejects pairing with self', () => {
    expect(() => {
      new Pair({
        id: 'pair-invalid',
        localDeviceId: 'device-same',
        peerDeviceId: 'device-same',
        peerPublicKey: 'peer-pub-key-123',
      });
    }).toThrow('Cannot establish Pair with self');
  });

  it('transitions to Active status once handshake verification succeeds', () => {
    const pair = new Pair({
      id: 'pair-1',
      localDeviceId: 'device-alice',
      peerDeviceId: 'device-bob',
      peerPublicKey: 'peer-pub-key-123',
    });

    pair.activate();

    expect(pair.status).toBe(PairStatus.Active);
    expect(pair.isActive()).toBe(true);
  });

  it('transitions to Revoked status and denies active communication', () => {
    const pair = new Pair({
      id: 'pair-1',
      localDeviceId: 'device-alice',
      peerDeviceId: 'device-bob',
      peerPublicKey: 'peer-pub-key-123',
    });
    pair.activate();
    expect(pair.isActive()).toBe(true);

    pair.revoke();

    expect(pair.status).toBe(PairStatus.Revoked);
    expect(pair.isActive()).toBe(false);
  });

  it('computes identical deterministic pair room ID regardless of peer ordering', () => {
    const pairA = new Pair({
      id: 'pair-1',
      localDeviceId: 'device-alice',
      peerDeviceId: 'device-bob',
      peerPublicKey: 'pk-bob',
    });

    const pairB = new Pair({
      id: 'pair-2',
      localDeviceId: 'device-bob',
      peerDeviceId: 'device-alice',
      peerPublicKey: 'pk-alice',
    });

    expect(pairA.getPairRoomId()).toBe('device-alice_device-bob');
    expect(pairB.getPairRoomId()).toBe('device-alice_device-bob');
  });
});
