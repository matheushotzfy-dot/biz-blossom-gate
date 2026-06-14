import { useEffect, useState } from "react";
import StaffManagementTab from "./StaffManagementTab";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Settings, Save } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

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
    setSaving(true);
    const payload = { ...limits, updated_by: user?.id ?? null, updated_at: new Date().toISOString() };
    const { error } = limitsId
      ? await supabase.from("manager_fee_limits").update(payload).eq("id", limitsId)
      : await supabase.from("manager_fee_limits").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Limites salvos.");
  };

  return (
    <div className="space-y-6">
      <StaffManagementTab profiles={profiles} onReload={onReload} role="manager" />

      <div className="border border-border rounded-md bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Settings className="h-4 w-4 text-emerald-400" /> Taxas mínimas que gerentes podem aplicar
          </h3>
          <Button size="sm" onClick={saveLimits} disabled={saving} className="gap-1.5 h-8">
            <Save className="h-3.5 w-3.5" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">% mínima de taxa</Label>
            <Input type="number" step="0.01" min="0" value={limits.min_transaction_percentage}
              onChange={(e) => setLimits((s) => ({ ...s, min_transaction_percentage: parseFloat(e.target.value) || 0 }))}
              className="h-9 text-sm mt-1 font-mono" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Taxa fixa mínima (R$)</Label>
            <Input type="number" step="0.01" min="0" value={limits.min_transaction_fixed}
              onChange={(e) => setLimits((s) => ({ ...s, min_transaction_fixed: parseFloat(e.target.value) || 0 }))}
              className="h-9 text-sm mt-1 font-mono" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Taxa saque mínima (R$)</Label>
            <Input type="number" step="0.01" min="0" value={limits.min_withdrawal_fee}
              onChange={(e) => setLimits((s) => ({ ...s, min_withdrawal_fee: parseFloat(e.target.value) || 0 }))}
              className="h-9 text-sm mt-1 font-mono" />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Gerentes não conseguem aplicar taxas abaixo destes valores. Admin não tem restrição.
        </p>
      </div>
    </div>
  );
}
