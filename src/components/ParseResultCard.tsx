import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { ParseResult } from '../parser/types';
import { UiCard, CardContent, CardHeader, CardTitle } from './ui/card';

interface ParseResultCardProps {
  result: ParseResult;
}

function formatAmount(minorUnits: number): string {
  return `₹${(minorUnits / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

const TYPE_LABEL: Record<string, string> = {
  purchase: 'Purchase',
  sale: 'Sale',
  payment: 'Payment',
  receipt: 'Receipt',
};

function AnimatedCard({
  children,
  ...rest
}: { children: React.ReactNode } & Record<string, unknown>) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Shows the parser's outcome for the current input text: SUCCESS / AMBIGUOUS / INVALID. */
export function ParseResultCard({ result }: ParseResultCardProps) {
  const headingId = 'parse-result-heading';

  if (result.status === 'INVALID') {
    return (
      <AnimatedCard>
        <UiCard tone="danger" role="alert" aria-live="polite">
          <CardHeader className="flex-row items-center gap-2">
            <CircleX className="size-5 shrink-0 text-danger" aria-hidden="true" />
            <CardTitle id={headingId} tabIndex={-1}>
              Couldn't understand that
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-body-small text-muted-foreground">
              Try including what happened and the amount, such as "Paid ₹500 for fertilizer".
            </p>
            {result.reasons.length > 0 ? (
              <ul className="list-disc pl-5 text-body-small text-muted-foreground">
                {result.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </UiCard>
      </AnimatedCard>
    );
  }

  const { transaction } = result;

  if (result.status === 'AMBIGUOUS') {
    return (
      <AnimatedCard>
        <UiCard tone="warning" role="alert" aria-live="polite">
          <CardHeader className="flex-row items-center gap-2">
            <TriangleAlert className="size-5 shrink-0 text-warning" aria-hidden="true" />
            <CardTitle id={headingId} tabIndex={-1}>
              One more detail needed
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <ul className="list-disc pl-5 text-body-small text-muted-foreground">
              {result.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="text-caption text-muted-foreground">
              Edit the text above and select "Review transaction" again.
            </p>
          </CardContent>
        </UiCard>
      </AnimatedCard>
    );
  }

  const secondaryRows: [string, string][] = [];
  if (transaction.party) secondaryRows.push(['Party', transaction.party]);
  if (transaction.description) secondaryRows.push(['Item', transaction.description]);
  if (transaction.paymentMode) secondaryRows.push(['Payment mode', transaction.paymentMode]);
  if (transaction.date) secondaryRows.push(['Date', transaction.date]);

  return (
    <AnimatedCard>
      <UiCard tone="highlighted" aria-live="polite">
        <CardHeader className="flex-row items-center gap-2">
          <CircleCheck className="size-5 shrink-0 text-success" aria-hidden="true" />
          <CardTitle id={headingId} tabIndex={-1}>
            Transaction understood
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div>
            {transaction.amount ? (
              <p className="financial-number text-3xl text-foreground">
                {formatAmount(transaction.amount.minorUnits)}
              </p>
            ) : null}
            {transaction.type ? (
              <p className="text-body-small text-muted-foreground">
                {TYPE_LABEL[transaction.type] ?? transaction.type}
              </p>
            ) : null}
          </div>
          {secondaryRows.length > 0 ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-body-small">
              {secondaryRows.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </CardContent>
      </UiCard>
    </AnimatedCard>
  );
}
