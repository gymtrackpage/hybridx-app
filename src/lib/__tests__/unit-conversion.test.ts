import { describe, it, expect } from 'vitest';
import {
  convertWeight,
  convertDistance,
  convertTextWithUnits,
  convertDistanceInText,
} from '../unit-conversion';

describe('convertWeight', () => {
  it('converts kg number to metric string', () => {
    expect(convertWeight(60, 'metric')).toBe('60kg');
  });

  it('converts kg number to imperial lbs', () => {
    expect(convertWeight(100, 'imperial')).toBe('220lbs');
  });

  it('converts a kg string to lbs', () => {
    expect(convertWeight('80kg', 'imperial')).toBe('176lbs');
  });

  it('converts a lbs string to metric kg', () => {
    expect(convertWeight('220lbs', 'metric')).toBe('99.8kg');
  });

  it('returns original string when no numeric part found', () => {
    expect(convertWeight('heavy', 'metric')).toBe('heavy');
  });
});

describe('convertDistance', () => {
  it('converts km number to metric string', () => {
    expect(convertDistance(5, 'metric')).toBe('5.00km');
  });

  it('converts km number to miles', () => {
    const result = convertDistance(10, 'imperial');
    expect(result).toBe('6.21mi');
  });

  it('converts a miles string to km', () => {
    const result = convertDistance('5mi', 'metric');
    expect(result).toMatch(/km$/);
  });

  it('returns original string for non-numeric input', () => {
    expect(convertDistance('far', 'metric')).toBe('far');
  });
});

describe('convertTextWithUnits', () => {
  it('converts kg references in exercise description to lbs', () => {
    expect(convertTextWithUnits('4 sets @ 60kg', 'imperial')).toBe('4 sets @ 132lbs');
  });

  it('converts lbs references to kg in metric mode', () => {
    const result = convertTextWithUnits('3x8 @ 135lbs', 'metric');
    expect(result).toContain('kg');
    expect(result).not.toContain('lbs');
  });

  it('leaves non-weight text unchanged', () => {
    expect(convertTextWithUnits('10 reps', 'imperial')).toBe('10 reps');
  });

  it('handles empty/null-like input gracefully', () => {
    expect(convertTextWithUnits('', 'metric')).toBe('');
  });

  it('keeps metric values unchanged when already in metric', () => {
    expect(convertTextWithUnits('20kg', 'metric')).toBe('20kg');
  });
});

describe('convertDistanceInText', () => {
  it('converts km to miles in text', () => {
    expect(convertDistanceInText('Run 5km at easy pace', 'imperial')).toBe('Run 3.11mi at easy pace');
  });

  it('converts miles to km in text', () => {
    const result = convertDistanceInText('Run 3mi', 'metric');
    expect(result).toContain('km');
  });

  it('leaves text without distances unchanged', () => {
    expect(convertDistanceInText('Easy effort today', 'imperial')).toBe('Easy effort today');
  });

  it('handles empty string gracefully', () => {
    expect(convertDistanceInText('', 'metric')).toBe('');
  });
});
