import { useCallback, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2, MessageSquareText, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogFoot, DialogHead, FieldHint, FieldLabel, dialogBox, dialogShell } from "@/components/seller-ui/form";
import { cn } from "@/lib/utils";

export type ConfirmTone = "danger" | "warning" | "default";

export interface ConfirmOptions {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger: apagar/revogar (botão vermelho). warning: ação delicada mas reversível. default: confirmar. */
  tone?: ConfirmTone;
  icon?: ReactNode;
}

const TONES: Record<ConfirmTone, { chip: string; cta: string }> = {
  danger: { chip: "bg-destructive/15 text-destructive", cta: "vp-cta vp-cta-danger" },
  warning: { chip: "bg-warning/15 text-warning", cta: "vp-cta" },
  default: { chip: "bg-accent text-accent-foreground", cta: "vp-cta" },
};

/**
 * Confirmação de uma ação (apagar, revogar, sair sem salvar…). O botão de confirmar não fecha sozinho:
 * quem chama decide quando fechar, para poder mostrar `busy` enquanto grava.
 */
export function ConfirmDialog({ open, onOpenChange, busy = false, onConfirm, tone = "danger", confirmLabel = "Confirmar", cancelLabel = "Cancelar", icon, title, description, children }: ConfirmOptions & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  /** Conteúdo extra abaixo do texto (lista do que será afetado, aviso…). */
  children?: ReactNode;
}) {
  const t = TONES[tone];
  const glyph = icon ?? (tone === "danger" ? <Trash2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />);
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next && busy) return; onOpenChange(next); }}>
      <AlertDialogContent className={cn(dialogShell, "w-[calc(100vw-1rem)] max-w-[460px]")}>
        <div className="flex gap-4 px-6 pb-6 pt-6 sm:px-8 sm:pt-7">
          <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-full", t.chip)}>{glyph}</span>
          <div className="min-w-0 flex-1">
            <AlertDialogTitle className="font-heading text-[20px] font-extrabold leading-tight tracking-[-0.03em] text-foreground">{title}</AlertDialogTitle>
            {description && <AlertDialogDescription asChild><div className="mt-1.5 text-[14.5px] leading-relaxed text-muted-foreground">{description}</div></AlertDialogDescription>}
            {children}
          </div>
        </div>
        <DialogFoot>
          <AlertDialogCancel disabled={busy} className="vp-ghost !mt-0 !h-12 justify-center">{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction className={cn(t.cta, "!h-12 justify-center sm:min-w-[150px]")} disabled={busy} onClick={(e) => { e.preventDefault(); void onConfirm(); }}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Aguarde…</> : confirmLabel}
          </AlertDialogAction>
        </DialogFoot>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Troca `window.confirm`: `ask(...)` devolve uma promessa com a resposta e `dialog` precisa ser renderizado uma vez na tela.
 *   const { ask, dialog } = useConfirm();
 *   if (!(await ask({ title: "Remover o link?" }))) return;
 */
export function useConfirm() {
  const [req, setReq] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  // guarda o último pedido para o texto não sumir durante a animação de fechar
  const last = useRef<ConfirmOptions>({ title: "" });
  if (req) last.current = req;

  const ask = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setReq({ ...options, resolve })), []);
  const settle = (value: boolean) => { req?.resolve(value); setReq(null); };

  const dialog = (
    <ConfirmDialog
      {...last.current}
      open={!!req}
      onOpenChange={(open) => { if (!open) settle(false); }}
      onConfirm={() => settle(true)}
    />
  );
  return { ask, dialog };
}

export interface ReasonOptions {
  title: ReactNode;
  description?: ReactNode;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  /** Mínimo de caracteres (sem contar espaços nas pontas). */
  minLength?: number;
  confirmLabel?: string;
  tone?: ConfirmTone;
}

function ReasonDialog({ open, options, onCancel, onSubmit }: { open: boolean; options: ReasonOptions; onCancel: () => void; onSubmit: (text: string) => void }) {
  const [text, setText] = useState(options.defaultValue ?? "");
  const [touched, setTouched] = useState(false);
  const min = options.minLength ?? 1;
  const clean = text.trim();
  const short = clean.length < min;
  const tone = options.tone ?? "default";
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className={dialogBox("md")}>
        <DialogHead icon={<MessageSquareText className="h-5 w-5" />} title={options.title} subtitle={options.description} />
        <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); setTouched(true); if (!short) onSubmit(clean); }}>
          <DialogBody>
            <div>
              <FieldLabel htmlFor="reason-text">{options.label ?? "Motivo"}</FieldLabel>
              <textarea
                id="reason-text" className="vp-field resize-none" rows={4} autoFocus value={text} maxLength={500}
                onChange={(e) => setText(e.target.value)} placeholder={options.placeholder}
                aria-invalid={touched && short ? true : undefined} aria-describedby="reason-hint"
              />
              {touched && short
                ? <p id="reason-hint" role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">{min > 1 ? `Escreva pelo menos ${min} caracteres.` : "Escreva o motivo."}</p>
                : <FieldHint><span id="reason-hint">{min > 1 ? `Mínimo de ${min} caracteres.` : "Fica registrado junto com a ação."}</span></FieldHint>}
            </div>
          </DialogBody>
          <DialogFoot>
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={onCancel}>Cancelar</button>
            <button type="submit" className={cn(TONES[tone].cta, "!h-12 justify-center sm:min-w-[150px]")}>{options.confirmLabel ?? "Continuar"}</button>
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Troca `window.prompt` para pedir um motivo: `ask(...)` devolve o texto ou `null` se a pessoa cancelar. */
export function useReason() {
  const [req, setReq] = useState<(ReasonOptions & { resolve: (v: string | null) => void }) | null>(null);
  const last = useRef<ReasonOptions>({ title: "" });
  if (req) last.current = req;

  const ask = useCallback((options: ReasonOptions) => new Promise<string | null>((resolve) => setReq({ ...options, resolve })), []);
  const settle = (value: string | null) => { req?.resolve(value); setReq(null); };

  // a chave remonta o diálogo a cada pedido, zerando o texto digitado
  const dialog = <ReasonDialog key={req ? String(req.title) + (req.defaultValue ?? "") : "idle"} open={!!req} options={last.current} onCancel={() => settle(null)} onSubmit={(text) => settle(text)} />;
  return { ask, dialog };
}
