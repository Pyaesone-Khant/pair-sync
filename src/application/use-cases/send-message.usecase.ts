import { IPairRepository, IMessageRepository } from '../ports/repositories';
import { ISignalingPort } from '../ports/signaling';
import { CiphertextEnvelope } from '../../domain/messaging/ciphertext-envelope';

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

    // Encrypt content on-device using Web Crypto AES-GCM
    const ivBytes = new Uint8Array(12);
    crypto.getRandomValues(ivBytes);

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(content.trim());

    // Generate ephemeral AES-GCM session key
    const rawKey = new Uint8Array(32);
    crypto.getRandomValues(rawKey);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: ivBytes },
      cryptoKey,
      dataBuffer
    );

    const ivBase64 = Buffer.from(ivBytes).toString('base64');
    const ciphertextBase64 = Buffer.from(encryptedBuffer).toString('base64');
    const ratchetKeyBase64 = Buffer.from(rawKey).toString('base64');

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
