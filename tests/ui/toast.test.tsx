import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider, useToast } from '../../src/components/ui/use-toast';
import { Toaster } from '../../src/components/ui/toast';

function mockMatchMedia(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function Fire() {
  const { toast } = useToast();
  return <button onClick={() => toast({ title: 'Saved', variant: 'success' })}>Fire toast</button>;
}

describe('Toaster', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a toast and renders it under reduced motion', async () => {
    mockMatchMedia(true);
    render(
      <ToastProvider>
        <Fire />
        <Toaster />
      </ToastProvider>,
    );

    await act(async () => {
      screen.getByText('Fire toast').click();
    });
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('auto-dismisses after its timeout', async () => {
    mockMatchMedia(true);
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Fire />
        <Toaster />
      </ToastProvider>,
    );

    act(() => {
      screen.getByText('Fire toast').click();
    });
    expect(screen.getByText('Saved')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4100);
    });
    vi.useRealTimers();

    await waitFor(() => expect(screen.queryByText('Saved')).not.toBeInTheDocument());
  });
});
