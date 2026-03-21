import { describe, it, expect } from 'vitest';
import {
  timeStringToSeconds,
  secondsToTimeString,
  calculatePacePerKm,
  formatPace,
} from '../pace-utils';

describe('timeStringToSeconds', () => {
  it('parses HH:MM:SS correctly', () => {
    expect(timeStringToSeconds('1:30:00', '5k')).toBe(5400);
    expect(timeStringToSeconds('2:05:30', 'marathon')).toBe(7530);
  });

  it('parses MM:SS for short races (5k, 10k)', () => {
    expect(timeStringToSeconds('25:30', '5k')).toBe(1530);
    expect(timeStringToSeconds('48:00', '10k')).toBe(2880);
  });

  it('parses HH:MM for long races (half-marathon, marathon)', () => {
    expect(timeStringToSeconds('1:45', 'half-marathon')).toBe(6300);
    expect(timeStringToSeconds('3:30', 'marathon')).toBe(12600);
  });

  it('handles single seconds value', () => {
    expect(timeStringToSeconds('3600', '5k')).toBe(3600);
  });

  it('returns 0 for empty string', () => {
    expect(timeStringToSeconds('', '5k')).toBe(0);
  });
});

describe('secondsToTimeString', () => {
  it('formats sub-hour times as MM:SS', () => {
    expect(secondsToTimeString(1530)).toBe('25:30');
    expect(secondsToTimeString(600)).toBe('10:00');
    expect(secondsToTimeString(65)).toBe('1:05');
  });

  it('formats times over an hour as H:MM:SS', () => {
    expect(secondsToTimeString(5400)).toBe('1:30:00');
    expect(secondsToTimeString(7530)).toBe('2:05:30');
  });

  it('returns empty string for zero or negative', () => {
    expect(secondsToTimeString(0)).toBe('');
    expect(secondsToTimeString(-1)).toBe('');
  });
});

describe('calculatePacePerKm', () => {
  it('returns seconds per km', () => {
    // 5km in 25 minutes (1500s) → 300s/km
    expect(calculatePacePerKm(1500, 5)).toBe(300);
  });

  it('returns 0 when inputs are missing', () => {
    expect(calculatePacePerKm(0, 5)).toBe(0);
    expect(calculatePacePerKm(1500, 0)).toBe(0);
  });
});

describe('formatPace', () => {
  it('formats seconds to MM:SS pace string', () => {
    expect(formatPace(300)).toBe('5:00');
    expect(formatPace(315)).toBe('5:15');
    expect(formatPace(270)).toBe('4:30');
  });

  it('pads seconds below 10 with a leading zero', () => {
    expect(formatPace(305)).toBe('5:05');
  });

  it('returns "N/A" for zero or negative pace', () => {
    expect(formatPace(0)).toBe('N/A');
    expect(formatPace(-1)).toBe('N/A');
  });
});
