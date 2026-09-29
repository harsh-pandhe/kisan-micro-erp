import type { ReactNode } from 'react';
import './EmptyState.css';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

/** Placeholder for a page/section with no data yet, or functionality not built yet. */
export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      {icon ? (
        <div className="empty-state__icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <p className="empty-state__title">{title}</p>
      {description ? <p className="empty-state__description">{description}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
