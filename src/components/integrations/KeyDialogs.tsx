import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogHead, FieldHint, FieldLabel, dialogShell } from "@/components/seller-ui/form";
import { copyText } from "@/components/seller-ui/copy";
import { cn } from "@/lib/utils";
import { KEY_NAME_MAX } from "./intMeta";

export interface KeyNameTarget { mode: "create" | "rename"; name?: string }
export interface SaveResult { ok: boolean; message?: string }

/** Nome da chave: serve para criar e para renomear. */
export function KeyNameDialog({ target, onOpenChange, onSave }: {
  target: KeyNameTarget | null;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => Promise<SaveResult>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (target) { setName(target.name ?? (target.mode === "create" ? "Produção" : "")); setBusy(false); setTouched(false); setError(null); } }, [target]);

  const clean = name.trim();
  const invalid = clean.length === 0;
  const rename = target?.mode === "rename";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (invalid || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await onSave(clean);
      if (!res.ok) setError(res.message || "Não foi possível salvar. Tente de novo.");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className={cn(dialogShell, "w-[calc(100vw-1rem)] max-w-[480px]")}>
        <DialogHead icon={<KeyRound className="h-5 w-5" />} title={rename ? "Renomear chave" : "Nova chave de API"} subtitle={rename ? "O nome só ajuda você a reconhecer a chave." : "Uma chave por sistema ou ambiente facilita revogar só o que vazou."} />
        <form onSubmit={(e) => { void submit(e); }} noValidate>
          <div className="space-y-2 px-6 py-6 sm:px-8">
            <FieldLabel htmlFor="key-name">Nome da chave</FieldLabel>
            <input id="key-name" className="vp-field" value={name} maxLength={KEY_NAME_MAX} autoFocus onChange={(e) => { setName(e.target.value); setError(null); }} placeholder="Ex.: Produção, Loja, Zapier" aria-invalid={touched && invalid} />
            {touched && invalid ? <p role="alert" className="text-[12.5px] font-medium text-destructive">Dê um nome para a chave.</p> : !rename && <FieldHint>A chave vale por 90 dias. Depois disso é preciso criar outra.</FieldHint>}
          </div>
          {error && <p role="alert" className="border-t border-border bg-destructive/10 px-6 py-3 text-[13.5px] font-medium text-destructive sm:px-8">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-border bg-card px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</button>
            <button type="submit" className="vp-cta !h-12 justify-center" disabled={busy}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Salvando…</> : rename ? "Salvar nome" : "Criar chave"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface RevealedKey { name: string; public_key: string; secret_key: string }

/** A chave secreta só existe aqui: o servidor guarda apenas o hash. */
export function SecretDialog({ value, onClose }: { value: RevealedKey | null; onClose: () => void }) {
  const [copied, setCopied] = useState<"secret" | "public" | null>(null);
  useEffect(() => { if (value) setCopied(null); }, [value]);

  const copy = async (which: "secret" | "public") => {
    if (!value) return;
    const ok = await copyText(which === "secret" ? value.secret_key : value.public_key, which === "secret" ? "Chave secreta copiada." : "Chave pública copiada.");
    if (ok) setCopied(which);
  };

  return (
    <Dialog open={!!value} onOpenChange={() => { /* só fecha pelo botão: a chave não aparece de novo */ }}>
      <DialogContent
        className={cn(dialogShell, "w-[calc(100vw-1rem)] max-w-[560px] [&>button]:hidden")}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHead icon={<ShieldAlert className="h-5 w-5" />} title="Copie sua chave secreta agora" subtitle={value?.name} />
        <div className="space-y-5 px-6 py-6 sm:px-8">
          <p className="rounded-[16px] bg-warning/15 px-4 py-3 text-[13.5px] font-medium leading-snug text-warning">
            Esta é a única vez que a chave secreta aparece. Guarde em um cofre de senhas. Se perder, crie outra chave.
          </p>
          <div>
            <FieldLabel htmlFor="secret-key">Chave secreta</FieldLabel>
            <div className="flex items-center gap-2">
              <input id="secret-key" readOnly className="vp-field min-w-0 flex-1 font-mono !text-[13px]" value={value?.secret_key ?? ""} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="vp-pill !h-12 shrink-0 bg-accent !px-4 text-accent-foreground hover:!bg-accent" onClick={() => { void copy("secret"); }}>
                {copied === "secret" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied === "secret" ? "Copiada" : "Copiar"}
              </button>
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="public-key">Chave pública</FieldLabel>
            <div className="flex items-center gap-2">
              <input id="public-key" readOnly className="vp-field min-w-0 flex-1 font-mono !text-[13px]" value={value?.public_key ?? ""} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="vp-pill !h-12 shrink-0 !px-4" onClick={() => { void copy("public"); }}>
                {copied === "public" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied === "public" ? "Copiada" : "Copiar"}
              </button>
            </div>
            <FieldHint>A chave pública continua visível na lista de credenciais.</FieldHint>
          </div>
        </div>
        <div className="flex justify-end border-t border-border bg-card px-6 py-4 sm:px-8">
          <button type="button" className="vp-cta !h-12 justify-center" onClick={onClose}>Já guardei a chave</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
