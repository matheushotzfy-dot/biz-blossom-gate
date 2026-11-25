import { useCallback, useState } from "react";
import { Copy, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { displayPixKey } from "@/lib/financial-input";
import { cn } from "@/lib/utils";

const PIX_KEY_LABEL: Record<string, string> = { email: "E-mail", cpf: "CPF", cnpj: "CNPJ", phone: "Telefone", celular: "Telefone", random: "Aleatória", evp: "Aleatória" };

const copy = (value: string, label: string) => {
  navigator.clipboard.writeText(value).then(
    () => toast.success(`${label} copiado`),
    () => toast.error("Não foi possível copiar. Selecione o texto e copie manualmente."),
  );
};

function Chip({ children, tone = "muted" }: { children: React.ReactNode; tone?: "primary" | "warning" | "muted" }) {
  return (
    <span className={cn("w-fit rounded-md border px-1.5 py-0.5 text-[11px] font-semibold",
      tone === "primary" ? "border-primary/25 bg-primary/10 text-primary" : tone === "warning" ? "border-warning/30 bg-warning/10 text-warning" : "border-border bg-muted/40 text-muted-foreground")}>{children}</span>
  );
}
function CopyValue({ value, label }: { value: string; label: string }) {
  return (
    <button type="button" onClick={() => copy(value, label)} title={`Copiar ${label.toLowerCase()}`} aria-label={`Copiar ${label.toLowerCase()}`}
      className="flex max-w-[210px] items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2 py-1 text-left transition-colors hover:border-border hover:bg-muted/60">
      <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="truncate font-mono text-[11px] text-foreground/80">{value}</span>
    </button>
  );
}

/**
 * Destino do pagamento — revela sob demanda a chave PIX (ou endereço cripto)
 * do vendedor, deixando explícito o TIPO da chave e facilitando a cópia.
 */
export function PayoutTarget({ withdrawal }: { withdrawal: Tables<"withdrawals"> }) {
  const [revealed, setRevealed] = useState<{ type: string; value: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const reveal = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_reveal_pix_keys", { _user_id: withdrawal.user_id });
      if (error) { toast.error("Sem permissão para revelar a chave"); return; }
      const rows = (data as { id: string; key_type: string; key_value: string; is_default: boolean }[]) || [];
      const match = rows.find((r) => r.id === withdrawal.pix_key_id) || rows.find((r) => r.is_default) || rows[0];
      if (!match) { toast.error("O seller não tem chave Pix cadastrada"); return; }
      setRevealed({ type: match.key_type, value: match.key_value });
    } finally {
      setLoading(false);
    }
  }, [withdrawal.pix_key_id, withdrawal.user_id]);

  if (withdrawal.withdrawal_type === "crypto") {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1"><Chip tone="warning">{withdrawal.crypto_currency || "Cripto"}</Chip>{withdrawal.crypto_network ? <Chip>{withdrawal.crypto_network}</Chip> : null}</div>
        {withdrawal.crypto_address ? <CopyValue value={withdrawal.crypto_address} label="Endereço" /> : <span className="text-[11px] text-muted-foreground">—</span>}
      </div>
    );
  }
  if (withdrawal.pix_copy_paste_code) {
    return <div className="flex flex-col gap-1"><Chip tone="primary">Pix copia e cola</Chip><CopyValue value={withdrawal.pix_copy_paste_code} label="Código Pix" /></div>;
  }
  if (revealed) {
    return <div className="flex flex-col gap-1"><Chip tone="primary">{PIX_KEY_LABEL[revealed.type?.toLowerCase()] || revealed.type || "Pix"}</Chip><CopyValue value={displayPixKey(revealed.value, revealed.type)} label="Chave Pix" /></div>;
  }
  return (
    <button type="button" onClick={() => void reveal()} disabled={loading}
      className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2 py-1 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-60">
      <Eye className="h-3 w-3" /> {loading ? "Abrindo…" : "Ver chave Pix"}
    </button>
  );
}
