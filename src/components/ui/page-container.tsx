import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/**
 * Standardized responsive horizontal padding + max-width for page content:
 * 16px on mobile, 20-24px on tablet, 32px on desktop, capped so desktop
 * content doesn't stretch edge-to-edge or go uncomfortably narrow.
 *
 * Not applied to any existing page this session (would touch page markup
 * beyond a pure infrastructure change) — available for future page-redesign
 * milestones.
 */
export function PageContainer({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mx-auto w-full max-w-4xl px-4 md:px-6 lg:px-8', className)} {...rest} />
  );
}
