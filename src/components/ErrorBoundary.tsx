import React from "react";
import { supabase } from "@/integrations/supabase/client";

interface State {
 hasError: boolean;
 error: Error | null;
}

async function logErrorToDb(error: Error, context: string) {
 try {
 const { data: { session } } = await supabase.auth.getSession();
 await supabase.from("error_logs").insert({
 error_type: "client_error",
 message: error.message?.slice(0, 500) || "Unknown error",
 stack_trace: error.stack?.slice(0, 2000) || null,
 user_id: session?.user?.id || null,
 metadata: { context, url: window.location.href, ua: navigator.userAgent },
 });
 } catch {
 // Silent fail — don't break the app for logging
 }
}

// Global error handler for uncaught errors
if (typeof window !== "undefined") {
 window.addEventListener("error", (event) => {
 if (event.error) {
 logErrorToDb(event.error, "window.onerror");
 }
 });
 window.addEventListener("unhandledrejection", (event) => {
 const err = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
 logErrorToDb(err, "unhandledrejection");
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
 logErrorToDb(error, `ErrorBoundary: ${errorInfo.componentStack?.slice(0, 300) || ""}`);
 }

 render() {
 if (this.state.hasError) {
 return (
 <div style={{ padding: 32, fontFamily: "sans-serif", background: "hsl(var(--background, 0 0% 100%))", color: "hsl(var(--foreground, 0 0% 7%))", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
 <div style={{ maxWidth: 420, textAlign: "center" }}>
 <h1 style={{ fontSize: 22, marginBottom: 8, fontWeight: 700 }}>Algo deu errado</h1>
 <p style={{ fontSize: 14, color: "#666", marginBottom: 24, lineHeight: 1.6 }}>
 Ocorreu um erro inesperado. Tente recarregar a página. Se o problema persistir, entre em contato com o suporte.
 </p>
 {import.meta.env.DEV && this.state.error && (
 <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#f5f5f5", padding: 12, borderRadius: 8, textAlign: "left", marginBottom: 16, maxHeight: 200, overflow: "auto" }}>
 {this.state.error.message}
 </pre>
 )}
 <button
 onClick={() => window.location.reload()}
 style={{ padding: "12px 28px", background: "#22c55e", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
 >
 Recarregar Página
 </button>
 </div>
 </div>
 );
 }
 return this.props.children;
 }
}
