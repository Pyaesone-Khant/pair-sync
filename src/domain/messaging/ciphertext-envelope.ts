export interface CiphertextEnvelopeProperties {
  id: string;
  senderDeviceId: string;
  recipientDeviceId: string;
  iv: string;
  ciphertext: string;
  sequenceNumber: number;
  ratchetPublicKey: string;
  timestamp: number;
}

/**
 * Domain value object representing an end-to-end encrypted message container.
 * Strictly adheres to CONTEXT.md and ADR 0004.
 */
export class CiphertextEnvelope {
  public readonly id: string;
  public readonly senderDeviceId: string;
  public readonly recipientDeviceId: string;
  public readonly iv: string;
  public readonly ciphertext: string;
  public readonly sequenceNumber: number;
  public readonly ratchetPublicKey: string;
  public readonly timestamp: number;

  constructor(props: CiphertextEnvelopeProperties) {
    if (!props.ciphertext || props.ciphertext.trim().length === 0) {
      throw new Error('Ciphertext cannot be empty');
    }
    if (!props.iv || props.iv.trim().length === 0) {
      throw new Error('Initialization vector (IV) cannot be empty');
    }
    if (props.sequenceNumber < 0) {
      throw new Error('Sequence number must be non-negative');
    }
    if (!props.senderDeviceId || !props.recipientDeviceId) {
      throw new Error('Sender and recipient device IDs are required');
    }

    this.id = props.id;
    this.senderDeviceId = props.senderDeviceId;
    this.recipientDeviceId = props.recipientDeviceId;
    this.iv = props.iv;
    this.ciphertext = props.ciphertext;
    this.sequenceNumber = props.sequenceNumber;
    this.ratchetPublicKey = props.ratchetPublicKey;
    this.timestamp = props.timestamp;
  }

  /**
   * Serializes the envelope into a JSON wire string for blind relay transmission.
   */
  public serialize(): string {
    return JSON.stringify({
      id: this.id,
      senderDeviceId: this.senderDeviceId,
      recipientDeviceId: this.recipientDeviceId,
      iv: this.iv,
      ciphertext: this.ciphertext,
      sequenceNumber: this.sequenceNumber,
      ratchetPublicKey: this.ratchetPublicKey,
      timestamp: this.timestamp,
    });
  }

  /**
   * Restores an envelope instance from JSON wire payload.
   */
  public static deserialize(jsonString: string): CiphertextEnvelope {
    const parsed = JSON.parse(jsonString) as CiphertextEnvelopeProperties;
    return new CiphertextEnvelope(parsed);
  }
}
