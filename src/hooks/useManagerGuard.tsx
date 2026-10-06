import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Shield } from "lucide-react";

export function useManagerGuard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isStaff, setIsStaff] = useState(false);
  const [role, setRole] = useState<"manager" | "employee" | null>(null);
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
        const [{ data: manager, error: managerError }, { data: employee, error: employeeError }] = await Promise.all([
          supabase.rpc("current_user_has_role", { _role: "manager" }),
          supabase.rpc("current_user_has_role", { _role: "employee" }),
        ]);
        if (cancelled) return;
        if (managerError || employeeError || (manager !== true && employee !== true)) {
          navigate("/gerentes", { replace: true });
          return;
        }
        setRole(manager === true ? "manager" : "employee");
        setIsStaff(true);
      } catch {
        if (!cancelled) navigate("/gerentes", { replace: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, authLoading, navigate]);

  return { isStaff, role, loading, user };
}

export function RequireManager({ children }: { children: React.ReactNode }) {
  const { isStaff, loading } = useManagerGuard();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <p className="text-[11px] font-medium uppercase text-muted-foreground">
            Verificando permissões...
          </p>
        </div>
      </div>
    );
  }

  if (!isStaff) return null;
  return <>{children}</>;
}
