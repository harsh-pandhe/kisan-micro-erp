import type { ParseResult } from '../parser/types';
import { Card } from './Card';
import { StatusBadge } from './StatusBadge';

interface ParseResultCardProps {
  result: ParseResult;
}

function formatAmount(minorUnits: number): string {
  return `₹${(minorUnits / 100).toFixed(2)}`;
}

/** Shows the parser's outcome for the current input text: SUCCESS / AMBIGUOUS / INVALID. */
export function ParseResultCard({ result }: ParseResultCardProps) {
  if (result.status === 'INVALID') {
    return (
      <Card title="Could not understand this text" className="parse-result">
        <StatusBadge tone="warning">Not understood</StatusBadge>
        <p>
          We could not work out a transaction from this text. Try including an amount and a word
          like "paid", "sold", "received" or "bought".
        </p>
        <ul className="parse-result__reasons">
          {result.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Card>
    );
  }

  const { transaction } = result;
  const rows: [string, string][] = [
    ['Type', transaction.type ?? '—'],
    ['Amount', transaction.amount ? formatAmount(transaction.amount.minorUnits) : '—'],
    ['Party', transaction.party ?? '—'],
    ['Description', transaction.description ?? '—'],
    ['Date', transaction.date ?? '—'],
    ['Payment mode', transaction.paymentMode ?? '—'],
  ];

  return (
    <Card
      title={result.status === 'SUCCESS' ? 'Parsed transaction' : 'Needs a bit more detail'}
      className="parse-result"
    >
      <StatusBadge tone={result.status === 'SUCCESS' ? 'positive' : 'warning'}>
        {result.status === 'SUCCESS' ? 'Understood' : 'Ambiguous'}
      </StatusBadge>
      <dl className="parse-result__fields">
        {rows.map(([label, value]) => (
          <div key={label} className="parse-result__field">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {result.status === 'AMBIGUOUS' ? (
        <ul className="parse-result__reasons">
          {result.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
