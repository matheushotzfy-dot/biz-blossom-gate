import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type Role = "manager" | "employee";
type Perm = "balance_adjust_request" | "dispute_review";
interface Row { role: Role; permission: Perm; allowed: boolean }

const PERMS: { id: Perm; label: string; hint: string }[] = [
  { id: "balance_adjust_request", label: "Pedir ajuste de saldo", hint: "O pedido só vale depois da sua aprovação" },
  { id: "dispute_review", label: "Colocar disputa em análise", hint: "Não decide o resultado nem move dinheiro" },
];
const ROLES: { id: Role; label: string }[] = [{ id: "manager", label: "Gerente" }, { id: "employee", label: "Funcionário" }];

/** Owner decides what managers and employees may do in the financial area. */
export function FinancialPermissionsCard() {
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("financial_role_permissions").select("role,permission,allowed");
    setRows((data ?? []) as Row[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const isOn = (r: Role, p: Perm) => rows.find((x) => x.role === r && x.permission === p)?.allowed ?? false;

  const toggle = async (role: Role, permission: Perm, allowed: boolean) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("financial_role_permissions")
      .upsert({ role, permission, allowed, updated_at: new Date().toISOString(), updated_by: u.user?.id ?? null });
    if (error) { toast.error("Não foi possível salvar a permissão"); return; }
    toast.success("Permissão atualizada");
    void load();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Somente você (dono)</strong> aprova reembolsos, decide disputas e chargebacks, ajusta saldos direto e aprova pedidos da equipe. Todas essas ações pedem sua senha de novo.
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr><th className="px-3 py-2">Permissão</th>{ROLES.map((r) => <th key={r.id} className="px-3 py-2 text-center">{r.label}</th>)}</tr>
          </thead>
          <tbody>
            {PERMS.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2"><p className="font-medium">{p.label}</p><p className="text-xs text-muted-foreground">{p.hint}</p></td>
                {ROLES.map((r) => (
                  <td key={r.id} className="px-3 py-2 text-center">
                    <Switch checked={isOn(r.id, p.id)} onCheckedChange={(v) => toggle(r.id, p.id, v)} aria-label={`${p.label} — ${r.label}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
