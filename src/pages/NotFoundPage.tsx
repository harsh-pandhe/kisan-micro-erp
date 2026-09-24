import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <EmptyState
        title="We couldn't find that page"
        description="Check the link, or head back to the dashboard."
        action={
          <Link to="/" className="btn btn--primary">
            Go to dashboard
          </Link>
        }
      />
    </>
  );
}
