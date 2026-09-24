import { useId, useState, type FormEvent } from 'react';
import type { AccountType } from '../features/accounting';
import { Button } from './Button';

interface AccountFormProps {
  onSubmit: (input: { code: string; name: string; type: AccountType }) => Promise<void> | void;
}

const ACCOUNT_TYPES: AccountType[] = ['asset', 'liability', 'equity', 'income', 'expense'];

/** Minimal account creation form: code, name, type. Validates before submit. */
export function AccountForm({ onSubmit }: AccountFormProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('expense');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const codeId = useId();
  const nameId = useId();
  const typeId = useId();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code.trim() || !name.trim()) {
      setError('Both a code and a name are required.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({ code: code.trim(), name: name.trim(), type });
      setCode('');
      setName('');
      setType('expense');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the account.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor={codeId} className="field__label">
          Code
        </label>
        <input
          id={codeId}
          className="field__input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. 1010"
        />
      </div>
      <div className="field">
        <label htmlFor={nameId} className="field__label">
          Name
        </label>
        <input
          id={nameId}
          className="field__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Cash"
        />
      </div>
      <div className="field">
        <label htmlFor={typeId} className="field__label">
          Type
        </label>
        <select
          id={typeId}
          className="field__input"
          value={type}
          onChange={(e) => setType(e.target.value as AccountType)}
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p role="alert" className="account-form__error">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Adding…' : 'Add Account'}
      </Button>
    </form>
  );
}
