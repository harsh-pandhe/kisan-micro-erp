import { motion, useReducedMotion } from 'motion/react';
import type { Account } from '../features/accounting';
import type { ParsedTransaction, ParsedTransactionType } from '../parser/types';
import { UiButton } from './ui/button';
import { UiCard, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

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
  return `₹${(minorUnits / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

const TYPE_LABEL: Record<ParsedTransactionType, string> = {
  purchase: 'Purchase',
  sale: 'Sale',
  payment: 'Payment',
  receipt: 'Receipt',
};

// Existing M6 counter-account labeling semantics, restyled only.
const COUNTER_LABEL: Record<ParsedTransactionType, string> = {
  purchase: 'Paid from / owed to (cash, bank or supplier)',
  sale: 'Received into / owed by (cash, bank or customer)',
  payment: 'Paid from (cash or bank)',
  receipt: 'Received into (cash or bank)',
};

/**
 * Final confirmation card — the financial safety checkpoint. Nothing is
 * posted until the user explicitly presses "Record transaction"; parsing and
 * classification succeeding is never enough on its own.
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
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <UiCard tone="highlighted">
        <CardHeader>
          <CardTitle>Review before recording</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {transaction.amount ? (
            <p className="financial-number text-4xl text-foreground">
              {formatAmount(transaction.amount.minorUnits)}
            </p>
          ) : null}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-body-small">
            <div className="contents">
              <dt className="text-muted-foreground">Type</dt>
              <dd className="text-foreground">{TYPE_LABEL[type]}</dd>
            </div>
            {transaction.description || transaction.party ? (
              <div className="contents">
                <dt className="text-muted-foreground">For</dt>
                <dd className="text-foreground">{transaction.description ?? transaction.party}</dd>
              </div>
            ) : null}
            <div className="contents">
              <dt className="text-muted-foreground">Matched account</dt>
              <dd className="text-foreground">{itemAccount.name}</dd>
            </div>
            <div className="contents">
              <dt className="text-muted-foreground">Date</dt>
              <dd className="text-foreground">{transaction.date ?? 'Today'}</dd>
            </div>
          </dl>

          <div className="flex flex-col gap-1.5">
            <label className="text-label text-foreground" htmlFor="counter-account-picker">
              {COUNTER_LABEL[type]}
            </label>
            <Select
              value={counterAccount ? String(counterAccount.id) : undefined}
              onValueChange={(v) => onCounterAccountChange(Number(v))}
            >
              <SelectTrigger id="counter-account-picker" aria-label={COUNTER_LABEL[type]}>
                <SelectValue placeholder="Select an account…" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={String(account.id)}>
                    {account.name} ({account.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-caption text-muted-foreground">Nothing has been recorded yet.</p>

          {error ? (
            <p role="alert" aria-live="assertive" className="text-body-small text-danger">
              {error}
            </p>
          ) : null}

          <UiButton
            type="button"
            size="lg"
            loading={isPosting}
            onClick={onConfirm}
            disabled={!canConfirm}
            className="w-full sm:w-auto"
          >
            {isPosting ? 'Recording…' : 'Record transaction'}
          </UiButton>
        </CardContent>
      </UiCard>
    </motion.div>
  );
}
