import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
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
  const location = useLocation();
  const [theme, setThemeState] = useState<Theme>("light");
  const [userId, setUserId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const saveIdRef = useRef(0);
  const checkoutOwnsTheme = /^\/(pay|checkout|pl)\//.test(location.pathname);

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
      const requestId = ++requestIdRef.current;
      setUserId(nextUserId);
      if (!nextUserId) {
        setThemeState("light");
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("theme_preference")
        .eq("user_id", nextUserId)
        .maybeSingle();
      if (!active || requestId !== requestIdRef.current) return;
      if (error) {
        console.error("[theme] preference load failed");
        setThemeState("light");
        return;
      }
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
    const saveId = ++saveIdRef.current;
    setThemeState(next);
    if (!userId) return;
    const previous = theme;
    void supabase.rpc("set_my_theme_preference", { _theme: next }).then(({ error }) => {
      if (error && saveId === saveIdRef.current) {
        console.error("[theme] preference update failed");
        setThemeState(previous);
      }
    });
  }, [theme, userId]);

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
