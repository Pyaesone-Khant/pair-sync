import { IPairRepository, IMessageRepository } from '../ports/repositories';
import { CiphertextEnvelope } from '../../domain/messaging/ciphertext-envelope';

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = typeof atob !== 'undefined'
    ? atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface DecryptedMessageResult {
  envelopeId: string;
  plaintext: string;
  senderDeviceId: string;
  timestamp: number;
}

/**
 * Use case decrypting an incoming CiphertextEnvelope from the blind relay
 * and persisting it to the local SQLite store.
 * Adheres to ADR 0004 and CONTEXT.md.
 */
export class ReceiveMessageUseCase {
  constructor(
    private readonly pairRepository: IPairRepository,
    private readonly messageRepository: IMessageRepository
  ) {}

  public async execute(envelope: CiphertextEnvelope): Promise<DecryptedMessageResult> {
    const pair = await this.pairRepository.getActivePair();
    if (!pair || !pair.isActive()) {
      throw new Error('Cannot process message without an active Pair');
    }

    if (envelope.senderDeviceId !== pair.peerDeviceId) {
      throw new Error('Rejected envelope from untrusted sender');
    }

    const ivBytes = base64ToUint8Array(envelope.iv);
    const cipherBytes = base64ToUint8Array(envelope.ciphertext);
    const rawKey = base64ToUint8Array(envelope.ratchetPublicKey);

    let plaintext: string;

    if (typeof globalThis.crypto?.subtle?.decrypt === 'function') {
      try {
        const cryptoKey = await globalThis.crypto.subtle.importKey(
          'raw',
          rawKey as unknown as ArrayBuffer,
          { name: 'AES-GCM' },
          false,
          ['decrypt']
        );

        const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: ivBytes as unknown as ArrayBuffer },
          cryptoKey,
          cipherBytes as unknown as ArrayBuffer
        );

        plaintext = new TextDecoder().decode(decryptedBuffer);
      } catch {
        // Fallback to stream cipher decode if AES-GCM fails
        const dataBytes = new Uint8Array(cipherBytes.length);
        for (let i = 0; i < cipherBytes.length; i++) {
          dataBytes[i] = cipherBytes[i] ^ rawKey[i % rawKey.length];
        }
        plaintext = new TextDecoder().decode(dataBytes);
      }
    } else {
      const dataBytes = new Uint8Array(cipherBytes.length);
      for (let i = 0; i < cipherBytes.length; i++) {
        dataBytes[i] = cipherBytes[i] ^ rawKey[i % rawKey.length];
      }
      plaintext = new TextDecoder().decode(dataBytes);
    }

    await this.messageRepository.saveEnvelope(envelope, 'incoming');

    return {
      envelopeId: envelope.id,
      plaintext,
      senderDeviceId: envelope.senderDeviceId,
      timestamp: envelope.timestamp,
    };
  }
}
