import { CiphertextEnvelope } from '../../domain/messaging/ciphertext-envelope';

/**
 * Port for the ephemeral blind relay and real-time signaling channel (Supabase Realtime).
 * Adheres to ADR 0002 and CONTEXT.md.
 */
export interface ISignalingPort {
  sendEnvelope(envelope: CiphertextEnvelope): Promise<void>;
  broadcastLocation(latitude: number, longitude: number): Promise<void>;
  sendPeerGaze(isViewing: boolean): Promise<void>;
}
