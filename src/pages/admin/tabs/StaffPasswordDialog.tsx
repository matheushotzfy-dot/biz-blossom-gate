import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogError, DialogFoot, DialogHead, FormField, dialogBox } from "@/components/seller-ui/form";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/auditLog";
import { functionErrorMessage } from "@/lib/functionError";

export function generateStaffPassword(len = 14) {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#$%";
  const arr = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(arr).map((b) => chars[b % chars.length]).join("");
}

export interface StaffPasswordTarget { user_id: string; full_name: string | null; email: string | null }

/** Redefine a senha de uma conta de staff/gerente: sugere uma senha forte, deixa trocar e copia ao salvar. */
export function StaffPasswordDialog({ target, onClose }: { target: StaffPasswordTarget | null; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target) { setPassword(generateStaffPassword()); setVisible(true); setError(null); }
  }, [target]);

  const tooShort = password.length < 8;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target || busy) return;
    if (tooShort) { setError("A senha precisa ter pelo menos 8 caracteres."); return; }
    setBusy(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke("admin-manage-staff", {
      body: { action: "reset_password", target_user_id: target.user_id, password },
    });
    if (fnError || (data as { error?: string } | null)?.error) {
      setError(await functionErrorMessage(fnError, data, "Não foi possível redefinir a senha."));
      setBusy(false);
      return;
    }
    await logAdminAction("reset_staff_password", "staff", target.user_id);
    const copied = await navigator.clipboard.writeText(password).then(() => true).catch(() => false);
    toast.success(copied ? "Senha redefinida e copiada." : "Senha redefinida. Anote antes de fechar: não dá para ver de novo.");
    setBusy(false);
    // Sem cópia automática a senha só existe nesta tela: mantém aberta para a pessoa anotar.
    if (copied) onClose();
  };

  const name = target?.full_name || target?.email || "esta conta";
  return (
    <Dialog open={!!target} onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className={dialogBox("md")}>
        <DialogHead icon={<KeyRound className="h-5 w-5" />} title="Redefinir senha" subtitle={`Nova senha de acesso de ${name}.`} />
        <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => { void submit(e); }}>
          <DialogBody>
            <FormField id="staff-new-password" label="Nova senha" hint="Entregue por um canal seguro. Depois de salvar, a senha não aparece em nenhum outro lugar.">
              <div className="relative">
                <input
                  id="staff-new-password"
                  type={visible ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={128}
                  autoComplete="new-password"
                  spellCheck={false}
                  className="vp-field !pr-24 font-mono"
                  aria-invalid={tooShort ? true : undefined}
                />
                <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 gap-0.5">
                  <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? "Ocultar senha" : "Mostrar senha"} aria-pressed={visible} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                    {visible ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                  <button type="button" onClick={() => { setPassword(generateStaffPassword()); setVisible(true); }} aria-label="Gerar outra senha" title="Gerar outra senha" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                    <RefreshCw className="h-[18px] w-[18px]" />
                  </button>
                </div>
              </div>
            </FormField>
          </DialogBody>
          {error && <DialogError>{error}</DialogError>}
          <DialogFoot>
            <button type="button" className="vp-ghost !h-12 justify-center" disabled={busy} onClick={onClose}>Cancelar</button>
            <button type="submit" className="vp-cta !h-12 justify-center sm:min-w-[190px]" disabled={busy || tooShort}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Salvando…</> : "Redefinir e copiar"}
            </button>
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}
