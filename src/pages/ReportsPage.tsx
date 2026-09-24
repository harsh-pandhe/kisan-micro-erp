import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';

const REPORTS = [
  { title: 'Trial Balance', description: 'All ledger balances, debits and credits matched.' },
  { title: 'Profit & Loss', description: 'Income and expenses for a chosen period.' },
  { title: 'Balance Sheet', description: 'Assets, liabilities and equity as of a date.' },
];

export function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        description="Generated once transactions are recorded and posted."
      />
      <div className="stack-gap">
        {REPORTS.map((report) => (
          <Card key={report.title} title={report.title}>
            <EmptyState title="Not available yet" description={report.description} />
          </Card>
        ))}
      </div>
    </>
  );
}
