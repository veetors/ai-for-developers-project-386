import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[AppErrorBoundary]', error, info);
    }
  }

  handleReset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="container flex flex-col items-center gap-4 py-16 text-center">
          <h1 className="text-2xl font-semibold">Что-то пошло не так</h1>
          <p className="text-muted-foreground">
            Мы не смогли обработать запрос. Попробуйте вернуться на главную.
          </p>
          <div className="flex gap-2">
            <Button onClick={this.handleReset} variant="outline">
              Попробовать снова
            </Button>
            <Button asChild>
              <Link to="/">На главную</Link>
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
