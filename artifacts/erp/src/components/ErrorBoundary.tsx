import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props { children: ReactNode; fallbackTitle?: string }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production you'd send this to Sentry / LogRocket
    console.error('[ErrorBoundary]', error.message, info.componentStack);
    // Hook/context errors (e.g. after HMR module swap) are unrecoverable without
    // a full page reload — do it automatically so users don't see a dead app.
    if (
      error.message.includes('Invalid hook call') ||
      error.message.includes('must be used within') ||
      error.message.includes('AuthProvider')
    ) {
      window.location.reload();
    }
  }

  handleReset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center p-8">
          <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-foreground">
              {this.props.fallbackTitle ?? 'Something went wrong'}
            </p>
            <p className="text-[13px] text-muted-foreground mt-1 max-w-sm">
              {this.state.error?.message ?? 'An unexpected error occurred in this section.'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={this.handleReset} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
