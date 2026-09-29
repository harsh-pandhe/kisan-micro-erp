import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/**
 * Status badges never rely on color alone: each variant pairs its color with
 * a fixed leading dot glyph, and callers should also pass a short text label
 * (e.g. "Paid", "Overdue") — never an empty colored pill.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'bg-muted text-muted-foreground',
        success: 'bg-success/15 text-success',
        warning: 'bg-warning/15 text-warning',
        danger: 'bg-danger/15 text-danger',
        info: 'bg-info/15 text-info',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

const dotClasses: Record<string, string> = {
  default: 'bg-muted-foreground',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant = 'default', children, ...rest }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...rest}>
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full', dotClasses[variant ?? 'default'])}
      />
      {children}
    </span>
  );
}
