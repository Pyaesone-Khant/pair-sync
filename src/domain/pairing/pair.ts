export enum PairStatus {
  PendingHandshake = 'PendingHandshake',
  Active = 'Active',
  Revoked = 'Revoked',
}

export interface PairProperties {
  id: string;
  localDeviceId: string;
  peerDeviceId: string;
  peerPublicKey: string;
  status?: PairStatus;
  createdAt?: number;
}

/**
 * Domain entity representing an exclusive bidirectional relationship
 * established between two specific devices.
 * Strictly adheres to CONTEXT.md and ADR 0001.
 */
export class Pair {
  public readonly id: string;
  public readonly localDeviceId: string;
  public readonly peerDeviceId: string;
  public readonly peerPublicKey: string;
  public readonly createdAt: number;
  private _status: PairStatus;

  constructor(props: PairProperties) {
    if (props.localDeviceId === props.peerDeviceId) {
      throw new Error('Cannot establish Pair with self');
    }

    this.id = props.id;
    this.localDeviceId = props.localDeviceId;
    this.peerDeviceId = props.peerDeviceId;
    this.peerPublicKey = props.peerPublicKey;
    this._status = props.status ?? PairStatus.PendingHandshake;
    this.createdAt = props.createdAt ?? Date.now();
  }

  public get status(): PairStatus {
    return this._status;
  }

  public isActive(): boolean {
    return this._status === PairStatus.Active;
  }

  public activate(): void {
    this._status = PairStatus.Active;
  }

  public revoke(): void {
    this._status = PairStatus.Revoked;
  }

  /**
   * Computes a deterministic broadcast room ID shared between both devices.
   */
  public getPairRoomId(): string {
    return [this.localDeviceId, this.peerDeviceId].sort().join('_');
  }
}
