import { IPlaceRepository } from '../ports/repositories';
import { Place, GeographicCoordinate } from '../../domain/places/place';

export interface LocationEvaluationResult {
  coordinate: GeographicCoordinate;
  matchedPlace: Place | null;
  summary: string;
}

/**
 * Use case evaluating peer's real-time geographic coordinates against
 * locally stored Places to produce contextual safety and arrival events.
 * Adheres to ADR 0008 and CONTEXT.md.
 */
export class ProcessIncomingLocationUseCase {
  constructor(private readonly placeRepository: IPlaceRepository) {}

  public async execute(
    coordinate: GeographicCoordinate
  ): Promise<LocationEvaluationResult> {
    const places = await this.placeRepository.getAllPlaces();

    for (const place of places) {
      if (place.containsCoordinate(coordinate)) {
        return {
          coordinate,
          matchedPlace: place,
          summary: `Peer is at ${place.name}`,
        };
      }
    }

    return {
      coordinate,
      matchedPlace: null,
      summary: 'Peer is in transit',
    };
  }
}
