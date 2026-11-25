import { useEffect, useState } from "react";
import StaffManagementTab from "./StaffManagementTab";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ShieldAlert, Save, Percent, Banknote, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { PremiumPanel } from "./AdminPremium";
import { friendlyError } from "@/lib/friendlyError";
import { logAdminAction } from "@/lib/auditLog";

interface Props {
  profiles: Tables<"profiles">[];
  onReload: () => void;
}

export default function AdminManagersTab({ profiles, onReload }: Props) {
  const { user } = useAuth();
  const [limits, setLimits] = useState({
    min_transaction_percentage: 2.0,
    min_transaction_fixed: 1.0,
    min_withdrawal_fee: 3.0,
  });
  const [limitsId, setLimitsId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("manager_fee_limits")
        .select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (data) {
        setLimitsId(data.id);
        setLimits({
          min_transaction_percentage: Number(data.min_transaction_percentage),
          min_transaction_fixed: Number(data.min_transaction_fixed),
          min_withdrawal_fee: Number(data.min_withdrawal_fee),
        });
      }
    })();
  }, []);

  const saveLimits = async () => {
    if (limits.min_transaction_percentage < 0 || limits.min_transaction_percentage > 100) {
      toast.error("% mínima de taxa deve estar entre 0 e 100"); return;
    }
    if (limits.min_transaction_fixed < 0) { toast.error("Taxa fixa mínima não pode ser negativa"); return; }
    if (limits.min_withdrawal_fee < 0) { toast.error("Taxa de saque mínima não pode ser negativa"); return; }
    setSaving(true);
    const payload = { ...limits, updated_by: user?.id ?? null, updated_at: new Date().toISOString() };
    const { error } = limitsId
      ? await supabase.from("manager_fee_limits").update(payload).eq("id", limitsId)
      : await supabase.from("manager_fee_limits").insert(payload);
    setSaving(false);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Limites salvos.");
    await logAdminAction("update_manager_fee_limits", "manager_fee_limits", limitsId ?? "global", payload);
  };

  return (
    <div className="space-y-6">
      <StaffManagementTab profiles={profiles} onReload={onReload} role="manager" />

      <PremiumPanel
        eyebrow="Governança"
        title="Limites mínimos de taxas para gerentes"
        icon={ShieldAlert}
        action={
          <Button size="sm" onClick={saveLimits} disabled={saving} className="gap-1.5 h-9">
            <Save className="h-3.5 w-3.5" /> {saving ? "Salvando..." : "Salvar limites"}
          </Button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Percent, label: "% mínima de taxa", value: limits.min_transaction_percentage, suffix: "%", key: "min_transaction_percentage" as const, tone: "primary" },
            { icon: Banknote, label: "Taxa fixa mínima", value: limits.min_transaction_fixed, suffix: "R$", key: "min_transaction_fixed" as const, tone: "success" },
            { icon: ArrowDownToLine, label: "Taxa saque mínima", value: limits.min_withdrawal_fee, suffix: "R$", key: "min_withdrawal_fee" as const, tone: "warning" },
          ].map((f) => (
            <div key={f.key} className="group relative overflow-hidden rounded-xl border border-border/60 bg-muted/20 p-4 transition-colors hover:border-primary/30">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">{f.label}</Label>
                <f.icon className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary transition-colors" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] font-bold text-muted-foreground">{f.suffix}</span>
                <Input type="number" step="0.01" min="0" value={f.value}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") return;
                    const v = parseFloat(raw);
                    if (Number.isNaN(v)) { toast.error("Valor inválido"); return; }
                    if (v < 0) { toast.error("Valor não pode ser negativo"); return; }
                    if (f.key === "min_transaction_percentage" && v > 100) { toast.error("% não pode ser maior que 100"); return; }
                    setLimits((s) => ({ ...s, [f.key]: v }));
                  }}
                  className="h-10 text-lg font-display font-black tabular-nums bg-transparent border-0 border-b border-border/40 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary" />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-muted-foreground/80 flex items-start gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 mt-0.5 text-warning shrink-0" />
          Gerentes não conseguem aplicar taxas abaixo destes valores. Admin não tem restrição.
        </p>
      </PremiumPanel>
    </div>
  );
}
