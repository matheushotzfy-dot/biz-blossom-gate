import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import { rpcErrorMessage } from "./types";
import { useSensitiveConfirm } from "./useSensitiveConfirm";

interface Settings { refunds: boolean; med: boolean; withdrawals: boolean; acquirer_auto_intake: boolean }
const DEFAULTS: Settings = { refunds: true, med: true, withdrawals: true, acquirer_auto_intake: false };
const ITEMS: { key: keyof Settings; label: string; hint: string; on: string; off: string }[] = [
  { key: "refunds", label: "Reembolsos manuais", hint: "Toda devolução espera sua confirmação",
    on: "Toda devolução volta a esperar sua confirmação.", off: "As devoluções deixam de esperar a sua confirmação." },
  { key: "med", label: "MED Pix manual", hint: "Você decide se estorna ou libera",
    on: "Você volta a decidir cada MED (estornar ou liberar).", off: "O MED deixa de passar pela sua decisão." },
  { key: "withdrawals", label: "Saques manuais", hint: "Nenhum saque é pago sem sua aprovação",
    on: "Nenhum saque volta a ser pago sem a sua aprovação.", off: "Saques deixam de precisar da sua aprovação." },
  { key: "acquirer_auto_intake", label: "Abrir MED automático pela adquirente", hint: "Desligado: só gera alerta para você abrir",
    on: "O MED passa a ser aberto sozinho quando a adquirente avisar.", off: "A adquirente passa a só gerar um alerta para você abrir o MED." },
];

/** Owner-only switches. Everything starts manual; changing requires password. */
export function ManualApprovalSettings() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const { confirm, dialog } = useSensitiveConfirm();

  const load = useCallback(async () => {
    setState("loading");
    const { data, error } = await supabase.from("platform_settings").select("value").eq("key", "manual_approval").maybeSingle();
    if (error) { setState("error"); return; }
    // sem linha gravada = nunca foi alterado: vale o padrão (tudo manual)
    setS({ ...DEFAULTS, ...((data?.value as Partial<Settings> | null) ?? {}) });
    setState("ok");
  }, []);
  useEffect(() => { void load(); }, [load]);

  const toggle = (item: (typeof ITEMS)[number], value: boolean) => {
    const next = { ...s, [item.key]: value };
    confirm(`${value ? "Ligar" : "Desligar"} "${item.label}". ${value ? item.on : item.off}`, async () => {
      const { data, error } = await supabase.rpc("admin_set_manual_approval", { _value: next });
      if (error) { toast.error(rpcErrorMessage(error)); return; }
      setS(data as unknown as Settings); toast.success("Regra salva");
    });
  };

  return (
    <PremiumPanel title="Aprovação manual">
      <p className="mb-3 text-[12.5px] text-muted-foreground">Só o dono altera estas regras, e cada mudança pede a sua senha de novo.</p>
      {state === "loading" ? (
        <div className="flex h-20 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando regras" /></div>
      ) : state === "error" ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-[13px] font-semibold text-destructive">Não foi possível ler as regras atuais.</p>
          <p className="text-[12px] text-muted-foreground">Não mostramos os interruptores para você não decidir olhando um valor que talvez não seja o real.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>Tentar de novo</Button>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-1 md:grid-cols-[repeat(2,minmax(0,1fr))]">
          {ITEMS.map((i) => (
            <label key={i.key} className="flex cursor-pointer items-center justify-between gap-4 rounded-[10px] px-1 py-2.5">
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-foreground">{i.label}</span>
                <span className="block text-[12px] text-muted-foreground">{i.hint}</span>
              </span>
              <Switch checked={s[i.key]} onCheckedChange={(v) => toggle(i, v)} aria-label={i.label} />
            </label>
          ))}
        </div>
      )}
      {dialog}
    </PremiumPanel>
  );
}
