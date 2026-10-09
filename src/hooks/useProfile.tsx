import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

interface ProfileContextType {
  profile: Tables<"profiles"> | null;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
  updateProfile: (updates: Partial<Tables<"profiles">>) => void;
}

const ProfileContext = createContext<ProfileContextType>({
  profile: null,
  loading: true,
  error: false,
  refresh: async () => {},
  updateProfile: () => {},
});

const RETRY_DELAYS_MS = [1000, 2000, 4000];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  /**
   * Id do usuário cujo perfil já foi carregado. Enquanto for diferente do
   * usuário atual, o perfil NÃO é confiável — é o que evita o flash do aviso
   * de KYC logo após o login (perfil ainda null, sessão já presente).
   */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) { setProfile(null); setLoadedFor(null); setError(false); return; }
    setError(false);
    let lastError: string | null = null;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!fetchError) {
        setProfile(data ?? null);
        setLoadedFor(user.id);
        return;
      }
      lastError = fetchError.message;
      if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
    }
    // Falha de rede/RLS não pode ser lida como "conta não aprovada": mantemos o
    // perfil como não resolvido, mas liberamos o loading para não travar a UI
    // para sempre — o chamador pode checar `error` e oferecer um retry.
    console.error("[useProfile] fetch error after retries:", lastError);
    setError(true);
    setLoadedFor(user.id);
  }, [user?.id]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const loading = !user?.id ? false : loadedFor !== user.id;


  const updateProfile = useCallback((updates: Partial<Tables<"profiles">>) => {
    setProfile(prev => prev ? { ...prev, ...updates } : prev);
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, loading, error, refresh: fetchProfile, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
