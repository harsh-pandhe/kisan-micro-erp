import { describe, expect, it } from 'vitest';
import { parseTransactionText } from '../../src/parser';

describe('parseTransactionText: malformed and ambiguous input', () => {
  it('does not treat a bare number as a complete transaction', () => {
    const result = parseTransactionText('500');
    expect(result.status).not.toBe('SUCCESS');
    expect(['AMBIGUOUS', 'INVALID']).toContain(result.status);
  });

  it('rejects "₹abc" as an invalid amount', () => {
    const result = parseTransactionText('₹abc');
    expect(result.status).toBe('INVALID');
  });

  it('rejects an empty string', () => {
    const result = parseTransactionText('');
    expect(result.status).toBe('INVALID');
  });

  it('rejects whitespace-only input', () => {
    const result = parseTransactionText('   ');
    expect(result.status).toBe('INVALID');
  });

  it('rejects "₹12.345" for having 3 decimal digits', () => {
    const result = parseTransactionText('Paid ₹12.345 cash for fertilizer');
    expect(result.status).toBe('INVALID');
  });

  it('rejects a bare "₹" with no digits', () => {
    const result = parseTransactionText('₹');
    expect(result.status).toBe('INVALID');
  });

  it('returns AMBIGUOUS/INVALID for text with no recognized verb or amount', () => {
    const result = parseTransactionText('the weather is nice today');
    expect(result.status).not.toBe('SUCCESS');
  });

  it('returns AMBIGUOUS when the transaction type keyword is missing but an amount and context exist', () => {
    const result = parseTransactionText('₹500 for fertilizer');
    expect(result.status).toBe('AMBIGUOUS');
    if (result.status === 'AMBIGUOUS') {
      expect(result.transaction.amount?.minorUnits).toBe(50000);
    }
  });

  it('flags conflicting transaction-type keywords as AMBIGUOUS', () => {
    const result = parseTransactionText('bought and sold wheat for ₹500');
    expect(result.status).toBe('AMBIGUOUS');
  });

  it('rejects negative amounts', () => {
    const result = parseTransactionText('paid -500 cash for fertilizer');
    expect(result.status).toBe('INVALID');
  });

  it('does not silently reinterpret a malformed numeric date', () => {
    const result = parseTransactionText('paid ₹500 cash on 32/13/2026');
    expect(result.status).toBe('SUCCESS');
    if (result.status === 'SUCCESS') {
      expect(result.transaction.date).toBeUndefined();
    }
  });
});
