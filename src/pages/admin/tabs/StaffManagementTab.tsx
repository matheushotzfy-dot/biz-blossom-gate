import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Plus, Search, Shield, Snowflake, Sun, KeyRound, Trash2, History, ArrowUpDown,
  UserCog, Users, RefreshCw, Copy, Eye, EyeOff, Activity, Percent, UsersRound,
  X, CheckCircle2, Briefcase, Loader2,
  type LucideIcon,
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

type SortKey = "name" | "pct" | "permissions" | "assigned" | "status";

function genPassword(len = 14) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%";
  const arr = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(arr).map((b) => chars[b % chars.length]).join("");
}

export default function StaffManagementTab({ profiles, onReload, role }: Props) {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "frozen">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showAudit, setShowAudit] = useState<StaffRow | null>(null);
  const [showPerm, setShowPerm] = useState<StaffRow | null>(null);
  const [auditRows, setAuditRows] = useState<Tables<"staff_audit_log">[]>([]);

  const isManager = role === "manager";
  const heading = isManager ? "Gerentes de Contas" : "Staff / Funcionários";

  const load = async () => {
    setLoading(true);
    const { data: ur } = await supabase.from("user_roles").select("user_id").eq("role", role);
    const ids = (ur ?? []).map((r) => r.user_id);
    if (ids.length === 0) { setRows([]); setLoading(false); return; }

    const [{ data: cfg }, { data: perms }, { data: assigns }] = await Promise.all([
      supabase.from("staff_commission_config").select("user_id, base_pct").in("user_id", ids),
      supabase.from("staff_permissions").select("user_id, permission_key").in("user_id", ids),
      isManager
        ? supabase.from("manager_seller_assignments").select("manager_user_id").in("manager_user_id", ids)
        : Promise.resolve({ data: [] as { manager_user_id: string }[] }),
    ]);

    const cfgMap = new Map((cfg ?? []).map((c) => [c.user_id, Number(c.base_pct)]));
    const permMap = new Map<string, string[]>();
    (perms ?? []).forEach((p) => {
      const arr = permMap.get(p.user_id) ?? [];
      arr.push(p.permission_key);
      permMap.set(p.user_id, arr);
    });
    const assignMap = new Map<string, number>();
    (assigns ?? []).forEach((a) => {
      assignMap.set(a.manager_user_id, (assignMap.get(a.manager_user_id) ?? 0) + 1);
    });

    const list: StaffRow[] = ids.map((uid) => {
      const p = profiles.find((x) => x.user_id === uid) as (Tables<"profiles"> & { frozen?: boolean }) | undefined;
      return {
        user_id: uid,
        email: p?.email ?? null,
        full_name: p?.full_name ?? null,
        frozen: !!p?.frozen,
        created_at: p?.created_at ?? new Date().toISOString(),
        pct: cfgMap.get(uid) ?? 0,
        permissions: permMap.get(uid) ?? [],
        assignedCount: assignMap.get(uid) ?? 0,
      };
    });
    setRows(list);
    setLoading(false);
  };

  useEffect(() => { load();   }, [role, profiles]);

  const filtered = useMemo(() => {
    let out = rows;
    if (statusFilter !== "all") out = out.filter(r => (statusFilter === "frozen" ? r.frozen : !r.frozen));
    if (filter.trim()) {
      const q = filter.toLowerCase();
      out = out.filter(r => (r.full_name ?? "").toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q));
    }
    const sorted = [...out].sort((a, b) => {
      switch (sort) {
        case "pct": return b.pct - a.pct;
        case "permissions": return b.permissions.length - a.permissions.length;
        case "assigned": return b.assignedCount - a.assignedCount;
        case "status": return Number(a.frozen) - Number(b.frozen);
        default: return (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "");
      }
    });
    return sorted;
  }, [rows, filter, sort, statusFilter]);

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
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error ?? error?.message ?? "Erro");
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
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error ?? error?.message ?? "Erro");
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
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error ?? error?.message ?? "Erro");
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

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button onClick={() => setSort(k)}
      className={cn("inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-black uppercase tracking-wider transition-colors",
        sort === k ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40")}>
      <ArrowUpDown className="h-3 w-3" /> {label}
    </button>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow={isManager ? "Admin · Gerentes" : "Admin · Staff"}
        title={heading}
        subtitle={isManager
          ? "Gerentes de contas com permissões delegadas e carteira de sellers."
          : "Funcionários operacionais com permissões granulares e auditoria completa."}
        status={{ tone: rows.length ? "success" : "neutral", label: `${rows.length} conta${rows.length !== 1 ? "s" : ""}`, pulse: rows.length > 0 }}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} className="h-9 gap-1.5 rounded-md">
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </Button>
            <Button onClick={() => setShowCreate(true)} size="sm" className="h-9 gap-1.5 rounded-md">
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

      {/* Toolbar unificada */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-sm group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar por nome ou email..."
              className="h-9 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
            {(["all", "active", "frozen"] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn("h-7 rounded-md px-3 text-[10px] font-black uppercase tracking-wider transition-all duration-150",
                  statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>
                {s === "all" ? "Todas" : s === "active" ? "Ativas" : "Congeladas"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Ordenar</span>
          <SortBtn k="name" label="Nome" />
          <SortBtn k="pct" label="%" />
          <SortBtn k="permissions" label="Permissões" />
          {isManager && <SortBtn k="assigned" label="Sellers" />}
        </div>
      </div>

      <PremiumPanel
        eyebrow="Diretório"
        title={`${isManager ? "Gerentes" : "Funcionários"} (${filtered.length})`}
        icon={isManager ? Users : UserCog}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="ml-2 text-xs font-bold">Carregando contas…</span>
          </div>
        ) : filtered.length === 0 ? (
          <PremiumEmpty
            icon={isManager ? Users : UserCog}
            title="Nenhuma conta encontrada"
            subtitle='Use "Criar conta" para adicionar um novo membro'
          />
        ) : (
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
              {filtered.map((row) => (
                <tr key={row.user_id} className={cn(premiumTable.row, "transition-colors duration-150 hover:bg-muted/40")}>
                  <td className={premiumTable.td}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30 text-[11px] font-black uppercase text-foreground">
                        {(row.full_name || row.email || "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-black text-foreground">{row.full_name || "—"}</div>
                        <div className="truncate text-[10px] font-bold text-muted-foreground">{row.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className={premiumTable.td}>
                    {row.frozen ? (
                      <span className="inline-flex items-center gap-1 rounded border border-info/40 bg-info/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-info">
                        <Snowflake className="h-3 w-3" /> Congelada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-success">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Ativa
                      </span>
                    )}
                  </td>
                  <td className={cn(premiumTable.td, "text-right")}>
                    <div className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-1.5 py-0.5 focus-within:border-primary">
                      <input
                        type="number" step="0.01" min="0" max="100"
                        defaultValue={row.pct}
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value);
                          if (v !== row.pct) setPct(row, v);
                        }}
                        className="w-16 bg-transparent text-right font-mono text-xs font-black tabular-nums text-foreground focus:outline-none"
                      />
                      <Percent className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </td>
                  {isManager && (
                    <td className={cn(premiumTable.td, "text-right")}>
                      <span className={cn(
                        "inline-flex min-w-[2rem] items-center justify-center rounded border px-2 py-0.5 text-[10px] font-black tabular-nums",
                        row.assignedCount > 0 ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground"
                      )}>
                        {row.assignedCount}
                      </span>
                    </td>
                  )}
                  <td className={premiumTable.td}>
                    <button
                      onClick={() => setShowPerm(row)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider transition-colors",
                        row.permissions.length > 0
                          ? "border-border bg-card text-foreground hover:border-primary hover:text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      <Shield className="h-3 w-3" />
                      {row.permissions.length}<span className="text-muted-foreground">/{STAFF_PERMISSIONS.length}</span>
                    </button>
                  </td>
                  <td className={cn(premiumTable.td, "text-right")}>
                    <div className="flex items-center justify-end gap-1">
                      <ActionBtn icon={Shield} label="Permissões" onClick={() => setShowPerm(row)} hoverTone="primary" />
                      <ActionBtn icon={History} label="Auditoria" onClick={() => openAudit(row)} hoverTone="primary" />
                      <ActionBtn icon={KeyRound} label="Resetar senha" onClick={() => resetPassword(row)} hoverTone="warning" />
                      <ActionBtn icon={row.frozen ? Sun : Snowflake} label={row.frozen ? "Descongelar" : "Congelar"} onClick={() => toggleFreeze(row)} hoverTone="info" />
                      <ActionBtn icon={Trash2} label="Excluir" onClick={() => removeStaff(row)} hoverTone="destructive" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
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

function ActionBtn({ icon: Icon, label, onClick, hoverTone }: {
  icon: LucideIcon; label: string; onClick: () => void;
  hoverTone: "primary" | "warning" | "info" | "destructive";
}) {
  const hoverCls = {
    primary: "hover:border-primary hover:text-primary",
    warning: "hover:border-warning hover:text-warning",
    info: "hover:border-info hover:text-info",
    destructive: "hover:border-destructive hover:text-destructive",
  }[hoverTone];
  return (
    <button onClick={onClick} title={label}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-all duration-150 active:scale-[0.95]",
        hoverCls
      )}>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

// ---------------- Dialog header (shared) ----------------
function DetailDialogHeader({ title, subtitle, icon: Icon, onClose, tone = "primary" }: {
  title: string; subtitle?: string; icon: LucideIcon; onClose: () => void;
  tone?: "primary" | "success" | "warning";
}) {
  const toneCls = {
    primary: "border-primary/40 bg-primary/10 text-primary",
    success: "border-success/40 bg-success/10 text-success",
    warning: "border-warning/40 bg-warning/10 text-warning",
  }[tone];
  return (
    <header className="flex items-center justify-between border-b border-border bg-card p-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border", toneCls)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-base font-black tracking-tight text-foreground">{title}</p>
          {subtitle && <p className="truncate text-[11px] font-bold text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 shrink-0 p-0">
        <X className="h-4 w-4" />
      </Button>
    </header>
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
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error ?? error?.message ?? "Falha");
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

  const Icon = role === "manager" ? Briefcase : Shield;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0 border-border [&>button]:hidden">
        <DetailDialogHeader
          title={`Nova conta de ${role === "manager" ? "Gerente" : "Staff"}`}
          subtitle="Defina credenciais, comissão e permissões iniciais"
          icon={Icon} onClose={() => onOpenChange(false)}
          tone={role === "manager" ? "success" : "primary"}
        />

        <div className="max-h-[65vh] space-y-4 overflow-y-auto bg-card p-5">
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Identificação</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Nome completo</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">E-mail</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-9 text-sm" type="email" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Acesso & Comissão</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Senha inicial</Label>
                <div className="mt-1 flex gap-1">
                  <Input value={password} onChange={(e) => setPassword(e.target.value)} className="h-9 font-mono text-sm"
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
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">% comissão (sobre net)</Label>
                <div className="mt-1 flex items-center gap-1 rounded-md border border-border bg-card px-3 focus-within:border-primary">
                  <Input type="number" step="0.01" min="0" max="100" value={pct}
                    onChange={(e) => setPct(parseFloat(e.target.value) || 0)}
                    className="h-9 border-0 bg-transparent px-0 font-mono text-sm focus-visible:ring-0" />
                  <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                <Shield className="h-3 w-3" /> Permissões iniciais
              </p>
              <span className="text-[10px] font-black tabular-nums text-foreground">{perms.size}/{STAFF_PERMISSIONS.length}</span>
            </div>
            <PermissionsGrid grouped={grouped} perms={perms} onToggle={toggle} />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-card p-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={submit} disabled={submitting} className="gap-1.5">
            {submitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Criando…</> : <><Plus className="h-3.5 w-3.5" /> Criar conta</>}
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
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0 border-border [&>button]:hidden">
        <DetailDialogHeader
          title={row.full_name || row.email || "Conta"}
          subtitle={row.email || undefined}
          icon={Shield} onClose={onClose}
        />
        <div className="bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Permissões</p>
            <span className="text-[10px] font-black tabular-nums text-foreground">{perms.size}/{STAFF_PERMISSIONS.length} ativas</span>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            <PermissionsGrid grouped={grouped} perms={perms} onToggle={(k) => {
              const n = new Set(perms);
              if (n.has(k)) n.delete(k); else n.add(k);
              setPerms(n);
            }} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border bg-card p-4">
          <Button size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={save} className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Salvar permissões
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PermissionsGrid({ grouped, perms, onToggle }: {
  grouped: Record<string, typeof STAFF_PERMISSIONS>;
  perms: Set<string>;
  onToggle: (k: string) => void;
}) {
  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([group, items]) => (
        <div key={group} className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">{group}</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {items.map((p) => {
              const active = perms.has(p.key);
              return (
                <label key={p.key}
                  className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-bold transition-all duration-150",
                    active ? "border-primary/40 bg-primary/5 text-foreground" : "border-border bg-muted/20 text-muted-foreground hover:border-primary/30 hover:text-foreground")}>
                  <Switch checked={active} onCheckedChange={() => onToggle(p.key)} />
                  <span className="flex-1">{p.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------- Audit dialog ----------------
function AuditDialog({ row, rows, onClose }: {
  row: StaffRow | null; rows: Tables<"staff_audit_log">[]; onClose: () => void;
}) {
  if (!row) return null;
  return (
    <Dialog open={!!row} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0 border-border [&>button]:hidden">
        <DetailDialogHeader
          title={`Auditoria · ${row.full_name || row.email}`}
          subtitle={row.email || undefined}
          icon={History} onClose={onClose}
        />
        <div className="max-h-[65vh] overflow-y-auto bg-card">
          {rows.length === 0 ? (
            <PremiumEmpty icon={History} title="Nenhuma ação registrada" subtitle="As ações desta conta aparecem aqui" />
          ) : (
            <table className="w-full text-xs">
              <thead className={cn(premiumTable.headRow, "bg-muted/30")}>
                <tr>
                  <th className={premiumTable.th}>Quando</th>
                  <th className={premiumTable.th}>Ação</th>
                  <th className={premiumTable.th}>Entidade</th>
                  <th className={premiumTable.th}>ID</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border transition-colors hover:bg-muted/30">
                    <td className="px-5 py-3 font-mono text-[11px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center rounded border border-border bg-muted/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-foreground">
                        {r.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{r.entity_type}</td>
                    <td className="px-5 py-3 truncate max-w-[180px] font-mono text-[10px] text-muted-foreground">{r.entity_id}</td>
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
