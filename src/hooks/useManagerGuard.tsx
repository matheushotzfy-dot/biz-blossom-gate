import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Shield } from "lucide-react";

export function useManagerGuard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/gerentes", { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("current_user_has_role", { _role: "manager" as any });
        if (cancelled) return;
        if (error || data !== true) {
          navigate("/gerentes", { replace: true });
          return;
        }
        setIsManager(true);
      } catch {
        if (!cancelled) navigate("/gerentes", { replace: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, authLoading, navigate]);

  return { isManager, loading, user };
}

export function RequireManager({ children }: { children: React.ReactNode }) {
  const { isManager, loading } = useManagerGuard();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-[18px] bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-[0_0_60px_rgba(16,185,129,0.3)] animate-pulse">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <p className="text-[11px] text-white/20 font-medium tracking-wider uppercase">
            Verificando permissões...
          </p>
        </div>
      </div>
    );
  }

  if (!isManager) return null;
  return <>{children}</>;
}
