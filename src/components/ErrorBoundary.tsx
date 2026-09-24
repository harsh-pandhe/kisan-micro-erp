import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Catches render errors anywhere in the app shell and shows a recoverable error state. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.assign('/');
  };

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '1rem' }}>
          <EmptyState
            title="Something went wrong"
            description="This screen ran into an unexpected error. Your saved data is unaffected — try going back to the dashboard."
            action={
              <Button type="button" onClick={this.handleReload}>
                Back to dashboard
              </Button>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}
