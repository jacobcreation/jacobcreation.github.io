import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    void error;
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center w-full h-screen bg-black text-white p-6 text-center">
          <h2 className="text-xl font-bold mb-4">Something went wrong</h2>
          <p className="text-white/60 mb-6">Failed to load the 3D scene. This might be due to a texture loading error or WebGL issue.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 rounded-full hover:bg-blue-700 transition-colors"
          >
            Reload Simulator
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
