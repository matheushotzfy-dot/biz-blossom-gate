import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [userId, setUserId] = useState<string | null>(null);
  const checkoutOwnsTheme = /^\/(pay|checkout|pl)\//.test(window.location.pathname);

  useEffect(() => {
    const root = document.documentElement;
    if (!checkoutOwnsTheme && theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    root.style.colorScheme = checkoutOwnsTheme ? "" : theme;
  }, [checkoutOwnsTheme, theme]);

  useEffect(() => {
    let active = true;

    const loadPreference = async (nextUserId: string | null) => {
      if (!active) return;
      setUserId(nextUserId);
      if (!nextUserId) {
        setThemeState("light");
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("theme_preference")
        .eq("user_id", nextUserId)
        .maybeSingle();
      if (!active) return;
      setThemeState(data?.theme_preference === "dark" ? "dark" : "light");
    };

    supabase.auth.getSession().then(({ data }) => loadPreference(data.session?.user.id ?? null));
    const { data: authData } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadPreference(session?.user.id ?? null);
    });

    return () => {
      active = false;
      authData.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(uniqueChannelName(`theme-profile-${userId}`))
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${userId}` },
        (payload) => {
          const next = (payload.new as { theme_preference?: string }).theme_preference;
          if (next === "light" || next === "dark") setThemeState(next);
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    if (!userId) return;
    void supabase.rpc("set_my_theme_preference", { _theme: next }).then(({ error }) => {
      if (error) {
        console.error("[theme] preference update failed");
      }
    });
  }, [userId]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
