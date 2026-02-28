import React from "react";

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught:", error.message, error.stack);
    console.error("[ErrorBoundary] Info:", errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, fontFamily: "sans-serif", background: "#fff", color: "#111", minHeight: "100vh" }}>
          <h1 style={{ fontSize: 20, marginBottom: 12 }}>⚠️ Erro na aplicação</h1>
          <pre style={{ fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#f5f5f5", padding: 16, borderRadius: 8 }}>
            {this.state.error?.message}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: "10px 20px", background: "#22c55e", color: "#fff", border: "none", borderRadius: 8, fontSize: 14 }}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
