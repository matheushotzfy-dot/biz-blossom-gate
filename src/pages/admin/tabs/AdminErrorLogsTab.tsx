import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle, Search, CheckCircle2, Clock, Bug, RefreshCw, XCircle,
  Trash2, ShoppingCart, CreditCard, Webhook, KeyRound, Banknote, Server,
  Database, Code2, Eye, Copy, Layers, Filter, FileDown,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented, PremiumEmpty, premiumTable } from "./AdminPremium";
import { logAdminAction } from "@/lib/auditLog";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

interface ErrorLog {
  id: string;
  error_type: string;
  message: string;
  stack_trace: string | null;
  user_id: string | null;
  metadata: Record<string, unknown>;
  resolved: boolean;
  created_at: string;
}

interface Props {
  profiles: Tables<"profiles">[];
}

type Category = "platform" | "checkout" | "payment" | "webhook" | "auth" | "withdrawal" | "api" | "database" | "other";

const CATEGORIES: { value: Category | "all"; label: string; icon: LucideIcon; tone: "primary" | "warning" | "destructive" | "info" | "success" | "neutral" }[] = [
  { value: "all", label: "Todos", icon: Layers, tone: "neutral" },
  { value: "platform", label: "Plataforma", icon: Server, tone: "primary" },
  { value: "checkout", label: "Checkout", icon: ShoppingCart, tone: "info" },
  { value: "payment", label: "Pagamentos", icon: CreditCard, tone: "destructive" },
  { value: "webhook", label: "Webhooks", icon: Webhook, tone: "warning" },
  { value: "auth", label: "Auth", icon: KeyRound, tone: "primary" },
  { value: "withdrawal", label: "Saques", icon: Banknote, tone: "warning" },
  { value: "api", label: "API", icon: Code2, tone: "info" },
  { value: "database", label: "Database", icon: Database, tone: "destructive" },
  { value: "other", label: "Outros", icon: Bug, tone: "neutral" },
];

const CAT_META: Record<Category, { icon: LucideIcon; cls: string; label: string }> = {
  platform: { icon: Server, cls: "bg-primary/10 text-primary border-primary/30", label: "Plataforma" },
  checkout: { icon: ShoppingCart, cls: "bg-info/10 text-info border-info/30", label: "Checkout" },
  payment: { icon: CreditCard, cls: "bg-destructive/10 text-destructive border-destructive/30", label: "Pagamento" },
  webhook: { icon: Webhook, cls: "bg-warning/10 text-warning border-warning/30", label: "Webhook" },
  auth: { icon: KeyRound, cls: "bg-primary/10 text-primary border-primary/30", label: "Auth" },
  withdrawal: { icon: Banknote, cls: "bg-warning/10 text-warning border-warning/30", label: "Saque" },
  api: { icon: Code2, cls: "bg-info/10 text-info border-info/30", label: "API" },
  database: { icon: Database, cls: "bg-destructive/10 text-destructive border-destructive/30", label: "Database" },
  other: { icon: Bug, cls: "bg-muted/40 text-muted-foreground border-border", label: "Outro" },
};

function deriveCategory(e: ErrorLog): Category {
  const t = (e.error_type || "").toLowerCase();
  const m = (e.message || "").toLowerCase();
  const meta = e.metadata || {};
  const route = String(meta["route"] || meta["path"] || meta["url"] || "").toLowerCase();
  const source = String(meta["source"] || meta["component"] || "").toLowerCase();
  const hay = `${t} ${m} ${route} ${source}`;

  if (/(webhook|hmac|signature)/.test(hay)) return "webhook";
  if (/(checkout|cart|order_bump|pix_qrcode|payment_intent|product_id)/.test(hay)) return "checkout";
  if (/(payment|charge|refund|chargeback|acquirer|podpay|transaction)/.test(hay)) return "payment";
  if (/(withdraw|saque|payout|pix_key)/.test(hay)) return "withdrawal";
  if (/(auth|login|signup|signin|jwt|session|token|otp|2fa)/.test(hay)) return "auth";
  if (/(api[_-]?key|rate[_-]?limit|api\/v1|\/api\/|sk_live|pk_live)/.test(hay)) return "api";
  if (/(database|postgres|pg|sql|rls|policy|relation|column|constraint)/.test(hay)) return "database";
  if (t === "client_error" || /(network|fetch|cors|render|hydration|chunk|vite|react|typeerror|undefined is not)/.test(hay)) return "platform";
  return "other";
}

const fmtDate = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const copyTxt = (v: string) => { navigator.clipboard.writeText(v); toast.success("Copiado"); };

export default function AdminErrorLogsTab({ profiles }: Props) {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [search, setSearch] = useState("");
  const [filterResolved, setFilterResolved] = useState<"all" | "open" | "resolved">("open");
  const [category, setCategory] = useState<Category | "all">("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "clear_resolved" | "clear_all" | "resolve_all">(null);
  const [detail, setDetail] = useState<ErrorLog | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("error_logs").select("*").order("created_at", { ascending: false }).limit(1000);
    if (error) toast.error("Erro ao carregar: " + error.message);
    if (data) setErrors(data as ErrorLog[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const enriched = useMemo(() => errors.map(e => ({ ...e, _cat: deriveCategory(e) })), [errors]);

  const toggleResolved = async (id: string, resolved: boolean) => {
    const { error } = await supabase.from("error_logs").update({ resolved }).eq("id", id);
    if (error) { toast.error("Erro"); return; }
    setErrors(prev => prev.map(e => e.id === id ? { ...e, resolved } : e));
  };

  const resolveAll = async () => {
    setBusy(true);
    const openIds = errors.filter(e => !e.resolved).map(e => e.id);
    if (openIds.length === 0) { setBusy(false); setConfirmAction(null); return; }
    const { error } = await supabase.from("error_logs").update({ resolved: true } as any).in("id", openIds);
    setBusy(false); setConfirmAction(null);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(`${openIds.length} erro(s) resolvido(s)`);
    await logAdminAction("error_logs_resolve_all", "error_logs", null, { count: openIds.length });
    load();
  };

  const clearResolved = async () => {
    setBusy(true);
    const ids = errors.filter(e => e.resolved).map(e => e.id);
    if (ids.length === 0) { setBusy(false); setConfirmAction(null); return; }
    const { error } = await supabase.from("error_logs").delete().in("id", ids);
    setBusy(false); setConfirmAction(null);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(`${ids.length} resolvido(s) apagado(s)`);
    await logAdminAction("error_logs_clear_resolved", "error_logs", null, { count: ids.length });
    load();
  };

  const clearAll = async () => {
    setBusy(true);
    // delete-all needs a where clause
    const { error } = await supabase.from("error_logs").delete().gte("created_at", "1970-01-01");
    setBusy(false); setConfirmAction(null);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Todos os logs foram apagados");
    await logAdminAction("error_logs_clear_all", "error_logs", null, { count: errors.length });
    load();
  };

  const getSeller = (userId: string | null) => {
    if (!userId) return { name: "Sistema", email: "—" };
    const p = profiles.find(pp => pp.user_id === userId);
    return { name: p?.full_name || userId.slice(0, 8), email: p?.email || userId };
  };

  const filtered = enriched.filter(e => {
    if (filterResolved === "open" && e.resolved) return false;
    if (filterResolved === "resolved" && !e.resolved) return false;
    if (category !== "all" && e._cat !== category) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    const seller = getSeller(e.user_id);
    return e.message.toLowerCase().includes(s)
      || e.error_type.toLowerCase().includes(s)
      || seller.name.toLowerCase().includes(s)
      || seller.email.toLowerCase().includes(s)
      || (e.stack_trace || "").toLowerCase().includes(s);
  });

  const openCount = errors.filter(e => !e.resolved).length;
  const resolvedCount = errors.filter(e => e.resolved).length;
  const todayCount = errors.filter(e => new Date(e.created_at).toDateString() === new Date().toDateString()).length;
  const last1h = errors.filter(e => Date.now() - new Date(e.created_at).getTime() < 3600 * 1000).length;
  const uniqueUsers = new Set(errors.filter(e => e.user_id).map(e => e.user_id)).size;

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    enriched.forEach(e => { if (!e.resolved) counts[e._cat] = (counts[e._cat] || 0) + 1; });
    return counts;
  }, [enriched]);

  const exportCsv = () => {
    const rows = [["id", "criado_em", "categoria", "tipo", "mensagem", "user_id", "seller", "resolvido", "metadata"]];
    filtered.forEach(e => {
      const seller = getSeller(e.user_id);
      rows.push([e.id, e.created_at, e._cat, e.error_type, e.message, e.user_id || "", seller.name, e.resolved ? "1" : "0", JSON.stringify(e.metadata || {})]);
    });
    const csv = rows.map(r => r.map(c => `"${(c || "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `error-logs-${Date.now()}.csv`; a.click();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <FinanceiroHero
        eyebrow="Saúde do Sistema · Observability"
        title="Logs de Erros"
        subtitle="Stack traces, metadata e classificação por domínio — plataforma, checkout, pagamentos, webhooks, auth, saques."
        status={openCount > 0
          ? { tone: "destructive", label: `${openCount} aberto(s)`, pulse: true }
          : { tone: "success", label: "Tudo limpo" }}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-9 text-[11px] gap-1.5 rounded-lg" onClick={exportCsv}>
              <FileDown className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button size="sm" variant="outline" className="h-9 text-[11px] gap-1.5 rounded-lg" onClick={load}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Atualizar
            </Button>
            <Button size="sm" variant="outline" className="h-9 text-[11px] gap-1.5 rounded-lg" disabled={openCount === 0} onClick={() => setConfirmAction("resolve_all")}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Resolver tudo
            </Button>
            <Button size="sm" variant="outline" className="h-9 text-[11px] gap-1.5 rounded-lg text-warning hover:text-warning" disabled={resolvedCount === 0} onClick={() => setConfirmAction("clear_resolved")}>
              <Trash2 className="h-3.5 w-3.5" /> Limpar resolvidos
            </Button>
            <Button size="sm" variant="outline" className="h-9 text-[11px] gap-1.5 rounded-lg text-destructive hover:text-destructive border-destructive/30" disabled={errors.length === 0} onClick={() => setConfirmAction("clear_all")}>
              <Trash2 className="h-3.5 w-3.5" /> Zerar tudo
            </Button>
          </div>
        }
      />

      <PremiumMetricGrid cols={5}>
        <PremiumMetric icon={AlertTriangle} label="Abertos" value={String(openCount)} sub="precisam atenção" tone={openCount > 0 ? "destructive" : "success"} />
        <PremiumMetric icon={Clock} label="Última hora" value={String(last1h)} sub={`${todayCount} hoje`} tone={last1h > 5 ? "warning" : "neutral"} />
        <PremiumMetric icon={Bug} label="Total registrado" value={String(errors.length)} sub={`${resolvedCount} resolvidos`} tone="neutral" />
        <PremiumMetric icon={KeyRound} label="Contas afetadas" value={String(uniqueUsers)} sub="usuários únicos" tone="info" />
        <PremiumMetric icon={CreditCard} label="Crítico (pag.+wh)" value={String((catCounts.payment || 0) + (catCounts.webhook || 0) + (catCounts.checkout || 0))} sub="checkout/pag/webhook" tone={(catCounts.payment || 0) + (catCounts.webhook || 0) > 0 ? "destructive" : "neutral"} />
      </PremiumMetricGrid>

      {/* Category segmented */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map(c => {
          const count = c.value === "all" ? openCount : (catCounts[c.value] || 0);
          const active = category === c.value;
          const Icon = c.icon;
          return (
            <button key={c.value} onClick={() => setCategory(c.value)}
              className={cn("inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-[11px] font-black uppercase tracking-wider transition-colors",
                active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/30")}>
              <Icon className="h-3.5 w-3.5" />
              {c.label}
              <span className={cn("ml-1 px-1.5 py-0.5 rounded text-[9px] tabular-nums",
                active ? "bg-primary-foreground/20" : "bg-muted/50 text-muted-foreground")}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input placeholder="Buscar mensagem, stack, seller, email..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30" />
        </div>
        <PremiumSegmented<"all" | "open" | "resolved">
          value={filterResolved}
          onChange={setFilterResolved}
          options={[
            { value: "open", label: `Abertos · ${openCount}` },
            { value: "resolved", label: `Resolvidos · ${resolvedCount}` },
            { value: "all", label: `Todos · ${errors.length}` },
          ]}
        />
      </div>

      <PremiumPanel icon={Filter} eyebrow="Observabilidade" title={`Log de Erros (${filtered.length})`}>
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-8">Carregando…</p>
        ) : filtered.length === 0 ? (
          <PremiumEmpty icon={Bug} title={errors.length === 0 ? "Nenhum erro registrado" : "Nenhum erro encontrado"} subtitle={errors.length === 0 ? "Sua plataforma está limpa." : "Ajuste os filtros para visualizar mais."} />
        ) : (
          <div className={premiumTable.wrapper}>
            <table className={premiumTable.table}>
              <thead>
                <tr className={premiumTable.headRow}>
                  <th className={premiumTable.th}>Quando</th>
                  <th className={premiumTable.th}>Categoria</th>
                  <th className={premiumTable.th}>Mensagem</th>
                  <th className={premiumTable.th}>Conta</th>
                  <th className={premiumTable.th}>Origem</th>
                  <th className={premiumTable.th}>Status</th>
                  <th className={cn(premiumTable.th, "text-right")}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map(err => {
                  const meta = CAT_META[err._cat];
                  const Icon = meta.icon;
                  const seller = getSeller(err.user_id);
                  const route = (err.metadata as any)?.route || (err.metadata as any)?.path || (err.metadata as any)?.url || (err.metadata as any)?.source || "—";
                  return (
                    <tr key={err.id} className={cn(premiumTable.row, !err.resolved && "bg-destructive/[0.03]")}>
                      <td className={cn(premiumTable.td, "text-[10px] text-muted-foreground tabular-nums whitespace-nowrap")}>{fmtDate(err.created_at)}</td>
                      <td className={premiumTable.td}>
                        <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider", meta.cls)}>
                          <Icon className="h-3 w-3" /> {meta.label}
                        </span>
                        <p className="text-[9px] font-mono text-muted-foreground/70 mt-0.5 truncate max-w-[140px]" title={err.error_type}>{err.error_type}</p>
                      </td>
                      <td className={cn(premiumTable.td, "max-w-[360px]")}>
                        <p className="text-xs text-foreground/90 truncate" title={err.message}>{err.message}</p>
                        {err.stack_trace && (
                          <p className="text-[10px] text-muted-foreground/70 font-mono truncate" title={err.stack_trace}>{err.stack_trace.split("\n")[0]}</p>
                        )}
                      </td>
                      <td className={cn(premiumTable.td, "text-[11px]")}>
                        <p className="font-bold truncate max-w-[160px]">{seller.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">{seller.email}</p>
                      </td>
                      <td className={cn(premiumTable.td, "font-mono text-[10px] text-muted-foreground truncate max-w-[180px]")} title={String(route)}>{String(route)}</td>
                      <td className={premiumTable.td}>
                        {err.resolved ? (
                          <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-success/10 text-success border border-success/30 uppercase">Resolvido</span>
                        ) : (
                          <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-destructive/10 text-destructive border border-destructive/30 uppercase">Aberto</span>
                        )}
                      </td>
                      <td className={cn(premiumTable.td, "text-right whitespace-nowrap")}>
                        <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1" onClick={() => setDetail(err)}>
                          <Eye className="h-3 w-3" /> Detalhes
                        </Button>
                        {err.resolved ? (
                          <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1" onClick={() => toggleResolved(err.id, false)}>
                            <XCircle className="h-3 w-3" /> Reabrir
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-success" onClick={() => toggleResolved(err.id, true)}>
                            <CheckCircle2 className="h-3 w-3" /> Resolver
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length > 500 && <p className="text-[10px] text-muted-foreground text-center py-3">Exibindo primeiros 500 — refine o filtro ou exporte CSV.</p>}
          </div>
        )}
      </PremiumPanel>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {detail && (() => {
            const meta = CAT_META[deriveCategory(detail)];
            const Icon = meta.icon;
            const seller = getSeller(detail.user_id);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-sm">
                    <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider", meta.cls)}>
                      <Icon className="h-3 w-3" /> {meta.label}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">{detail.error_type}</span>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <KV k="ID" v={detail.id} copy />
                    <KV k="Quando" v={fmtDate(detail.created_at)} />
                    <KV k="Seller" v={`${seller.name} (${seller.email})`} />
                    <KV k="Status" v={detail.resolved ? "Resolvido" : "Aberto"} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">Mensagem</p>
                    <pre className="text-[11px] bg-muted/30 border border-border rounded-lg p-3 whitespace-pre-wrap break-words text-foreground/90">{detail.message}</pre>
                  </div>
                  {detail.stack_trace && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Stack Trace</p>
                        <button onClick={() => copyTxt(detail.stack_trace || "")} className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                          <Copy className="h-3 w-3" /> Copiar
                        </button>
                      </div>
                      <pre className="text-[10px] font-mono bg-muted/30 border border-border rounded-lg p-3 whitespace-pre-wrap break-words text-foreground/80 max-h-72 overflow-y-auto">{detail.stack_trace}</pre>
                    </div>
                  )}
                  {detail.metadata && Object.keys(detail.metadata).length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Metadata</p>
                        <button onClick={() => copyTxt(JSON.stringify(detail.metadata, null, 2))} className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                          <Copy className="h-3 w-3" /> Copiar JSON
                        </button>
                      </div>
                      <pre className="text-[10px] font-mono bg-muted/30 border border-border rounded-lg p-3 whitespace-pre-wrap break-words text-foreground/80 max-h-60 overflow-y-auto">{JSON.stringify(detail.metadata, null, 2)}</pre>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  {detail.resolved ? (
                    <Button size="sm" variant="outline" onClick={() => { toggleResolved(detail.id, false); setDetail(null); }}>
                      <XCircle className="h-3 w-3 mr-1" /> Reabrir
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => { toggleResolved(detail.id, true); setDetail(null); }}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Marcar como resolvido
                    </Button>
                  )}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Confirm dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {confirmAction === "resolve_all" && "Resolver todos os erros abertos?"}
              {confirmAction === "clear_resolved" && "Apagar logs resolvidos?"}
              {confirmAction === "clear_all" && "Zerar TODOS os logs?"}
            </DialogTitle>
            <DialogDescription className="text-[11px]">
              {confirmAction === "resolve_all" && `${openCount} erro(s) serão marcados como resolvidos.`}
              {confirmAction === "clear_resolved" && `${resolvedCount} log(s) resolvidos serão removidos permanentemente.`}
              {confirmAction === "clear_all" && `Todos os ${errors.length} logs serão removidos permanentemente. Esta ação não pode ser desfeita.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => setConfirmAction(null)} disabled={busy}>Cancelar</Button>
            <Button size="sm" variant={confirmAction === "clear_all" ? "destructive" : "default"} disabled={busy}
              onClick={() => {
                if (confirmAction === "resolve_all") resolveAll();
                if (confirmAction === "clear_resolved") clearResolved();
                if (confirmAction === "clear_all") clearAll();
              }}>
              {busy ? "Processando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KV({ k, v, copy }: { k: string; v: string; copy?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-2.5">
      <p className="text-[9px] uppercase font-black tracking-wider text-muted-foreground">{k}</p>
      <div className="flex items-center gap-1.5 mt-0.5">
        <p className="text-[11px] font-mono truncate" title={v}>{v}</p>
        {copy && (
          <button onClick={() => copyTxt(v)} className="text-muted-foreground hover:text-foreground shrink-0">
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
