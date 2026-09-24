import { describe, expect, it } from 'vitest';
import { parseTransactionText } from '../../src/parser';

const REF_DATE = new Date('2026-09-24T00:00:00Z');

describe('parseTransactionText: required success cases', () => {
  it('parses "Bought fertilizer for ₹500"', () => {
    const result = parseTransactionText('Bought fertilizer for ₹500', REF_DATE);
    expect(result.status).toBe('SUCCESS');
    if (result.status === 'SUCCESS') {
      expect(result.transaction.type).toBe('purchase');
      expect(result.transaction.amount).toEqual({ minorUnits: 50000, currency: 'INR' });
      expect(result.transaction.description).toBe('Fertilizer');
    }
  });

  it('parses "Paid ₹500 cash for fertilizer"', () => {
    const result = parseTransactionText('Paid ₹500 cash for fertilizer', REF_DATE);
    expect(result.status).toBe('SUCCESS');
    if (result.status === 'SUCCESS') {
      expect(result.transaction.type).toBe('payment');
      expect(result.transaction.amount?.minorUnits).toBe(50000);
      expect(result.transaction.paymentMode).toBe('cash');
      expect(result.transaction.description).toBe('Fertilizer');
    }
  });

  it('parses "Paid ₹1200 via UPI"', () => {
    const result = parseTransactionText('Paid ₹1200 via UPI', REF_DATE);
    expect(result.status).toBe('SUCCESS');
    if (result.status === 'SUCCESS') {
      expect(result.transaction.type).toBe('payment');
      expect(result.transaction.amount?.minorUnits).toBe(120000);
      expect(result.transaction.paymentMode).toBe('upi');
    }
  });

  it('parses "Sold wheat for ₹5000"', () => {
    const result = parseTransactionText('Sold wheat for ₹5000', REF_DATE);
    expect(result.status).toBe('SUCCESS');
    if (result.status === 'SUCCESS') {
      expect(result.transaction.type).toBe('sale');
      expect(result.transaction.amount?.minorUnits).toBe(500000);
      expect(result.transaction.description).toBe('Wheat');
    }
  });

  it('parses "Received ₹3000 from Ramesh"', () => {
    const result = parseTransactionText('Received ₹3000 from Ramesh', REF_DATE);
    expect(result.status).toBe('SUCCESS');
    if (result.status === 'SUCCESS') {
      expect(result.transaction.type).toBe('receipt');
      expect(result.transaction.amount?.minorUnits).toBe(300000);
      expect(result.transaction.party).toBe('Ramesh');
    }
  });

  it('parses Hinglish "kharcha 500 hua fertilizer ke liye"', () => {
    const result = parseTransactionText('kharcha 500 hua fertilizer ke liye', REF_DATE);
    expect(result.status).toBe('SUCCESS');
    if (result.status === 'SUCCESS') {
      expect(result.transaction.type).toBe('purchase');
      expect(result.transaction.amount?.minorUnits).toBe(50000);
      expect(result.transaction.description).toBe('Fertilizer');
    }
  });

  it('parses Hinglish "₹500 cash diya Ramesh ko"', () => {
    const result = parseTransactionText('₹500 cash diya to Ramesh', REF_DATE);
    expect(result.status).toBe('SUCCESS');
    if (result.status === 'SUCCESS') {
      expect(result.transaction.type).toBe('payment');
      expect(result.transaction.paymentMode).toBe('cash');
      expect(result.transaction.party).toBe('Ramesh');
    }
  });

  it('parses Hinglish "Suresh se 1000 mila"', () => {
    const result = parseTransactionText('Suresh se 1000 mila', REF_DATE);
    expect(result.status).toBe('SUCCESS');
    if (result.status === 'SUCCESS') {
      expect(result.transaction.type).toBe('receipt');
      expect(result.transaction.amount?.minorUnits).toBe(100000);
    }
  });

  it('parses Hinglish "₹5000 sale hui wheat ke liye"', () => {
    const result = parseTransactionText('₹5000 sale hui wheat ke liye', REF_DATE);
    expect(result.status).toBe('SUCCESS');
    if (result.status === 'SUCCESS') {
      expect(result.transaction.type).toBe('sale');
      expect(result.transaction.description).toBe('Wheat');
    }
  });

  it('resolves "today" using the injected reference date', () => {
    const result = parseTransactionText('Paid ₹500 cash today', REF_DATE);
    expect(result.status).toBe('SUCCESS');
    if (result.status === 'SUCCESS') {
      expect(result.transaction.date).toBe('2026-09-24');
    }
  });

  it('resolves "yesterday" using the injected reference date', () => {
    const result = parseTransactionText('Paid ₹500 cash yesterday', REF_DATE);
    expect(result.status).toBe('SUCCESS');
    if (result.status === 'SUCCESS') {
      expect(result.transaction.date).toBe('2026-09-23');
    }
  });

  it('parses an explicit DD/MM/YYYY date', () => {
    const result = parseTransactionText('Paid ₹500 cash on 05/03/2026', REF_DATE);
    expect(result.status).toBe('SUCCESS');
    if (result.status === 'SUCCESS') {
      expect(result.transaction.date).toBe('2026-03-05');
    }
  });
});

describe('parseTransactionText: purity and determinism', () => {
  it('produces equivalent output for the same input parsed twice', () => {
    const first = parseTransactionText('Bought fertilizer for ₹500', REF_DATE);
    const second = parseTransactionText('Bought fertilizer for ₹500', REF_DATE);
    expect(first).toEqual(second);
  });

  it('never returns a float for amount minor units', () => {
    const result = parseTransactionText('Sold wheat for ₹1,250.50', REF_DATE);
    expect(result.status).toBe('SUCCESS');
    if (result.status === 'SUCCESS') {
      expect(Number.isInteger(result.transaction.amount?.minorUnits)).toBe(true);
    }
  });

  it('does not depend on hidden mutable state between calls', () => {
    parseTransactionText('Sold wheat for ₹5000', REF_DATE);
    const result = parseTransactionText('Bought fertilizer for ₹500', REF_DATE);
    expect(result.status).toBe('SUCCESS');
    if (result.status === 'SUCCESS') {
      expect(result.transaction.type).toBe('purchase');
    }
  });
});
