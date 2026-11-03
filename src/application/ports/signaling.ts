import { CiphertextEnvelope } from '../../domain/messaging/ciphertext-envelope';

export interface LocationTelemetryPayload {
  latitude: number;
  longitude: number;
  batteryPercent?: number | null;
  isCharging?: boolean | null;
  motionActivity?: string | null;
  timestamp?: number;
}

/**
 * Port for the ephemeral blind relay and real-time signaling channel (Supabase Realtime).
 * Adheres to ADR 0002 and CONTEXT.md.
 */
export interface ISignalingPort {
  joinPairRoom(pairId: string): Promise<void>;
  leavePairRoom(): Promise<void>;

  sendEnvelope(envelope: CiphertextEnvelope): Promise<void>;
  broadcastLocation(telemetry: LocationTelemetryPayload): Promise<void>;
  sendPeerGaze(isViewing: boolean): Promise<void>;

  onEnvelopeReceived(callback: (envelope: CiphertextEnvelope) => void): () => void;
  onLocationReceived(callback: (payload: LocationTelemetryPayload) => void): () => void;
  onPeerGazeReceived(callback: (isViewing: boolean) => void): () => void;
}

