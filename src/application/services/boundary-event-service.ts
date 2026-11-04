import { GeographicCoordinate } from '../../domain/places/place';
import { BoundaryEvent } from '../../domain/places/boundary-event';
import { IPlaceRepository } from '../ports/repositories';
import { ISignalingPort } from '../ports/signaling';

/**
 * Autonomous service tracking hardware and remote peer coordinates against
 * locally stored Places, emitting BoundaryEvents upon perimeter crossing.
 * Adheres to ADR 0008 and CONTEXT.md.
 */
export class BoundaryEventService {
  private listeners: Set<(event: BoundaryEvent) => void> = new Set();
  // Map of subject:placeId -> boolean (was inside)
  private presenceMap: Map<string, boolean> = new Map();
  // Tracks if initial state has been observed for subject
  private hasInitializedSubject: Set<'me' | 'peer'> = new Set();

  constructor(
    private readonly placeRepository: IPlaceRepository,
    private readonly signalingPort?: ISignalingPort
  ) {}

  public onBoundaryEvent(callback: (event: BoundaryEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Evaluates coordinate updates for either 'me' or 'peer' against all registered Places.
   */
  public async evaluateCoordinateChange(
    subject: 'me' | 'peer',
    coordinate: GeographicCoordinate
  ): Promise<BoundaryEvent[]> {
    const places = await this.placeRepository.getAllPlaces();
    const emittedEvents: BoundaryEvent[] = [];
    const isFirstRunForSubject = !this.hasInitializedSubject.has(subject);

    for (const place of places) {
      const presenceKey = `${subject}:${place.id}`;
      const wasInside = this.presenceMap.get(presenceKey) ?? false;
      const isInside = place.containsCoordinate(coordinate);

      this.presenceMap.set(presenceKey, isInside);

      if (isFirstRunForSubject) {
        // Initial setup for subject records presence without spurious arrival
        continue;
      }

      if (!wasInside && isInside) {
        // Crossed into place
        const event = new BoundaryEvent({
          id: `boundary-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: 'arrived',
          placeId: place.id,
          placeName: place.name,
          subject,
          timestamp: Date.now(),
        });
        emittedEvents.push(event);
        this.dispatch(event);
      } else if (wasInside && !isInside) {
        // Crossed out of place
        const event = new BoundaryEvent({
          id: `boundary-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: 'departed',
          placeId: place.id,
          placeName: place.name,
          subject,
          timestamp: Date.now(),
        });
        emittedEvents.push(event);
        this.dispatch(event);
      }
    }

    if (isFirstRunForSubject) {
      this.hasInitializedSubject.add(subject);
    }

    return emittedEvents;
  }

  private dispatch(event: BoundaryEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[BoundaryEventService] Listener error:', err);
      }
    });
  }

  public reset(): void {
    this.presenceMap.clear();
    this.hasInitializedSubject.clear();
  }
}
