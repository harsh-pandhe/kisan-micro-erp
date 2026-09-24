import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';

export function TransactionsPage() {
  return (
    <>
      <PageHeader
        title="Transactions"
        description="Every purchase, sale, payment and receipt will be listed here."
        action={
          <Button type="button" aria-label="Add a new transaction" disabled>
            + Add Transaction
          </Button>
        }
      />
      <EmptyState
        title="No transactions recorded yet"
        description="Transaction entry (text and speech-to-text) is built in a later milestone. This screen shows the layout it will use."
      />
    </>
  );
}
