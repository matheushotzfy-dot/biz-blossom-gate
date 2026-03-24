import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for impersonation tokens first
    const impersonateData = localStorage.getItem("impersonate_session");
    if (impersonateData) {
      try {
        const { access_token, refresh_token, timestamp } = JSON.parse(impersonateData);
        // Only use if less than 60 seconds old
        if (Date.now() - timestamp < 60000 && access_token && refresh_token) {
          localStorage.removeItem("impersonate_session");
          supabase.auth.setSession({ access_token, refresh_token }).then(({ data: { session }, error }) => {
            if (!error && session) {
              setUser(session.user);
              setLoading(false);
              // Clean URL param
              const url = new URL(window.location.href);
              url.searchParams.delete("impersonate");
              window.history.replaceState({}, "", url.toString());
              return;
            }
            // Fallback to normal flow
            initNormalSession();
          });
          return;
        } else {
          localStorage.removeItem("impersonate_session");
        }
      } catch {
        localStorage.removeItem("impersonate_session");
      }
    }

    initNormalSession();

    function initNormalSession() {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setLoading(false);
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
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
