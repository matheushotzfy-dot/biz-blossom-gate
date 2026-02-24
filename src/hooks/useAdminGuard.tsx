import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Shield } from "lucide-react";

/**
 * Server-side admin role verification hook.
 * Uses supabase.rpc('has_role') which executes as SECURITY DEFINER
 * on the database — cannot be spoofed client-side.
 */
export function useAdminGuard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/admin-matheus", { replace: true });
      return;
    }

    // Server-side role check via RPC (SECURITY DEFINER)
    supabase
      .rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data, error }) => {
        if (error || data !== true) {
          // Not admin — sign out to prevent session reuse
          supabase.auth.signOut();
          navigate("/admin-matheus", { replace: true });
          return;
        }
        setIsAdmin(true);
        setLoading(false);
      });
  }, [user, authLoading, navigate]);

  return { isAdmin, loading, user };
}

/**
 * Protected admin route wrapper.
 * Blocks rendering until server-side admin verification completes.
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAdminGuard();

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(228,20%,4%)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-[0_0_60px_rgba(239,68,68,0.3)] animate-pulse">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <p className="text-[11px] text-white/20 font-medium tracking-wider uppercase">
            Verificando permissões...
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;
  return <>{children}</>;
}
