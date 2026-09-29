import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { rpcErrorMessage } from "./types";
import { useSensitiveConfirm } from "./useSensitiveConfirm";

interface Settings { refunds: boolean; med: boolean; withdrawals: boolean; acquirer_auto_intake: boolean }
const DEFAULTS: Settings = { refunds: true, med: true, withdrawals: true, acquirer_auto_intake: false };
const ITEMS: { key: keyof Settings; label: string; hint: string }[] = [
  { key: "refunds", label: "Reembolsos manuais", hint: "Toda devolução espera sua confirmação" },
  { key: "med", label: "MED PIX manual", hint: "Você decide se estorna ou libera" },
  { key: "withdrawals", label: "Saques manuais", hint: "Nenhum saque é pago sem sua aprovação" },
  { key: "acquirer_auto_intake", label: "Abrir MED automático pela adquirente", hint: "Desligado: só gera alerta para você abrir" },
];

/** Owner-only switches. Everything starts manual; changing requires password. */
export function ManualApprovalSettings() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const { confirm, dialog } = useSensitiveConfirm();

  useEffect(() => {
    void supabase.from("platform_settings").select("value").eq("key", "manual_approval").maybeSingle()
      .then(({ data }) => { if (data?.value) setS({ ...DEFAULTS, ...(data.value as Partial<Settings>) }); });
  }, []);

  const toggle = (key: keyof Settings, value: boolean) => {
    const next = { ...s, [key]: value };
    confirm("Alterar regras de aprovação manual da plataforma.", async () => {
      const { data, error } = await supabase.rpc("admin_set_manual_approval", { _value: next });
      if (error) { toast.error(rpcErrorMessage(error)); return; }
      setS(data as unknown as Settings); toast.success("Configuração salva");
    });
  };

  return (
    <div className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-card p-3 md:grid-cols-2">
      {ITEMS.map((i) => (
        <label key={i.key} className="flex items-center justify-between gap-3 rounded-lg p-2">
          <span><span className="block text-sm font-semibold">{i.label}</span><span className="block text-xs text-muted-foreground">{i.hint}</span></span>
          <Switch checked={s[i.key]} onCheckedChange={(v) => toggle(i.key, v)} aria-label={i.label} />
        </label>
      ))}
      {dialog}
    </div>
  );
}
