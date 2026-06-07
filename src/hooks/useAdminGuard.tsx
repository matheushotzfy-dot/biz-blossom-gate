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

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/admin-matheus", { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [adminRes, employeeRes] = await Promise.all([
          supabase.rpc("current_user_has_role", { _role: "admin" }),
          supabase.rpc("current_user_has_role", { _role: "employee" as any }),
        ]);
        if (cancelled) return;
        const hasAdmin = adminRes.data === true;
        const hasEmployee = employeeRes.data === true;
        if (!hasAdmin && !hasEmployee) {
          navigate("/admin-matheus", { replace: true });
          return;
        }
        setIsAdmin(hasAdmin);
        setIsEmployee(hasEmployee && !hasAdmin);
      } catch {
        if (!cancelled) navigate("/admin-matheus", { replace: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, authLoading, navigate]);

  return { isAdmin, isEmployee, loading, user };
}

/**
 * Protected admin/employee route wrapper.
 * Blocks rendering until server-side verification completes.
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin, isEmployee, loading } = useAdminGuard();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-[18px] bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-[0_0_60px_rgba(99,102,241,0.3)] animate-pulse">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <p className="text-[11px] text-white/20 font-medium tracking-wider uppercase">
            Verificando permissões...
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin && !isEmployee) return null;
  return <>{children}</>;
}