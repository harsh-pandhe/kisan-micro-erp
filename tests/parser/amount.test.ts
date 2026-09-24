import { describe, expect, it } from 'vitest';
import { findAmountToken, parseAmount } from '../../src/parser';

describe('parseAmount', () => {
  const successCases: Array<[string, number]> = [
    ['₹500', 50000],
    ['500', 50000],
    ['Rs 500', 50000],
    ['₹1,250', 125000],
    ['1,250.50', 125050],
    ['₹1,250.50', 125050],
    ['500 rupees', 50000],
    ['0.50', 50],
  ];

  it.each(successCases)('parses %j as %i minor units', (input, expectedMinorUnits) => {
    const result = parseAmount(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.amount.minorUnits).toBe(expectedMinorUnits);
      expect(Number.isInteger(result.amount.minorUnits)).toBe(true);
      expect(result.amount.currency).toBe('INR');
    }
  });

  const failureCases: string[] = ['₹', '₹abc', '', '₹12.345', '-500', '.', '₹.'];

  it.each(failureCases)('rejects malformed amount %j', (input) => {
    const result = parseAmount(input);
    expect(result.ok).toBe(false);
  });

  it('never produces a float value for minor units', () => {
    const result = parseAmount('₹1,250.50');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Number.isInteger(result.amount.minorUnits)).toBe(true);
      expect(Number.isSafeInteger(result.amount.minorUnits)).toBe(true);
    }
  });

  it('is deterministic across repeated calls', () => {
    expect(parseAmount('₹1,250.50')).toEqual(parseAmount('₹1,250.50'));
  });
});

describe('findAmountToken', () => {
  it('locates a ₹-prefixed amount inside a sentence', () => {
    expect(findAmountToken('bought fertilizer for ₹500')).toBe('₹500');
  });

  it('locates a trailing "rupees" amount inside a sentence', () => {
    expect(findAmountToken('kharcha 500 rupees hua')).toBe('500 rupees');
  });

  it('returns undefined when no digits are present', () => {
    expect(findAmountToken('bought fertilizer')).toBeUndefined();
  });
});
