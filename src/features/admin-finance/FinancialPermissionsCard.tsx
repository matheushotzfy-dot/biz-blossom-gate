import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, KeyRound, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import { friendlyError } from "@/lib/friendlyError";
import { useSensitiveConfirm } from "./useSensitiveConfirm";

type Role = "manager" | "employee";
type Perm = "balance_adjust_request" | "dispute_review";
interface Row { role: Role; permission: Perm; allowed: boolean }

const PERMS: { id: Perm; label: string; hint: string }[] = [
  { id: "balance_adjust_request", label: "Pedir ajuste de saldo", hint: "O pedido só vale depois da sua aprovação." },
  { id: "dispute_review", label: "Colocar disputa em análise", hint: "Não decide o resultado nem move dinheiro." },
];
const ROLES: { id: Role; label: string }[] = [{ id: "manager", label: "Gerente" }, { id: "employee", label: "Funcionário" }];

/** O dono decide o que gerentes e funcionários podem fazer na área financeira. */
export function FinancialPermissionsCard() {
  const sensitive = useSensitiveConfirm();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const { data, error } = await supabase.from("financial_role_permissions").select("role,permission,allowed");
    if (error) { setLoadError(friendlyError(error, "Tente de novo em instantes.")); return; }
    setRows((data ?? []) as Row[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const isOn = (r: Role, p: Perm) => rows?.find((x) => x.role === r && x.permission === p)?.allowed ?? false;

  const save = async (role: Role, permission: Perm, allowed: boolean) => {
    const key = `${role}:${permission}`;
    setSaving(key);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("financial_role_permissions").upsert({ role, permission, allowed, updated_at: new Date().toISOString(), updated_by: u.user?.id ?? null });
      if (error) { toast.error("Não foi possível salvar a permissão. Nada mudou.", { description: friendlyError(error, "Tente de novo em instantes.") }); return; }
      toast.success(allowed ? "Permissão liberada." : "Permissão retirada.");
      await load();
    } finally {
      setSaving(null);
    }
  };

  /** Liberar abre mais poder para o cargo, então pede a senha de novo. Retirar é o caminho seguro e vale na hora. */
  const toggle = (role: Role, permission: Perm, allowed: boolean) => {
    const p = PERMS.find((x) => x.id === permission)?.label ?? "";
    const r = ROLES.find((x) => x.id === role)?.label.toLowerCase() ?? "";
    if (!allowed) { void save(role, permission, false); return; }
    sensitive.confirm(`Liberar "${p}" para ${r}s.`, () => save(role, permission, true));
  };

  return (
    <PremiumPanel eyebrow="Cargos" title="Permissões financeiras" icon={KeyRound}>
      <div className="space-y-4">
        <p className="rounded-[12px] border border-border/60 bg-muted/30 p-3 text-[12.5px] leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Só você, o dono,</strong> aprova reembolsos, decide disputas e chargebacks, ajusta saldos direto e aprova pedidos da equipe. Todas essas ações pedem a sua senha de novo.
        </p>
        {loadError ? (
          <div role="alert" className="flex flex-col items-start gap-2 rounded-[12px] border border-destructive/30 bg-destructive/5 p-4 text-[13px]">
            <p className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> Não foi possível carregar as permissões.</p>
            <p className="text-muted-foreground">{loadError}</p>
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => void load()}><RefreshCw className="h-3.5 w-3.5" /> Tentar de novo</Button>
          </div>
        ) : rows === null ? (
          <p className="flex items-center gap-2 py-8 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando permissões…</p>
        ) : (
          <div className="overflow-x-auto rounded-[12px] border border-border/60">
            <table className="w-full border-collapse text-left">
              <thead><tr className="border-b border-border bg-muted/25 text-[12px] font-medium text-muted-foreground">
                <th className="px-4 py-3">Permissão</th>{ROLES.map((r) => <th key={r.id} className="px-4 py-3 text-center">{r.label}</th>)}
              </tr></thead>
              <tbody>
                {PERMS.map((p) => (
                  <tr key={p.id} className="border-b border-border/40 last:border-b-0">
                    <td className="px-4 py-3.5"><p className="text-[13.5px] font-medium text-foreground">{p.label}</p><p className="text-[12px] text-muted-foreground">{p.hint}</p></td>
                    {ROLES.map((r) => (
                      <td key={r.id} className="px-4 py-3.5 text-center">
                        <Switch checked={isOn(r.id, p.id)} disabled={saving !== null} onCheckedChange={(v) => toggle(r.id, p.id, v)} aria-label={`${p.label}, ${r.label}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {sensitive.dialog}
    </PremiumPanel>
  );
}
