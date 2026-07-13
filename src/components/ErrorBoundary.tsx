import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMsg: string;
  errorStack: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMsg: '',
    errorStack: ''
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMsg: error.toString(), errorStack: error.stack || '' };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-950/20 border border-red-500/30 rounded-xl my-4 text-red-400">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle size={24} className="text-red-500" />
            <h2 className="font-bold text-lg">Error Rendering Component</h2>
          </div>
          <p className="font-medium mb-4">{this.state.errorMsg}</p>
          <pre className="text-xs bg-black/40 p-4 rounded overflow-auto max-h-64 break-all whitespace-pre-wrap font-mono">
            {this.state.errorStack}
          </pre>
          <button 
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded font-bold hover:bg-red-700"
            onClick={() => this.setState({ hasError: false })}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
