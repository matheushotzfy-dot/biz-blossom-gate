import { StaffAssignment } from "@/features/staff/StaffAssignment";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Plus, Search, Shield, Snowflake, Sun, KeyRound, History, ArrowUpDown,
  UserCog, Users, RefreshCw, Copy, Eye, EyeOff, Activity, Percent, UsersRound,
  X, CheckCircle2, Briefcase, Loader2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumPanel, PremiumMetric, PremiumMetricGrid, PremiumEmpty, premiumTable } from "./AdminPremium";
import { friendlyError } from "@/lib/friendlyError";
import { logAdminAction } from "@/lib/auditLog";
import { functionErrorMessage } from "@/lib/functionError";
import { StaffPasswordDialog, generateStaffPassword } from "./StaffPasswordDialog";

import { STAFF_PERMISSIONS, DEFAULT_STAFF_LIMITS, validStaffLimits, type StaffFeeLimits } from "@/features/staff/staffPolicy";
export { STAFF_PERMISSIONS };

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
  limits: StaffFeeLimits;
}

type SortKey = "name" | "pct" | "permissions" | "assigned" | "status";

export default function StaffManagementTab({ profiles, onReload, role }: Props) {
  const [passwordTarget, setPasswordTarget] = useState<StaffRow | null>(null);
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [auditError, setAuditError] = useState(false);
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
    setLoadError(false);
    const { data: ur, error: roleError } = await supabase.from("user_roles").select("user_id").eq("role", role);
    if (roleError) { setLoadError(true); setLoading(false); return; }
    const ids = (ur ?? []).map((r) => r.user_id);
    if (ids.length === 0) { setRows([]); setLoading(false); return; }

    const [{ data: cfg, error: cfgError }, { data: perms, error: permsError }, { data: assigns }, { data: limits, error: limitsError }] = await Promise.all([
      supabase.from("staff_commission_config").select("user_id, base_pct").in("user_id", ids),
      supabase.from("staff_permissions").select("user_id, permission_key").in("user_id", ids),
      isManager
        ? supabase.from("manager_seller_assignments").select("manager_user_id").in("manager_user_id", ids).is("ended_at", null)
        : Promise.resolve({ data: [] as { manager_user_id: string }[] }),
      supabase.from("staff_fee_limits").select("*").in("user_id", ids),
    ]);

    if (cfgError || permsError || limitsError) { setLoadError(true); setLoading(false); return; }
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
      const p = profiles.find((x) => x.user_id === uid);
      return {
        user_id: uid,
        email: p?.email ?? null,
        full_name: p?.full_name ?? null,
        frozen: !!p?.frozen,
        created_at: p?.created_at ?? new Date().toISOString(),
        pct: cfgMap.get(uid) ?? 0,
        permissions: permMap.get(uid) ?? [],
        assignedCount: assignMap.get(uid) ?? 0,
        limits: limits?.find(l => l.user_id === uid) ?? DEFAULT_STAFF_LIMITS,
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
    setAuditError(false);
    setAuditRows([]);
    const { data, error } = await supabase
      .from("staff_audit_log").select("*")
      .eq("staff_user_id", row.user_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) { setAuditError(true); return; }
    setAuditRows(data ?? []);
  };

  const toggleFreeze = async (row: StaffRow) => {
    const action = row.frozen ? "unfreeze" : "freeze";
    const { data, error } = await supabase.functions.invoke("admin-manage-staff", {
      body: { action, target_user_id: row.user_id },
    });
    if (error || (data as { error?: string })?.error) {
      toast.error(await functionErrorMessage(error, data, "Não foi possível alterar a conta."));
      return;
    }
    toast.success(row.frozen ? "Conta descongelada" : "Conta congelada");
    await logAdminAction(action === "freeze" ? "freeze_staff" : "unfreeze_staff", "staff", row.user_id);
    load();
    onReload?.();
  };

  const resetPassword = (row: StaffRow) => setPasswordTarget(row);

  const setPct = async (row: StaffRow, value: number) => {
    if (!Number.isFinite(value) || value < 0 || value > 50) { toast.error("A comissão precisa ficar entre 0% e 50%."); load(); return; }
    const { error } = await supabase.rpc("admin_configure_staff", { _user_id: row.user_id, _permissions: row.permissions.filter(k => STAFF_PERMISSIONS.some(p => p.key === k)), _percentage: row.limits.min_transaction_percentage, _fixed: row.limits.min_transaction_fixed, _withdrawal: row.limits.min_withdrawal_fee, _commission: value });
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("% atualizada.");
    await logAdminAction("update_staff_commission_pct", "staff", row.user_id, { pct: value });
    load();
  };

  const activeCount = rows.filter((r) => !r.frozen).length;
  const frozenCount = rows.filter((r) => r.frozen).length;
  const avgPct = rows.length ? rows.reduce((s, r) => s + r.pct, 0) / rows.length : 0;
  const totalAssigned = rows.reduce((s, r) => s + r.assignedCount, 0);

  const rowActions = (row: StaffRow) => (
    <div className="flex items-center gap-1 md:justify-end">
      <ActionBtn icon={Shield} label="Permissões" onClick={() => setShowPerm(row)} hoverTone="primary" />
      <ActionBtn icon={History} label="Auditoria" onClick={() => openAudit(row)} hoverTone="primary" />
      <ActionBtn icon={KeyRound} label="Resetar senha" onClick={() => resetPassword(row)} hoverTone="warning" />
      <ActionBtn icon={row.frozen ? Sun : Snowflake} label={row.frozen ? "Restaurar acesso staff" : "Suspender acesso staff"} onClick={() => toggleFreeze(row)} hoverTone="info" />
    </div>
  );

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button onClick={() => setSort(k)}
      className={cn("inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11.5px] font-semibold transition-colors",
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

      {isManager && <StaffAssignment staff={rows} sellers={profiles} />}
      {/* Toolbar unificada */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-sm group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar por nome ou e-mail" aria-label="Buscar conta" style={{ paddingLeft: 40 }}
              className="h-9 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
            {(["all", "active", "frozen"] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn("h-7 rounded-md px-3 text-[11.5px] font-semibold transition-all duration-150",
                  statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>
                {s === "all" ? "Todas" : s === "active" ? "Ativas" : "Congeladas"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] font-semibold text-muted-foreground">Ordenar por</span>
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
          <div role="status" className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="ml-2 text-xs font-bold">Carregando contas…</span>
          </div>
        ) : loadError ? (
          <div role="alert" className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm font-bold text-destructive">Não foi possível carregar a equipe. Isso não quer dizer que não existam contas.</p>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Tentar de novo</Button>
          </div>
        ) : filtered.length === 0 ? (
          <PremiumEmpty
            icon={isManager ? Users : UserCog}
            title={rows.length === 0 ? "Nenhuma conta ainda" : "Nenhuma conta com esses filtros"}
            subtitle={rows.length === 0 ? 'Use "Criar conta" para adicionar um novo membro' : "Limpe a busca ou troque o filtro de status"}
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
                <th className={cn(premiumTable.th, "hidden text-right md:table-cell")}>Ações</th>
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
                        <div className="truncate text-xs font-black text-foreground">{row.full_name || row.email || "Conta sem perfil"}</div>
                        <div className="truncate text-[10px] font-bold text-muted-foreground">{row.full_name ? row.email : row.user_id.slice(0, 8)}</div>
                        <div className="mt-2 md:hidden">{rowActions(row)}</div>
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
                        type="number" step="0.01" min="0" max="50"
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
                  <td className={cn(premiumTable.td, "hidden text-right md:table-cell")}>{rowActions(row)}</td>
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

      <StaffPasswordDialog target={passwordTarget} onClose={() => setPasswordTarget(null)} />

      <AuditDialog
        row={showAudit}
        rows={auditRows}
        failed={auditError}
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
    <button onClick={onClick} title={label} aria-label={label}
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
          <DialogTitle className="font-display text-base font-black tracking-tight text-foreground">{title}</DialogTitle>
          <DialogDescription className="truncate text-[11px] font-bold text-muted-foreground">{subtitle || "Conta da equipe"}</DialogDescription>
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
  const [password, setPassword] = useState(generateStaffPassword());
  const [pct, setPct] = useState(role === "manager" ? 0.20 : 0.10);
  const [showPw, setShowPw] = useState(false);
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [limits, setLimits] = useState<StaffFeeLimits>(DEFAULT_STAFF_LIMITS);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail(""); setName(""); setPassword(generateStaffPassword()); setSubmitting(false);
      setPct(role === "manager" ? 0.20 : 0.10);
      setPerms(new Set()); setLimits(DEFAULT_STAFF_LIMITS);
    }
  }, [open, role]);

  const toggle = (k: string) => {
    const n = new Set(perms);
    if (n.has(k)) n.delete(k); else n.add(k);
    setPerms(n);
  };

  const submit = async () => {
    if (submitting) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || name.trim().length < 2 || password.length < 8 || password.length > 128 || !validStaffLimits(limits, pct)) {
      toast.error("Preencha todos os campos. Senha mín. 8."); return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("admin-create-staff", {
      body: { email, password, full_name: name, role, permissions: Array.from(perms), commission_pct: pct, fee_limits: limits },
    });
    setSubmitting(false);
    if (error || (data as { error?: string })?.error) {
      toast.error(await functionErrorMessage(error, data, "Não foi possível criar a conta."));
      return;
    }
    await logAdminAction("create_staff", "staff", (data as { user_id?: string })?.user_id ?? email, { email, role, permissions: Array.from(perms), commission_pct: pct });
    const copied = await navigator.clipboard.writeText(`Email: ${email}\nSenha: ${password}`).then(() => true).catch(() => false);
    toast.success(copied ? "Conta criada. Credenciais copiadas." : "Conta criada; cópia indisponível. Anote a senha antes de fechar.");
    if (!copied) { onCreated(); return; }
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
                  <Button type="button" size="sm" variant="outline" onClick={() => setPassword(generateStaffPassword())} className="h-9 w-9 p-0">
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
                  <Input type="number" step="0.01" min="0" max="50" value={pct}
                    onChange={(e) => setPct(parseFloat(e.target.value) || 0)}
                    className="h-9 border-0 bg-transparent px-0 font-mono text-sm focus-visible:ring-0" />
                  <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>

          <StaffLimitsFields limits={limits} onChange={setLimits} />
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
  const [limits, setLimits] = useState<StaffFeeLimits>(DEFAULT_STAFF_LIMITS);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setPerms(new Set((row?.permissions ?? []).filter(k => STAFF_PERMISSIONS.some(p => p.key === k)))); setLimits(row?.limits ?? DEFAULT_STAFF_LIMITS); }, [row]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof STAFF_PERMISSIONS> = {};
    STAFF_PERMISSIONS.forEach((p) => { (g[p.group] ??= []).push(p); });
    return g;
  }, []);

  if (!row) return null;

  const save = async () => {
    if (saving || !validStaffLimits(limits, row.pct)) { toast.error("Revise os limites e a comissão (0–50%)"); return; }
    setSaving(true);
    const { error } = await supabase.rpc("admin_configure_staff", { _user_id: row.user_id, _permissions: Array.from(perms), _percentage: limits.min_transaction_percentage, _fixed: limits.min_transaction_fixed, _withdrawal: limits.min_withdrawal_fee, _commission: row.pct });
    setSaving(false);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Permissões e limites salvos.");
    onSaved();
    onClose();
  };

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
          <div className="max-h-[60vh] overflow-y-auto space-y-4">
            <StaffLimitsFields limits={limits} onChange={setLimits} />
            <PermissionsGrid grouped={grouped} perms={perms} onToggle={(k) => {
              const n = new Set(perms);
              if (n.has(k)) n.delete(k); else n.add(k);
              setPerms(n);
            }} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border bg-card p-4">
          <Button size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
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
                  <Switch checked={active} aria-label={p.label} onCheckedChange={() => onToggle(p.key)} />
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
function AuditDialog({ row, rows, failed = false, onClose }: {
  row: StaffRow | null; rows: Tables<"staff_audit_log">[]; failed?: boolean; onClose: () => void;
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
          {failed ? (
            <p role="alert" className="py-14 text-center text-sm font-bold text-destructive">Não foi possível carregar a auditoria desta conta. Feche e abra de novo para tentar outra vez.</p>
          ) : rows.length === 0 ? (
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

function StaffLimitsFields({ limits, onChange }: { limits: StaffFeeLimits; onChange: (v: StaffFeeLimits) => void }) {
  const fields: { key: keyof StaffFeeLimits; label: string; max: number }[] = [
    { key: "min_transaction_percentage", label: "Taxa percentual mínima (%)", max: 100 },
    { key: "min_transaction_fixed", label: "Taxa fixa mínima (R$)", max: 1000000 },
    { key: "min_withdrawal_fee", label: "Taxa de saque mínima (R$)", max: 1000000 },
  ];
  return <section className="space-y-3 border-t border-border pt-4"><h3 className="text-sm font-semibold">Pisos de taxas por seller</h3><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{fields.map(f => <div key={f.key} className="space-y-1"><Label htmlFor={f.key}>{f.label}</Label><Input id={f.key} type="number" min={0} max={f.max} step="0.01" value={Number.isNaN(limits[f.key]) ? "" : limits[f.key]} onChange={e => onChange({ ...limits, [f.key]: e.target.value === "" ? NaN : Number(e.target.value) })} /></div>)}</div></section>;
}
