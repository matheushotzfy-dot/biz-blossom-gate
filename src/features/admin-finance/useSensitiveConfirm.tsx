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

  const confirm = useCallback((desc: string, action: Action) => {
    pending.current = action;
    setDescription(desc);
    setOpen(true);
  }, []);

  const onConfirm = async (password: string) => {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const email = u.user?.email;
      if (!email) { toast.error("Sessão inválida"); return; }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { toast.error("Senha incorreta"); return; }
      setOpen(false);
      await pending.current?.();
    } finally {
      setBusy(false);
      pending.current = null;
    }
  };

  const dialog = (
    <ReauthenticationDialog
      open={open}
      busy={busy}
      title={title}
      description={description}
      onOpenChange={setOpen}
      onConfirm={onConfirm}
    />
  );

  return { confirm, dialog };
}
