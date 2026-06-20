import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus, Search, Shield, Snowflake, Sun, KeyRound, Trash2, History, Settings2,
  UserCog, Users, RefreshCw, Copy, Eye, EyeOff, Activity, Percent, UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumPanel, PremiumMetric, PremiumMetricGrid, PremiumEmpty, premiumTable } from "./AdminPremium";

export const STAFF_PERMISSIONS: { key: string; label: string; group: string }[] = [
  { key: "view_sellers", label: "Ver vendedores", group: "Visualização" },
  { key: "view_transactions", label: "Ver transações", group: "Visualização" },
  { key: "view_financial", label: "Ver financeiro (lucros/taxas)", group: "Visualização" },
  { key: "view_disputes", label: "Ver disputas / MED", group: "Visualização" },
  { key: "view_withdrawals", label: "Ver saques", group: "Visualização" },
  { key: "approve_kyc", label: "Aprovar KYC de sellers", group: "Aprovações" },
  { key: "approve_product", label: "Aprovar produtos", group: "Aprovações" },
  { key: "edit_fees", label: "Alterar taxas (respeita mínimo)", group: "Edição" },
  { key: "edit_seller_notes", label: "Editar observações de seller", group: "Edição" },
  { key: "request_refund", label: "Solicitar reembolso (admin aprova)", group: "Operações" },
  { key: "manage_med", label: "Trabalhar MED (admin finaliza)", group: "Operações" },
  { key: "login_as_user", label: "Login as user (impersonate)", group: "Operações" },
  { key: "freeze_seller_balance", label: "Congelar saldo de seller", group: "Operações" },
];

interface Props {
  profiles: Tables<"profiles">[];
  onReload: () => void;
  role: "employee" | "manager";
}

interface StaffRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  frozen: boolean;
  created_at: string;
  pct: number;
  permissions: string[];
  assignedCount: number;
}

function genPassword(len = 14) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%";
  const arr = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(arr).map((b) => chars[b % chars.length]).join("");
}

export default function StaffManagementTab({ profiles, onReload, role }: Props) {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showAudit, setShowAudit] = useState<StaffRow | null>(null);
  const [showPerm, setShowPerm] = useState<StaffRow | null>(null);
  const [auditRows, setAuditRows] = useState<any[]>([]);

  const isManager = role === "manager";
  const heading = isManager ? "Gerentes de Contas" : "Staff / Funcionários";
  const accent = isManager ? "emerald" : "indigo";

  const load = async () => {
    setLoading(true);
    const { data: ur } = await supabase.from("user_roles").select("user_id").eq("role", role);
    const ids = (ur ?? []).map((r: any) => r.user_id);
    if (ids.length === 0) { setRows([]); setLoading(false); return; }

    const [{ data: cfg }, { data: perms }, { data: assigns }] = await Promise.all([
      supabase.from("staff_commission_config").select("user_id, base_pct").in("user_id", ids),
      supabase.from("staff_permissions").select("user_id, permission_key").in("user_id", ids),
      isManager
        ? supabase.from("manager_seller_assignments").select("manager_user_id").in("manager_user_id", ids)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const cfgMap = new Map((cfg ?? []).map((c: any) => [c.user_id, Number(c.base_pct)]));
    const permMap = new Map<string, string[]>();
    (perms ?? []).forEach((p: any) => {
      const arr = permMap.get(p.user_id) ?? [];
      arr.push(p.permission_key);
      permMap.set(p.user_id, arr);
    });
    const assignMap = new Map<string, number>();
    (assigns ?? []).forEach((a: any) => {
      assignMap.set(a.manager_user_id, (assignMap.get(a.manager_user_id) ?? 0) + 1);
    });

    const list: StaffRow[] = ids.map((uid) => {
      const p = profiles.find((x) => x.user_id === uid);
      return {
        user_id: uid,
        email: p?.email ?? null,
        full_name: p?.full_name ?? null,
        frozen: !!(p as any)?.frozen,
        created_at: p?.created_at ?? new Date().toISOString(),
        pct: cfgMap.get(uid) ?? 0,
        permissions: permMap.get(uid) ?? [],
        assignedCount: assignMap.get(uid) ?? 0,
      };
    });
    setRows(list);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [role, profiles]);

  const filtered = useMemo(() => {
    if (!filter) return rows;
    const q = filter.toLowerCase();
    return rows.filter((r) =>
      (r.full_name ?? "").toLowerCase().includes(q) ||
      (r.email ?? "").toLowerCase().includes(q)
    );
  }, [rows, filter]);

  const openAudit = async (row: StaffRow) => {
    setShowAudit(row);
    const { data } = await supabase
      .from("staff_audit_log").select("*")
      .eq("staff_user_id", row.user_id)
      .order("created_at", { ascending: false })
      .limit(200);
    setAuditRows(data ?? []);
  };

  const toggleFreeze = async (row: StaffRow) => {
    const action = row.frozen ? "unfreeze" : "freeze";
    const { data, error } = await supabase.functions.invoke("admin-manage-staff", {
      body: { action, target_user_id: row.user_id },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Erro");
      return;
    }
    toast.success(row.frozen ? "Conta descongelada" : "Conta congelada");
    load();
    onReload?.();
  };

  const resetPassword = async (row: StaffRow) => {
    const pw = prompt("Nova senha (mín. 8):", genPassword());
    if (!pw || pw.length < 8) return;
    const { data, error } = await supabase.functions.invoke("admin-manage-staff", {
      body: { action: "reset_password", target_user_id: row.user_id, password: pw },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Erro");
      return;
    }
    await navigator.clipboard.writeText(pw).catch(() => {});
    toast.success("Senha redefinida (copiada).");
  };

  const removeStaff = async (row: StaffRow) => {
    if (!confirm(`Excluir conta de ${row.email}? Esta ação é irreversível.`)) return;
    const { data, error } = await supabase.functions.invoke("admin-manage-staff", {
      body: { action: "delete", target_user_id: row.user_id },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Erro");
      return;
    }
    toast.success("Conta excluída.");
    load();
    onReload?.();
  };

  const setPct = async (row: StaffRow, value: number) => {
    if (!Number.isFinite(value) || value < 0 || value > 100) return;
    const { error } = await supabase.from("staff_commission_config").upsert({
      user_id: row.user_id, base_pct: value, base: "net_amount", is_active: true,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("% atualizada.");
    load();
  };

  const activeCount = rows.filter((r) => !r.frozen).length;
  const frozenCount = rows.filter((r) => r.frozen).length;
  const avgPct = rows.length ? rows.reduce((s, r) => s + r.pct, 0) / rows.length : 0;
  const totalAssigned = rows.reduce((s, r) => s + r.assignedCount, 0);

  return (
    <div className="space-y-6">
      <FinanceiroHero
        eyebrow={isManager ? "Admin · Gerentes" : "Admin · Staff"}
        title={heading}
        subtitle={isManager
          ? "Gerentes de contas com permissões delegadas e carteira de sellers."
          : "Funcionários operacionais com permissões granulares e auditoria completa."}
        status={{ tone: rows.length ? "success" : "neutral", label: `${rows.length} conta${rows.length !== 1 ? "s" : ""}`, pulse: rows.length > 0 }}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} className="rounded-md gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </Button>
            <Button onClick={() => setShowCreate(true)} size="sm" className="rounded-md gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Criar conta
            </Button>
          </div>
        }
      />

      <PremiumMetricGrid cols={isManager ? 4 : 3}>
        <PremiumMetric label="Ativas" value={String(activeCount)} sub="contas operacionais" icon={Activity} tone="success" />
        <PremiumMetric label="Congeladas" value={String(frozenCount)} sub="acesso suspenso" icon={Snowflake} tone="info" />
        <PremiumMetric label="% Média" value={`${avgPct.toFixed(2)}%`} sub="comissão sobre net" icon={Percent} tone="primary" />
        {isManager && (
          <PremiumMetric label="Sellers" value={String(totalAssigned)} sub="atribuídos no total" icon={UsersRound} tone="warning" />
        )}
      </PremiumMetricGrid>

      <PremiumPanel
        eyebrow="Diretório"
        title={isManager ? "Gerentes" : "Funcionários"}
        icon={isManager ? Users : UserCog}
        action={
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary" />
            <Input
              value={filter} onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar por nome ou e-mail..."
              className="pl-8 h-9 text-sm rounded-md focus-visible:ring-primary/30"
            />
          </div>
        }
      >
        <div className={premiumTable.wrapper}>
          <table className={premiumTable.table}>
            <thead>
              <tr className={premiumTable.headRow}>
                <th className={premiumTable.th}>Conta</th>
                <th className={premiumTable.th}>Status</th>
                <th className={cn(premiumTable.th, "text-right")}>% Comissão</th>
                {isManager && <th className={cn(premiumTable.th, "text-right")}>Sellers</th>}
                <th className={premiumTable.th}>Permissões</th>
                <th className={cn(premiumTable.th, "text-right")}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-10 text-center text-sm text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6}>
                  <PremiumEmpty
                    icon={isManager ? Users : UserCog}
                    title="Nenhuma conta encontrada"
                    subtitle='Use "Criar conta" para adicionar um novo membro.'
                  />
                </td></tr>
              ) : filtered.map((row) => (
                <tr key={row.user_id} className={premiumTable.row}>
                  <td className={premiumTable.td}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[11px] font-black uppercase",
                        isManager ? "bg-success/10 border-success/20 text-success" : "bg-primary/10 border-primary/20 text-primary"
                      )}>
                        {(row.full_name || row.email || "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-foreground truncate">{row.full_name || "—"}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{row.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className={premiumTable.td}>
                    {row.frozen ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-info/10 text-info border border-info/20">
                        <Snowflake className="h-3 w-3" /> Congelada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-success/10 text-success border border-success/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Ativa
                      </span>
                    )}
                  </td>
                  <td className={cn(premiumTable.td, "text-right")}>
                    <div className="inline-flex items-center gap-1">
                      <input
                        type="number" step="0.01" min="0" max="100"
                        defaultValue={row.pct}
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value);
                          if (v !== row.pct) setPct(row, v);
                        }}
                        className="w-20 text-right bg-muted/30 border border-border/60 rounded-md px-2 py-1 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                      />
                      <span className="text-muted-foreground text-xs">%</span>
                    </div>
                  </td>
                  {isManager && (
                    <td className={cn(premiumTable.td, "text-right tabular-nums font-mono text-xs")}>
                      <span className={cn(
                        "inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md border",
                        row.assignedCount > 0 ? "bg-primary/10 text-primary border-primary/20" : "bg-muted/30 text-muted-foreground border-border/60"
                      )}>
                        {row.assignedCount}
                      </span>
                    </td>
                  )}
                  <td className={premiumTable.td}>
                    <button
                      onClick={() => setShowPerm(row)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Shield className="h-3 w-3" />
                      {row.permissions.length} ativa{row.permissions.length !== 1 ? "s" : ""}
                    </button>
                  </td>
                  <td className={cn(premiumTable.td, "text-right")}>
                    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" onClick={() => setShowPerm(row)} title="Permissões" className="h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary">
                        <Shield className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openAudit(row)} title="Auditoria" className="h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary">
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => resetPassword(row)} title="Resetar senha" className="h-7 w-7 p-0 hover:bg-warning/10 hover:text-warning">
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleFreeze(row)}
                        title={row.frozen ? "Descongelar" : "Congelar"} className="h-7 w-7 p-0 hover:bg-info/10 hover:text-info">
                        {row.frozen ? <Sun className="h-3.5 w-3.5" /> : <Snowflake className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeStaff(row)} title="Excluir"
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PremiumPanel>

      <CreateStaffDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        role={role}
        onCreated={() => { load(); onReload?.(); }}
      />

      <PermissionsDialog
        row={showPerm}
        onClose={() => setShowPerm(null)}
        onSaved={load}
      />

      <AuditDialog
        row={showAudit}
        rows={auditRows}
        onClose={() => { setShowAudit(null); setAuditRows([]); }}
      />
    </div>
  );
}

// ---------------- Create dialog ----------------
function CreateStaffDialog({ open, onOpenChange, role, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; role: "employee" | "manager"; onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState(genPassword());
  const [pct, setPct] = useState(role === "manager" ? 0.20 : 0.10);
  const [showPw, setShowPw] = useState(false);
  const [perms, setPerms] = useState<Set<string>>(new Set(
    role === "manager"
      ? ["view_sellers","view_transactions","view_disputes","view_withdrawals","approve_kyc","approve_product","edit_fees","edit_seller_notes","request_refund","manage_med"]
      : ["view_sellers","view_transactions","view_disputes","edit_seller_notes"]
  ));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail(""); setName(""); setPassword(genPassword()); setSubmitting(false);
      setPct(role === "manager" ? 0.20 : 0.10);
    }
  }, [open, role]);

  const toggle = (k: string) => {
    const n = new Set(perms);
    if (n.has(k)) n.delete(k); else n.add(k);
    setPerms(n);
  };

  const submit = async () => {
    if (!email || !name || password.length < 8) {
      toast.error("Preencha todos os campos. Senha mín. 8."); return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("admin-create-staff", {
      body: { email, password, full_name: name, role, permissions: Array.from(perms), commission_pct: pct },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Falha");
      return;
    }
    await navigator.clipboard.writeText(`Email: ${email}\nSenha: ${password}`).catch(() => {});
    toast.success("Conta criada. Credenciais copiadas.");
    onOpenChange(false);
    onCreated();
  };

  const grouped = useMemo(() => {
    const g: Record<string, typeof STAFF_PERMISSIONS> = {};
    STAFF_PERMISSIONS.forEach((p) => { (g[p.group] ??= []).push(p); });
    return g;
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Criar conta de {role === "manager" ? "Gerente" : "Staff"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nome completo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">E-mail</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 text-sm mt-1" type="email" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Senha inicial</Label>
              <div className="flex gap-1 mt-1">
                <Input value={password} onChange={(e) => setPassword(e.target.value)} className="h-9 text-sm font-mono"
                  type={showPw ? "text" : "password"} />
                <Button type="button" size="sm" variant="outline" onClick={() => setShowPw((v) => !v)} className="h-9 w-9 p-0">
                  {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setPassword(genPassword())} className="h-9 w-9 p-0">
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(password); toast.success("Copiada"); }} className="h-9 w-9 p-0">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">% comissão (sobre net)</Label>
              <Input type="number" step="0.01" min="0" max="100" value={pct}
                onChange={(e) => setPct(parseFloat(e.target.value) || 0)}
                className="h-9 text-sm mt-1 font-mono" />
            </div>
          </div>

          <div className="border border-border rounded-md p-3">
            <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Permissões
            </div>
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="mb-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{group}</div>
                <div className="grid grid-cols-2 gap-2">
                  {items.map((p) => (
                    <label key={p.key} className="flex items-center gap-2 text-xs cursor-pointer hover:text-foreground">
                      <Switch checked={perms.has(p.key)} onCheckedChange={() => toggle(p.key)} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={submit} disabled={submitting}>
            {submitting ? "Criando..." : "Criar conta"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Permissions dialog ----------------
function PermissionsDialog({ row, onClose, onSaved }: {
  row: StaffRow | null; onClose: () => void; onSaved: () => void;
}) {
  const [perms, setPerms] = useState<Set<string>>(new Set());
  useEffect(() => { setPerms(new Set(row?.permissions ?? [])); }, [row]);
  if (!row) return null;

  const save = async () => {
    await supabase.from("staff_permissions").delete().eq("user_id", row.user_id);
    if (perms.size > 0) {
      await supabase.from("staff_permissions").insert(
        Array.from(perms).map((k) => ({ user_id: row.user_id, permission_key: k }))
      );
    }
    toast.success("Permissões salvas.");
    onSaved();
    onClose();
  };

  const grouped = useMemo(() => {
    const g: Record<string, typeof STAFF_PERMISSIONS> = {};
    STAFF_PERMISSIONS.forEach((p) => { (g[p.group] ??= []).push(p); });
    return g;
  }, []);

  return (
    <Dialog open={!!row} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Permissões — {row.full_name}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{group}</div>
              <div className="grid grid-cols-2 gap-2">
                {items.map((p) => (
                  <label key={p.key} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Switch checked={perms.has(p.key)} onCheckedChange={(v) => {
                      const n = new Set(perms);
                      v ? n.add(p.key) : n.delete(p.key);
                      setPerms(n);
                    }} />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={save}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Audit dialog ----------------
function AuditDialog({ row, rows, onClose }: {
  row: StaffRow | null; rows: any[]; onClose: () => void;
}) {
  if (!row) return null;
  return (
    <Dialog open={!!row} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Auditoria — {row.full_name}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto">
          {rows.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Nenhuma ação registrada ainda.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/20">
                <tr>
                  <th className="text-left p-2">Quando</th>
                  <th className="text-left p-2">Ação</th>
                  <th className="text-left p-2">Entidade</th>
                  <th className="text-left p-2">ID</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                    <td className="p-2 font-mono text-[11px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-2 font-medium">{r.action}</td>
                    <td className="p-2 text-muted-foreground">{r.entity_type}</td>
                    <td className="p-2 font-mono text-[10px] text-muted-foreground truncate max-w-[180px]">{r.entity_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
