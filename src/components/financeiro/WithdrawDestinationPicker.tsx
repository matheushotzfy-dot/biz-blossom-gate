import { useRef } from "react";
import {
  AtSign, Building2, Check, ClipboardPaste, Fingerprint, Key, Shuffle, Smartphone, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface WithdrawPixKey {
  id: string;
  key_type: string;
  key_value?: string | null;
  key_value_masked?: string | null;
}

interface WithdrawDestinationPickerProps {
  pixKeys: WithdrawPixKey[];
  /** id of a saved key, "copy_paste" for a one-off BR Code, or "" when nothing is picked */
  pickedKey: string;
  onPickKey: (value: string) => void;
  copyPasteCode: string;
  onCopyPasteChange: (value: string) => void;
}

const KEY_META: Record<string, { label: string; icon: LucideIcon }> = {
  cpf: { label: "CPF", icon: Fingerprint },
  cnpj: { label: "CNPJ", icon: Building2 },
  email: { label: "E-mail", icon: AtSign },
  phone: { label: "Telefone", icon: Smartphone },
  telefone: { label: "Telefone", icon: Smartphone },
  random: { label: "Aleatória", icon: Shuffle },
  aleatoria: { label: "Aleatória", icon: Shuffle },
};

export const getPixKeyMeta = (type: string) =>
  KEY_META[type?.toLowerCase?.() ?? ""] ?? { label: type || "Chave", icon: Key };

export const getPixKeyLabel = (pk: WithdrawPixKey) =>
  pk.key_value || pk.key_value_masked || "Chave indisponível";

/** Light structural check: every BR Code starts with "000201" and carries a CRC tag ("6304") near the end. */
export const looksLikeBrCode = (code: string) => {
  const c = code.trim();
  return c.length >= 50 && c.startsWith("000201") && c.slice(-8).startsWith("6304");
};

/**
 * Destination selector for the withdrawal dialog.
 * Fixed-height panel so the dialog doesn't jump when switching modes.
 */
export function WithdrawDestinationPicker({
  pixKeys, pickedKey, onPickKey, copyPasteCode, onCopyPasteChange,
}: WithdrawDestinationPickerProps) {
  const lastKeyRef = useRef<string>("");
  const isCopyPaste = pickedKey === "copy_paste";
  if (!isCopyPaste && pickedKey) lastKeyRef.current = pickedKey;

  const trimmed = copyPasteCode.trim();
  const codeValid = looksLikeBrCode(trimmed);

  const selectKeysMode = () => {
    const fallback = pixKeys.find((k) => k.id === lastKeyRef.current)?.id ?? pixKeys[0]?.id ?? "";
    onPickKey(fallback);
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) { toast.error("A área de transferência está vazia"); return; }
      onCopyPasteChange(text.trim());
    } catch {
      toast.error("Não foi possível acessar a área de transferência. Cole manualmente.");
    }
  };

  const tabClass = (active: boolean) => cn(
    "relative flex h-10 flex-1 items-center justify-center gap-2 rounded-full text-[13px] font-semibold transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
  );

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Tipo de destino" className="flex gap-1 rounded-full bg-muted/70 p-1">
        <button type="button" role="tab" aria-selected={!isCopyPaste} onClick={selectKeysMode} className={tabClass(!isCopyPaste)}>
          <Key className="h-3.5 w-3.5" strokeWidth={2.5} /> Minhas chaves
          {pixKeys.length > 0 && (
            <span className={cn(
              "rounded-md px-1.5 text-[10px] font-bold tabular-nums",
              !isCopyPaste ? "bg-primary-foreground/15" : "bg-muted text-muted-foreground",
            )}>{pixKeys.length}</span>
          )}
        </button>
        <button type="button" role="tab" aria-selected={isCopyPaste} onClick={() => onPickKey("copy_paste")} className={tabClass(isCopyPaste)}>
          <ClipboardPaste className="h-3.5 w-3.5" strokeWidth={2.5} /> Copia e Cola
        </button>
      </div>

      <div className="h-[244px]">
        {isCopyPaste ? (
          <div key="cc" className="flex h-full flex-col animate-in fade-in duration-200">
            <div className={cn(
              "relative flex-1 overflow-hidden rounded-2xl border bg-background transition-colors",
              trimmed && !codeValid ? "border-destructive/50" : codeValid ? "border-success/50" : "border-border/60 focus-within:border-primary/50",
            )}>
              <textarea
                value={copyPasteCode}
                onChange={(e) => onCopyPasteChange(e.target.value)}
                aria-label="Código PIX Copia e Cola"
                placeholder="00020126...  Cole aqui o código PIX Copia e Cola"
                spellCheck={false}
                className="h-full w-full resize-none bg-transparent px-4 pb-12 pt-4 font-mono text-[12px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 border-t border-border/50 bg-card px-3 py-2">
                <span className={cn(
                  "flex items-center gap-1.5 text-[11px] font-semibold",
                  !trimmed ? "text-muted-foreground" : codeValid ? "text-success" : "text-destructive",
                )}>
                  {!trimmed ? "Aguardando código" : codeValid ? <><Check className="h-3.5 w-3.5" strokeWidth={3} /> Código reconhecido</> : <><X className="h-3.5 w-3.5" strokeWidth={3} /> Código incompleto</>}
                  {trimmed && <span className="font-normal tabular-nums text-muted-foreground">· {trimmed.length} caracteres</span>}
                </span>
                {trimmed ? (
                  <button type="button" onClick={() => onCopyPasteChange("")} className="h-8 rounded-lg px-3 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                    Limpar
                  </button>
                ) : (
                  <button type="button" onClick={pasteFromClipboard} className="flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 px-3 text-[11px] font-bold text-primary transition-colors hover:bg-primary/20">
                    <ClipboardPaste className="h-3.5 w-3.5" strokeWidth={2.5} /> Colar
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Vale só para este saque — o código não fica salvo no seu perfil.</p>
          </div>
        ) : pixKeys.length === 0 ? (
          <div key="empty" className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 p-6 text-center animate-in fade-in duration-200">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-muted-foreground"><Key className="h-5 w-5" /></span>
            <p className="text-[13px] font-semibold text-foreground">Nenhuma chave cadastrada</p>
            <p className="max-w-[240px] text-[11px] leading-relaxed text-muted-foreground">
              Cadastre em <Link to="/financeiro/config" className="font-semibold text-primary underline-offset-2 hover:underline">Dados bancários</Link> ou use Copia e Cola.
            </p>
          </div>
        ) : (
          <div key="keys" role="radiogroup" aria-label="Chaves PIX" className="flex h-full flex-col gap-2 overflow-y-auto pr-0.5 animate-in fade-in duration-200">
            {pixKeys.map((pk) => {
              const active = pickedKey === pk.id;
              const meta = getPixKeyMeta(pk.key_type);
              const Icon = meta.icon;
              return (
                <button
                  key={pk.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onPickKey(pk.id)}
                  className={cn(
                    "group flex w-full shrink-0 items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.99]",
                    active ? "border-primary bg-primary/[0.08]" : "border-border/60 bg-background hover:border-primary/40",
                  )}
                >
                  <span className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors",
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:text-primary",
                  )}>
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold text-muted-foreground">{meta.label}</span>
                    <span className="block truncate text-[14px] font-bold text-foreground">{getPixKeyLabel(pk)}</span>
                  </span>
                  <span className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-all",
                    active ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}>
                    {active && <Check className="h-3 w-3" strokeWidth={3.5} />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
