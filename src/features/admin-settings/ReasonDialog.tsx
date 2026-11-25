import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogError, DialogFoot, DialogHead, FieldLabel, dialogBox } from "@/components/seller-ui/form";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { Chip } from "./Chip";
import { checkReason } from "./settingsModel";

interface Props {
  open: boolean;
  onClose: () => void;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  /** Texto e campos extras do diálogo, acima do motivo. */
  children?: ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  danger?: boolean;
  /** "required": motivo de pelo menos 5 caracteres. "none": sem campo de motivo. */
  reason: "required" | "none";
  presets?: readonly string[];
  /** Frase mostrada na confirmação de senha. */
  confirmText: string;
  /** Problema dos campos extras (o diálogo não envia enquanto houver). */
  extraProblem?: string | null;
  /** Faz a chamada. Lançar erro mostra a mensagem dentro do diálogo e nada fecha. */
  onSubmit: (reason: string) => Promise<void>;
  onTouched?: () => void;
}

/** Diálogo único das mudanças sensíveis das Configurações: explica, pede o motivo, pede a senha de novo e envia. */
export function ReasonDialog(p: Props) {
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!p.open) return;
    setReason(""); setTouched(false); setBusy(false); setServerError(null);
  }, [p.open]);

  const problem = p.reason === "required" ? checkReason(reason) : null;
  const blocked = !!problem || !!p.extraProblem;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true); p.onTouched?.(); setServerError(null);
    if (blocked) return;
    sensitive.confirm(p.confirmText, async () => {
      setBusy(true);
      try { await p.onSubmit(reason.trim()); p.onClose(); }
      catch (err) { setServerError(friendlyError(err, "Não foi possível salvar. Nada mudou.")); }
      finally { setBusy(false); }
    });
  };

  return (
    <>
      <Dialog open={p.open} onOpenChange={(o) => { if (!o && !busy) p.onClose(); }}>
        <DialogContent className={dialogBox("md")}>
          <DialogHead icon={p.icon} title={p.title} subtitle={p.subtitle} />
          <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submit}>
            <DialogBody>
              {p.children}
              {p.reason === "required" && (
                <div>
                  <FieldLabel htmlFor="settings-reason" hint="Fica no histórico desta mudança.">Motivo</FieldLabel>
                  {p.presets && p.presets.length > 0 && (
                    <div className="mb-2.5 flex flex-wrap gap-2">
                      {p.presets.map((t) => <Chip key={t} active={reason === t} onClick={() => setReason(t)} className="!h-9 px-3.5 text-[13px] font-medium">{t}</Chip>)}
                    </div>
                  )}
                  <textarea id="settings-reason" className="vp-field resize-none" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={touched && !!problem} />
                  {touched && problem && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">{problem}</p>}
                </div>
              )}
            </DialogBody>
            {serverError && <DialogError>{serverError}</DialogError>}
            <DialogFoot>
              <button type="button" className="vp-ghost !h-12 justify-center" onClick={p.onClose} disabled={busy}>Voltar</button>
              <button type="submit" className={cn("vp-cta", p.danger && "vp-cta-danger", "!h-12 justify-center sm:min-w-[190px]")} disabled={busy}>
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> {p.busyLabel ?? "Salvando…"}</> : p.confirmLabel}
              </button>
            </DialogFoot>
          </form>
        </DialogContent>
      </Dialog>
      {sensitive.dialog}
    </>
  );
}
