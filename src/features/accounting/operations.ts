/**
 * Minimal business-operation helpers that translate a structured business
 * operation into a balanced `NewJournalEntry` and post it. These are
 * domain helpers, not UI functions or a parser — they take account ids and
 * amounts the caller has already resolved (e.g. via classification), never
 * free text. See docs/accounting-model.md for the double-entry convention
 * used here.
 */
import type { NewJournalEntry, VoucherType } from './types';
import { postJournalEntry } from './posting';

interface TwoAccountOperation {
  date: string;
  amountMinor: number;
  narration?: string | null;
  voucherNumber?: string;
  sourceTransactionId?: number | null;
}

/** Purchase: debit the expense/item ledger, credit cash or the supplier (creditor). */
export interface PurchaseInput extends TwoAccountOperation {
  expenseOrItemAccountId: number;
  cashOrCreditorAccountId: number;
}

export function postPurchase(input: PurchaseInput) {
  return postTwoLineEntry(
    'purchase',
    input.expenseOrItemAccountId,
    input.cashOrCreditorAccountId,
    input,
  );
}

/** Sale: debit cash or the customer (debtor), credit the sales/income ledger. */
export interface SaleInput extends TwoAccountOperation {
  cashOrDebtorAccountId: number;
  salesAccountId: number;
}

export function postSale(input: SaleInput) {
  return postTwoLineEntry('sale', input.cashOrDebtorAccountId, input.salesAccountId, input);
}

/** Payment: debit the expense or supplier (creditor) being paid off, credit cash/bank. */
export interface PaymentInput extends TwoAccountOperation {
  expenseOrCreditorAccountId: number;
  cashOrBankAccountId: number;
}

export function postPayment(input: PaymentInput) {
  return postTwoLineEntry(
    'payment',
    input.expenseOrCreditorAccountId,
    input.cashOrBankAccountId,
    input,
  );
}

/** Receipt: debit cash/bank, credit the income or customer (debtor) being settled. */
export interface ReceiptInput extends TwoAccountOperation {
  cashOrBankAccountId: number;
  incomeOrDebtorAccountId: number;
}

export function postReceipt(input: ReceiptInput) {
  return postTwoLineEntry(
    'receipt',
    input.cashOrBankAccountId,
    input.incomeOrDebtorAccountId,
    input,
  );
}

function postTwoLineEntry(
  voucherType: VoucherType,
  debitAccountId: number,
  creditAccountId: number,
  input: TwoAccountOperation,
) {
  const entry: NewJournalEntry = {
    voucherType,
    voucherNumber: input.voucherNumber,
    date: input.date,
    narration: input.narration ?? null,
    sourceTransactionId: input.sourceTransactionId ?? null,
    lines: [
      { accountId: debitAccountId, side: 'debit', amountMinor: input.amountMinor },
      { accountId: creditAccountId, side: 'credit', amountMinor: input.amountMinor },
    ],
  };
  return postJournalEntry(entry);
}
