import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Impersonation receiver — postMessage pure-channel handshake.
 *
 * Flow:
 *  1) Admin tab opens this page in a new tab (window.open).
 *  2) This page posts { type: "IMPERSONATE_READY" } to window.opener.
 *  3) Opener (same origin) responds with { type: "IMPERSONATE_TOKENS", access_token, refresh_token }.
 *  4) We validate event.source === window.opener AND event.origin === window.location.origin,
 *     then call supabase.auth.setSession and redirect to /dashboard.
 *
 * No tokens ever touch localStorage / sessionStorage / URL.
 */
export default function ImpersonateReceiver() {
  const [status, setStatus] = useState<"waiting" | "applying" | "error">("waiting");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!window.opener) {
      setStatus("error");
      setErrorMsg("Esta página deve ser aberta pelo painel administrativo.");
      return;
    }

    const expectedOrigin = window.location.origin;
    let timedOut = false;

    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== expectedOrigin) return;
      if (event.source !== window.opener) return;
      const data = event.data;
      if (!data || data.type !== "IMPERSONATE_TOKENS") return;
      if (!data.access_token || !data.refresh_token) return;
      if (timedOut) return;

      window.removeEventListener("message", onMessage);
      setStatus("applying");

      const { error } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (error) {
        setStatus("error");
        setErrorMsg(error.message || "Falha ao aplicar sessão");
        return;
      }

      // Mark this tab as an impersonation session so the banner renders.
      try {
        sessionStorage.setItem("impersonation_session", JSON.stringify({
          target_email: data.target_email || null,
          target_name: data.target_name || null,
          target_user_id: data.target_user_id || null,
          started_at: new Date().toISOString(),
        }));
      } catch { /* noop */ }

      window.location.replace("/dashboard");
    };


    window.addEventListener("message", onMessage);

    // Signal opener we're ready to receive
    try {
      window.opener.postMessage({ type: "IMPERSONATE_READY" }, expectedOrigin);
    } catch {
      setStatus("error");
      setErrorMsg("Não foi possível notificar o painel.");
      return;
    }

    // Hard timeout — abort after 10s if no tokens arrive
    const t = setTimeout(() => {
      timedOut = true;
      window.removeEventListener("message", onMessage);
      setStatus("error");
      setErrorMsg("Tempo esgotado. Tente novamente pelo painel.");
    }, 10_000);

    return () => {
      clearTimeout(t);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  return (
    <div className="h-dvh flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        {status !== "error" ? (
          <>
            <div className="h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">
              {status === "waiting" ? "Aguardando autorização do painel…" : "Aplicando sessão…"}
            </p>
          </>
        ) : (
          <>
            <p className="text-base font-semibold text-foreground">Não foi possível continuar</p>
            <p className="text-sm text-muted-foreground max-w-sm">{errorMsg}</p>
            <button
              onClick={() => window.close()}
              className="mt-2 text-xs text-primary underline"
            >
              Fechar aba
            </button>
          </>
        )}
      </div>
    </div>
  );
}
