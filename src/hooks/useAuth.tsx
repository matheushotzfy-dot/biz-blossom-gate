import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Dedupe do rastreio de IP em escopo de módulo: `useAuth` é montado por dezenas de
 * componentes e cada montagem disparava um `track-user-ip` (que faz auth.getUser()
 * + UPDATE em profiles). Isso gerava milhares de writes/segundo em profiles e
 * timeouts (57014) no endpoint /user do auth. Agora é 1 chamada por usuário a cada
 * 30 minutos, em toda a aba.
 */
const IP_TRACK_INTERVAL_MS = 30 * 60 * 1000;
let lastTrackedUser: string | null = null;
let lastTrackedAt = 0;

function trackIp(uid: string, source: string) {
  const now = Date.now();
  if (lastTrackedUser === uid && now - lastTrackedAt < IP_TRACK_INTERVAL_MS) return;
  lastTrackedUser = uid;
  lastTrackedAt = now;
  // Fire-and-forget — não bloqueia a UI
  supabase.functions.invoke("track-user-ip", { body: { source } }).catch(() => {
    // falha de tracking não pode derrubar a sessão; libera nova tentativa depois
  });
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    // Set up auth listener FIRST to avoid missing events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        // Supabase calls listeners while holding its auth lock. Never invoke
        // another authenticated request synchronously from this callback.
        const uid = session.user.id;
        setTimeout(() => trackIp(uid, event === "SIGNED_IN" ? "login" : "refresh"), 0);
      }
    });

    // Initial session check (impersonation handled via /impersonate-receiver postMessage flow,
    // no tokens are ever stored in localStorage)
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) trackIp(session.user.id, "session");
    }).catch(() => {
      if (active) setLoading(false);
    });


    return () => { active = false; subscription.unsubscribe(); };
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
