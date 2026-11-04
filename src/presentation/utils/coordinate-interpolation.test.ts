import { describe, it, expect } from 'vitest';
import {
  interpolateCoordinate,
  calculateBearingDegrees,
  createCoordinateSteps,
} from './coordinate-interpolation';

describe('CoordinateInterpolation (ADR 0007 & CONTEXT.md)', () => {
  const coordA = { latitude: 37.7749, longitude: -122.4194 };
  const coordB = { latitude: 37.7849, longitude: -122.4094 };

  it('interpolates midpoint correctly at fraction = 0.5', () => {
    const mid = interpolateCoordinate(coordA, coordB, 0.5);
    expect(mid.latitude).toBeCloseTo(37.7799, 4);
    expect(mid.longitude).toBeCloseTo(-122.4144, 4);
  });

  it('clamps fraction between 0.0 and 1.0', () => {
    const atZero = interpolateCoordinate(coordA, coordB, -0.5);
    expect(atZero.latitude).toBeCloseTo(coordA.latitude, 4);
    expect(atZero.longitude).toBeCloseTo(coordA.longitude, 4);

    const atOne = interpolateCoordinate(coordA, coordB, 1.5);
    expect(atOne.latitude).toBeCloseTo(coordB.latitude, 4);
    expect(atOne.longitude).toBeCloseTo(coordB.longitude, 4);
  });

  it('calculates geographic bearing angle in degrees between two coordinates', () => {
    // Due North
    const south = { latitude: 0, longitude: 0 };
    const north = { latitude: 10, longitude: 0 };
    const bearingNorth = calculateBearingDegrees(south, north);
    expect(bearingNorth).toBeCloseTo(0, 1);

    // Due East
    const east = { latitude: 0, longitude: 10 };
    const bearingEast = calculateBearingDegrees(south, east);
    expect(bearingEast).toBeCloseTo(90, 1);
  });

  it('generates smooth discrete intermediate coordinate steps for frame animation', () => {
    const steps = createCoordinateSteps(coordA, coordB, 10);
    expect(steps.length).toBe(11); // 0% to 100% inclusive
    expect(steps[0]).toEqual(coordA);
    expect(steps[steps.length - 1].latitude).toBeCloseTo(coordB.latitude, 4);
    expect(steps[steps.length - 1].longitude).toBeCloseTo(coordB.longitude, 4);
  });
});
