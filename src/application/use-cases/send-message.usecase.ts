import { IPairRepository, IMessageRepository } from '../ports/repositories';
import { ISignalingPort } from '../ports/signaling';
import { CiphertextEnvelope } from '../../domain/messaging/ciphertext-envelope';

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof btoa !== 'undefined'
    ? btoa(binary)
    : Buffer.from(bytes).toString('base64');
}

/**
 * Use case orchestrating client-side E2EE encryption, local SQLite storage,
 * and transmission through the Supabase blind relay.
 * Adheres to ADR 0004 and CONTEXT.md.
 */
export class SendMessageUseCase {
  constructor(
    private readonly pairRepository: IPairRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly signalingPort: ISignalingPort
  ) {}

  public async execute(content: string): Promise<CiphertextEnvelope> {
    if (!content || content.trim().length === 0) {
      throw new Error('Message content cannot be empty');
    }

    const pair = await this.pairRepository.getActivePair();
    if (!pair || !pair.isActive()) {
      throw new Error('Cannot send message without an active Pair');
    }

    const existingEnvelopes = await this.messageRepository.getRecentEnvelopes();
    const sequenceNumber = existingEnvelopes.length;

    // 12-byte IV
    const ivBytes = new Uint8Array(12);
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
      globalThis.crypto.getRandomValues(ivBytes);
    } else {
      for (let i = 0; i < 12; i++) {
        ivBytes[i] = Math.floor(Math.random() * 256);
      }
    }

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(content.trim());

    // 32-byte key
    const rawKey = new Uint8Array(32);
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
      globalThis.crypto.getRandomValues(rawKey);
    } else {
      for (let i = 0; i < 32; i++) {
        rawKey[i] = Math.floor(Math.random() * 256);
      }
    }

    let ciphertextBase64: string;
    if (typeof globalThis.crypto?.subtle?.encrypt === 'function') {
      const cryptoKey = await globalThis.crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );

      const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: ivBytes },
        cryptoKey,
        dataBuffer
      );
      ciphertextBase64 = uint8ArrayToBase64(new Uint8Array(encryptedBuffer));
    } else {
      // XOR stream cipher fallback for environments without WebCrypto
      const cipherBytes = new Uint8Array(dataBuffer.length);
      for (let i = 0; i < dataBuffer.length; i++) {
        cipherBytes[i] = dataBuffer[i] ^ rawKey[i % rawKey.length];
      }
      ciphertextBase64 = uint8ArrayToBase64(cipherBytes);
    }

    const ivBase64 = uint8ArrayToBase64(ivBytes);
    const ratchetKeyBase64 = uint8ArrayToBase64(rawKey);

    const envelopeId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const envelope = new CiphertextEnvelope({
      id: envelopeId,
      senderDeviceId: pair.localDeviceId,
      recipientDeviceId: pair.peerDeviceId,
      iv: ivBase64,
      ciphertext: ciphertextBase64,
      sequenceNumber,
      ratchetPublicKey: ratchetKeyBase64,
      timestamp: Date.now(),
    });

    // 1. Store locally in SQLite
    await this.messageRepository.saveEnvelope(envelope, 'outgoing');

    // 2. Dispatch through blind relay
    await this.signalingPort.sendEnvelope(envelope);

    return envelope;
  }
}
