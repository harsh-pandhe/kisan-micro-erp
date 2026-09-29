import { Separator as SeparatorPrimitive } from 'radix-ui';
import { cn } from '../../lib/utils';

export function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...rest
}: SeparatorPrimitive.SeparatorProps) {
  return (
    <SeparatorPrimitive.Root
      orientation={orientation}
      decorative={decorative}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...rest}
    />
  );
}
