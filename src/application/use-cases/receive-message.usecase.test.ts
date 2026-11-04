import { describe, it, expect, beforeEach } from 'vitest';
import { SendMessageUseCase } from './send-message.usecase';
import { ReceiveMessageUseCase } from './receive-message.usecase';
import { Pair, PairStatus } from '../../domain/pairing/pair';
import { CiphertextEnvelope } from '../../domain/messaging/ciphertext-envelope';
import { IPairRepository, IMessageRepository } from '../ports/repositories';
import { ISignalingPort } from '../ports/signaling';

class InMemoryPairRepo implements IPairRepository {
  constructor(private activePair: Pair | null = null) {}
  async getActivePair(): Promise<Pair | null> {
    return this.activePair;
  }
  async savePair(pair: Pair): Promise<void> {
    this.activePair = pair;
  }
  async updatePairStatus(id: string, status: PairStatus): Promise<void> {
    if (this.activePair && this.activePair.id === id) {
      if (status === PairStatus.Active) {
        this.activePair.activate();
      } else if (status === PairStatus.Revoked) {
        this.activePair.revoke();
      }
    }
  }
}

class InMemoryMessageRepo implements IMessageRepository {
  public envelopes: Array<{ envelope: CiphertextEnvelope; direction: 'incoming' | 'outgoing' }> = [];

  async saveEnvelope(envelope: CiphertextEnvelope, direction: 'incoming' | 'outgoing'): Promise<void> {
    this.envelopes.push({ envelope, direction });
  }

  async getRecentEnvelopes(): Promise<CiphertextEnvelope[]> {
    return this.envelopes.map((e) => e.envelope);
  }

  async markDelivered(): Promise<void> {}
}

class DummySignalingPort implements ISignalingPort {
  async joinPairRoom(): Promise<void> {}
  async leavePairRoom(): Promise<void> {}
  async sendEnvelope(): Promise<void> {}
  async broadcastLocation(): Promise<void> {}
  async sendPeerGaze(): Promise<void> {}
  async sendCallSignal(): Promise<void> {}
  onEnvelopeReceived(): () => void {
    return () => {};
  }
  onLocationReceived(): () => void {
    return () => {};
  }
  onPeerGazeReceived(): () => void {
    return () => {};
  }
  onCallSignalReceived(): () => void {
    return () => {};
  }
}

describe('ReceiveMessageUseCase (ADR 0004 & Signal Ratchet Decryption)', () => {
  let pairRepo: InMemoryPairRepo;
  let messageRepo: InMemoryMessageRepo;
  let signalingPort: DummySignalingPort;
  let sendUseCase: SendMessageUseCase;
  let receiveUseCase: ReceiveMessageUseCase;

  beforeEach(() => {
    const pair = new Pair({
      id: 'pair-unit-test',
      localDeviceId: 'local-phone',
      peerDeviceId: 'peer-phone',
      peerPublicKey: 'peer-key',
      status: PairStatus.Active,
    });

    pairRepo = new InMemoryPairRepo(pair);
    messageRepo = new InMemoryMessageRepo();
    signalingPort = new DummySignalingPort();

    sendUseCase = new SendMessageUseCase(pairRepo, messageRepo, signalingPort);
    receiveUseCase = new ReceiveMessageUseCase(pairRepo, messageRepo);
  });

  it('decrypts an envelope produced by SendMessageUseCase and saves to repository', async () => {
    const originalText = 'Hello from the other side! Meet at the safe place.';
    const envelope = await sendUseCase.execute(originalText);

    // Swap sender & recipient to simulate incoming packet from peer
    const incomingEnvelope = new CiphertextEnvelope({
      id: envelope.id,
      senderDeviceId: 'peer-phone',
      recipientDeviceId: 'local-phone',
      iv: envelope.iv,
      ciphertext: envelope.ciphertext,
      sequenceNumber: envelope.sequenceNumber,
      ratchetPublicKey: envelope.ratchetPublicKey,
      timestamp: envelope.timestamp,
    });

    const decrypted = await receiveUseCase.execute(incomingEnvelope);

    expect(decrypted.plaintext).toBe(originalText);
    expect(decrypted.envelopeId).toBe(envelope.id);

    // Verify saved to local repository as 'incoming'
    const lastSaved = messageRepo.envelopes[messageRepo.envelopes.length - 1];
    expect(lastSaved.direction).toBe('incoming');
    expect(lastSaved.envelope.id).toBe(envelope.id);
  });

  it('rejects envelope if senderDeviceId does not match active pair', async () => {
    const envelope = new CiphertextEnvelope({
      id: 'fake-id',
      senderDeviceId: 'untrusted-intruder',
      recipientDeviceId: 'local-phone',
      iv: 'iv',
      ciphertext: 'ciphertext',
      sequenceNumber: 0,
      ratchetPublicKey: 'key',
      timestamp: Date.now(),
    });

    await expect(receiveUseCase.execute(envelope)).rejects.toThrow(
      'Rejected envelope from untrusted sender'
    );
  });
});
