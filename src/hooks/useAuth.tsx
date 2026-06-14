import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let lastTrackedUser: string | null = null;
    const trackIp = (uid: string, source: string) => {
      if (lastTrackedUser === uid) return;
      lastTrackedUser = uid;
      // Fire-and-forget — don't block UI
      supabase.functions.invoke("track-user-ip", { body: { source } }).catch(() => {});
    };

    // Set up auth listener FIRST to avoid missing events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        trackIp(session.user.id, event === "SIGNED_IN" ? "login" : "refresh");
      }
    });

    // Initial session check (impersonation handled via /impersonate-receiver postMessage flow,
    // no tokens are ever stored in localStorage)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) trackIp(session.user.id, "session");
    });


    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
