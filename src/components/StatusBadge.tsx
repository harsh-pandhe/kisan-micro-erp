import type { ReactNode } from 'react';
import './StatusBadge.css';

type StatusTone = 'neutral' | 'positive' | 'warning';

interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusTone;
}

/** Small pill for short status text (e.g. "Online", "Draft"). */
export function StatusBadge({ children, tone = 'neutral' }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${tone}`}>{children}</span>;
}
