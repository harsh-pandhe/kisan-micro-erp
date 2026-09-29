import { CircleCheck, HelpCircle, Landmark, ListTree } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { Account } from '../features/accounting';
import type { ClassifiedTransaction } from '../features/classification';
import { UiButton } from './ui/button';
import { UiCard, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

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

function AccountRow({
  account,
  selected,
  onSelect,
}: {
  account: Account;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-colors ${
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
          : 'border-border bg-card hover:bg-muted'
      }`}
    >
      <Landmark className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="flex-1">
        <span className="block text-body-small font-medium text-foreground">{account.name}</span>
        <span className="block text-caption text-muted-foreground">{account.type}</span>
      </span>
      {selected ? (
        <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
      ) : null}
    </button>
  );
}

/**
 * Shows the M5 classification outcome and, for UNKNOWN/AMBIGUOUS results (or
 * a user-initiated change to a MATCHED one), an account picker. The
 * "remember this" checkbox only ever wires into `learnMapping`/
 * `relearnMapping` when the user explicitly confirms — never automatically,
 * and this component never offers or creates a fallback account.
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
  const reduceMotion = useReducedMotion();

  if (status === 'matched' && !isEditingMatch) {
    return (
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <UiCard aria-live="polite">
          <CardHeader>
            <CardTitle>Matched account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-muted/40 px-3 py-2.5">
              <Landmark className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="flex-1">
                <span className="block text-body-small font-medium text-foreground">
                  {classification.account.name}
                </span>
                <span className="block text-caption text-muted-foreground">
                  {classification.account.type}
                </span>
              </span>
              <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
            </div>
            <p className="text-caption text-muted-foreground">{reason}</p>
            <UiButton
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={onStartEditMatch}
            >
              Change account
            </UiButton>
          </CardContent>
        </UiCard>
      </motion.div>
    );
  }

  const candidateAccounts =
    status === 'ambiguous' ? classification.candidates.map((c) => c.account) : accounts;
  const heading =
    status === 'unknown'
      ? "We don't know this item yet"
      : status === 'ambiguous'
        ? 'A few accounts could match'
        : 'Choose an account';
  const Icon = status === 'ambiguous' ? ListTree : HelpCircle;
  const canRemember = status !== 'ambiguous';

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <UiCard tone="warning" aria-live="polite">
        <CardHeader className="flex-row items-center gap-2">
          <Icon className="size-5 shrink-0 text-warning" aria-hidden="true" />
          <CardTitle>{heading}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-caption text-muted-foreground">{reason}</p>

          {status === 'ambiguous' ? (
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Choose an account">
              {candidateAccounts.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  selected={selectedAccountId === account.id}
                  onSelect={() => onSelectAccount(account.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-label text-foreground" htmlFor="account-picker">
                Choose an account
              </label>
              <Select
                value={selectedAccountId ? String(selectedAccountId) : undefined}
                onValueChange={(v) => onSelectAccount(Number(v))}
              >
                <SelectTrigger id="account-picker" aria-label="Choose an account">
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
          )}

          {canRemember ? (
            <label className="flex items-start gap-2 text-body-small text-foreground">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-border accent-[var(--color-primary)]"
                checked={rememberChoice}
                onChange={(e) => onRememberChoiceChange(e.target.checked)}
              />
              <span>
                Remember this for future transactions
                <span className="block text-caption text-muted-foreground">
                  Your choice will be saved for the same item next time.
                </span>
              </span>
            </label>
          ) : null}
        </CardContent>
      </UiCard>
    </motion.div>
  );
}
