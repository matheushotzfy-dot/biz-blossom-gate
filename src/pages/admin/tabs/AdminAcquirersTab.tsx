import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus, Power, PowerOff, Edit, Save, Shield, Globe, Eye, EyeOff,
  AlertTriangle, Activity, Zap, Clock, TrendingUp, TrendingDown,
  Users, ArrowRightLeft, KeyRound, Webhook, History, RefreshCw,
  CheckCircle2, XCircle, Copy, ChevronRight, Filter, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle } from "./AdminOverviewTab";
import { LinearHero, LinearStat, LinearStatRow } from "@/components/admin/LinearKit";
import { logAdminAction } from "@/lib/auditLog";
import { cn } from "@/lib/utils";

// ============== Types ==============
type Health = "online" | "degraded" | "offline" | "maintenance";
interface Acquirer {
  id: string; name: string; slug: string; type: "white" | "black"; is_active: boolean;
  api_endpoint: string | null; description: string | null;
  conversion_rate: number; seller_visible: boolean;
  health_status: Health; last_health_check_at: string | null;
  last_failure_at: string | null; last_latency_ms: number | null; avg_latency_ms: number | null;
  uptime_pct: number | null;
  min_transaction_amount: number | null; max_transaction_amount: number | null;
  supported_methods: string[];
  transaction_fee_percentage: number | null; transaction_fee_fixed: number | null;
  webhook_url: string | null; webhook_secret: string | null;
  api_key_encrypted: string | null; api_secret_encrypted: string | null;
  api_environment: "production" | "sandbox";
  priority: number; allow_failover: boolean; notes: string | null;
  created_at: string; updated_at: string;
}
interface HealthEvent {
  id: string; acquirer_id: string; event_type: string; severity: string;
  message: string | null; latency_ms: number | null; error_code: string | null;
  created_at: string;
}
interface FailoverEvent {
  id: string; from_acquirer_id: string | null; to_acquirer_id: string | null;
  seller_id: string | null; reason: string; trigger_type: string;
  success: boolean; error_message: string | null; created_at: string;
}

const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "credit_card", label: "Cartão Crédito" },
  { value: "debit_card", label: "Cartão Débito" },
  { value: "boleto", label: "Boleto" },
];

const mask = (v: string | null) => v ? `${v.slice(0, 4)}${"•".repeat(Math.max(0, v.length - 8))}${v.slice(-4)}` : "—";
const fmtBRL = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ago = (d: string | null) => {
  if (!d) return "—";
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
};

const HEALTH_CONFIG = {
  online: { color: "text-success", bg: "bg-success/10", border: "border-success/30", dot: "bg-success", label: "Online" },
  degraded: { color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", dot: "bg-warning", label: "Degradado" },
  offline: { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", dot: "bg-destructive", label: "Offline" },
  maintenance: { color: "text-primary", bg: "bg-primary/10", border: "border-primary/30", dot: "bg-primary", label: "Manutenção" },
} as const;

export default function AdminAcquirersTab() {
  const [acquirers, setAcquirers] = useState<Acquirer[]>([]);
  const [healthEvents, setHealthEvents] = useState<HealthEvent[]>([]);
  const [failovers, setFailovers] = useState<FailoverEvent[]>([]);
  const [txStats, setTxStats] = useState<Record<string, { sales: number; volume: number; refused: number; refunded: number; medpix: number; sellers: number }>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showBulk, setShowBulk] = useState(false);

  const [form, setForm] = useState<Partial<Acquirer>>({});

  const load = async () => {
    setLoading(true);
    const [acqRes, heRes, foRes, profRes, txRes, dispRes] = await Promise.all([
      supabase.from("acquirers").select("*").order("priority", { ascending: false }).order("created_at"),
      supabase.from("acquirer_health_events").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("acquirer_failover_events").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("user_id, acquirer_id"),
      supabase.from("transactions").select("user_id, amount, status, payment_method, created_at").gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
      supabase.from("disputes").select("transaction_id, type, created_at").gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    ]);

    const acqs = (acqRes.data || []) as unknown as Acquirer[];
    setAcquirers(acqs);
    setHealthEvents((heRes.data || []) as HealthEvent[]);
    setFailovers((foRes.data || []) as FailoverEvent[]);

    // Build seller -> acquirer map
    const sellerAcq = new Map<string, string>();
    const acqSellers = new Map<string, Set<string>>();
    (profRes.data || []).forEach((p: any) => {
      if (p.acquirer_id) {
        sellerAcq.set(p.user_id, p.acquirer_id);
        if (!acqSellers.has(p.acquirer_id)) acqSellers.set(p.acquirer_id, new Set());
        acqSellers.get(p.acquirer_id)!.add(p.user_id);
      }
    });

    // Aggregate tx by acquirer
    const stats: typeof txStats = {};
    acqs.forEach(a => { stats[a.id] = { sales: 0, volume: 0, refused: 0, refunded: 0, medpix: 0, sellers: acqSellers.get(a.id)?.size || 0 }; });
    (txRes.data || []).forEach((t: any) => {
      const aid = sellerAcq.get(t.user_id); if (!aid || !stats[aid]) return;
      if (t.status === "completed") { stats[aid].sales++; stats[aid].volume += Number(t.amount); }
      if (["failed", "refused"].includes(t.status)) stats[aid].refused++;
      if (t.status === "refunded") stats[aid].refunded++;
    });
    // MEDPIX via disputes: need tx -> user -> acquirer. Approximation: count disputes per acquirer via tx_id join
    const medTxIds = new Set((dispRes.data || []).filter((d: any) => d.type === "medpix" || d.type === "med").map((d: any) => d.transaction_id));
    if (medTxIds.size > 0) {
      const { data: medTx } = await supabase.from("transactions").select("user_id").in("id", Array.from(medTxIds) as string[]);
      (medTx || []).forEach((t: any) => {
        const aid = sellerAcq.get(t.user_id); if (aid && stats[aid]) stats[aid].medpix++;
      });
    }
    setTxStats(stats);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const whiteAcqs = acquirers.filter(a => a.type === "white");
  const blackAcqs = acquirers.filter(a => a.type === "black");
  const offlineCount = acquirers.filter(a => a.health_status === "offline").length;
  const degradedCount = acquirers.filter(a => a.health_status === "degraded").length;

  const detailAcq = acquirers.find(a => a.id === detailId);

  const resetForm = () => setForm({
    name: "", slug: "", type: "black", api_endpoint: "", description: "",
    conversion_rate: 0, seller_visible: false, health_status: "online",
    min_transaction_amount: 1, max_transaction_amount: 50000,
    supported_methods: ["pix", "credit_card"],
    transaction_fee_percentage: 0, transaction_fee_fixed: 0,
    webhook_url: "", webhook_secret: "", api_key_encrypted: "", api_secret_encrypted: "",
    api_environment: "production", priority: 0, allow_failover: true, notes: "",
  });

  const openCreate = () => { resetForm(); setEditingId(null); setShowForm(true); };
  const openEdit = (a: Acquirer) => { setForm({ ...a }); setEditingId(a.id); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name || !form.slug) { toast.error("Nome e slug obrigatórios"); return; }
    const payload: any = {
      name: form.name, slug: form.slug, type: form.type,
      api_endpoint: form.api_endpoint || null, description: form.description || null,
      conversion_rate: form.conversion_rate || 0, seller_visible: form.seller_visible || false,
      health_status: form.health_status || "online",
      min_transaction_amount: form.min_transaction_amount,
      max_transaction_amount: form.max_transaction_amount,
      supported_methods: form.supported_methods || ["pix"],
      transaction_fee_percentage: form.transaction_fee_percentage || 0,
      transaction_fee_fixed: form.transaction_fee_fixed || 0,
      webhook_url: form.webhook_url || null, webhook_secret: form.webhook_secret || null,
      api_key_encrypted: form.api_key_encrypted || null,
      api_secret_encrypted: form.api_secret_encrypted || null,
      api_environment: form.api_environment || "production",
      priority: form.priority || 0, allow_failover: form.allow_failover !== false,
      notes: form.notes || null,
    };
    const { error } = editingId
      ? await supabase.from("acquirers").update(payload).eq("id", editingId)
      : await supabase.from("acquirers").insert(payload);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(editingId ? "Atualizada!" : "Criada!");
    await logAdminAction(editingId ? "update_acquirer" : "create_acquirer", "acquirer", editingId, payload);
    setShowForm(false); setEditingId(null); resetForm(); load();
  };

  const toggleField = async (acq: Acquirer, field: "is_active" | "seller_visible" | "allow_failover") => {
    const newVal = !(acq as any)[field];
    const { error } = await supabase.from("acquirers").update({ [field]: newVal }).eq("id", acq.id);
    if (error) { toast.error("Erro"); return; }
    toast.success("Atualizada");
    load();
  };

  const setHealth = async (acq: Acquirer, newStatus: Health) => {
    const { error } = await supabase.from("acquirers").update({
      health_status: newStatus, last_health_check_at: new Date().toISOString(),
    }).eq("id", acq.id);
    if (error) { toast.error("Erro"); return; }
    toast.success(`Status: ${HEALTH_CONFIG[newStatus].label}`);
    await logAdminAction("set_acquirer_health", "acquirer", acq.id, { health_status: newStatus });
    load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <LinearHero
        eyebrow="Infraestrutura · Adquirentes"
        title="Centro de Adquirentes"
        subtitle="Monitore saúde, latência, conversão, MEDPIX e gerencie chaves, webhooks e roteamento de failover."
        status={{
          tone: offlineCount > 0 ? "destructive" : degradedCount > 0 ? "warning" : "success",
          label: offlineCount > 0 ? `${offlineCount} OFFLINE` : degradedCount > 0 ? `${degradedCount} degradado(s)` : `${acquirers.filter(a => a.is_active).length} ativas`,
        }}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setShowBulk(true)}>
              <ArrowRightLeft className="h-3.5 w-3.5" /> Trocar em Massa
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={load}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Atualizar
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5 bg-foreground text-background hover:bg-foreground/90" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" /> Nova Adquirente
            </Button>
          </div>
        }
      />

      {/* ===== Alerts ===== */}
      {(offlineCount > 0 || degradedCount > 0) && (
        <div className={cn("rounded-2xl border p-4 flex items-start gap-3",
          offlineCount > 0 ? "bg-destructive/5 border-destructive/30" : "bg-warning/5 border-warning/30")}>
          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center",
            offlineCount > 0 ? "bg-destructive/15" : "bg-warning/15")}>
            <AlertTriangle className={cn("h-4 w-4", offlineCount > 0 ? "text-destructive" : "text-warning")} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("text-xs font-black uppercase tracking-wider mb-1", offlineCount > 0 ? "text-destructive" : "text-warning")}>
              Alerta de Conectividade
            </p>
            <div className="flex flex-wrap gap-2">
              {acquirers.filter(a => a.health_status === "offline").map(a => (
                <span key={a.id} className="px-2 py-1 rounded-lg bg-destructive/10 border border-destructive/30 text-[11px] font-bold text-destructive">
                  {a.name} · OFFLINE há {ago(a.last_failure_at)}
                </span>
              ))}
              {acquirers.filter(a => a.health_status === "degraded").map(a => (
                <span key={a.id} className="px-2 py-1 rounded-lg bg-warning/10 border border-warning/30 text-[11px] font-bold text-warning">
                  {a.name} · degradado{a.last_latency_ms ? ` · ${a.last_latency_ms}ms` : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== KPIs ===== */}
      <LinearStatRow>
        <LinearStat icon={Shield} label="Black" value={String(blackAcqs.length)} sub={`${blackAcqs.filter(a => a.is_active).length} ativas`} tone="neutral" />
        <LinearStat icon={Globe} label="White" value={String(whiteAcqs.length)} sub={`${whiteAcqs.filter(a => a.is_active).length} ativas`} tone="info" />
        <LinearStat icon={Activity} label="Saudáveis" value={String(acquirers.filter(a => a.health_status === "online" && a.is_active).length)} sub={`${degradedCount} degradadas`} tone="success" />
        <LinearStat icon={Zap} label="Latência Média" value={`${Math.round(acquirers.reduce((s, a) => s + (a.last_latency_ms || 0), 0) / Math.max(acquirers.length, 1))}ms`} sub="últimos checks" tone="primary" />
      </LinearStatRow>

      {/* ===== Acquirers List (full table) ===== */}
      <AdminPanel>
        <PanelTitle color="zinc" icon={<Activity className="h-4 w-4" />}>Adquirentes ({acquirers.length})</PanelTitle>
        <p className="text-[10px] text-muted-foreground mt-1 mb-4">Clique em uma linha para ver detalhes, histórico e configurações.</p>
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-8">Carregando…</p>
        ) : acquirers.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Nenhuma adquirente cadastrada.</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground border-b border-border/60">
                  <th className="text-left py-2 px-2 font-black">Adquirente</th>
                  <th className="text-left py-2 px-2 font-black">Saúde</th>
                  <th className="text-right py-2 px-2 font-black">Conv.</th>
                  <th className="text-right py-2 px-2 font-black">Latência</th>
                  <th className="text-right py-2 px-2 font-black">Sellers</th>
                  <th className="text-right py-2 px-2 font-black">Vendas 30d</th>
                  <th className="text-right py-2 px-2 font-black">Volume 30d</th>
                  <th className="text-right py-2 px-2 font-black">Recusas</th>
                  <th className="text-right py-2 px-2 font-black">MEDPIX</th>
                  <th className="text-right py-2 px-2 font-black">Taxa</th>
                  <th className="text-right py-2 px-2 font-black"></th>
                </tr>
              </thead>
              <tbody>
                {acquirers.map(a => {
                  const cfg = HEALTH_CONFIG[a.health_status];
                  const st = txStats[a.id] || { sales: 0, volume: 0, refused: 0, refunded: 0, medpix: 0, sellers: 0 };
                  const isBlack = a.type === "black";
                  return (
                    <tr key={a.id} className={cn("border-b border-border/30 hover:bg-muted/20 cursor-pointer transition-colors",
                      !a.is_active && "opacity-50")} onClick={() => setDetailId(a.id)}>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2.5">
                          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-[11px] font-black border shrink-0",
                            isBlack ? "bg-foreground text-background border-foreground/20" : "bg-primary/10 text-primary border-primary/30")}>
                            {a.name[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-foreground truncate">{a.name}</span>
                              <span className={cn("px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                                isBlack ? "bg-foreground/10 text-foreground" : "bg-primary/15 text-primary")}>{a.type}</span>
                              {a.api_environment === "sandbox" && (
                                <span className="px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-warning/15 text-warning">SBX</span>
                              )}
                            </div>
                            <p className="text-[10px] font-mono text-muted-foreground truncate">{a.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider", cfg.bg, cfg.border, cfg.color)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot, a.health_status === "online" && "animate-pulse")} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums font-bold">{Number(a.conversion_rate).toFixed(1)}%</td>
                      <td className="py-2.5 px-2 text-right tabular-nums">
                        {a.last_latency_ms ? (
                          <span className={cn(a.last_latency_ms > 1500 ? "text-destructive" : a.last_latency_ms > 800 ? "text-warning" : "text-success", "font-bold")}>{a.last_latency_ms}ms</span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums">{st.sellers}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums">{st.sales}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums font-bold text-success">{fmtBRL(st.volume)}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums">
                        <span className={cn(st.refused > 0 ? "text-destructive font-bold" : "text-muted-foreground")}>{st.refused}</span>
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums">
                        <span className={cn(st.medpix > 0 ? "text-warning font-bold" : "text-muted-foreground")}>{st.medpix}</span>
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-[10px] text-muted-foreground">
                        {Number(a.transaction_fee_percentage || 0).toFixed(2)}% + {fmtBRL(Number(a.transaction_fee_fixed || 0))}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground inline" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      {/* ===== Failover History ===== */}
      <AdminPanel>
        <PanelTitle color="amber" icon={<ArrowRightLeft className="h-4 w-4" />}>Histórico de Failover ({failovers.length})</PanelTitle>
        <p className="text-[10px] text-muted-foreground mt-1 mb-4">Trocas automáticas/manuais e sellers afetados.</p>
        {failovers.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhum evento registrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground border-b border-border/60">
                  <th className="text-left py-2 px-2 font-black">Quando</th>
                  <th className="text-left py-2 px-2 font-black">De → Para</th>
                  <th className="text-left py-2 px-2 font-black">Seller</th>
                  <th className="text-left py-2 px-2 font-black">Tipo</th>
                  <th className="text-left py-2 px-2 font-black">Motivo</th>
                  <th className="text-center py-2 px-2 font-black">Status</th>
                </tr>
              </thead>
              <tbody>
                {failovers.slice(0, 50).map(f => {
                  const from = acquirers.find(a => a.id === f.from_acquirer_id);
                  const to = acquirers.find(a => a.id === f.to_acquirer_id);
                  return (
                    <tr key={f.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="py-2 px-2 text-muted-foreground text-[10px]">{ago(f.created_at)}</td>
                      <td className="py-2 px-2">
                        <span className="text-muted-foreground">{from?.name || "—"}</span>
                        <ArrowRightLeft className="inline h-2.5 w-2.5 mx-1.5 text-muted-foreground" />
                        <span className="font-bold">{to?.name || "—"}</span>
                      </td>
                      <td className="py-2 px-2 font-mono text-[10px]">{f.seller_id?.slice(0, 8) || "—"}</td>
                      <td className="py-2 px-2">
                        <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-black uppercase",
                          f.trigger_type === "auto" ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary")}>{f.trigger_type}</span>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground truncate max-w-[260px]">{f.reason}</td>
                      <td className="py-2 px-2 text-center">
                        {f.success ? <CheckCircle2 className="h-3.5 w-3.5 text-success inline" /> : <XCircle className="h-3.5 w-3.5 text-destructive inline" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      {/* ===== Detail Drawer ===== */}
      <Sheet open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {detailAcq && (
            <AcquirerDetail
              acq={detailAcq}
              stats={txStats[detailAcq.id]}
              healthEvents={healthEvents.filter(e => e.acquirer_id === detailAcq.id)}
              failovers={failovers.filter(f => f.from_acquirer_id === detailAcq.id || f.to_acquirer_id === detailAcq.id)}
              onEdit={() => { openEdit(detailAcq); setDetailId(null); }}
              onSetHealth={(s) => setHealth(detailAcq, s)}
              onToggle={(f) => toggleField(detailAcq, f)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ===== Form Dialog ===== */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-sm font-bold">{editingId ? "Editar" : "Nova"} Adquirente</DialogTitle></DialogHeader>
          <AcquirerForm form={form} setForm={setForm} onSave={handleSave} onCancel={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>

      {/* ===== Bulk Assignment ===== */}
      <Dialog open={showBulk} onOpenChange={setShowBulk}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-sm font-bold">Trocar Adquirente em Massa</DialogTitle></DialogHeader>
          <BulkAssign acquirers={acquirers} onDone={() => { setShowBulk(false); load(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============== Detail Drawer ==============
function AcquirerDetail({ acq, stats, healthEvents, failovers, onEdit, onSetHealth, onToggle }: {
  acq: Acquirer; stats?: any; healthEvents: HealthEvent[]; failovers: FailoverEvent[];
  onEdit: () => void; onSetHealth: (s: Health) => void; onToggle: (f: "is_active" | "seller_visible" | "allow_failover") => void;
}) {
  const cfg = HEALTH_CONFIG[acq.health_status];
  const [showSecrets, setShowSecrets] = useState(false);
  const s = stats || { sales: 0, volume: 0, refused: 0, refunded: 0, medpix: 0, sellers: 0 };
  const conv = s.sales + s.refused > 0 ? (s.sales / (s.sales + s.refused)) * 100 : Number(acq.conversion_rate);

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-3">
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center text-sm font-black border",
            acq.type === "black" ? "bg-foreground text-background border-foreground/20" : "bg-primary/10 text-primary border-primary/30")}>
            {acq.name[0]}
          </div>
          <div>
            <p className="font-black text-base">{acq.name}</p>
            <p className="text-[10px] font-mono text-muted-foreground">{acq.slug} · {acq.type.toUpperCase()}</p>
          </div>
        </SheetTitle>
      </SheetHeader>

      <div className="mt-5 space-y-5">
        {/* Health controls */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground mb-3">Status de Saúde</p>
          <div className={cn("flex items-center justify-between rounded-lg border p-3 mb-3", cfg.bg, cfg.border)}>
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", cfg.dot, acq.health_status === "online" && "animate-pulse")} />
              <span className={cn("text-sm font-black", cfg.color)}>{cfg.label}</span>
            </div>
            <div className="text-right text-[10px] text-muted-foreground">
              <p>Último check: {ago(acq.last_health_check_at)}</p>
              {acq.last_failure_at && <p>Última falha: {ago(acq.last_failure_at)}</p>}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(["online", "degraded", "offline", "maintenance"] as Health[]).map(h => (
              <Button key={h} size="sm" variant={acq.health_status === h ? "default" : "outline"}
                className="h-7 text-[10px]" onClick={() => onSetHealth(h)}>
                {HEALTH_CONFIG[h].label}
              </Button>
            ))}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Conv. Real" value={`${conv.toFixed(1)}%`} icon={TrendingUp} tone="success" />
          <Metric label="Latência" value={acq.last_latency_ms ? `${acq.last_latency_ms}ms` : "—"} icon={Zap} tone="primary" />
          <Metric label="Uptime" value={`${Number(acq.uptime_pct || 100).toFixed(1)}%`} icon={Activity} tone="info" />
          <Metric label="Sellers" value={String(s.sellers)} icon={Users} tone="primary" />
          <Metric label="Vendas 30d" value={String(s.sales)} icon={TrendingUp} tone="success" />
          <Metric label="Volume 30d" value={fmtBRL(s.volume)} icon={TrendingUp} tone="success" />
          <Metric label="Recusas" value={String(s.refused)} icon={XCircle} tone={s.refused > 0 ? "danger" : "neutral"} />
          <Metric label="Reembolsos" value={String(s.refunded)} icon={TrendingDown} tone={s.refunded > 0 ? "warning" : "neutral"} />
          <Metric label="MEDPIX" value={String(s.medpix)} icon={AlertTriangle} tone={s.medpix > 0 ? "warning" : "neutral"} />
        </div>

        {/* Switches */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <ToggleRow label="Ativa" desc="Aceita transações" checked={acq.is_active} onChange={() => onToggle("is_active")} />
          <ToggleRow label="Visível para sellers" desc="Sellers podem escolher esta adquirente" checked={acq.seller_visible} onChange={() => onToggle("seller_visible")} />
          <ToggleRow label="Permitir failover" desc="Pode ser destino de troca automática" checked={acq.allow_failover} onChange={() => onToggle("allow_failover")} />
        </div>

        {/* Limits & Methods */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground mb-3">Limites & Métodos</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <KV k="Mín. transação" v={fmtBRL(Number(acq.min_transaction_amount || 0))} />
            <KV k="Máx. transação" v={fmtBRL(Number(acq.max_transaction_amount || 0))} />
            <KV k="Taxa %" v={`${Number(acq.transaction_fee_percentage || 0).toFixed(2)}%`} />
            <KV k="Taxa fixa" v={fmtBRL(Number(acq.transaction_fee_fixed || 0))} />
            <KV k="Prioridade" v={String(acq.priority)} />
            <KV k="Ambiente" v={acq.api_environment.toUpperCase()} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {acq.supported_methods?.map(m => (
              <span key={m} className="px-2 py-0.5 rounded bg-muted/40 border border-border text-[10px] font-bold uppercase">{m}</span>
            ))}
          </div>
        </div>

        {/* API Keys masked */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
              <KeyRound className="h-3 w-3" /> Credenciais
            </p>
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setShowSecrets(s => !s)}>
              {showSecrets ? <><EyeOff className="h-3 w-3 mr-1" /> Ocultar</> : <><Eye className="h-3 w-3 mr-1" /> Revelar</>}
            </Button>
          </div>
          <KV k="Endpoint" v={acq.api_endpoint || "—"} mono />
          <KV k="API Key" v={showSecrets ? (acq.api_key_encrypted || "—") : mask(acq.api_key_encrypted)} mono copy />
          <KV k="API Secret" v={showSecrets ? (acq.api_secret_encrypted || "—") : mask(acq.api_secret_encrypted)} mono copy />
        </div>

        {/* Webhook */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
            <Webhook className="h-3 w-3" /> Webhook
          </p>
          <KV k="URL" v={acq.webhook_url || "—"} mono copy />
          <KV k="Secret" v={showSecrets ? (acq.webhook_secret || "—") : mask(acq.webhook_secret)} mono copy />
        </div>

        {/* Health Events */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-1.5">
            <History className="h-3 w-3" /> Histórico de Saúde ({healthEvents.length})
          </p>
          {healthEvents.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Nenhum evento.</p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {healthEvents.slice(0, 20).map(e => (
                <div key={e.id} className="flex items-start gap-2 text-[10px] py-1 border-b border-border/30 last:border-0">
                  <span className={cn("px-1.5 py-0.5 rounded font-black uppercase text-[8.5px]",
                    e.severity === "critical" ? "bg-destructive/15 text-destructive" :
                    e.severity === "warning" ? "bg-warning/15 text-warning" : "bg-muted/40 text-muted-foreground")}>
                    {e.event_type}
                  </span>
                  <span className="flex-1 text-foreground/80">{e.message}</span>
                  <span className="text-muted-foreground shrink-0">{ago(e.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Failovers */}
        {failovers.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground mb-3">
              Failovers Envolvendo Esta Adquirente ({failovers.length})
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto text-[10px]">
              {failovers.slice(0, 20).map(f => (
                <div key={f.id} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                  <span className="font-mono">{f.seller_id?.slice(0, 8) || "—"}</span>
                  <span className="text-muted-foreground">{f.reason}</span>
                  <span className="text-muted-foreground">{ago(f.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button size="sm" className="flex-1 h-8 text-xs" onClick={onEdit}>
            <Edit className="h-3 w-3 mr-1" /> Editar Adquirente
          </Button>
        </div>
      </div>
    </>
  );
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: string }) {
  const toneCls: Record<string, string> = {
    success: "text-success", primary: "text-primary", info: "text-info",
    warning: "text-warning", danger: "text-destructive", neutral: "text-muted-foreground",
  };
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className={cn("h-3 w-3", toneCls[tone])} />
        <span className="text-[8.5px] font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      </div>
      <p className={cn("text-sm font-black tabular-nums", toneCls[tone])}>{value}</p>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: any) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-bold text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function KV({ k, v, mono, copy }: { k: string; v: string; mono?: boolean; copy?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0 gap-3">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">{k}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={cn("text-[11px] truncate", mono && "font-mono")} title={v}>{v}</span>
        {copy && v !== "—" && (
          <button onClick={() => { navigator.clipboard.writeText(v); toast.success("Copiado"); }} className="text-muted-foreground hover:text-foreground shrink-0">
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============== Form ==============
function AcquirerForm({ form, setForm, onSave, onCancel }: any) {
  const toggleMethod = (m: string) => {
    const cur = form.supported_methods || [];
    setForm({ ...form, supported_methods: cur.includes(m) ? cur.filter((x: string) => x !== m) : [...cur, m] });
  };
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  const Input = ({ label, k, type = "text", placeholder = "", mono = false, hint = "" }: any) => (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <input type={type} value={form[k] ?? ""} onChange={e => set(k, type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
        placeholder={placeholder}
        className={cn("w-full h-9 px-3 bg-muted/30 border border-border rounded-lg text-xs text-foreground mt-1", mono && "font-mono")} />
      {hint && <p className="text-[9px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-4 mt-2">
      {/* Basic */}
      <div className="grid grid-cols-2 gap-3">
        <Input label="Nome" k="name" placeholder="PodPay" />
        <Input label="Slug" k="slug" placeholder="podpay" mono />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] text-muted-foreground">Tipo</Label>
          <div className="flex gap-2 mt-1">
            {(["black", "white"] as const).map(t => (
              <button key={t} type="button" onClick={() => set("type", t)}
                className={cn("flex-1 h-9 rounded-lg border text-xs font-bold uppercase",
                  form.type === t ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/30 border-border text-muted-foreground")}>{t}</button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Ambiente</Label>
          <div className="flex gap-2 mt-1">
            {(["production", "sandbox"] as const).map(e => (
              <button key={e} type="button" onClick={() => set("api_environment", e)}
                className={cn("flex-1 h-9 rounded-lg border text-xs font-bold uppercase",
                  form.api_environment === e ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/30 border-border text-muted-foreground")}>{e}</button>
            ))}
          </div>
        </div>
      </div>

      <Input label="Descrição" k="description" placeholder="Descrição da adquirente..." />

      {/* Limits & Fees */}
      <div className="rounded-xl border border-border bg-muted/10 p-3 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Taxas & Limites</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Taxa % por transação" k="transaction_fee_percentage" type="number" placeholder="2.99" />
          <Input label="Taxa fixa (R$)" k="transaction_fee_fixed" type="number" placeholder="0.50" />
          <Input label="Valor mínimo (R$)" k="min_transaction_amount" type="number" placeholder="1.00" />
          <Input label="Valor máximo (R$)" k="max_transaction_amount" type="number" placeholder="50000.00" />
          <Input label="Conversão %" k="conversion_rate" type="number" placeholder="95.5" hint="Exibida ao seller" />
          <Input label="Prioridade" k="priority" type="number" placeholder="0" hint="Maior = preferida no failover" />
        </div>
      </div>

      {/* Payment Methods */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Métodos Suportados</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {PAYMENT_METHODS.map(m => {
            const active = (form.supported_methods || []).includes(m.value);
            return (
              <button key={m.value} type="button" onClick={() => toggleMethod(m.value)}
                className={cn("px-3 h-8 rounded-lg border text-[11px] font-bold transition-all",
                  active ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/30 border-border text-muted-foreground")}>
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* API */}
      <div className="rounded-xl border border-border bg-muted/10 p-3 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
          <KeyRound className="h-3 w-3" /> Credenciais de API
        </p>
        <Input label="API Endpoint" k="api_endpoint" placeholder="https://api.podpay.com/v1" mono />
        <Input label="API Key" k="api_key_encrypted" placeholder="pk_live_..." mono />
        <Input label="API Secret" k="api_secret_encrypted" placeholder="sk_live_..." mono />
      </div>

      {/* Webhook */}
      <div className="rounded-xl border border-border bg-muted/10 p-3 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
          <Webhook className="h-3 w-3" /> Webhook
        </p>
        <Input label="Webhook URL" k="webhook_url" placeholder="https://api.exemplo.com/wh/podpay" mono />
        <Input label="Webhook Secret" k="webhook_secret" placeholder="whsec_..." mono />
      </div>

      {/* Switches */}
      <div className="rounded-xl border border-border bg-muted/10 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div><p className="text-xs font-bold">Visível para sellers</p><p className="text-[10px] text-muted-foreground">Sellers podem escolher esta adquirente</p></div>
          <Switch checked={!!form.seller_visible} onCheckedChange={v => set("seller_visible", v)} />
        </div>
        <div className="flex items-center justify-between">
          <div><p className="text-xs font-bold">Permitir failover</p><p className="text-[10px] text-muted-foreground">Pode receber trocas automáticas</p></div>
          <Switch checked={form.allow_failover !== false} onCheckedChange={v => set("allow_failover", v)} />
        </div>
      </div>

      <Input label="Notas internas" k="notes" placeholder="Observações para admin..." />

      <div className="flex gap-3 pt-2">
        <Button size="sm" variant="ghost" className="flex-1 text-xs" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" className="flex-1 text-xs" onClick={onSave}>
          <Save className="h-3 w-3 mr-1" /> Salvar
        </Button>
      </div>
    </div>
  );
}

// ============== Bulk Assignment ==============
function BulkAssign({ acquirers, onDone }: { acquirers: Acquirer[]; onDone: () => void }) {
  const [sellers, setSellers] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "white" | "black" | "none">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetAcq, setTargetAcq] = useState<string>("");
  const [reason, setReason] = useState("Troca administrativa em massa");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("user_id, full_name, email, nickname, acquirer_id, account_status").limit(2000)
      .then(({ data }) => setSellers(data || []));
  }, []);

  const filtered = useMemo(() => {
    return sellers.filter(s => {
      if (filter === "none" && s.acquirer_id) return false;
      if (filter !== "all" && filter !== "none") {
        const a = acquirers.find(x => x.id === s.acquirer_id);
        if (!a || a.type !== filter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!(s.full_name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.nickname?.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [sellers, filter, search, acquirers]);

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(s => s.user_id)));
  };

  const apply = async () => {
    if (!targetAcq) { toast.error("Selecione a adquirente destino"); return; }
    if (selected.size === 0) { toast.error("Selecione ao menos 1 seller"); return; }
    setRunning(true);
    const { data, error } = await (supabase as any).rpc("admin_bulk_assign_acquirer", {
      _seller_ids: Array.from(selected), _new_acquirer_id: targetAcq, _reason: reason,
    });
    setRunning(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    const successCount = (data || []).filter((r: any) => r.success).length;
    const failCount = (data || []).filter((r: any) => !r.success).length;
    toast.success(`${successCount} alterados${failCount ? `, ${failCount} falharam` : ""}`);
    await logAdminAction("bulk_assign_acquirer", "acquirer", targetAcq, { count: successCount, reason });
    onDone();
  };

  return (
    <div className="space-y-4 mt-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] text-muted-foreground">Filtrar por tipo atual</Label>
          <div className="flex gap-1 mt-1">
            {(["all", "white", "black", "none"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn("flex-1 h-8 rounded-lg border text-[10px] font-bold uppercase",
                  filter === f ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/30 border-border text-muted-foreground")}>
                {f === "none" ? "Sem Adq." : f === "all" ? "Todos" : f}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Buscar</Label>
          <div className="relative mt-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome, email, nickname"
              className="w-full h-8 pl-7 pr-2 bg-muted/30 border border-border rounded-lg text-xs" />
          </div>
        </div>
      </div>

      <div>
        <Label className="text-[10px] text-muted-foreground">Adquirente destino</Label>
        <select value={targetAcq} onChange={e => setTargetAcq(e.target.value)}
          className="w-full h-9 px-3 bg-muted/30 border border-border rounded-lg text-xs mt-1">
          <option value="">— Selecionar —</option>
          {acquirers.filter(a => a.is_active).map(a => (
            <option key={a.id} value={a.id}>{a.name} ({a.type.toUpperCase()})</option>
          ))}
        </select>
      </div>

      <div>
        <Label className="text-[10px] text-muted-foreground">Motivo</Label>
        <input value={reason} onChange={e => setReason(e.target.value)}
          className="w-full h-9 px-3 bg-muted/30 border border-border rounded-lg text-xs mt-1" />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
          <span className="text-[10px] font-black uppercase tracking-wider">
            {filtered.length} sellers · {selected.size} selecionados
          </span>
          <button onClick={toggleAll} className="text-[10px] font-bold text-primary hover:underline">
            {selected.size === filtered.length ? "Desmarcar todos" : "Marcar todos"}
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {filtered.map(s => {
            const acq = acquirers.find(a => a.id === s.acquirer_id);
            const checked = selected.has(s.user_id);
            return (
              <label key={s.user_id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/20 cursor-pointer border-b border-border/30 last:border-0">
                <input type="checkbox" checked={checked} onChange={() => {
                  const n = new Set(selected);
                  if (checked) n.delete(s.user_id); else n.add(s.user_id);
                  setSelected(n);
                }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{s.full_name || s.nickname || "—"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{s.email}</p>
                </div>
                <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-black uppercase",
                  !acq ? "bg-muted/40 text-muted-foreground" :
                  acq.type === "black" ? "bg-foreground/10 text-foreground" : "bg-primary/15 text-primary")}>
                  {acq?.name || "Nenhuma"}
                </span>
              </label>
            );
          })}
          {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Nenhum seller.</p>}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button size="sm" variant="ghost" className="flex-1 text-xs" onClick={onDone}>Cancelar</Button>
        <Button size="sm" className="flex-1 text-xs" onClick={apply} disabled={running || selected.size === 0 || !targetAcq}>
          <ArrowRightLeft className="h-3 w-3 mr-1" />
          {running ? "Aplicando..." : `Trocar ${selected.size} seller(s)`}
        </Button>
      </div>
    </div>
  );
}
