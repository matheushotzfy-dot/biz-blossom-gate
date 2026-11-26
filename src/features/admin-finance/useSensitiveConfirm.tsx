import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ReauthenticationDialog } from "@/components/security/ReauthenticationDialog";
import { toast } from "sonner";

type Action = () => Promise<void>;

/**
 * Reinforced confirmation for sensitive money operations.
 * The admin re-enters the password (fresh session); the server rejects the
 * operation unless the password was confirmed in the last 10 minutes.
 */
export function useSensitiveConfirm(title = "Confirmação de operação financeira") {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState("");
  const pending = useRef<Action | null>(null);
  const cancelled = useRef<(() => void) | null>(null);

  /** `onCancel` (opcional) roda se a janela da senha for fechada sem confirmar. */
  const confirm = useCallback((desc: string, action: Action, onCancel?: () => void) => {
    pending.current = action;
    cancelled.current = onCancel ?? null;
    setDescription(desc);
    setOpen(true);
  }, []);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && pending.current) {
      const cancel = cancelled.current;
      pending.current = null;
      cancelled.current = null;
      cancel?.();
    }
  };

  const onConfirm = async (password: string) => {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const email = u.user?.email;
      if (!email) { toast.error("Sessão inválida"); return; }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { toast.error("Senha incorreta"); return; }
      setOpen(false);
      const action = pending.current;
      pending.current = null;
      cancelled.current = null;
      await action?.();
    } finally {
      // Não limpa `pending` aqui: com a senha errada a janela continua aberta e a ação precisa sobreviver à
      // próxima tentativa (antes o finally a apagava e a senha certa, na segunda vez, não fazia nada).
      setBusy(false);
    }
  };

  const dialog = (
    <ReauthenticationDialog
      open={open}
      busy={busy}
      title={title}
      description={description}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  );

  return { confirm, dialog };
}
