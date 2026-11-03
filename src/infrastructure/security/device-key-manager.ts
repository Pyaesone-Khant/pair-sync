/**
 * Port for hardware/secure enclave keystore.
 */
export interface IKeyStorePort {
  getDevicePublicKey(): Promise<string | null>;
  getDevicePrivateKey(): Promise<string | null>;
  saveDeviceKeypair(publicKey: string, privateKey: string): Promise<void>;
  deleteDeviceKeypair(): Promise<void>;
}

/**
 * In-memory keystore for fast, isolated unit testing.
 */
export class InMemoryKeyStore implements IKeyStorePort {
  private publicKey: string | null = null;
  private privateKey: string | null = null;

  public async getDevicePublicKey(): Promise<string | null> {
    return this.publicKey;
  }

  public async getDevicePrivateKey(): Promise<string | null> {
    return this.privateKey;
  }

  public async saveDeviceKeypair(
    publicKey: string,
    privateKey: string
  ): Promise<void> {
    this.publicKey = publicKey;
    this.privateKey = privateKey;
  }

  public async deleteDeviceKeypair(): Promise<void> {
    this.publicKey = null;
    this.privateKey = null;
  }
}

/**
 * Mobile implementation backed by Expo SecureStore (iOS Keychain & Android Keystore).
 */
export class ExpoSecureKeyStore implements IKeyStorePort {
  private static readonly PUB_KEY_ALIAS = 'pair_sync_device_pub_key';
  private static readonly PRIV_KEY_ALIAS = 'pair_sync_device_priv_key';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly secureStore: any) {}

  public async getDevicePublicKey(): Promise<string | null> {
    return this.secureStore.getItemAsync(ExpoSecureKeyStore.PUB_KEY_ALIAS);
  }

  public async getDevicePrivateKey(): Promise<string | null> {
    return this.secureStore.getItemAsync(ExpoSecureKeyStore.PRIV_KEY_ALIAS);
  }

  public async saveDeviceKeypair(
    publicKey: string,
    privateKey: string
  ): Promise<void> {
    await this.secureStore.setItemAsync(
      ExpoSecureKeyStore.PUB_KEY_ALIAS,
      publicKey
    );
    await this.secureStore.setItemAsync(
      ExpoSecureKeyStore.PRIV_KEY_ALIAS,
      privateKey
    );
  }

  public async deleteDeviceKeypair(): Promise<void> {
    await this.secureStore.deleteItemAsync(ExpoSecureKeyStore.PUB_KEY_ALIAS);
    await this.secureStore.deleteItemAsync(ExpoSecureKeyStore.PRIV_KEY_ALIAS);
  }
}

/**
 * Asymmetric cryptographic key manager using standard Web Crypto API (ECDSA P-256).
 * Handles hardware identity generation, signing, and verification.
 * Adheres to ADR 0006 and CONTEXT.md.
 */
export class DeviceKeyManager {
  private static readonly ALGORITHM: EcKeyGenParams = {
    name: 'ECDSA',
    namedCurve: 'P-256',
  };

  private static readonly SIGN_ALGORITHM: EcdsaParams = {
    name: 'ECDSA',
    hash: { name: 'SHA-256' },
  };

  constructor(private readonly keyStore: IKeyStorePort) {}

  /**
   * Generates a new cryptographic asymmetric keypair serialized to JWK strings.
   */
  public async generateDeviceKeypair(): Promise<{
    publicKey: string;
    privateKey: string;
  }> {
    const keypair = await crypto.subtle.generateKey(
      DeviceKeyManager.ALGORITHM,
      true,
      ['sign', 'verify']
    );

    const pubJwk = await crypto.subtle.exportKey('jwk', keypair.publicKey);
    const privJwk = await crypto.subtle.exportKey('jwk', keypair.privateKey);

    return {
      publicKey: JSON.stringify(pubJwk),
      privateKey: JSON.stringify(privJwk),
    };
  }

  /**
   * Retrieves existing keypair from secure storage, or creates and stores a new one.
   */
  public async getOrCreateDeviceKeypair(): Promise<{
    publicKey: string;
    privateKey: string;
  }> {
    const existingPub = await this.keyStore.getDevicePublicKey();
    const existingPriv = await this.keyStore.getDevicePrivateKey();

    if (existingPub && existingPriv) {
      return { publicKey: existingPub, privateKey: existingPriv };
    }

    const created = await this.generateDeviceKeypair();
    await this.keyStore.saveDeviceKeypair(
      created.publicKey,
      created.privateKey
    );
    return created;
  }

  /**
   * Cryptographically signs arbitrary string data using the device private key.
   */
  public async signPayload(data: string): Promise<string> {
    const { privateKey } = await this.getOrCreateDeviceKeypair();
    const privJwk = JSON.parse(privateKey) as JsonWebKey;

    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      privJwk,
      DeviceKeyManager.ALGORITHM,
      false,
      ['sign']
    );

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    const signatureBuffer = await crypto.subtle.sign(
      DeviceKeyManager.SIGN_ALGORITHM,
      cryptoKey,
      dataBuffer
    );

    return Buffer.from(signatureBuffer).toString('base64');
  }

  /**
   * Cryptographically verifies that a signature was produced by the given public key.
   */
  public async verifySignature(
    publicKey: string,
    data: string,
    signatureBase64: string
  ): Promise<boolean> {
    try {
      const pubJwk = JSON.parse(publicKey) as JsonWebKey;
      const cryptoKey = await crypto.subtle.importKey(
        'jwk',
        pubJwk,
        DeviceKeyManager.ALGORITHM,
        false,
        ['verify']
      );

      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const signatureBuffer = Buffer.from(signatureBase64, 'base64');

      return await crypto.subtle.verify(
        DeviceKeyManager.SIGN_ALGORITHM,
        cryptoKey,
        signatureBuffer,
        dataBuffer
      );
    } catch {
      return false;
    }
  }
}
