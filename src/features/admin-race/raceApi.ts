import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { safeNavigationUrl } from "@/lib/safeUrl";
import { assetPath, imageProblem } from "./raceModel";

export const RACE_KEY = ["admin-race"] as const;
export const LIST_KEY = [...RACE_KEY, "list"] as const;
export const DETAIL_KEY = [...RACE_KEY, "detail"] as const;
const BUCKET = "race-assets";

/** Chama uma função do banco e lança o erro (a tela mostra a mensagem em português). */
export async function callRpc(name: string, args?: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.rpc(name as never, (args ?? {}) as never);
  if (error) throw error;
  return data;
}

export function useRefreshRace() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: LIST_KEY });
    void qc.invalidateQueries({ queryKey: DETAIL_KEY });
  };
}

/**
 * O bucket é privado: o seller lê por link assinado (edge `get-race-asset-urls`) e o admin, aqui.
 * Link de fora do bucket é usado como está (só http e https).
 */
export function useAssetUrl(url: string | null | undefined): string | null {
  const path = assetPath(url);
  const q = useQuery({
    queryKey: [...RACE_KEY, "asset", path],
    enabled: !!path,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path as string, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  if (!url) return null;
  if (path) return q.data ?? null;
  return safeNavigationUrl(url);
}

/** Envia a imagem para `race-assets/<corrida>/…` (o seller só lê arquivos que começam com o id da corrida ativa). Devolve o endereço a gravar. */
export async function uploadRaceImage(raceId: string, kind: string, file: File): Promise<string> {
  const problem = imageProblem(file);
  if (problem) throw new Error(problem);
  const safeName = file.name.replace(/[^\w.-]/g, "_").slice(-60);
  const path = `${raceId}/${kind}-${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Apaga as imagens de uma corrida que foi removida. Se falhar, só sobra arquivo solto: não vale travar a tela. */
export async function removeRaceFiles(raceId: string): Promise<void> {
  try {
    const { data } = await supabase.storage.from(BUCKET).list(raceId, { limit: 100 });
    const files = (data ?? []).map((f) => `${raceId}/${f.name}`);
    if (files.length > 0) await supabase.storage.from(BUCKET).remove(files);
  } catch { /* arquivo solto não faz mal */ }
}
