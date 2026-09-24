/**
 * Typed error hierarchy for the accounting engine. Callers (eventually UI)
 * can branch on `kind` instead of parsing raw sql.js/SQLite error messages.
 */
export type AccountingErrorKind =
  | 'validation'
  | 'account-not-found'
  | 'duplicate-account'
  | 'duplicate-voucher'
  | 'unbalanced-entry'
  | 'database';

export class AccountingError extends Error {
  readonly kind: AccountingErrorKind;
  readonly cause?: unknown;

  constructor(kind: AccountingErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = 'AccountingError';
    this.kind = kind;
    this.cause = cause;
  }
}

export class ValidationError extends AccountingError {
  constructor(message: string, cause?: unknown) {
    super('validation', message, cause);
    this.name = 'ValidationError';
  }
}

export class AccountNotFoundError extends AccountingError {
  constructor(message: string, cause?: unknown) {
    super('account-not-found', message, cause);
    this.name = 'AccountNotFoundError';
  }
}

export class DuplicateAccountError extends AccountingError {
  constructor(message: string, cause?: unknown) {
    super('duplicate-account', message, cause);
    this.name = 'DuplicateAccountError';
  }
}

export class DuplicateVoucherError extends AccountingError {
  constructor(message: string, cause?: unknown) {
    super('duplicate-voucher', message, cause);
    this.name = 'DuplicateVoucherError';
  }
}

export class UnbalancedEntryError extends AccountingError {
  constructor(message: string, cause?: unknown) {
    super('unbalanced-entry', message, cause);
    this.name = 'UnbalancedEntryError';
  }
}

export class AccountingDatabaseError extends AccountingError {
  constructor(message: string, cause?: unknown) {
    super('database', message, cause);
    this.name = 'AccountingDatabaseError';
  }
}
