import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, LogOut } from "lucide-react";

type Info = {
  target_email: string | null;
  target_name: string | null;
  target_user_id: string | null;
  started_at: string;
  expires_at: string;
};

/**
 * Sticky top-of-viewport banner shown ONLY while operating inside an
 * impersonation tab. Reads sessionStorage marker set by ImpersonateReceiver.
 * sessionStorage is per-tab, so the banner never leaks to the admin's own tab.
 */
export default function ImpersonationBanner() {
  const [info, setInfo] = useState<Info | null>(null);

  const handleExit = async () => {
    try { sessionStorage.removeItem("impersonation_session"); } catch { /* noop */ }
    await supabase.auth.signOut();
    window.close();
    // Fallback if the tab can't be closed programmatically
    window.location.replace("/auth");
  };

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("impersonation_session");
      if (raw) setInfo(JSON.parse(raw));
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (!info) return;
    const remaining = new Date(info.expires_at).getTime() - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) {
      void handleExit();
      return;
    }
    const timeout = window.setTimeout(() => void handleExit(), remaining);
    return () => window.clearTimeout(timeout);
  }, [info]);

  if (!info) return null;

  const label = info.target_name || info.target_email || info.target_user_id?.slice(0, 8) || "usuário";

  return (
    <div className="fixed top-0 inset-x-0 z-[100] bg-warning text-warning-foreground border-b border-warning/50">
      <div className="max-w-screen-2xl mx-auto px-4 h-10 flex items-center justify-between gap-3 text-xs font-medium">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span className="truncate">
            Modo impersonação — você está operando como <strong>{label}</strong>. Todas as ações estão sendo auditadas.
          </span>
        </div>
        <button
          onClick={handleExit}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-warning-foreground/10 hover:bg-warning-foreground/20 transition"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair da impersonação
        </button>
      </div>
    </div>
  );
}
