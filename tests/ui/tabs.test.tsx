import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../src/components/ui/tabs';

function Example() {
  return (
    <Tabs defaultValue="summary">
      <TabsList>
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="detail">Detail</TabsTrigger>
      </TabsList>
      <TabsContent value="summary">Summary panel</TabsContent>
      <TabsContent value="detail">Detail panel</TabsContent>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('shows only the active panel and switches on click', async () => {
    const user = userEvent.setup();
    render(<Example />);

    expect(screen.getByText('Summary panel')).toBeVisible();
    expect(screen.queryByText('Detail panel')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Detail' }));

    expect(await screen.findByText('Detail panel')).toBeVisible();
    expect(screen.queryByText('Summary panel')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Detail' })).toHaveAttribute('aria-selected', 'true');
  });
});
