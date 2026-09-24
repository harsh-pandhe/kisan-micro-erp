import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';

export function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A snapshot of your books. Figures will populate once transactions are recorded."
      />
      <div className="stat-grid">
        <Card title="Balance">
          <p className="stat-placeholder">—</p>
        </Card>
        <Card title="Income">
          <p className="stat-placeholder">—</p>
        </Card>
        <Card title="Expenses">
          <p className="stat-placeholder">—</p>
        </Card>
      </div>
      <Card title="Recent Transactions" className="stack-gap">
        <EmptyState
          title="No transactions yet"
          description="Recorded transactions will show up here, newest first."
        />
      </Card>
    </>
  );
}
