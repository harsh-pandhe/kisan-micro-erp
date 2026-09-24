import { describe, expect, it } from 'vitest';
import { normalizeText } from '../../src/parser';

describe('normalizeText', () => {
  const cases: Array<[string, string]> = [
    ['  Bought fertilizer for ₹500  ', 'bought fertilizer for ₹500'],
    ['Bought   fertilizer  for ₹500', 'bought fertilizer for ₹500'],
    ['Rs. 500 paid cash', '₹500 paid cash'],
    ['Rs 500 paid cash', '₹500 paid cash'],
    ['INR500 paid', '₹500 paid'],
    ['PAID ₹500 CASH', 'paid ₹500 cash'],
  ];

  it.each(cases)('normalizes %j -> %j', (input, expected) => {
    expect(normalizeText(input)).toBe(expected);
  });

  it('does not mutate its input', () => {
    const input = '  Bought fertilizer for ₹500  ';
    normalizeText(input);
    expect(input).toBe('  Bought fertilizer for ₹500  ');
  });

  it('is deterministic across repeated calls', () => {
    const input = 'Paid ₹1200 via UPI';
    expect(normalizeText(input)).toBe(normalizeText(input));
  });
});
