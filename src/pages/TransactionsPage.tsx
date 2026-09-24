import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { TransactionInput } from '../components/TransactionInput';
import { ParseResultCard } from '../components/ParseResultCard';
import { ClassificationCard } from '../components/ClassificationCard';
import { TransactionReview } from '../components/TransactionReview';
import { TransactionHistory } from '../components/TransactionHistory';
import type { VoiceLanguage } from '../components/VoiceInputButton';
import { parseTransactionText } from '../parser';
import type { ParseResult } from '../parser/types';
import { classify, learnMapping, relearnMapping } from '../features/classification';
import type { ClassifiedTransaction } from '../features/classification';
import { getAllAccounts } from '../features/accounting';
import type { Account } from '../features/accounting';
import { listTransactionHistory, recordTransaction } from '../features/transactions';
import type { TransactionHistoryItem } from '../features/transactions';
import { BACKUP_RESTORED_EVENT } from '../features/backup';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultCounterAccountId(
  paymentMode: string | undefined,
  accounts: Account[],
): number | undefined {
  const name = paymentMode === 'cash' ? 'Cash' : paymentMode ? 'Bank' : undefined;
  if (!name) return undefined;
  const match = accounts.find((a) => a.name.toLowerCase() === name.toLowerCase());
  return match?.id;
}

/** Reads accounts, tolerating a DB that isn't initialized yet (e.g. in isolated tests). */
function safeGetAllAccounts(): Account[] {
  try {
    return getAllAccounts();
  } catch {
    return [];
  }
}

function safeListTransactionHistory(): TransactionHistoryItem[] {
  try {
    return listTransactionHistory();
  } catch {
    return [];
  }
}

export function TransactionsPage() {
  const [inputText, setInputText] = useState('');
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceLanguage>('en-IN');

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [classification, setClassification] = useState<ClassifiedTransaction | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(undefined);
  const [isEditingMatch, setIsEditingMatch] = useState(false);
  const [rememberChoice, setRememberChoice] = useState(false);
  const [counterAccountId, setCounterAccountId] = useState<number | undefined>(undefined);

  const [accounts, setAccounts] = useState<Account[]>(() => safeGetAllAccounts());
  const [history, setHistory] = useState<TransactionHistoryItem[]>(() =>
    safeListTransactionHistory(),
  );
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function refreshData() {
    setAccounts(safeGetAllAccounts());
    setHistory(safeListTransactionHistory());
  }

  // A restore replaces the active database; drop any in-progress draft and
  // re-read accounts/history so this page never shows pre-restore state.
  useEffect(() => {
    function handleRestored() {
      refreshData();
      resetDraft();
      setInputText('');
      setSuccessMessage(null);
    }
    window.addEventListener(BACKUP_RESTORED_EVENT, handleRestored);
    return () => window.removeEventListener(BACKUP_RESTORED_EVENT, handleRestored);
  }, []);

  function resetDraft() {
    setParseResult(null);
    setClassification(null);
    setSelectedAccountId(undefined);
    setIsEditingMatch(false);
    setRememberChoice(false);
    setCounterAccountId(undefined);
    setPostError(null);
  }

  function handleParse() {
    setSuccessMessage(null);
    const result = parseTransactionText(inputText);
    setParseResult(result);
    setClassification(null);
    setSelectedAccountId(undefined);
    setIsEditingMatch(false);
    setRememberChoice(false);
    setCounterAccountId(undefined);
    setPostError(null);

    if (result.status === 'SUCCESS') {
      const classified = classify(result.transaction);
      setClassification(classified);
      if (classified.status === 'matched') {
        setSelectedAccountId(classified.accountId);
        setCounterAccountId(
          defaultCounterAccountId(result.transaction.paymentMode, safeGetAllAccounts()),
        );
      }
    }
  }

  const resolvedAccount =
    classification && (classification.status !== 'matched' || isEditingMatch)
      ? accounts.find((a) => a.id === selectedAccountId)
      : classification?.status === 'matched'
        ? classification.account
        : undefined;

  const canReview =
    parseResult?.status === 'SUCCESS' &&
    parseResult.transaction.type !== undefined &&
    parseResult.transaction.amount !== undefined &&
    resolvedAccount !== undefined;

  async function handleConfirm() {
    if (!canReview || !parseResult || parseResult.status !== 'SUCCESS' || !resolvedAccount) return;
    if (counterAccountId === undefined) return;
    const transaction = parseResult.transaction;
    if (!transaction.type || !transaction.amount) return;

    setIsPosting(true);
    setPostError(null);
    try {
      // Learning is a distinct, user-initiated step — only runs when the
      // user explicitly asked to remember this choice, and never blocks
      // posting on its own failure semantics (it either succeeds before
      // posting or the whole confirm fails with a clear error).
      if (rememberChoice && transaction.description) {
        if (classification?.status === 'matched' && isEditingMatch) {
          await relearnMapping(transaction.description, resolvedAccount.id);
        } else if (classification?.status === 'unknown' || classification?.status === 'invalid') {
          await learnMapping(transaction.description, resolvedAccount.id);
        }
      }

      await recordTransaction({
        rawText: inputText,
        inputMethod: 'text',
        type: transaction.type,
        amountMinor: transaction.amount.minorUnits,
        date: transaction.date ?? todayIso(),
        classifiedAccountId: resolvedAccount.id,
        counterAccountId,
        narration: transaction.description ?? transaction.party ?? null,
      });

      setSuccessMessage('Transaction recorded.');
      setInputText('');
      resetDraft();
      refreshData();
    } catch (cause) {
      setPostError(
        cause instanceof Error
          ? cause.message
          : 'Could not record this transaction. Nothing was posted.',
      );
    } finally {
      setIsPosting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Describe a transaction in plain text or speech, then review and confirm it before it's recorded."
      />

      <TransactionInput
        value={inputText}
        onChange={(v) => {
          setInputText(v);
          setSuccessMessage(null);
        }}
        onParse={handleParse}
        voiceLanguage={voiceLanguage}
        onVoiceLanguageChange={setVoiceLanguage}
        disabled={isPosting}
      />

      {successMessage ? (
        <p role="status" aria-live="polite" className="transaction-success">
          {successMessage}
        </p>
      ) : null}

      {parseResult ? <ParseResultCard result={parseResult} /> : null}

      {classification ? (
        <ClassificationCard
          classification={classification}
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelectAccount={(id) => {
            setSelectedAccountId(id);
          }}
          rememberChoice={rememberChoice}
          onRememberChoiceChange={setRememberChoice}
          isEditingMatch={isEditingMatch}
          onStartEditMatch={() => {
            setIsEditingMatch(true);
            setSelectedAccountId(undefined);
          }}
        />
      ) : null}

      {canReview &&
      parseResult?.status === 'SUCCESS' &&
      resolvedAccount &&
      parseResult.transaction.type ? (
        <TransactionReview
          transaction={parseResult.transaction}
          type={parseResult.transaction.type}
          itemAccount={resolvedAccount}
          counterAccount={accounts.find((a) => a.id === counterAccountId)}
          accounts={accounts}
          onCounterAccountChange={setCounterAccountId}
          onConfirm={handleConfirm}
          isPosting={isPosting}
          error={postError}
        />
      ) : null}

      <h2 className="section-heading">History</h2>
      <TransactionHistory items={history} />
    </>
  );
}
