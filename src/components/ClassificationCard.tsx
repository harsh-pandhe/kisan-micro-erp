import type { Account } from '../features/accounting';
import type { ClassifiedTransaction } from '../features/classification';
import { Button } from './Button';
import { Card } from './Card';
import { StatusBadge } from './StatusBadge';

interface ClassificationCardProps {
  classification: ClassifiedTransaction;
  accounts: Account[];
  /** Currently selected account id for UNKNOWN/AMBIGUOUS, or a matched result the user wants to change. */
  selectedAccountId: number | undefined;
  onSelectAccount: (accountId: number) => void;
  rememberChoice: boolean;
  onRememberChoiceChange: (value: boolean) => void;
  /** True once the user has explicitly opened "change account" on a matched result. */
  isEditingMatch: boolean;
  onStartEditMatch: () => void;
}

/**
 * Shows the M5 classification outcome and, for UNKNOWN/AMBIGUOUS results (or
 * a user-initiated change to a MATCHED one), an account picker. The
 * "remember this" checkbox only ever wires into `learnMapping`/
 * `relearnMapping` when the user explicitly confirms — never automatically.
 */
export function ClassificationCard({
  classification,
  accounts,
  selectedAccountId,
  onSelectAccount,
  rememberChoice,
  onRememberChoiceChange,
  isEditingMatch,
  onStartEditMatch,
}: ClassificationCardProps) {
  const { status, reason } = classification;

  if (status === 'matched' && !isEditingMatch) {
    return (
      <Card title="Account" className="classification">
        <StatusBadge tone="positive">Matched</StatusBadge>
        <p>
          <strong>{classification.account.name}</strong> ({classification.account.type})
        </p>
        <p className="classification__reason">{reason}</p>
        <Button type="button" variant="ghost" onClick={onStartEditMatch}>
          Change account
        </Button>
      </Card>
    );
  }

  const candidateAccounts =
    status === 'ambiguous' ? classification.candidates.map((c) => c.account) : accounts;

  return (
    <Card title="Account" className="classification">
      <StatusBadge tone="warning">
        {status === 'unknown'
          ? 'Unknown item'
          : status === 'ambiguous'
            ? 'Ambiguous match'
            : 'Needs an account'}
      </StatusBadge>
      <p className="classification__reason">{reason}</p>
      <label className="field">
        <span className="field__label">Choose an account</span>
        <select
          className="field__input"
          value={selectedAccountId ?? ''}
          onChange={(e) => onSelectAccount(Number(e.target.value))}
        >
          <option value="" disabled>
            Select an account…
          </option>
          {(status === 'ambiguous' ? candidateAccounts : accounts).map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.type})
            </option>
          ))}
        </select>
      </label>
      {status !== 'ambiguous' ? (
        <label className="classification__remember">
          <input
            type="checkbox"
            checked={rememberChoice}
            onChange={(e) => onRememberChoiceChange(e.target.checked)}
          />
          Remember this for next time
        </label>
      ) : null}
    </Card>
  );
}
