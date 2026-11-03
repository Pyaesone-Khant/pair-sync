import { describe, it, expect, beforeEach } from 'vitest';
import { SendMessageUseCase } from './send-message.usecase';
import { IPairRepository, IMessageRepository } from '../ports/repositories';
import { ISignalingPort } from '../ports/signaling';
import { Pair, PairStatus } from '../../domain/pairing/pair';
import { CiphertextEnvelope } from '../../domain/messaging/ciphertext-envelope';

class FakePairRepository implements IPairRepository {
  constructor(public activePair: Pair | null = null) {}
  async getActivePair(): Promise<Pair | null> {
    return this.activePair;
  }
  async savePair(pair: Pair): Promise<void> {
    this.activePair = pair;
  }
  async updatePairStatus(id: string, status: PairStatus): Promise<void> {
    if (this.activePair) {
      if (status === PairStatus.Active) this.activePair.activate();
      if (status === PairStatus.Revoked) this.activePair.revoke();
    }
  }
}

class FakeMessageRepository implements IMessageRepository {
  public envelopes: CiphertextEnvelope[] = [];
  async saveEnvelope(envelope: CiphertextEnvelope): Promise<void> {
    this.envelopes.push(envelope);
  }
  async getRecentEnvelopes(): Promise<CiphertextEnvelope[]> {
    return this.envelopes;
  }
  async markDelivered(): Promise<void> {}
}

class FakeSignalingPort implements ISignalingPort {
  public dispatchedEnvelopes: CiphertextEnvelope[] = [];
  async joinPairRoom(): Promise<void> {}
  async leavePairRoom(): Promise<void> {}
  async sendEnvelope(envelope: CiphertextEnvelope): Promise<void> {
    this.dispatchedEnvelopes.push(envelope);
  }
  async broadcastLocation(): Promise<void> {}
  async sendPeerGaze(): Promise<void> {}
  onEnvelopeReceived(): () => void {
    return () => {};
  }
  onLocationReceived(): () => void {
    return () => {};
  }
  onPeerGazeReceived(): () => void {
    return () => {};
  }
}

describe('SendMessageUseCase (ADR 0004 & E2EE Blind Relay)', () => {
  let pairRepo: FakePairRepository;
  let messageRepo: FakeMessageRepository;
  let signalingPort: FakeSignalingPort;
  let useCase: SendMessageUseCase;

  beforeEach(() => {
    const pair = new Pair({
      id: 'pair-1',
      localDeviceId: 'device-alice',
      peerDeviceId: 'device-bob',
      peerPublicKey: 'bob-key-pub',
    });
    pair.activate();

    pairRepo = new FakePairRepository(pair);
    messageRepo = new FakeMessageRepository();
    signalingPort = new FakeSignalingPort();

    useCase = new SendMessageUseCase(pairRepo, messageRepo, signalingPort);
  });

  it('fails if no active Pair is bonded', async () => {
    pairRepo.activePair = null;

    await expect(useCase.execute('Hello Bob!')).rejects.toThrow(
      'Cannot send message without an active Pair'
    );
  });

  it('rejects empty message content', async () => {
    await expect(useCase.execute('   ')).rejects.toThrow(
      'Message content cannot be empty'
    );
  });

  it('encrypts payload into CiphertextEnvelope, stores locally, and dispatches to blind relay', async () => {
    const envelope = await useCase.execute('Hey, on my way home!');

    expect(envelope.senderDeviceId).toBe('device-alice');
    expect(envelope.recipientDeviceId).toBe('device-bob');
    expect(envelope.ciphertext).toBeDefined();
    expect(envelope.iv).toBeDefined();
    expect(envelope.sequenceNumber).toBe(0);

    // Stored in local SQLite
    expect(messageRepo.envelopes.length).toBe(1);
    expect(messageRepo.envelopes[0].id).toBe(envelope.id);

    // Dispatched to Supabase blind relay
    expect(signalingPort.dispatchedEnvelopes.length).toBe(1);
    expect(signalingPort.dispatchedEnvelopes[0].id).toBe(envelope.id);
  });

  it('increments sequence numbers monotonically for successive messages', async () => {
    const env1 = await useCase.execute('Message 1');
    const env2 = await useCase.execute('Message 2');

    expect(env1.sequenceNumber).toBe(0);
    expect(env2.sequenceNumber).toBe(1);
  });
});
