/**
 * Domain entity representing an autonomous client-side Boundary Event.
 * Strictly adheres to ADR 0008 and CONTEXT.md.
 */
export type BoundaryEventType = 'arrived' | 'departed';

export interface BoundaryEventProperties {
  id: string;
  type: BoundaryEventType;
  placeId: string;
  placeName: string;
  subject: 'me' | 'peer';
  timestamp: number;
}

export class BoundaryEvent {
  public readonly id: string;
  public readonly type: BoundaryEventType;
  public readonly placeId: string;
  public readonly placeName: string;
  public readonly subject: 'me' | 'peer';
  public readonly timestamp: number;

  constructor(props: BoundaryEventProperties) {
    this.id = props.id;
    this.type = props.type;
    this.placeId = props.placeId;
    this.placeName = props.placeName;
    this.subject = props.subject;
    this.timestamp = props.timestamp;
  }

  public getSummary(): string {
    const actor = this.subject === 'me' ? 'You' : 'Your partner';
    const action = this.type === 'arrived' ? 'arrived at' : 'departed from';
    return `${actor} ${action} ${this.placeName}`;
  }
}
