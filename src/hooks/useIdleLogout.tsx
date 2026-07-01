import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Auto sign-out after a period of user inactivity.
 * Resets timer on any pointer/keyboard/scroll activity.
 * Used to protect privileged admin sessions.
 */
export function useIdleLogout(minutes = 15) {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const ms = minutes * 60 * 1000;

    const logout = async () => {
      try {
        await supabase.auth.signOut();
      } finally {
        toast.warning(`Sessão encerrada por inatividade (${minutes} min).`);
        window.location.replace("/admin/login");
      }
    };

    const reset = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(logout, ms);
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove", "mousedown", "keydown", "scroll", "touchstart", "visibilitychange",
    ];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [minutes]);
}
