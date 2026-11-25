import { supabase } from "@/integrations/supabase/client";

export const SETTINGS_KEY = ["admin-settings"] as const;

/** Chama uma função do banco e lança o erro (o diálogo mostra a mensagem em português). */
export async function callRpc(name: string, args?: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.rpc(name as never, (args ?? {}) as never);
  if (error) throw error;
  return data;
}
