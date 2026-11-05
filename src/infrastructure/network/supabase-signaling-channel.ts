import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import {
  ISignalingPort,
  LocationTelemetryPayload,
  CallSignalPayload,
} from '../../application/ports/signaling';
import { CiphertextEnvelope } from '../../domain/messaging/ciphertext-envelope';

export interface SupabaseSignalingConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseClient?: SupabaseClient;
}

/**
 * Production implementation of ISignalingPort using Supabase Realtime Broadcast.
 * Acts as an untrusted blind relay forwarding ciphertext envelopes and ephemeral
 * telemetry without persisting plaintext or holding cryptographic keys.
 * Strictly adheres to ADR 0002, ADR 0004, ADR 0005, and CONTEXT.md.
 */
export class SupabaseSignalingChannel implements ISignalingPort {
  private client: SupabaseClient | null = null;
  private currentChannel: RealtimeChannel | null = null;
  private currentPairId: string | null = null;

  private envelopeListeners: Set<(envelope: CiphertextEnvelope) => void> = new Set();
  private locationListeners: Set<(payload: LocationTelemetryPayload) => void> = new Set();
  private peerGazeListeners: Set<(isViewing: boolean) => void> = new Set();
  private callSignalListeners: Set<(signal: CallSignalPayload) => void> = new Set();

  constructor(config?: SupabaseSignalingConfig) {
    if (config?.supabaseClient) {
      this.client = config.supabaseClient;
    } else {
      const url =
        config?.supabaseUrl ||
        process.env.EXPO_PUBLIC_SUPABASE_URL ||
        'https://uqvkhfxnnvnzftvvwlwi.supabase.co';
      const key =
        config?.supabaseAnonKey ||
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        'sb_publishable_B4fWBTYmHyUOXjGikfWn4g_E3F48cWf';

      if (url && key) {
        this.client = createClient(url, key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
          realtime: {
            params: {
              eventsPerSecond: 20,
            },
          },
        });
      }
    }
  }

  /**
   * Subscribes to the pairwise Realtime broadcast topic for a bonded 1:1 pair.
   */
  public async joinPairRoom(pairId: string): Promise<void> {
    if (this.currentPairId === pairId && this.currentChannel) {
      return;
    }

    if (this.currentChannel) {
      await this.leavePairRoom();
    }

    this.currentPairId = pairId;

    if (!this.client) {
      console.warn('[SupabaseSignalingChannel] No Supabase client configured. Operating in offline relay mode.');
      return;
    }

    const topic = `pairsync:pair:${pairId}`;
    const channel = this.client.channel(topic, {
      config: {
        broadcast: { ack: false, self: false },
      },
    });

    channel
      .on('broadcast', { event: 'envelope' }, ({ payload }) => {
        try {
          const envelope = new CiphertextEnvelope({
            id: payload.id,
            senderDeviceId: payload.senderDeviceId,
            recipientDeviceId: payload.recipientDeviceId,
            iv: payload.iv,
            ciphertext: payload.ciphertext,
            sequenceNumber: payload.sequenceNumber,
            ratchetPublicKey: payload.ratchetPublicKey,
            timestamp: payload.timestamp,
          });
          this.envelopeListeners.forEach((listener) => listener(envelope));
        } catch (err) {
          console.error('[SupabaseSignalingChannel] Failed to parse incoming envelope:', err);
        }
      })
      .on('broadcast', { event: 'location' }, ({ payload }) => {
        this.locationListeners.forEach((listener) => listener(payload));
      })
      .on('broadcast', { event: 'peer_gaze' }, ({ payload }) => {
        this.peerGazeListeners.forEach((listener) => listener(Boolean(payload.isViewing)));
      })
      .on('broadcast', { event: 'call_signal' }, ({ payload }) => {
        this.callSignalListeners.forEach((listener) => listener(payload));
      });

    channel.subscribe((status) => {
      console.log(`[SupabaseSignalingChannel] Realtime topic [${topic}] status: ${status}`);
    });
    this.currentChannel = channel;
  }

  /**
   * Leaves the active Realtime channel.
   */
  public async leavePairRoom(): Promise<void> {
    if (this.currentChannel) {
      await this.currentChannel.unsubscribe();
      this.currentChannel = null;
    }
    this.currentPairId = null;
  }

  /**
   * Broadcasts an end-to-end encrypted message envelope through the blind relay.
   */
  public async sendEnvelope(envelope: CiphertextEnvelope): Promise<void> {
    if (!this.currentChannel) {
      return;
    }

    await this.currentChannel.send({
      type: 'broadcast',
      event: 'envelope',
      payload: envelope.toObject(),
    });
  }

  /**
   * Broadcasts an ephemeral location telemetry payload to the paired peer.
   */
  public async broadcastLocation(telemetry: LocationTelemetryPayload): Promise<void> {
    if (!this.currentChannel) {
      return;
    }

    await this.currentChannel.send({
      type: 'broadcast',
      event: 'location',
      payload: telemetry,
    });
  }

  /**
   * Notifies the peer whether the local user has opened the map (Live Viewing state).
   */
  public async sendPeerGaze(isViewing: boolean): Promise<void> {
    if (!this.currentChannel) {
      return;
    }

    await this.currentChannel.send({
      type: 'broadcast',
      event: 'peer_gaze',
      payload: { isViewing },
    });
  }

  /**
   * Broadcasts a WebRTC P2P call signaling packet (offer, answer, ICE candidate, hangup).
   * Adheres to ADR 0005.
   */
  public async sendCallSignal(signal: CallSignalPayload): Promise<void> {
    if (!this.currentChannel) {
      return;
    }

    await this.currentChannel.send({
      type: 'broadcast',
      event: 'call_signal',
      payload: signal,
    });
  }

  public onEnvelopeReceived(callback: (envelope: CiphertextEnvelope) => void): () => void {
    this.envelopeListeners.add(callback);
    return () => this.envelopeListeners.delete(callback);
  }

  public onLocationReceived(callback: (payload: LocationTelemetryPayload) => void): () => void {
    this.locationListeners.add(callback);
    return () => this.locationListeners.delete(callback);
  }

  public onPeerGazeReceived(callback: (isViewing: boolean) => void): () => void {
    this.peerGazeListeners.add(callback);
    return () => this.peerGazeListeners.delete(callback);
  }

  public onCallSignalReceived(callback: (signal: CallSignalPayload) => void): () => void {
    this.callSignalListeners.add(callback);
    return () => this.callSignalListeners.delete(callback);
  }

  /**
   * Listens for an incoming pairing handshake request targeting this device ID.
   * Enables seamless instant pairing when counterparty scans our QR code (ADR 0001/0006).
   */
  public listenForPairingHandshake(
    localDeviceId: string,
    onHandshake: (payloadString: string) => void
  ): () => void {
    if (!this.client) return () => {};
    const topic = `pairsync:handshake:${localDeviceId}`;
    const channel = this.client.channel(topic, {
      config: { broadcast: { ack: false, self: false } },
    });
    channel.on('broadcast', { event: 'handshake' }, ({ payload }) => {
      if (payload?.payloadString) {
        onHandshake(payload.payloadString);
      }
    });
    channel.subscribe();
    return () => {
      channel.unsubscribe();
    };
  }

  /**
   * Broadcasts our pairing payload to counterparty's handshake topic upon scanning their QR.
   */
  public async sendPairingHandshake(
    targetDeviceId: string,
    payloadString: string
  ): Promise<void> {
    if (!this.client) return;
    const topic = `pairsync:handshake:${targetDeviceId}`;
    const channel = this.client.channel(topic, {
      config: { broadcast: { ack: false, self: false } },
    });
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          const sendPacket = async () => {
            await channel.send({
              type: 'broadcast',
              event: 'handshake',
              payload: { payloadString },
            });
          };
          // Send 3 bursts across 1 second to ensure delivery over cellular/WiFi latency
          await sendPacket();
          setTimeout(() => sendPacket().catch(() => {}), 350);
          setTimeout(() => sendPacket().catch(() => {}), 850);
        } catch (err) {
          console.warn('[SupabaseSignalingChannel] Failed to send pairing handshake:', err);
        } finally {
          setTimeout(() => channel.unsubscribe(), 2500);
        }
      }
    });
  }
}

// Global singleton instance for app-wide signaling
let defaultSignalingChannel: SupabaseSignalingChannel | null = null;

export function getSignalingChannel(): SupabaseSignalingChannel {
  if (!defaultSignalingChannel) {
    defaultSignalingChannel = new SupabaseSignalingChannel();
  }
  return defaultSignalingChannel;
}
