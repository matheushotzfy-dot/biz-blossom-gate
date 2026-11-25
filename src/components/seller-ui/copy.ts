import { toast } from "sonner";

/** Copia para a área de transferência e avisa o resultado. */
export async function copyText(text: string, ok: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); toast.success(ok); return true; }
  catch { toast.error("Não foi possível copiar. Selecione e copie manualmente."); return false; }
}
