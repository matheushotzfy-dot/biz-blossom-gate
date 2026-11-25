import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Repeat2, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogHead, FieldHint, FieldLabel, dialogShell } from "@/components/seller-ui/form";
import { copyText } from "@/components/seller-ui/copy";
import { cn } from "@/lib/utils";
import { KEY_NAME_MAX } from "./intMeta";

export interface KeyNameTarget { mode: "create" | "rename" | "replace"; name?: string; /** nome da chave que está sendo trocada */ from?: string }
export interface SaveResult { ok: boolean; message?: string }

/** Nome da chave: serve para criar, renomear e trocar. */
export function KeyNameDialog({ target, taken = [], onOpenChange, onSave }: {
  target: KeyNameTarget | null;
  /** Nomes que as outras chaves já usam (avisa, não bloqueia). */
  taken?: string[];
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
  const mode = target?.mode ?? "create";
  const repeated = !invalid && taken.some((n) => n.trim().toLowerCase() === clean.toLowerCase());

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

  const head = mode === "rename"
    ? { icon: <KeyRound className="h-5 w-5" />, title: "Renomear chave", subtitle: "O nome só ajuda você a reconhecer a chave." }
    : mode === "replace"
      ? { icon: <Repeat2 className="h-5 w-5" />, title: "Trocar chave", subtitle: target?.from ? `Substitui "${target.from}"` : "Cria uma chave nova" }
      : { icon: <KeyRound className="h-5 w-5" />, title: "Nova chave de API", subtitle: "Uma chave por sistema facilita revogar só o que vazou." };

  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className={cn(dialogShell, "w-[calc(100vw-1rem)] max-w-[480px]")}>
        <DialogHead icon={head.icon} title={head.title} subtitle={head.subtitle} />
        <form onSubmit={(e) => { void submit(e); }} noValidate>
          <div className="space-y-2 px-6 py-6 sm:px-8">
            <FieldLabel htmlFor="key-name">{mode === "replace" ? "Nome da chave nova" : "Nome da chave"}</FieldLabel>
            <input id="key-name" className="vp-field" value={name} maxLength={KEY_NAME_MAX} autoFocus onChange={(e) => { setName(e.target.value); setError(null); }} placeholder="Ex.: Produção, Loja, Zapier" aria-invalid={touched && invalid} />
            {touched && invalid ? <p role="alert" className="text-[12.5px] font-medium text-destructive">Dê um nome para a chave.</p>
              : repeated && mode !== "rename" ? <FieldHint>Já existe uma chave com esse nome. Dá para usar, mas fica mais difícil saber qual é qual.</FieldHint>
              : mode === "replace" ? <FieldHint>A atual continua valendo até você revogar. A nova vale por 90 dias.</FieldHint>
              : mode === "create" ? <FieldHint>A chave vale por 90 dias. Depois disso é preciso criar outra.</FieldHint> : null}
          </div>
          {error && <p role="alert" className="border-t border-border bg-destructive/10 px-6 py-3 text-[13.5px] font-medium text-destructive sm:px-8">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-border bg-card px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</button>
            <button type="submit" className="vp-cta !h-12 justify-center" disabled={busy}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Salvando…</> : mode === "rename" ? "Salvar nome" : mode === "replace" ? "Criar chave nova" : "Criar chave"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface RevealedKey { name: string; public_key: string; secret_key: string; /** nome da chave que esta substitui */ replaces?: string }

const SECRET_PREFIX = /^(sk_[a-z]+_)/;

function selectAll(el: HTMLElement) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** A chave secreta só existe aqui: o servidor guarda apenas o hash. */
export function SecretDialog({ value, onClose }: { value: RevealedKey | null; onClose: () => void }) {
  const [copied, setCopied] = useState<"secret" | "public" | null>(null);
  const [warn, setWarn] = useState(false);
  useEffect(() => { if (value) { setCopied(null); setWarn(false); } }, [value]);

  const copy = async (which: "secret" | "public") => {
    if (!value) return;
    const ok = await copyText(which === "secret" ? value.secret_key : value.public_key, which === "secret" ? "Chave secreta copiada." : "Chave pública copiada.");
    if (ok) { setCopied(which); if (which === "secret") setWarn(false); }
  };

  // Fechar sem ter copiado a secreta pede uma segunda confirmação: depois disso a chave não volta.
  const close = () => {
    if (copied !== "secret" && !warn) { setWarn(true); return; }
    onClose();
  };

  const secret = value?.secret_key ?? "";
  const prefix = secret.match(SECRET_PREFIX)?.[1] ?? "";

  return (
    <Dialog open={!!value} onOpenChange={() => { /* só fecha pelo botão: a chave não aparece de novo */ }}>
      <DialogContent
        className={cn(dialogShell, "w-[calc(100vw-1rem)] max-w-[560px] [&>button]:hidden")}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHead icon={<ShieldAlert className="h-5 w-5" />} title="Copie sua chave secreta" subtitle={value?.name} />
        <div className="space-y-5 px-6 py-6 sm:px-8">
          <div className="overflow-hidden rounded-[18px] bg-[hsl(222_47%_8%)] text-white shadow-[inset_0_0_0_1px_hsl(0_0%_100%/.1)]">
            <div className="flex items-center justify-between gap-3 px-4 pt-3.5">
              <span className="text-[12.5px] font-semibold text-white/60">Chave secreta</span>
              <button type="button" className="vp-r12 inline-flex h-9 items-center gap-2 bg-white/15 px-3 text-[13px] font-semibold text-white hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" onClick={() => { void copy("secret"); }}>
                {copied === "secret" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied === "secret" ? "Copiada" : "Copiar"}
              </button>
            </div>
            <p id="secret-key" className="cursor-text break-all px-4 pb-4 pt-2 font-mono text-[12.5px] leading-relaxed" onClick={(e) => selectAll(e.currentTarget)}>
              <span className="text-white/45">{prefix}</span>{secret.slice(prefix.length)}
            </p>
          </div>

          <p className="text-[13.5px] leading-snug text-muted-foreground">
            Esta é a única vez que a chave inteira aparece. Guarde num cofre de senhas ou numa variável de ambiente, nunca no código nem em repositório público. Se perder, crie outra.
          </p>

          {value?.replaces && (
            <p className="rounded-[16px] bg-accent px-4 py-3 text-[13.5px] font-medium leading-snug text-accent-foreground">
              Esta chave substitui &ldquo;{value.replaces}&rdquo;, que continua valendo até você revogar. Troque no seu sistema primeiro e revogue a antiga depois.
            </p>
          )}

          <div>
            <FieldLabel htmlFor="public-key">Chave pública</FieldLabel>
            <div className="flex items-center gap-2">
              <input id="public-key" readOnly className="vp-field min-w-0 flex-1 font-mono !text-[13px]" value={value?.public_key ?? ""} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="vp-pill !h-12 shrink-0 !px-4" onClick={() => { void copy("public"); }}>
                {copied === "public" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied === "public" ? "Copiada" : "Copiar"}
              </button>
            </div>
            <FieldHint>A pública continua visível na lista de credenciais.</FieldHint>
          </div>
        </div>
        {warn && <p role="alert" className="border-t border-border bg-warning/15 px-6 py-3 text-[13.5px] font-medium text-warning sm:px-8">Você ainda não copiou a chave secreta, e ela não aparece de novo. Copie agora ou feche mesmo assim.</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-border bg-card px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
          <button type="button" className={cn("!h-12 justify-center", warn ? "vp-ghost" : "vp-cta")} onClick={close}>{warn ? "Fechar mesmo assim" : "Já guardei a chave"}</button>
          {warn && <button type="button" className="vp-cta !h-12 justify-center" onClick={() => { void copy("secret"); }}><Copy className="h-4 w-4" />Copiar a chave secreta</button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
