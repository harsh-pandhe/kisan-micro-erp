import { describe, expect, it } from 'vitest';
import { detectTransactionTypes } from '../../src/parser';

describe('detectTransactionTypes', () => {
  const cases: Array<[string, string[]]> = [
    ['bought fertilizer for ₹500', ['purchase']],
    ['purchased seeds', ['purchase']],
    ['kharcha 500', ['purchase']],
    ['sold wheat for ₹5000', ['sale']],
    ['₹5000 sale hui', ['sale']],
    ['paid ₹500 cash for fertilizer', ['payment']],
    ['₹500 cash diya', ['payment']],
    ['received ₹3000 from ramesh', ['receipt']],
    ['suresh se 1000 mila', ['receipt']],
    ['just some unrelated text', []],
  ];

  it.each(cases)('%j -> %j', (input, expected) => {
    expect(detectTransactionTypes(input)).toEqual(expected);
  });

  it('is deterministic across repeated calls', () => {
    const input = 'bought fertilizer for ₹500';
    expect(detectTransactionTypes(input)).toEqual(detectTransactionTypes(input));
  });
});
