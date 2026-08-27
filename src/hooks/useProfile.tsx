import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

interface ProfileContextType {
  profile: Tables<"profiles"> | null;
  loading: boolean;
  refresh: () => Promise<void>;
  updateProfile: (updates: Partial<Tables<"profiles">>) => void;
}

const ProfileContext = createContext<ProfileContextType>({
  profile: null,
  loading: true,
  refresh: async () => {},
  updateProfile: () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  /**
   * Id do usuário cujo perfil já foi carregado. Enquanto for diferente do
   * usuário atual, o perfil NÃO é confiável — é o que evita o flash do aviso
   * de KYC logo após o login (perfil ainda null, sessão já presente).
   */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) { setProfile(null); setLoadedFor(null); return; }
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      // Falha de rede/RLS não pode ser lida como "conta não aprovada":
      // mantemos o estado como não resolvido.
      console.error("[useProfile] fetch error:", error.message);
      return;
    }
    setProfile(data ?? null);
    setLoadedFor(user.id);
  }, [user?.id]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const loading = !user?.id ? false : loadedFor !== user.id;


  const updateProfile = useCallback((updates: Partial<Tables<"profiles">>) => {
    setProfile(prev => prev ? { ...prev, ...updates } : prev);
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, loading, refresh: fetchProfile, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
