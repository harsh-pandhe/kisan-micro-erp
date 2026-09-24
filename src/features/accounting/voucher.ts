/**
 * Minimal deterministic voucher numbering: `<PREFIX>-<YYYYMMDD>-<seq>`,
 * where seq is 1 + however many vouchers of that type already exist for
 * that date. The `journal_entries.voucher_number` UNIQUE constraint is the
 * final authority — a collision (e.g. concurrent posts) is surfaced as a
 * clean rejection by `posting.ts`, never silently retried into a
 * misleading partial record.
 */
import { getDatabase } from '../../db/database';
import type { VoucherType } from './types';

const PREFIX: Record<VoucherType, string> = {
  purchase: 'PUR',
  sale: 'SAL',
  payment: 'PAY',
  receipt: 'REC',
  journal: 'JV',
};

/** Generates the next voucher number for a given type/date. Not itself atomic; the DB UNIQUE constraint is authoritative. */
export function generateVoucherNumber(voucherType: VoucherType, date: string): string {
  const db = getDatabase();
  const datePart = date.replace(/-/g, '');
  const prefix = PREFIX[voucherType];
  const likePattern = `${prefix}-${datePart}-%`;
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM journal_entries WHERE voucher_number LIKE ?`,
    [likePattern],
  );
  const seq = (rows[0]?.count ?? 0) + 1;
  return `${prefix}-${datePart}-${String(seq).padStart(4, '0')}`;
}
