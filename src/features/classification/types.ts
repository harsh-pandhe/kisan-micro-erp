/**
 * Types for Milestone 5: deterministic ledger classification and
 * self-learning item->account mappings.
 *
 * This module maps a Milestone 4 `ParsedTransaction` to an existing
 * accounting account. It never posts journal entries, never mutates
 * balances, and never auto-creates accounts — see docs/milestone-5.md.
 */
import type { ParsedTransaction } from '../../parser/types';
import type { Account } from '../accounting/types';

/** How a match was determined. */
export type MatchSource = 'exact_mapping' | 'keyword_mapping';

/** A stored item->account mapping row (mirrors `item_mappings`). */
export interface ItemMapping {
  id: number;
  itemNameNormalized: string;
  accountId: number;
  createdAt: string;
}

/** Input for creating/updating a mapping. */
export interface NewItemMapping {
  /** Raw (not-yet-normalized) source key: an item/description or merchant term. */
  sourceKey: string;
  accountId: number;
}

/** A candidate match surfaced when classification cannot safely pick one. */
export interface ClassificationCandidate {
  accountId: number;
  account: Account;
  source: MatchSource;
  /** The normalized key/keyword that produced this candidate. */
  matchedKey: string;
}

export type ClassificationStatus = 'matched' | 'unknown' | 'ambiguous' | 'invalid';

interface ClassifiedBase {
  /** The original parsed transaction, never mutated. */
  transaction: ParsedTransaction;
  status: ClassificationStatus;
  /** Whether a human should confirm before this is used for posting. */
  requiresConfirmation: boolean;
  /** Human-readable reason for the outcome (always present). */
  reason: string;
}

export interface MatchedClassification extends ClassifiedBase {
  status: 'matched';
  accountId: number;
  account: Account;
  matchSource: MatchSource;
  mapping: ItemMapping;
  requiresConfirmation: false;
}

export interface UnknownClassification extends ClassifiedBase {
  status: 'unknown';
  accountId: undefined;
  requiresConfirmation: true;
}

export interface AmbiguousClassification extends ClassifiedBase {
  status: 'ambiguous';
  accountId: undefined;
  candidates: ClassificationCandidate[];
  requiresConfirmation: true;
}

/** The parsed transaction itself was not usable for classification (e.g. no item/party text). */
export interface InvalidClassification extends ClassifiedBase {
  status: 'invalid';
  accountId: undefined;
  requiresConfirmation: true;
}

export type ClassifiedTransaction =
  MatchedClassification | UnknownClassification | AmbiguousClassification | InvalidClassification;

/** Classification-specific typed error kinds, consistent with M3's error style. */
export type ClassificationErrorKind =
  'validation' | 'account-not-found' | 'mapping-conflict' | 'database';

export class ClassificationError extends Error {
  readonly kind: ClassificationErrorKind;
  readonly cause?: unknown;

  constructor(kind: ClassificationErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = 'ClassificationError';
    this.kind = kind;
    this.cause = cause;
  }
}

export class MappingValidationError extends ClassificationError {
  constructor(message: string, cause?: unknown) {
    super('validation', message, cause);
    this.name = 'MappingValidationError';
  }
}

export class MappingAccountNotFoundError extends ClassificationError {
  constructor(message: string, cause?: unknown) {
    super('account-not-found', message, cause);
    this.name = 'MappingAccountNotFoundError';
  }
}

export class MappingConflictError extends ClassificationError {
  constructor(message: string, cause?: unknown) {
    super('mapping-conflict', message, cause);
    this.name = 'MappingConflictError';
  }
}
