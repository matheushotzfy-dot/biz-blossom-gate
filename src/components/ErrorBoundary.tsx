import React from "react";
import { reportClientError } from "@/lib/clientErrorReport";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface State {
  hasError: boolean;
  error: Error | null;
}

// Erros fora da árvore do React (o `componentDidCatch` não os vê). O envio filtra ruído, não repete e tem limite por página.
declare global {
  interface Window { __lov_error_handlers__?: boolean }
}
if (typeof window !== "undefined" && !window.__lov_error_handlers__) {
  window.__lov_error_handlers__ = true;
  window.addEventListener("error", (event) => {
    if (event.error) reportClientError(event.error, "window.onerror");
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportClientError(event.reason, "unhandledrejection");
  });
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
    console.error("[ErrorBoundary] Caught:", error.message);
    reportClientError(error, `ErrorBoundary: ${errorInfo.componentStack?.slice(0, 300) || ""}`);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleHome = () => {
    window.location.href = "/dashboard";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-md w-full text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive">
              <AlertTriangle className="h-7 w-7" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Algo deu errado</h1>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Ocorreu um erro inesperado. Tente novamente — se o problema persistir, recarregue a página ou volte ao dashboard.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-[11px] text-left bg-muted/50 border border-border/60 rounded-lg p-3 mb-5 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono">
                {this.state.error.message}
                {this.state.error.stack && `\n\n${this.state.error.stack.slice(0, 600)}`}
              </pre>
            )}
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <RefreshCw className="h-4 w-4" strokeWidth={2.5} />
                Tentar novamente
              </button>
              <button
                onClick={this.handleHome}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-border bg-card text-card-foreground text-sm font-semibold hover:bg-accent transition-colors"
              >
                <Home className="h-4 w-4" strokeWidth={2.5} />
                Ir para o início
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
