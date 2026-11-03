import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseSignalingChannel } from './supabase-signaling-channel';
import { CiphertextEnvelope } from '../../domain/messaging/ciphertext-envelope';

interface MockChannel {
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

describe('SupabaseSignalingChannel (ADR 0002 Blind Relay & Realtime Broadcast)', () => {
  let mockChannel: MockChannel;
  let mockSupabaseClient: any;
  let channelListeners: Record<string, ((event: { payload: any }) => void)[]>;

  beforeEach(() => {
    channelListeners = {};

    mockChannel = {
      on: vi.fn((type: string, filter: { event: string }, callback: any) => {
        const eventName = filter.event;
        if (!channelListeners[eventName]) {
          channelListeners[eventName] = [];
        }
        channelListeners[eventName].push(callback);
        return mockChannel;
      }),
      subscribe: vi.fn((callback?: (status: string) => void) => {
        if (callback) callback('SUBSCRIBED');
        return mockChannel;
      }),
      unsubscribe: vi.fn(() => Promise.resolve('ok')),
      send: vi.fn(() => Promise.resolve('ok')),
    };

    mockSupabaseClient = {
      channel: vi.fn(() => mockChannel),
      removeChannel: vi.fn(() => Promise.resolve('ok')),
    };
  });

  it('connects to pair broadcast room on joinPairRoom', async () => {
    const signaling = new SupabaseSignalingChannel({
      supabaseClient: mockSupabaseClient,
    });

    await signaling.joinPairRoom('pair-uuid-1234');

    expect(mockSupabaseClient.channel).toHaveBeenCalledWith(
      'pairsync:pair:pair-uuid-1234',
      expect.objectContaining({
        config: { broadcast: { ack: false, self: false } },
      })
    );
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it('broadcasts ciphertext envelope over realtime channel', async () => {
    const signaling = new SupabaseSignalingChannel({
      supabaseClient: mockSupabaseClient,
    });

    await signaling.joinPairRoom('pair-uuid-1234');

    const envelope = new CiphertextEnvelope({
      id: 'env-1',
      senderDeviceId: 'key-dev-1',
      recipientDeviceId: 'key-dev-2',
      iv: 'base64iv',
      ciphertext: 'encryptedpayload',
      sequenceNumber: 1,
      ratchetPublicKey: 'pubkey-ratchet',
      timestamp: 1700000000000,
    });

    await signaling.sendEnvelope(envelope);

    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'envelope',
      payload: envelope.toObject(),
    });
  });

  it('broadcasts location telemetry over realtime channel', async () => {
    const signaling = new SupabaseSignalingChannel({
      supabaseClient: mockSupabaseClient,
    });

    await signaling.joinPairRoom('pair-uuid-1234');

    await signaling.broadcastLocation({
      latitude: 37.7749,
      longitude: -122.4194,
      batteryPercent: 88,
      motionActivity: 'Walking',
    });

    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'location',
      payload: {
        latitude: 37.7749,
        longitude: -122.4194,
        batteryPercent: 88,
        motionActivity: 'Walking',
      },
    });
  });

  it('invokes registered listeners when broadcast packet arrives', async () => {
    const signaling = new SupabaseSignalingChannel({
      supabaseClient: mockSupabaseClient,
    });

    const envelopeListener = vi.fn();
    const locationListener = vi.fn();

    signaling.onEnvelopeReceived(envelopeListener);
    signaling.onLocationReceived(locationListener);

    await signaling.joinPairRoom('pair-uuid-1234');

    // Simulate incoming location broadcast from remote peer
    const locationHandlers = channelListeners['location'];
    expect(locationHandlers).toBeDefined();
    locationHandlers[0]({
      payload: {
        latitude: 37.7899,
        longitude: -122.4014,
        batteryPercent: 42,
        motionActivity: 'Driving',
      },
    });

    expect(locationListener).toHaveBeenCalledWith({
      latitude: 37.7899,
      longitude: -122.4014,
      batteryPercent: 42,
      motionActivity: 'Driving',
    });
  });

  it('cleans up channel and listeners on leavePairRoom', async () => {
    const signaling = new SupabaseSignalingChannel({
      supabaseClient: mockSupabaseClient,
    });

    await signaling.joinPairRoom('pair-uuid-1234');
    await signaling.leavePairRoom();

    expect(mockChannel.unsubscribe).toHaveBeenCalled();
  });
});
