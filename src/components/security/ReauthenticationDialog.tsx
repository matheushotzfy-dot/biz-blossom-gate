import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogFoot, DialogHead, FormField, dialogBox } from "@/components/seller-ui/form";

export interface ReauthenticationDialogProps {
  open: boolean;
  busy?: boolean;
  title?: string;
  description?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (password: string) => Promise<void>;
}

const REAUTH_MIN_LENGTH = 6;

/** Pede a senha de novo antes de uma operação sensível (saque, troca de chave Pix…). A senha nunca fica guardada: some ao fechar. */
export function ReauthenticationDialog({
  open,
  busy = false,
  title = "Confirme sua identidade",
  description = "Digite sua senha atual para autorizar esta operação sensível.",
  onOpenChange,
  onConfirm,
}: ReauthenticationDialogProps) {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) { setPassword(""); setVisible(false); }
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (busy) return;
    onOpenChange(next);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < REAUTH_MIN_LENGTH || busy) return;
    await onConfirm(password);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={dialogBox("sm", "z-[150]")}>
        <DialogHead icon={<LockKeyhole className="h-5 w-5" />} title={title} subtitle={description} />
        <form onSubmit={(e) => { void handleSubmit(e); }} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody>
            <FormField id="reauth-password" label="Senha atual" hint="É a mesma senha que você usa para entrar.">
              <div className="relative">
                <input
                  id="reauth-password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  autoFocus
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="vp-field !pr-12"
                  aria-describedby="reauth-password-msg"
                />
                <button
                  type="button"
                  onClick={() => setVisible((v) => !v)}
                  aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={visible}
                  className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {visible ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </div>
            </FormField>
          </DialogBody>
          <DialogFoot>
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={() => handleOpenChange(false)} disabled={busy}>Cancelar</button>
            <button type="submit" className="vp-cta !h-12 justify-center sm:min-w-[190px]" disabled={busy || password.length < REAUTH_MIN_LENGTH}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Confirmando…</> : "Confirmar e continuar"}
            </button>
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}
