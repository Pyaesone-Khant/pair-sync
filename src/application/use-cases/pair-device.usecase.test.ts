import { describe, it, expect, beforeEach } from 'vitest';
import { PairDeviceUseCase } from './pair-device.usecase';
import {
  DeviceKeyManager,
  InMemoryKeyStore,
} from '../../infrastructure/security/device-key-manager';
import { PairStatus } from '../../domain/pairing/pair';
import { IPairRepository } from '../ports/repositories';
import { Pair } from '../../domain/pairing/pair';

class MockPairRepository implements IPairRepository {
  private activePair: Pair | null = null;

  public async getActivePair(): Promise<Pair | null> {
    return this.activePair;
  }

  public async savePair(pair: Pair): Promise<void> {
    this.activePair = pair;
  }

  public async updatePairStatus(id: string, status: PairStatus): Promise<void> {
    if (this.activePair && this.activePair.id === id) {
      if (status === PairStatus.Active) {
        this.activePair.activate();
      } else if (status === PairStatus.Revoked) {
        this.activePair.revoke();
      }
    }
  }
}

describe('PairDeviceUseCase (ADR 0001, ADR 0006 & Pairing Ceremony)', () => {
  let aliceKeyManager: DeviceKeyManager;
  let bobKeyManager: DeviceKeyManager;
  let alicePairRepo: MockPairRepository;
  let bobPairRepo: MockPairRepository;
  let aliceUseCase: PairDeviceUseCase;
  let bobUseCase: PairDeviceUseCase;

  beforeEach(async () => {
    aliceKeyManager = new DeviceKeyManager(new InMemoryKeyStore());
    bobKeyManager = new DeviceKeyManager(new InMemoryKeyStore());

    alicePairRepo = new MockPairRepository();
    bobPairRepo = new MockPairRepository();

    aliceUseCase = new PairDeviceUseCase('device-alice', aliceKeyManager, alicePairRepo);
    bobUseCase = new PairDeviceUseCase('device-bob', bobKeyManager, bobPairRepo);
  });

  it('generates a signed pairing payload containing device ID, public key, and signature', async () => {
    const payload = await aliceUseCase.generatePairingPayload();

    expect(payload.deviceId).toBe('device-alice');
    expect(payload.publicKey).toBeDefined();
    expect(payload.signature).toBeDefined();
    expect(payload.timestamp).toBeGreaterThan(0);
  });

  it('successfully processes scanned payload, verifies signature, and establishes active Pair', async () => {
    // Alice generates QR payload
    const alicePayload = await aliceUseCase.generatePairingPayload();

    // Bob scans Alice's QR code
    const pair = await bobUseCase.processScannedPayload(JSON.stringify(alicePayload));

    expect(pair.status).toBe(PairStatus.Active);
    expect(pair.localDeviceId).toBe('device-bob');
    expect(pair.peerDeviceId).toBe('device-alice');

    // Bob's repository now holds the active pair
    const stored = await bobPairRepo.getActivePair();
    expect(stored?.isActive()).toBe(true);
    expect(stored?.peerDeviceId).toBe('device-alice');
  });

  it('rejects tampered QR payload when signature does not match', async () => {
    const alicePayload = await aliceUseCase.generatePairingPayload();

    // Malicious actor tampers with payload data
    alicePayload.deviceId = 'device-hacker';

    await expect(
      bobUseCase.processScannedPayload(JSON.stringify(alicePayload))
    ).rejects.toThrow('Cryptographic signature verification failed');
  });

  it('rejects pairing with self', async () => {
    const alicePayload = await aliceUseCase.generatePairingPayload();

    // Alice scans her own QR code
    await expect(
      aliceUseCase.processScannedPayload(JSON.stringify(alicePayload))
    ).rejects.toThrow('Cannot establish Pair with self');
  });

  it('rejects expired pairing payload older than 5 minutes', async () => {
    const alicePayload = await aliceUseCase.generatePairingPayload();

    // Set timestamp to 10 minutes ago
    alicePayload.timestamp = Date.now() - 10 * 60 * 1000;

    await expect(
      bobUseCase.processScannedPayload(JSON.stringify(alicePayload))
    ).rejects.toThrow('Pairing payload has expired');
  });
});
