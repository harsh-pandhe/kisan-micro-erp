import type { Account } from '../features/accounting';
import type { ParsedTransaction, ParsedTransactionType } from '../parser/types';
import { Button } from './Button';
import { Card } from './Card';

interface TransactionReviewProps {
  transaction: ParsedTransaction;
  type: ParsedTransactionType;
  itemAccount: Account;
  counterAccount: Account | undefined;
  accounts: Account[];
  onCounterAccountChange: (accountId: number) => void;
  onConfirm: () => void;
  isPosting: boolean;
  error: string | null;
}

function formatAmount(minorUnits: number): string {
  return `₹${(minorUnits / 100).toFixed(2)}`;
}

const COUNTER_LABEL: Record<ParsedTransactionType, string> = {
  purchase: 'Paid from / owed to (cash, bank or supplier)',
  sale: 'Received into / owed by (cash, bank or customer)',
  payment: 'Paid from (cash or bank)',
  receipt: 'Received into (cash or bank)',
};

/**
 * Final confirmation card. Nothing is posted until the user explicitly
 * presses "Record Transaction" — parsing and classification succeeding is
 * never enough on its own.
 */
export function TransactionReview({
  transaction,
  type,
  itemAccount,
  counterAccount,
  accounts,
  onCounterAccountChange,
  onConfirm,
  isPosting,
  error,
}: TransactionReviewProps) {
  const canConfirm = counterAccount !== undefined && !isPosting;

  return (
    <Card title="Review & confirm" className="transaction-review">
      <dl className="parse-result__fields">
        <div className="parse-result__field">
          <dt>Type</dt>
          <dd>{type}</dd>
        </div>
        <div className="parse-result__field">
          <dt>Amount</dt>
          <dd>{transaction.amount ? formatAmount(transaction.amount.minorUnits) : '—'}</dd>
        </div>
        <div className="parse-result__field">
          <dt>Item / party</dt>
          <dd>{transaction.description ?? transaction.party ?? '—'}</dd>
        </div>
        <div className="parse-result__field">
          <dt>Payment mode</dt>
          <dd>{transaction.paymentMode ?? '—'}</dd>
        </div>
        <div className="parse-result__field">
          <dt>Date</dt>
          <dd>{transaction.date ?? 'Today'}</dd>
        </div>
        <div className="parse-result__field">
          <dt>Account</dt>
          <dd>{itemAccount.name}</dd>
        </div>
      </dl>

      <label className="field">
        <span className="field__label">{COUNTER_LABEL[type]}</span>
        <select
          className="field__input"
          value={counterAccount?.id ?? ''}
          onChange={(e) => onCounterAccountChange(Number(e.target.value))}
        >
          <option value="" disabled>
            Select an account…
          </option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.type})
            </option>
          ))}
        </select>
      </label>

      {error ? (
        <p role="alert" className="transaction-review__error">
          {error}
        </p>
      ) : null}

      <Button type="button" onClick={onConfirm} disabled={!canConfirm}>
        {isPosting ? 'Recording…' : 'Record Transaction'}
      </Button>
    </Card>
  );
}
