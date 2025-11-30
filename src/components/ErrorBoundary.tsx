import React from "react";

type State = { hasError: boolean; error: Error | null };

export default class ErrorBoundary extends React.Component<{}, State> {
  constructor(props: {}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    // log to console — developer should inspect DevTools
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background">
          <div className="pt-24 px-4 max-w-4xl mx-auto">
            <div className="p-6 border rounded bg-red-50">
              <h2 className="text-xl font-semibold text-red-700">Something went wrong</h2>
              <p className="mt-2 text-sm text-red-600">The admin page failed to render. Check the console for details.</p>
              <pre className="mt-4 text-xs whitespace-pre-wrap text-red-800">{String(this.state.error && this.state.error.stack)}</pre>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children as React.ReactElement;
  }
}
