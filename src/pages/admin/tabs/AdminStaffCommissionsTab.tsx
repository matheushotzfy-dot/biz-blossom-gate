import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Coins, Search, ArrowDownToLine, X, Plus, Trash2, Loader2, Download, Wallet,
  TrendingDown, CheckCircle2, Percent, User as UserIcon, Mail, Copy, ChevronRight,
  ArrowUpDown, Activity, Settings2, Receipt, Briefcase, Shield, Calendar,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumMetric, PremiumMetricGrid, PremiumPanel, premiumTable, PremiumEmpty } from "./AdminPremium";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props { profiles: Tables<"profiles">[]; }

interface StaffSummary {
  user_id: string;
  full_name: string;
  email: string;
  role: "manager" | "employee";
  base_pct: number;
  accrued: number;
  clawbacks: number;
  paid: number;
  balance: number;
  last_payout_at: string | null;
  last_activity_at: string | null;
  ledger_count: number;
}

type SortKey = "balance" | "accrued" | "clawbacks" | "paid" | "pct";
type RoleFilter = "all" | "manager" | "employee";

export default function AdminStaffCommissionsTab({ profiles }: Props) {
  const [rows, setRows] = useState<StaffSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sort, setSort] = useState<SortKey>("balance");
  const [selected, setSelected] = useState<StaffSummary | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: ur } = await supabase
      .from("user_roles").select("user_id, role")
      .in("role", ["manager", "employee"]);
    const roleMap = new Map<string, "manager" | "employee">(
      (ur ?? []).map((r) => [r.user_id, r.role as "manager" | "employee"])
    );
    const ids = Array.from(roleMap.keys());
    if (ids.length === 0) { setRows([]); setLoading(false); return; }

    const [{ data: cfg }, { data: ledger }, { data: payouts }] = await Promise.all([
      supabase.from("staff_commission_config").select("user_id, base_pct").in("user_id", ids),
      supabase.from("staff_commissions_ledger").select("staff_user_id, type, amount, balance_after, created_at").in("staff_user_id", ids),
      supabase.from("staff_commission_payouts").select("staff_user_id, status, processed_at").in("staff_user_id", ids).eq("status", "paid"),
    ]);

    const cfgMap = new Map((cfg ?? []).map((c) => [c.user_id, Number(c.base_pct)]));
    const sums = new Map<string, {
      accrued: number; clawbacks: number; paid: number; balance: number;
      lastBalanceTime: string; lastActivity: string; count: number;
    }>();

    (ledger ?? []).forEach((e) => {
      const cur = sums.get(e.staff_user_id) ?? { accrued: 0, clawbacks: 0, paid: 0, balance: 0, lastBalanceTime: "", lastActivity: "", count: 0 };
      const amt = Number(e.amount);
      if (e.type === "accrual") cur.accrued += amt;
      else if (e.type === "payout") cur.paid += -amt;
      else cur.clawbacks += -amt;
      cur.count += 1;
      if (!cur.lastBalanceTime || e.created_at > cur.lastBalanceTime) {
        cur.lastBalanceTime = e.created_at;
        cur.balance = Number(e.balance_after);
      }
      if (!cur.lastActivity || e.created_at > cur.lastActivity) cur.lastActivity = e.created_at;
      sums.set(e.staff_user_id, cur);
    });

    const lastPayout = new Map<string, string>();
    (payouts ?? []).forEach((p) => {
      const prev = lastPayout.get(p.staff_user_id);
      if (!prev || (p.processed_at && p.processed_at > prev)) {
        lastPayout.set(p.staff_user_id, p.processed_at!);
      }
    });

    const list: StaffSummary[] = ids.map((uid) => {
      const p = profiles.find((x) => x.user_id === uid);
      const s = sums.get(uid) ?? { accrued: 0, clawbacks: 0, paid: 0, balance: 0, lastBalanceTime: "", lastActivity: "", count: 0 };
      return {
        user_id: uid,
        full_name: p?.full_name ?? "—",
        email: p?.email ?? "—",
        role: roleMap.get(uid) ?? "employee",
        base_pct: cfgMap.get(uid) ?? 0,
        accrued: s.accrued,
        clawbacks: s.clawbacks,
        paid: s.paid,
        balance: s.balance,
        last_payout_at: lastPayout.get(uid) ?? null,
        last_activity_at: s.lastActivity || null,
        ledger_count: s.count,
      };
    });
    setRows(list);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profiles]);

  const filtered = useMemo(() => {
    let out = rows;
    if (roleFilter !== "all") out = out.filter((r) => r.role === roleFilter);
    if (filter.trim()) {
      const q = filter.toLowerCase();
      out = out.filter((r) => r.full_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
    }
    const sorted = [...out].sort((a, b) => {
      switch (sort) {
        case "accrued": return b.accrued - a.accrued;
        case "clawbacks": return b.clawbacks - a.clawbacks;
        case "paid": return b.paid - a.paid;
        case "pct": return b.base_pct - a.base_pct;
        default: return b.balance - a.balance;
      }
    });
    return sorted;
  }, [rows, filter, roleFilter, sort]);

  const totals = useMemo(() => ({
    balance: rows.reduce((s, r) => s + Math.max(r.balance, 0), 0),
    accrued: rows.reduce((s, r) => s + r.accrued, 0),
    clawbacks: rows.reduce((s, r) => s + r.clawbacks, 0),
    paid: rows.reduce((s, r) => s + r.paid, 0),
    managers: rows.filter(r => r.role === "manager").length,
    staff: rows.filter(r => r.role === "employee").length,
  }), [rows]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  const exportCSV = () => {
    const out = [
      ["Nome", "Email", "Função", "% padrão", "Acumulado", "Clawbacks", "Pago", "Saldo a pagar", "Último pagto"],
      ...filtered.map(r => [
        r.full_name, r.email, r.role === "manager" ? "Gerente" : "Staff",
        r.base_pct.toFixed(2), r.accrued.toFixed(2), r.clawbacks.toFixed(2),
        r.paid.toFixed(2), r.balance.toFixed(2),
        r.last_payout_at ? new Date(r.last_payout_at).toLocaleString("pt-BR") : "",
      ])
    ];
    const csv = out.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `staff-commissions-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button onClick={() => setSort(k)}
      className={cn("inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-black uppercase tracking-wider transition-colors",
        sort === k ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40")}>
      <ArrowUpDown className="h-3 w-3" /> {label}
    </button>
  );

  const roleBadge = (role: "manager" | "employee") => role === "manager"
    ? <span className="inline-flex items-center gap-1 rounded border border-success/40 bg-success/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-success"><Briefcase className="h-2.5 w-2.5" />Gerente</span>
    : <span className="inline-flex items-center gap-1 rounded border border-info/40 bg-info/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-info"><Shield className="h-2.5 w-2.5" />Staff</span>;

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Operações · Comissões"
        title="Comissões Staff & Gerentes"
        subtitle="Comissão calculada sobre net_amount. Refunds e MEDs descontam automaticamente do saldo."
        status={{ tone: "warning", label: `${rows.length} contas ativas`, pulse: false }}
        actions={
          <button onClick={exportCSV} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[11px] font-bold text-foreground transition-all duration-200 hover:border-primary hover:text-primary active:scale-[0.98]">
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </button>
        }
      />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={Wallet} label="Saldo a Pagar" value={fmt(totals.balance)} sub={`${rows.filter(r => r.balance > 0).length} contas com saldo`} tone="success" />
        <PremiumMetric icon={Coins} label="Acumulado (total)" value={fmt(totals.accrued)} sub="todas as accruals históricas" tone="primary" />
        <PremiumMetric icon={TrendingDown} label="Clawbacks" value={fmt(totals.clawbacks)} sub="estornos por refund / MED" tone="destructive" />
        <PremiumMetric icon={CheckCircle2} label="Pago (total)" value={fmt(totals.paid)} sub={`${totals.managers} gerentes · ${totals.staff} staff`} tone="info" />
      </PremiumMetricGrid>

      {/* Toolbar limpa */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-sm group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar por nome ou email..."
              className="h-9 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
            {(["all", "manager", "employee"] as RoleFilter[]).map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={cn("h-7 rounded-md px-3 text-[10px] font-black uppercase tracking-wider transition-all duration-150",
                  roleFilter === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>
                {r === "all" ? "Todos" : r === "manager" ? "Gerentes" : "Staff"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Ordenar</span>
          <SortBtn k="balance" label="Saldo" />
          <SortBtn k="accrued" label="Acumulado" />
          <SortBtn k="clawbacks" label="Clawbacks" />
          <SortBtn k="paid" label="Pago" />
          <SortBtn k="pct" label="%" />
        </div>
      </div>

      <PremiumPanel title={`Contas (${filtered.length})`} eyebrow="Clique numa linha para ver ledger, overrides e gerenciar pagamentos" icon={Coins}>
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="ml-2 text-xs font-bold">Carregando comissões…</span>
          </div>
        ) : filtered.length === 0 ? (
          <PremiumEmpty icon={Coins} title="Sem registros" subtitle={rows.length === 0 ? "Adicione cargos manager/employee para começar" : "Nenhum resultado para o filtro atual"} />
        ) : (
          <div className={premiumTable.wrapper}>
            <table className={premiumTable.table}>
              <thead>
                <tr className={premiumTable.headRow}>
                  {["Conta", "Função", "% Padrão", "Acumulado", "Clawbacks", "Pago", "Saldo a Pagar", "Atividade", ""].map(h => (
                    <th key={h} className={premiumTable.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.user_id} onClick={() => setSelected(r)}
                    className={cn(premiumTable.row, "cursor-pointer transition-colors duration-150 hover:bg-muted/40")}>
                    <td className={premiumTable.td}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted/30 text-xs font-black text-foreground">
                          {(r.full_name || "?")[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-foreground">{r.full_name}</p>
                          <p className="truncate text-[10px] font-bold text-muted-foreground">{r.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className={premiumTable.td}>{roleBadge(r.role)}</td>
                    <td className={premiumTable.td}>
                      <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/30 px-2 py-0.5 text-[10px] font-black tabular-nums text-foreground">
                        <Percent className="h-2.5 w-2.5 text-muted-foreground" />{r.base_pct.toFixed(2)}%
                      </span>
                    </td>
                    <td className={premiumTable.td}><span className="text-xs font-black text-foreground tabular-nums">{fmt(r.accrued)}</span></td>
                    <td className={premiumTable.td}><span className={cn("text-xs font-black tabular-nums", r.clawbacks > 0 ? "text-destructive" : "text-muted-foreground")}>{r.clawbacks > 0 ? `−${fmt(r.clawbacks)}` : fmt(0)}</span></td>
                    <td className={premiumTable.td}><span className="text-xs font-black text-info tabular-nums">{fmt(r.paid)}</span></td>
                    <td className={premiumTable.td}>
                      <span className={cn("inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-black tabular-nums",
                        r.balance > 0 ? "border-success/40 bg-success/10 text-success" : "border-border bg-muted/30 text-muted-foreground")}>
                        {fmt(r.balance)}
                      </span>
                    </td>
                    <td className={premiumTable.td}>
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {r.last_payout_at ? new Date(r.last_payout_at).toLocaleDateString("pt-BR") : "sem pagto"}
                        </span>
                        <span className="text-[9px] font-bold text-muted-foreground tabular-nums">{r.ledger_count} mov</span>
                      </div>
                    </td>
                    <td className={premiumTable.td}><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PremiumPanel>

      <StaffCommissionPanel selected={selected} onClose={() => setSelected(null)} onChanged={load} profiles={profiles} onCopy={copy} />
    </div>
  );
}

// ============== Detail panel ==============
function StaffCommissionPanel({ selected, onClose, onChanged, profiles, onCopy }: {
  selected: StaffSummary | null;
  onClose: () => void;
  onChanged: () => void;
  profiles: Tables<"profiles">[];
  onCopy: (text: string, label: string) => void;
}) {
  const [ledger, setLedger] = useState<Tables<"staff_commissions_ledger">[]>([]);
  const [overrides, setOverrides] = useState<Tables<"staff_commission_overrides">[]>([]);
  const [payouts, setPayouts] = useState<Tables<"staff_commission_payouts">[]>([]);
  const [tab, setTab] = useState<"ledger" | "overrides" | "payouts">("ledger");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("PIX");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [newOverrideSeller, setNewOverrideSeller] = useState("");
  const [newOverridePct, setNewOverridePct] = useState("");
  const [newPct, setNewPct] = useState("");

  useEffect(() => {
    if (!selected) return;
    setNewPct(selected.base_pct.toFixed(2));
    (async () => {
      const [{ data: l }, { data: o }, { data: p }] = await Promise.all([
        supabase.from("staff_commissions_ledger").select("*")
          .eq("staff_user_id", selected.user_id).order("created_at", { ascending: false }).limit(500),
        supabase.from("staff_commission_overrides").select("*").eq("staff_user_id", selected.user_id),
        supabase.from("staff_commission_payouts").select("*").eq("staff_user_id", selected.user_id).order("created_at", { ascending: false }),
      ]);
      setLedger(l ?? []); setOverrides(o ?? []); setPayouts(p ?? []);
    })();
  }, [selected]);

  if (!selected) return null;

  const saveBasePct = async () => {
    const v = parseFloat(newPct);
    if (!Number.isFinite(v)) return;
    const { error } = await supabase.from("staff_commission_config").upsert({
      user_id: selected.user_id, base_pct: v, base: "net_amount", is_active: true,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Percentual padrão atualizado");
    onChanged();
  };

  const addOverride = async () => {
    if (!newOverrideSeller || !newOverridePct) return;
    const { error } = await supabase.from("staff_commission_overrides").insert({
      staff_user_id: selected.user_id, seller_user_id: newOverrideSeller, pct: parseFloat(newOverridePct),
    });
    if (error) { toast.error(error.message); return; }
    setNewOverrideSeller(""); setNewOverridePct("");
    toast.success("Override adicionado");
    const { data } = await supabase.from("staff_commission_overrides").select("*").eq("staff_user_id", selected.user_id);
    setOverrides(data ?? []);
  };

  const removeOverride = async (id: string) => {
    await supabase.from("staff_commission_overrides").delete().eq("id", id);
    setOverrides(overrides.filter((o) => o.id !== id));
    toast.success("Override removido");
  };

  const createPayout = async () => {
    const v = parseFloat(payoutAmount);
    if (!Number.isFinite(v) || v <= 0) { toast.error("Valor inválido"); return; }
    const { error } = await supabase.from("staff_commission_payouts").insert({
      staff_user_id: selected.user_id, amount: v, method: payoutMethod, notes: payoutNotes, status: "pending",
    });
    if (error) { toast.error(error.message); return; }
    setPayoutAmount(""); setPayoutNotes("");
    toast.success("Pagamento criado como pendente");
    const { data } = await supabase.from("staff_commission_payouts").select("*").eq("staff_user_id", selected.user_id).order("created_at", { ascending: false });
    setPayouts(data ?? []);
  };

  const markPaid = async (id: string) => {
    const { error } = await supabase.from("staff_commission_payouts").update({ status: "paid" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Pagamento efetivado");
    const { data } = await supabase.from("staff_commission_payouts").select("*").eq("staff_user_id", selected.user_id).order("created_at", { ascending: false });
    setPayouts(data ?? []);
    onChanged();
  };

  const role = selected.role;
  const tabs = [
    { id: "ledger" as const, label: "Movimentações", icon: Activity, count: ledger.length },
    { id: "overrides" as const, label: "Overrides", icon: Settings2, count: overrides.length },
    { id: "payouts" as const, label: "Pagamentos", icon: ArrowDownToLine, count: payouts.length },
  ];

  return (
    <Dialog open={!!selected} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl gap-0 overflow-hidden p-0 border-border [&>button]:hidden">
        {/* Header limpo, estilo plataforma */}
        <header className="flex items-center justify-between border-b border-border bg-card p-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30 text-lg font-black text-foreground">
              {(selected.full_name || "?")[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate font-display text-lg font-black tracking-tight text-foreground">{selected.full_name}</p>
                {role === "manager"
                  ? <span className="inline-flex items-center gap-1 rounded border border-success/40 bg-success/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-success"><Briefcase className="h-2.5 w-2.5" />Gerente</span>
                  : <span className="inline-flex items-center gap-1 rounded border border-info/40 bg-info/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-info"><Shield className="h-2.5 w-2.5" />Staff</span>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{selected.email}</span>
                <button onClick={() => onCopy(selected.email, "Email")} className="rounded p-0.5 hover:text-primary"><Copy className="h-3 w-3" /></button>
                <span className="text-muted-foreground/40">·</span>
                <span className="inline-flex items-center gap-1"><UserIcon className="h-3 w-3" />ID: {selected.user_id.slice(0, 8)}…</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 shrink-0 p-0"><X className="h-4 w-4" /></Button>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 border-b border-border bg-muted/10 p-5 md:grid-cols-4">
          <MiniKpi icon={Wallet} label="Saldo a pagar" value={fmt(selected.balance)} tone="success" />
          <MiniKpi icon={Coins} label="Acumulado" value={fmt(selected.accrued)} tone="primary" />
          <MiniKpi icon={TrendingDown} label="Clawbacks" value={fmt(selected.clawbacks)} tone="destructive" />
          <MiniKpi icon={CheckCircle2} label="Pago" value={fmt(selected.paid)} tone="info" />
        </div>

        {/* % padrão + Tabs */}
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-2">
            <Label className="ml-1 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              <Percent className="h-3 w-3" />% padrão · sobre net
            </Label>
            <Input value={newPct} onChange={(e) => setNewPct(e.target.value)} type="number" step="0.01" min="0" max="100"
              className="h-8 w-24 font-mono text-sm" />
            <Button size="sm" onClick={saveBasePct} className="h-8">Salvar</Button>
          </div>

          <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn("inline-flex h-8 items-center gap-2 rounded-md px-3 text-[11px] font-black uppercase tracking-wider transition-all duration-150",
                  tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>
                <t.icon className="h-3.5 w-3.5" /> {t.label}
                <span className={cn("rounded px-1.5 py-0 text-[9px] tabular-nums",
                  tab === t.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground")}>{t.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[55vh] overflow-y-auto bg-card">
          {tab === "ledger" && (
            ledger.length === 0
              ? <PremiumEmpty icon={Activity} title="Sem movimentações" subtitle="Accruals, clawbacks e payouts aparecem aqui" />
              : (
                <table className="w-full text-xs">
                  <thead className={cn(premiumTable.headRow, "bg-muted/30")}>
                    <tr>
                      <th className={premiumTable.th}>Quando</th>
                      <th className={premiumTable.th}>Tipo</th>
                      <th className={cn(premiumTable.th, "text-right")}>Base</th>
                      <th className={cn(premiumTable.th, "text-right")}>%</th>
                      <th className={cn(premiumTable.th, "text-right")}>Valor</th>
                      <th className={cn(premiumTable.th, "text-right")}>Saldo após</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((e) => (
                      <tr key={e.id} className="border-t border-border transition-colors hover:bg-muted/30">
                        <td className="px-5 py-3 font-mono text-[11px] text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")}</td>
                        <td className="px-5 py-3">
                          <span className={cn("inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
                            e.type === "accrual" ? "border-success/40 bg-success/10 text-success" :
                            e.type === "payout" ? "border-info/40 bg-info/10 text-info" :
                            "border-destructive/40 bg-destructive/10 text-destructive")}>
                            {e.type === "accrual" ? "Accrual" : e.type === "payout" ? "Payout" : "Clawback"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums text-foreground">{fmt(Number(e.base_amount))}</td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums text-muted-foreground">{Number(e.pct).toFixed(2)}%</td>
                        <td className={cn("px-5 py-3 text-right font-mono font-black tabular-nums",
                          Number(e.amount) >= 0 ? "text-success" : "text-destructive")}>{fmt(Number(e.amount))}</td>
                        <td className="px-5 py-3 text-right font-mono font-bold tabular-nums text-foreground">{fmt(Number(e.balance_after))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
          )}

          {tab === "overrides" && (
            <div className="space-y-4 p-5">
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Novo override · % específica para um seller</p>
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <div className="flex-1">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Seller</Label>
                    <select value={newOverrideSeller} onChange={(e) => setNewOverrideSeller(e.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground transition-colors focus:border-primary focus:outline-none">
                      <option value="">Selecione um seller…</option>
                      {profiles.map((p) => (
                        <option key={p.user_id} value={p.user_id}>{p.full_name || p.email}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-32">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">% específica</Label>
                    <Input value={newOverridePct} onChange={(e) => setNewOverridePct(e.target.value)}
                      type="number" step="0.01" placeholder="0.00" className="mt-1 h-9 font-mono text-sm" />
                  </div>
                  <Button size="sm" onClick={addOverride} className="h-9 gap-1.5"><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
                </div>
              </div>

              {overrides.length === 0
                ? <PremiumEmpty icon={Settings2} title="Sem overrides" subtitle="O staff usa a % padrão para todos os sellers" />
                : (
                  <div className={premiumTable.wrapper}>
                    <table className="w-full text-xs">
                      <thead className={premiumTable.headRow}>
                        <tr>
                          <th className={premiumTable.th}>Seller</th>
                          <th className={cn(premiumTable.th, "text-right")}>% override</th>
                          <th className={cn(premiumTable.th, "w-12")}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {overrides.map((o) => {
                          const p = profiles.find((x) => x.user_id === o.seller_user_id);
                          return (
                            <tr key={o.id} className="border-t border-border transition-colors hover:bg-muted/30">
                              <td className="px-5 py-3">
                                <p className="text-xs font-bold text-foreground">{p?.full_name || "—"}</p>
                                <p className="text-[10px] font-bold text-muted-foreground">{p?.email || o.seller_user_id}</p>
                              </td>
                              <td className="px-5 py-3 text-right">
                                <span className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-black tabular-nums text-primary">
                                  <Percent className="h-2.5 w-2.5" />{Number(o.pct).toFixed(2)}%
                                </span>
                              </td>
                              <td className="px-5 py-3 text-right">
                                <Button size="sm" variant="ghost" onClick={() => removeOverride(o.id)}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          )}

          {tab === "payouts" && (
            <div className="space-y-4 p-5">
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Registrar novo pagamento</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Valor (R$)</Label>
                    <Input value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} type="number" step="0.01" placeholder="0.00" className="mt-1 h-9 font-mono" />
                  </div>
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Método</Label>
                    <Input value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)} className="mt-1 h-9" />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Observação</Label>
                    <Input value={payoutNotes} onChange={(e) => setPayoutNotes(e.target.value)} placeholder="ID da transação, comprovante…" className="mt-1 h-9" />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold text-muted-foreground">Saldo disponível: <span className="font-mono font-black text-success">{fmt(selected.balance)}</span></p>
                  <Button size="sm" onClick={createPayout} className="h-9 gap-1.5">
                    <ArrowDownToLine className="h-3.5 w-3.5" /> Registrar pagamento
                  </Button>
                </div>
              </div>

              {payouts.length === 0
                ? <PremiumEmpty icon={Receipt} title="Sem pagamentos" subtitle="Os pagamentos aparecem aqui após registrados" />
                : (
                  <div className={premiumTable.wrapper}>
                    <table className="w-full text-xs">
                      <thead className={premiumTable.headRow}>
                        <tr>
                          <th className={premiumTable.th}>Quando</th>
                          <th className={cn(premiumTable.th, "text-right")}>Valor</th>
                          <th className={premiumTable.th}>Método</th>
                          <th className={premiumTable.th}>Status</th>
                          <th className={premiumTable.th}>Observação</th>
                          <th className={cn(premiumTable.th, "text-right")}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {payouts.map((p) => (
                          <tr key={p.id} className="border-t border-border transition-colors hover:bg-muted/30">
                            <td className="px-5 py-3 font-mono text-[11px] text-muted-foreground">{new Date(p.created_at).toLocaleString("pt-BR")}</td>
                            <td className="px-5 py-3 text-right font-mono font-black tabular-nums text-foreground">{fmt(Number(p.amount))}</td>
                            <td className="px-5 py-3 text-foreground">{p.method}</td>
                            <td className="px-5 py-3">
                              <span className={cn("inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
                                p.status === "paid" ? "border-info/40 bg-info/10 text-info" :
                                p.status === "pending" ? "border-warning/40 bg-warning/10 text-warning" :
                                "border-destructive/40 bg-destructive/10 text-destructive")}>
                                {p.status === "paid" ? "Pago" : p.status === "pending" ? "Pendente" : p.status}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-[11px] text-muted-foreground truncate max-w-[200px]">{p.notes || "—"}</td>
                            <td className="px-5 py-3 text-right">
                              {p.status === "pending" && (
                                <Button size="sm" onClick={() => markPaid(p.id)} className="h-7 gap-1 text-[10px]">
                                  <CheckCircle2 className="h-3 w-3" /> Marcar pago
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MiniKpi({ icon: Icon, label, value, tone }: {
  icon: LucideIcon; label: string; value: string; tone: "success" | "primary" | "destructive" | "info";
}) {
  const toneText = {
    success: "text-success", primary: "text-primary", destructive: "text-destructive", info: "text-info",
  }[tone];
  const toneBorder = {
    success: "border-success/30", primary: "border-primary/30", destructive: "border-destructive/30", info: "border-info/30",
  }[tone];
  return (
    <div className={cn("group rounded-lg border border-border bg-card p-3 transition-all duration-200 hover:-translate-y-0.5", `hover:${toneBorder}`)}>
      <div className="flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5", toneText)} />
        <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className={cn("mt-1 font-display text-base font-black tabular-nums", toneText)}>{value}</p>
    </div>
  );
}
