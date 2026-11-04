import { useState, useEffect, useRef } from 'react';
import { GeographicCoordinate } from '../../domain/places/place';
import {
  interpolateCoordinate,
  calculateBearingDegrees,
} from '../utils/coordinate-interpolation';

export interface InterpolatedCoordinateResult {
  coordinate: GeographicCoordinate | null;
  bearing: number;
}

/**
 * Custom React hook performing smooth 60fps coordinate interpolation
 * whenever a new physical GPS or remote telemetry coordinate arrives.
 * Strictly adheres to ADR 0007 and CONTEXT.md ("Coordinate Interpolation").
 */
export function useInterpolatedCoordinate(
  targetCoordinate: GeographicCoordinate | null,
  durationMs: number = 1000
): InterpolatedCoordinateResult {
  const [currentCoordinate, setCurrentCoordinate] =
    useState<GeographicCoordinate | null>(targetCoordinate);
  const [bearing, setBearing] = useState<number>(0);

  const prevCoordRef = useRef<GeographicCoordinate | null>(targetCoordinate);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!targetCoordinate) return;

    if (!prevCoordRef.current) {
      prevCoordRef.current = targetCoordinate;
      setCurrentCoordinate(targetCoordinate);
      return;
    }

    const fromCoord = prevCoordRef.current;
    const toCoord = targetCoordinate;

    if (
      fromCoord.latitude === toCoord.latitude &&
      fromCoord.longitude === toCoord.longitude
    ) {
      return;
    }

    // Compute heading bearing towards destination
    const newBearing = calculateBearingDegrees(fromCoord, toCoord);
    setBearing(newBearing);

    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      const interpolated = interpolateCoordinate(fromCoord, toCoord, progress);
      setCurrentCoordinate(interpolated);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        prevCoordRef.current = toCoord;
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [targetCoordinate?.latitude, targetCoordinate?.longitude, durationMs]);

  return { coordinate: currentCoordinate, bearing };
}
