import type { ReactNode } from 'react';
import './PageHeader.css';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Consistent heading block for each page: title, short description, optional action. */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header__text">
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="page-header__action">{action}</div> : null}
    </div>
  );
}
