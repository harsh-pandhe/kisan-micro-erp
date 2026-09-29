import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from '../../lib/utils';

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...rest }: TabsPrimitive.TabsListProps) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--radius-md)] bg-muted p-1',
        className,
      )}
      {...rest}
    />
  );
}

export function TabsTrigger({ className, ...rest }: TabsPrimitive.TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex items-center justify-center rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors',
        'data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-[var(--shadow-subtle)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
        className,
      )}
      {...rest}
    />
  );
}

export function TabsContent({ className, ...rest }: TabsPrimitive.TabsContentProps) {
  return (
    <TabsPrimitive.Content className={cn('mt-3 focus-visible:outline-none', className)} {...rest} />
  );
}
