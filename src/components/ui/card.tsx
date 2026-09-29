import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type CardTone = 'default' | 'highlighted' | 'warning' | 'danger';

export interface UiCardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
}

const toneClasses: Record<CardTone, string> = {
  default: 'bg-card border-border',
  highlighted: 'bg-card border-primary/30 ring-1 ring-primary/15',
  warning: 'bg-card border-warning/40',
  danger: 'bg-card border-danger/40',
};

/** Local shadcn-style Card. Coexists with the existing `src/components/Card`. */
export function UiCard({ className, tone = 'default', ...rest }: UiCardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] border shadow-[var(--shadow-card)] text-card-foreground',
        toneClasses[tone],
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 p-4', className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-h3 text-card-foreground', className)} {...rest} />;
}

export function CardDescription({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-body-small text-muted-foreground', className)} {...rest} />;
}

export function CardContent({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 pt-0', className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-2 p-4 pt-0', className)} {...rest} />;
}
