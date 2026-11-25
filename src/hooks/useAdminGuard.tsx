import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Shield } from "lucide-react";

/**
 * Server-side admin/employee role verification hook.
 * Uses supabase.rpc('has_role') which executes as SECURITY DEFINER
 * on the database — cannot be spoofed client-side.
 */
export function useAdminGuard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);
  const [loading, setLoading] = useState(true);
  // Falha de rede/servidor ao conferir o papel: diferente de "sem permissão", que manda para o login.
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/admin-matheus", { replace: true });
      return;
    }

    let cancelled = false;
    setFailed(false);
    setLoading(true);
    (async () => {
      try {
        const [adminRes, employeeRes] = await Promise.all([
          supabase.rpc("current_user_has_role", { _role: "admin" }),
          supabase.rpc("current_user_has_role", { _role: "employee" }),
        ]);
        if (cancelled) return;
        if (adminRes.error || employeeRes.error) { setFailed(true); return; }
        const hasAdmin = adminRes.data === true;
        const hasEmployee = employeeRes.data === true;
        if (!hasAdmin && !hasEmployee) {
          navigate("/admin-matheus", { replace: true });
          return;
        }
        setIsAdmin(hasAdmin);
        setIsEmployee(hasEmployee && !hasAdmin);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        // Always release loading — even if unmounted, state setter on
        // unmounted component is a no-op and React swallows it.
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, authLoading, navigate, attempt]);

  return { isAdmin, isEmployee, loading, failed, retry: () => setAttempt((n) => n + 1), user };
}

/**
 * Protected admin/employee route wrapper.
 * Blocks rendering until server-side verification completes.
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin, isEmployee, loading, failed, retry } = useAdminGuard();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-[18px] bg-primary/15 border border-primary/30 flex items-center justify-center animate-pulse">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <p className="text-[11px] text-muted-foreground font-medium tracking-wider uppercase">
            Verificando permissões...
          </p>
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div role="alert" className="flex max-w-[360px] flex-col items-center gap-3 text-center">
          <div className="h-12 w-12 rounded-[16px] bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-[16px] font-semibold text-foreground">Não deu para confirmar seu acesso</h1>
          <p className="text-[13px] text-muted-foreground">Costuma ser a conexão. Nenhuma permissão foi alterada.</p>
          <button onClick={retry} className="mt-1 rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground">
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin && !isEmployee) return null;
  return <>{children}</>;
}