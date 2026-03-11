import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ShieldAlert, Shield, Search, Plus, Trash2, ToggleLeft, ToggleRight,
  AlertTriangle, Eye, Ban, Snowflake, Clock, Zap, FileWarning,
  CheckCircle2, XCircle, Globe, Mail, CreditCard, User, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { logAdminAction } from "@/lib/auditLog";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import { GlassPanel as Panel, AdminKpi as Kpi, GlassPanelTitle } from "./AdminOverviewTab";

/* ── Types ── */
interface BlacklistEntry { id: string; entry_type: string; entry_value: string; reason: string; added_by: string; is_active: boolean; created_at: string; }
interface VelocityRule { id: string; rule_name: string; rule_type: string; is_enabled: boolean; max_attempts: number; time_window_minutes: number; threshold_amount: number | null; action: string; updated_by: string | null; }
interface FraudLog { id: string; block_type: string; block_reason: string; matched_value: string | null; matched_type: string | null; customer_email: string | null; customer_document: string | null; customer_ip: string | null; product_id: string | null; seller_user_id: string | null; metadata: any; created_at: string; }

type SubTab = "blacklist" | "chargeback-radar" | "velocity" | "fraud-trail";

interface Props {
  profiles: Tables<"profiles">[];
  transactions: Tables<"transactions">[];
  fmtCurrency: (v: number) => string;
}

const ENTRY_TYPE_ICONS: Record<string, React.ReactNode> = {
  cpf: <User className="h-3 w-3" />,
  cnpj: <User className="h-3 w-3" />,
  email: <Mail className="h-3 w-3" />,
  ip: <Globe className="h-3 w-3" />,
  bin: <CreditCard className="h-3 w-3" />,
};

export default function AdminRiskComplianceTab({ profiles, transactions, fmtCurrency }: Props) {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>("blacklist");
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [velocityRules, setVelocityRules] = useState<VelocityRule[]>([]);
  const [fraudLogs, setFraudLogs] = useState<FraudLog[]>([]);
  const [search, setSearch] = useState("");

  // Add blacklist dialog
  const [addDialog, setAddDialog] = useState(false);
  const [newType, setNewType] = useState("cpf");
  const [newValue, setNewValue] = useState("");
  const [newReason, setNewReason] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("global_blacklist").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("velocity_rules").select("*").order("created_at", { ascending: true }),
      supabase.from("fraud_logs").select("*").order("created_at", { ascending: false }).limit(500),
    ]).then(([blRes, vrRes, flRes]) => {
      if (blRes.data) setBlacklist(blRes.data as any[]);
      if (vrRes.data) setVelocityRules(vrRes.data as any[]);
      if (flRes.data) setFraudLogs(flRes.data as any[]);
    });
  }, []);

  const getSellerName = (userId: string | null) => {
    if (!userId) return "—";
    return profiles.find(p => p.user_id === userId)?.full_name || userId.slice(0, 8);
  };

  /* ── Blacklist Actions ── */
  const handleAddBlacklist = async () => {
    if (!newValue.trim() || !newReason.trim()) { toast.error("Preencha valor e motivo"); return; }
    if (!user) return;
    const clean = newType === "cpf" || newType === "cnpj" ? newValue.replace(/\D/g, "") : newValue.trim().toLowerCase();
    const { error } = await supabase.from("global_blacklist").insert({
      entry_type: newType, entry_value: clean, reason: newReason.trim(), added_by: user.id,
    });
    if (error) {
      if (error.code === "23505") toast.error("Entrada já existe na blacklist");
      else toast.error("Erro ao adicionar");
      return;
    }
    toast.success(`${newType.toUpperCase()} adicionado à Blacklist`);
    await logAdminAction("add_blacklist", "global_blacklist", clean, { entry_type: newType, reason: newReason.trim() } as any);
    setAddDialog(false); setNewValue(""); setNewReason("");
    const { data } = await supabase.from("global_blacklist").select("*").order("created_at", { ascending: false }).limit(500);
    if (data) setBlacklist(data as any[]);
  };

  const handleRemoveBlacklist = async (id: string, value: string) => {
    const { error } = await supabase.from("global_blacklist").update({ is_active: false }).eq("id", id);
    if (error) { toast.error("Erro ao remover"); return; }
    toast.success("Removido da Blacklist");
    await logAdminAction("remove_blacklist", "global_blacklist", value);
    setBlacklist(prev => prev.map(b => b.id === id ? { ...b, is_active: false } : b));
  };

  /* ── Velocity Actions ── */
  const handleToggleRule = async (rule: VelocityRule) => {
    const { error } = await supabase.from("velocity_rules").update({ is_enabled: !rule.is_enabled, updated_by: user?.id }).eq("id", rule.id);
    if (error) { toast.error("Erro"); return; }
    toast.success(`Regra ${!rule.is_enabled ? "ativada" : "desativada"}`);
    await logAdminAction("toggle_velocity_rule", "velocity_rules", rule.id, { rule_name: rule.rule_name, enabled: !rule.is_enabled } as any);
    setVelocityRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_enabled: !r.is_enabled } : r));
  };

  const handleUpdateRule = async (rule: VelocityRule, field: string, value: number) => {
    const { error } = await supabase.from("velocity_rules").update({ [field]: value, updated_by: user?.id } as any).eq("id", rule.id);
    if (error) { toast.error("Erro"); return; }
    toast.success("Regra atualizada");
    setVelocityRules(prev => prev.map(r => r.id === rule.id ? { ...r, [field]: value } : r));
  };

  /* ── Chargeback Radar ── */
  const chargebackRadar = useMemo(() => {
    const sellerMap = new Map<string, { total: number; chargebacks: number; refunds: number; name: string; email: string; frozen: boolean }>();
    transactions.forEach(tx => {
      if (!sellerMap.has(tx.user_id)) {
        const p = profiles.find(p => p.user_id === tx.user_id);
        sellerMap.set(tx.user_id, { total: 0, chargebacks: 0, refunds: 0, name: p?.full_name || "—", email: p?.email || "", frozen: p?.balance_frozen || false });
      }
      const s = sellerMap.get(tx.user_id)!;
      if (tx.status === "completed" || tx.status === "chargeback" || tx.status === "refunded") s.total++;
      if (tx.status === "chargeback") s.chargebacks++;
      if (tx.status === "refunded") s.refunds++;
    });
    return Array.from(sellerMap.entries())
      .map(([userId, data]) => ({ userId, ...data, rate: data.total > 0 ? ((data.chargebacks + data.refunds) / data.total) * 100 : 0 }))
      .filter(s => s.total > 0)
      .sort((a, b) => b.rate - a.rate);
  }, [transactions, profiles]);

  const handleFreezeSeller = async (userId: string) => {
    const { error } = await supabase.from("profiles").update({ balance_frozen: true }).eq("user_id", userId);
    if (error) { toast.error("Erro ao congelar"); return; }
    toast.success("Saldo congelado!");
    await logAdminAction("freeze_balance", "profile", userId, { reason: "chargeback_radar" } as any);
  };

  /* ── KPIs ── */
  const activeBlacklist = blacklist.filter(b => b.is_active).length;
  const enabledRules = velocityRules.filter(r => r.is_enabled).length;
  const blockedToday = fraudLogs.filter(f => new Date(f.created_at).toDateString() === new Date().toDateString()).length;
  const highRiskSellers = chargebackRadar.filter(s => s.rate > 1.5).length;

  const filteredBlacklist = blacklist.filter(b => {
    if (!search) return true;
    const s = search.toLowerCase();
    return b.entry_value.toLowerCase().includes(s) || b.reason.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={<Ban className="h-5 w-5" />} label="Blacklist Ativa" value={String(activeBlacklist)} sub="Entradas bloqueadas" gradient="from-red-600 to-rose-700" alert={activeBlacklist > 0} />
        <Kpi icon={<Zap className="h-5 w-5" />} label="Velocity Rules" value={`${enabledRules}/${velocityRules.length}`} sub="Regras ativas" gradient="from-amber-500 to-orange-600" />
        <Kpi icon={<ShieldAlert className="h-5 w-5" />} label="Bloqueios Hoje" value={String(blockedToday)} sub="Tentativas barradas" gradient="from-violet-500 to-purple-600" alert={blockedToday > 5} />
        <Kpi icon={<AlertTriangle className="h-5 w-5" />} label="Sellers em Risco" value={String(highRiskSellers)} sub="Chargeback > 1.5%" gradient="from-destructive to-red-700" alert={highRiskSellers > 0} />
      </div>

      {/* Sub-Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/30 border border-border w-fit flex-wrap">
        {([
          { id: "blacklist" as SubTab, label: "Blacklist Global", icon: Ban },
          { id: "chargeback-radar" as SubTab, label: "Radar Chargebacks", icon: AlertTriangle, count: highRiskSellers },
          { id: "velocity" as SubTab, label: "Velocity Checks", icon: Zap },
          { id: "fraud-trail" as SubTab, label: "Fraud Trail", icon: FileWarning, count: blockedToday },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setSubTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              subTab === tab.id ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"
            }`}>
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="h-4 min-w-[16px] px-1 rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground flex items-center justify-center">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ BLACKLIST ═══ */}
      {subTab === "blacklist" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input placeholder="Buscar CPF, email, IP..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30" />
            </div>
            <Button size="sm" className="gap-1.5 rounded-xl" onClick={() => setAddDialog(true)}>
              <Plus className="h-3.5 w-3.5" /> Adicionar à Blacklist
            </Button>
          </div>

          <Panel>
            <div className="flex items-center gap-2 text-sm font-bold text-foreground mb-4">
              <Ban className="h-4 w-4 text-destructive" /> Blacklist Global ({filteredBlacklist.filter(b => b.is_active).length} ativas)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  {["Tipo", "Valor", "Motivo", "Status", "Data", "Ações"].map(h => (
                    <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filteredBlacklist.map(b => (
                    <tr key={b.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${!b.is_active ? "opacity-40" : ""}`}>
                      <td className="p-3">
                        <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-foreground">
                          {ENTRY_TYPE_ICONS[b.entry_type]} {b.entry_type}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-xs text-foreground">{b.entry_value}</td>
                      <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">{b.reason}</td>
                      <td className="p-3">
                        {b.is_active ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">Ativa</span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">Removida</span>
                        )}
                      </td>
                      <td className="p-3 text-[10px] text-muted-foreground">{new Date(b.created_at).toLocaleString("pt-BR")}</td>
                      <td className="p-3">
                        {b.is_active && (
                          <Button size="sm" variant="ghost" className="h-7 text-[11px] text-destructive hover:bg-destructive/10 gap-1" onClick={() => handleRemoveBlacklist(b.id, b.entry_value)}>
                            <Trash2 className="h-3 w-3" /> Remover
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredBlacklist.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-muted-foreground text-xs">Blacklist vazia</td></tr>}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {/* ═══ CHARGEBACK RADAR ═══ */}
      {subTab === "chargeback-radar" && (
        <Panel>
          <div className="flex items-center gap-2 text-sm font-bold text-foreground mb-1">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Radar de Chargebacks — Ranking por Taxa
          </div>
          <p className="text-xs text-muted-foreground mb-4">Sellers ordenados pela maior taxa de chargeback/reembolso. Linhas vermelhas = acima de 1.5%.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                {["#", "Vendedor", "Total Tx", "Chargebacks", "Reembolsos", "Taxa %", "Status", "Ações"].map(h => (
                  <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {chargebackRadar.slice(0, 50).map((s, i) => {
                  const isHighRisk = s.rate > 1.5;
                  return (
                    <tr key={s.userId} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${isHighRisk ? "bg-destructive/[0.05] ring-1 ring-destructive/20" : ""}`}>
                      <td className="p-3 text-xs font-bold text-muted-foreground">{i + 1}</td>
                      <td className="p-3">
                        <p className="text-xs font-bold text-foreground">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground">{s.email}</p>
                      </td>
                      <td className="p-3 text-xs font-bold text-foreground">{s.total}</td>
                      <td className="p-3 text-xs font-bold text-destructive">{s.chargebacks}</td>
                      <td className="p-3 text-xs font-bold text-warning">{s.refunds}</td>
                      <td className="p-3">
                        <span className={`text-xs font-black ${isHighRisk ? "text-destructive" : s.rate > 0.5 ? "text-warning" : "text-emerald-500"}`}>
                          {s.rate.toFixed(2)}%
                        </span>
                        {isHighRisk && <AlertTriangle className="ml-1 h-3 w-3 text-destructive" />}
                      </td>
                      <td className="p-3">
                        {s.frozen ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center gap-1 w-fit">
                            <Snowflake className="h-2.5 w-2.5" /> Congelado
                          </span>
                        ) : isHighRisk ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-1 w-fit"><AlertTriangle className="h-2.5 w-2.5" /> Risco</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">OK</span>
                        )}
                      </td>
                      <td className="p-3">
                        {isHighRisk && !s.frozen && (
                          <Button size="sm" className="h-7 text-[11px] bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border border-blue-500/20 gap-1 rounded-xl shadow-none" onClick={() => handleFreezeSeller(s.userId)}>
                            <Snowflake className="h-3 w-3" /> Congelar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {chargebackRadar.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-muted-foreground text-xs">Sem dados</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* ═══ VELOCITY CHECKS ═══ */}
      {subTab === "velocity" && (
        <Panel>
          <div className="flex items-center gap-2 text-sm font-bold text-foreground mb-1">
            <Zap className="h-4 w-4 text-warning" /> Velocity Checks — Regras de Velocidade
          </div>
          <p className="text-xs text-muted-foreground mb-4">Configure bloqueios automáticos contra força bruta de cartão e compras suspeitas.</p>
          <div className="space-y-4">
            {velocityRules.map(rule => (
              <div key={rule.id} className={`p-4 rounded-xl border transition-all ${rule.is_enabled ? "border-primary/30 bg-primary/[0.03]" : "border-border bg-muted/20"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {rule.is_enabled ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                    <div>
                      <p className="text-sm font-bold text-foreground">{rule.rule_name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{rule.rule_type}</p>
                    </div>
                  </div>
                  <Switch checked={rule.is_enabled} onCheckedChange={() => handleToggleRule(rule)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Máx. Tentativas</Label>
                    <Input type="number" min="1" value={rule.max_attempts}
                      onChange={e => handleUpdateRule(rule, "max_attempts", Number(e.target.value))}
                      className="h-8 text-xs" disabled={!rule.is_enabled} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Janela (minutos)</Label>
                    <Input type="number" min="1" value={rule.time_window_minutes}
                      onChange={e => handleUpdateRule(rule, "time_window_minutes", Number(e.target.value))}
                      className="h-8 text-xs" disabled={!rule.is_enabled} />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    rule.action === "block" ? "bg-destructive/10 text-destructive border border-destructive/20" :
                    rule.action === "flag" ? "bg-warning/10 text-warning border border-warning/20" :
                    "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                  }`}>
                    Ação: {rule.action === "block" ? "Bloquear" : rule.action === "flag" ? "Sinalizar" : "Notificar"}
                  </span>
                </div>
              </div>
            ))}
            {velocityRules.length === 0 && <p className="text-center text-muted-foreground text-xs py-10">Nenhuma regra configurada</p>}
          </div>
        </Panel>
      )}

      {/* ═══ FRAUD TRAIL ═══ */}
      {subTab === "fraud-trail" && (
        <Panel>
          <div className="flex items-center gap-2 text-sm font-bold text-foreground mb-1">
            <FileWarning className="h-4 w-4 text-destructive" /> Fraud Trail — Log de Bloqueios
          </div>
          <p className="text-xs text-muted-foreground mb-4">Todas as transações bloqueadas pela Blacklist ou Velocity Check.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                {["Data", "Tipo", "Motivo", "Email", "Doc", "IP", "Seller", "Match"].map(h => (
                  <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {fraudLogs.map(f => (
                  <tr key={f.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="p-3 text-[10px] text-muted-foreground">{new Date(f.created_at).toLocaleString("pt-BR")}</td>
                    <td className="p-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        f.block_type === "blacklist" ? "bg-destructive/10 text-destructive border border-destructive/20" :
                        "bg-warning/10 text-warning border border-warning/20"
                      }`}>{f.block_type === "blacklist" ? "Blacklist" : "Velocity"}</span>
                    </td>
                    <td className="p-3 text-xs text-foreground max-w-[200px] truncate">{f.block_reason}</td>
                    <td className="p-3 text-[10px] text-muted-foreground font-mono">{f.customer_email || "—"}</td>
                    <td className="p-3 text-[10px] text-muted-foreground font-mono">{f.customer_document ? `***${f.customer_document.slice(-4)}` : "—"}</td>
                    <td className="p-3 text-[10px] text-muted-foreground font-mono">{f.customer_ip || "—"}</td>
                    <td className="p-3 text-xs text-foreground">{getSellerName(f.seller_user_id)}</td>
                    <td className="p-3 text-[10px] text-muted-foreground">
                      {f.matched_type && f.matched_value ? (
                        <span className="font-mono">{f.matched_type}: {f.matched_value}</span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
                {fraudLogs.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-muted-foreground text-xs">Nenhum bloqueio registrado</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* ═══ ADD BLACKLIST DIALOG ═══ */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Ban className="h-5 w-5 text-destructive" /> Adicionar à Blacklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-xs">Tipo</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="ip">IP</SelectItem>
                  <SelectItem value="bin">BIN (6 primeiros dígitos do cartão)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Valor</Label>
              <Input value={newValue} onChange={e => setNewValue(e.target.value)}
                placeholder={newType === "cpf" ? "000.000.000-00" : newType === "email" ? "email@exemplo.com" : newType === "ip" ? "192.168.1.1" : newType === "bin" ? "411111" : "00.000.000/0000-00"} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Motivo <span className="text-destructive">*</span></Label>
              <Textarea value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="Ex: Chargeback recorrente, fraude confirmada..." className="min-h-[60px]" />
            </div>
            <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
              <p className="text-[10px] text-destructive font-medium">⚠️ Qualquer compra na plataforma com este dado será <strong>bloqueada automaticamente</strong> antes de atingir a adquirente.</p>
            </div>
            <Button onClick={handleAddBlacklist} disabled={!newValue.trim() || !newReason.trim()} className="w-full gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">
              <Ban className="h-4 w-4" /> Bloquear
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
