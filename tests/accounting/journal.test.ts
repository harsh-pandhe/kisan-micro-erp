import { describe, expect, it } from 'vitest';
import { ValidationError, UnbalancedEntryError } from '../../src/features/accounting/errors';
import { validateJournalEntry } from '../../src/features/accounting/validation';
import type { NewJournalEntry } from '../../src/features/accounting/types';

function base(overrides: Partial<NewJournalEntry> = {}): NewJournalEntry {
  return {
    voucherType: 'journal',
    date: '2026-01-01',
    lines: [
      { accountId: 1, side: 'debit', amountMinor: 100 },
      { accountId: 2, side: 'credit', amountMinor: 100 },
    ],
    ...overrides,
  };
}

describe('journal entry structural validation', () => {
  it('accepts a valid balanced 2-line entry', () => {
    expect(() => validateJournalEntry(base())).not.toThrow();
  });

  it('accepts a valid balanced multi-line entry (debit 100 / credit 50+50)', () => {
    const entry = base({
      lines: [
        { accountId: 1, side: 'debit', amountMinor: 100 },
        { accountId: 2, side: 'credit', amountMinor: 50 },
        { accountId: 3, side: 'credit', amountMinor: 50 },
      ],
    });
    expect(() => validateJournalEntry(entry)).not.toThrow();
  });

  it('rejects a zero amount line', () => {
    const entry = base({
      lines: [
        { accountId: 1, side: 'debit', amountMinor: 0 },
        { accountId: 2, side: 'credit', amountMinor: 0 },
      ],
    });
    expect(() => validateJournalEntry(entry)).toThrow(ValidationError);
  });

  it('rejects a negative amount line', () => {
    const entry = base({
      lines: [
        { accountId: 1, side: 'debit', amountMinor: -100 },
        { accountId: 2, side: 'credit', amountMinor: 100 },
      ],
    });
    expect(() => validateJournalEntry(entry)).toThrow(ValidationError);
  });

  it('rejects a non-integer (float) amount', () => {
    const entry = base({
      lines: [
        { accountId: 1, side: 'debit', amountMinor: 100.5 },
        { accountId: 2, side: 'credit', amountMinor: 100.5 },
      ],
    });
    expect(() => validateJournalEntry(entry)).toThrow(ValidationError);
  });

  it('rejects a missing account id', () => {
    const entry = base({
      lines: [
        { accountId: undefined as unknown as number, side: 'debit', amountMinor: 100 },
        { accountId: 2, side: 'credit', amountMinor: 100 },
      ],
    });
    expect(() => validateJournalEntry(entry)).toThrow(ValidationError);
  });

  it('rejects a malformed side indicator', () => {
    const entry = base({
      lines: [
        { accountId: 1, side: 'sideways' as never, amountMinor: 100 },
        { accountId: 2, side: 'credit', amountMinor: 100 },
      ],
    });
    expect(() => validateJournalEntry(entry)).toThrow(ValidationError);
  });

  it('rejects a single-line entry', () => {
    const entry = base({ lines: [{ accountId: 1, side: 'debit', amountMinor: 100 }] });
    expect(() => validateJournalEntry(entry)).toThrow(ValidationError);
  });

  it('rejects an empty entry', () => {
    const entry = base({ lines: [] });
    expect(() => validateJournalEntry(entry)).toThrow(ValidationError);
  });

  it('rejects an unbalanced entry: debit 100 / credit 90', () => {
    const entry = base({
      lines: [
        { accountId: 1, side: 'debit', amountMinor: 100 },
        { accountId: 2, side: 'credit', amountMinor: 90 },
      ],
    });
    expect(() => validateJournalEntry(entry)).toThrow(UnbalancedEntryError);
  });

  it('accepts a balanced entry: debit 100 / credit 100', () => {
    const entry = base({
      lines: [
        { accountId: 1, side: 'debit', amountMinor: 100 },
        { accountId: 2, side: 'credit', amountMinor: 100 },
      ],
    });
    expect(() => validateJournalEntry(entry)).not.toThrow();
  });

  it('rejects an invalid voucher type', () => {
    const entry = base({ voucherType: 'not-a-type' as never });
    expect(() => validateJournalEntry(entry)).toThrow(ValidationError);
  });
});
