import { describe, it, expect, beforeEach } from 'vitest';
import { DeviceKeyManager, InMemoryKeyStore } from './device-key-manager';

describe('DeviceKeyManager & Hardware Keystore (ADR 0006)', () => {
  let keyStore: InMemoryKeyStore;
  let keyManager: DeviceKeyManager;

  beforeEach(() => {
    keyStore = new InMemoryKeyStore();
    keyManager = new DeviceKeyManager(keyStore);
  });

  it('generates an asymmetric cryptographic keypair', async () => {
    const keypair = await keyManager.generateDeviceKeypair();

    expect(keypair.publicKey).toBeDefined();
    expect(keypair.privateKey).toBeDefined();
    expect(keypair.publicKey.length).toBeGreaterThan(20);
    expect(keypair.privateKey.length).toBeGreaterThan(20);
  });

  it('stores and retrieves device keypair from keystore', async () => {
    const keypair = await keyManager.getOrCreateDeviceKeypair();

    const storedPublic = await keyStore.getDevicePublicKey();
    const storedPrivate = await keyStore.getDevicePrivateKey();

    expect(storedPublic).toBe(keypair.publicKey);
    expect(storedPrivate).toBe(keypair.privateKey);

    // Calling getOrCreate again returns the same existing keys
    const secondary = await keyManager.getOrCreateDeviceKeypair();
    expect(secondary.publicKey).toBe(keypair.publicKey);
    expect(secondary.privateKey).toBe(keypair.privateKey);
  });

  it('signs payload and verifies cryptographic signature correctly', async () => {
    const keypair = await keyManager.getOrCreateDeviceKeypair();
    const payload = 'pair-sync-auth-handshake-payload-123';

    const signature = await keyManager.signPayload(payload);
    expect(signature).toBeDefined();
    expect(signature.length).toBeGreaterThan(10);

    const isValid = await keyManager.verifySignature(
      keypair.publicKey,
      payload,
      signature
    );
    expect(isValid).toBe(true);

    const isTamperedValid = await keyManager.verifySignature(
      keypair.publicKey,
      'tampered-payload',
      signature
    );
    expect(isTamperedValid).toBe(false);
  });
});
