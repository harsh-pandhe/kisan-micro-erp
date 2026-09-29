import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../../src/components/ui/badge';

describe('Badge', () => {
  it.each([
    ['success', 'bg-success/15'],
    ['warning', 'bg-warning/15'],
    ['danger', 'bg-danger/15'],
    ['info', 'bg-info/15'],
  ] as const)('renders the %s variant with its color class and a status dot', (variant, cls) => {
    render(<Badge variant={variant}>Paid</Badge>);
    const badge = screen.getByText('Paid').closest('span');
    expect(badge?.className).toContain(cls);
    // Status is never conveyed by color alone: a dot glyph always accompanies it.
    expect(badge?.querySelector('span[aria-hidden="true"]')).toBeTruthy();
  });
});
