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
    // Hook/context errors are unrecoverable without a full page reload.
    // Auto-reload so users don't get stuck on a dead page.
    const msg = error.message;
    const isHookError =
      msg.includes('Invalid hook call') ||
      msg.includes('must be used within') ||
      msg.includes('AuthProvider') ||
      // recharts / library ESM-CJS split produces this when React dispatcher is null
      (msg.includes('Cannot read properties of null') && msg.includes('useContext')) ||
      msg.includes('Minified React error');
    if (isHookError) {
      // Short delay so console.error flushes before reload
      setTimeout(() => window.location.reload(), 100);
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
