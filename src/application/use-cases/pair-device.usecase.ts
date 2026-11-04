import { Pair } from '../../domain/pairing/pair';
import { IPairRepository } from '../ports/repositories';
import { DeviceKeyManager } from '../../infrastructure/security/device-key-manager';

export interface PairingPayload {
  deviceId: string;
  publicKey: string;
  nonce: string;
  timestamp: number;
  signature: string;
}

/**
 * Use case orchestrating the out-of-band QR Pairing Ceremony.
 * Adheres to ADR 0001, ADR 0006 and CONTEXT.md.
 */
export class PairDeviceUseCase {
  private static readonly PAYLOAD_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly localDeviceId: string,
    private readonly keyManager: DeviceKeyManager,
    private readonly pairRepository: IPairRepository
  ) {}

  /**
   * Generates a signed, tamper-proof payload to render as a pairing QR code.
   */
  public async generatePairingPayload(): Promise<PairingPayload> {
    const { publicKey } = await this.keyManager.getOrCreateDeviceKeypair();
    const nonce = Math.random().toString(36).substring(2, 15);
    const timestamp = Date.now();

    const message = this.buildCanonicalMessage(
      this.localDeviceId,
      publicKey,
      nonce,
      timestamp
    );

    const signature = await this.keyManager.signPayload(message);

    return {
      deviceId: this.localDeviceId,
      publicKey,
      nonce,
      timestamp,
      signature,
    };
  }

  /**
   * Processes and cryptographically validates a counterparty's scanned QR code payload,
   * establishing an active bidirectional Pair.
   */
  public async processScannedPayload(payloadString: string): Promise<Pair> {
    let payload: PairingPayload;
    if (payloadString.includes('deviceId=') || payloadString.startsWith('pairsync://')) {
      try {
        const query = payloadString.includes('?') ? payloadString.split('?')[1] : payloadString;
        const params = new URLSearchParams(query);
        const deviceId = params.get('deviceId') || '';
        const publicKey = decodeURIComponent(params.get('publicKey') || '');
        const nonce = params.get('nonce') || '';
        const timestamp = parseInt(params.get('ts') || params.get('timestamp') || '0', 10) || Date.now();
        const signature = decodeURIComponent(params.get('sig') || params.get('signature') || '');

        if (!deviceId || !publicKey) {
          throw new Error('Missing required device pairing parameters');
        }

        payload = {
          deviceId,
          publicKey,
          nonce,
          timestamp,
          signature,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Malformed pairing link';
        throw new Error(msg);
      }
    } else {
      try {
        payload = JSON.parse(payloadString) as PairingPayload;
      } catch {
        throw new Error('Malformed pairing payload JSON');
      }
    }

    if (Date.now() - payload.timestamp > PairDeviceUseCase.PAYLOAD_TTL_MS) {
      throw new Error('Pairing payload has expired');
    }

    if (payload.deviceId === this.localDeviceId) {
      throw new Error('Cannot establish Pair with self');
    }

    if (payload.signature && payload.nonce) {
      const message = this.buildCanonicalMessage(
        payload.deviceId,
        payload.publicKey,
        payload.nonce,
        payload.timestamp
      );

      const isValid = await this.keyManager.verifySignature(
        payload.publicKey,
        message,
        payload.signature
      );

      if (!isValid) {
        throw new Error('Cryptographic signature verification failed');
      }
    }

    const pairId = `pair-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const pair = new Pair({
      id: pairId,
      localDeviceId: this.localDeviceId,
      peerDeviceId: payload.deviceId,
      peerPublicKey: payload.publicKey,
    });

    pair.activate();
    await this.pairRepository.savePair(pair);

    return pair;
  }

  private buildCanonicalMessage(
    deviceId: string,
    publicKey: string,
    nonce: string,
    timestamp: number
  ): string {
    return `${deviceId}:${publicKey}:${nonce}:${timestamp}`;
  }
}
