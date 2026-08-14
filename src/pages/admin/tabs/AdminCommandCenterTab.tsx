import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownToLine, ArrowRight, Banknote, Bug, CheckCircle2,
  Clock, CreditCard, Gauge, LifeBuoy, RefreshCw, Search, ShieldAlert, ShieldCheck,
  UserCheck, Webhook, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";

/**
 * Centro de Comando — visão operacional única do admin.
 *
 * Agrega, em tempo quase real, as filas que exigem ação humana, a saúde da
 * infraestrutura de pagamento/webhooks e alertas de anomalia calculados a
 * partir das transações já carregadas pelo dashboard (sem round-trip extra).
 */

interface Props {
  transactions: Tables<"transactions">[];
  profiles: Tables<"profiles">[];
  withdrawals: Tables<"withdrawals">[];
  fmtCurrency: (v: number) => string;
  onNavigate: (tabId: string) => void;
}

type QueueKey =
  | "withdrawals" | "disputes" | "support" | "kyc" | "errors" | "webhooks";

interface QueueItem {
  key: QueueKey;
  label: string;
  hint: string;
  icon: LucideIcon;
  count: number;
  tab: string;
  tone: "neutral" | "warning" | "danger";
}

interface AcquirerHealth {
  id: string;
  name: string;
  is_active: boolean;
  health_status: string;
  priority: number;
  conversion_rate: number;
  last_latency_ms: number | null;
  last_failure_at: string | null;
}

interface ErrorRow {
  id: string;
  error_type: string;
  message: string;
  created_at: string;
}

interface FraudRow {
  id: string;
  block_type: string;
  block_reason: string;
  matched_value: string | null;
  created_at: string;
}

interface SearchHit {
  id: string;
  amount: number;
  status: string;
  customer_email: string | null;
  customer_name: string | null;
  created_at: string;
}

/* ── Primitivos visuais (planos, sem sombra/gradiente) ── */
function Panel({ title, icon: Icon, action, children }: {
  title: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[14px] border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />}
          <h3 className="truncate text-[13px] font-semibold tracking-tight text-foreground">{title}</h3>
        </div>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="py-6 text-center text-[12px] text-muted-foreground">{label}</p>;
}

const TONE_TEXT: Record<"neutral" | "warning" | "danger" | "success", string> = {
  neutral: "text-foreground",
  warning: "text-warning",
  danger: "text-destructive",
  success: "text-success",
};

export default function AdminCommandCenterTab({
  transactions, profiles, withdrawals, fmtCurrency, onNavigate,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [disputesOpen, setDisputesOpen] = useState(0);
  const [ticketsOpen, setTicketsOpen] = useState(0);
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [fraud, setFraud] = useState<FraudRow[]>([]);
  const [acquirers, setAcquirers] = useState<AcquirerHealth[]>([]);
  const [webhookStats, setWebhookStats] = useState({ delivered: 0, failed: 0, pending: 0 });
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [dRes, tRes, eRes, fRes, aRes, wRes] = await Promise.all([
        supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).neq("status", "closed"),
        supabase.from("error_logs").select("id, error_type, message, created_at")
          .eq("resolved", false).order("created_at", { ascending: false }).limit(6),
        supabase.from("fraud_logs").select("id, block_type, block_reason, matched_value, created_at")
          .order("created_at", { ascending: false }).limit(6),
        supabase.rpc("list_visible_acquirers"),
        supabase.from("webhook_deliveries").select("status").gte("created_at", since).limit(2000),
      ]);

      setDisputesOpen(dRes.count ?? 0);
      setTicketsOpen(tRes.count ?? 0);
      setErrors((eRes.data ?? []) as ErrorRow[]);
      setFraud((fRes.data ?? []) as FraudRow[]);
      setAcquirers((aRes.data ?? []) as unknown as AcquirerHealth[]);

      const rows = (wRes.data ?? []) as { status: string }[];
      setWebhookStats({
        delivered: rows.filter(r => r.status === "delivered").length,
        failed: rows.filter(r => r.status === "failed").length,
        pending: rows.filter(r => r.status === "pending" || r.status === "retrying").length,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "desconhecido";
      toast.error("Erro ao carregar centro de comando: " + msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* ── Métricas derivadas (sem useEffect) ── */
  const pendingWithdrawals = useMemo(
    () => withdrawals.filter(w => w.status === "pending"),
    [withdrawals],
  );

  const oldestWithdrawalHours = useMemo(() => {
    if (pendingWithdrawals.length === 0) return 0;
    const oldest = Math.min(...pendingWithdrawals.map(w => +new Date(w.created_at)));
    return Math.max(0, (Date.now() - oldest) / 3_600_000);
  }, [pendingWithdrawals]);

  const pendingKyc = useMemo(
    () => profiles.filter(p => p.account_status === "pending").length,
    [profiles],
  );

  const stats = useMemo(() => {
    const total = transactions.length;
    const approved = transactions.filter(t => t.status === "approved");
    const refunded = transactions.filter(t => t.status === "refunded").length;
    const chargeback = transactions.filter(t => t.status === "chargeback").length;
    const tpv = approved.reduce((s, t) => s + Number(t.amount || 0), 0);
    return {
      total,
      approvedCount: approved.length,
      approvalRate: total > 0 ? (approved.length / total) * 100 : 0,
      refundRate: approved.length > 0 ? (refunded / approved.length) * 100 : 0,
      chargebackRate: approved.length > 0 ? (chargeback / approved.length) * 100 : 0,
      tpv,
      ticket: approved.length > 0 ? tpv / approved.length : 0,
      pendingVolume: pendingWithdrawals.reduce((s, w) => s + Number(w.amount || 0), 0),
    };
  }, [transactions, pendingWithdrawals]);

  const alerts = useMemo(() => {
    const list: { id: string; label: string; detail: string; tone: "warning" | "danger" }[] = [];
    if (stats.total >= 20 && stats.approvalRate < 55) {
      list.push({ id: "approval", tone: "danger", label: "Conversão abaixo do esperado", detail: `${stats.approvalRate.toFixed(1)}% de aprovação no período` });
    }
    if (stats.chargebackRate > 1) {
      list.push({ id: "cb", tone: "danger", label: "Chargeback acima de 1%", detail: `${stats.chargebackRate.toFixed(2)}% das vendas aprovadas` });
    }
    if (stats.refundRate > 5) {
      list.push({ id: "refund", tone: "warning", label: "Reembolsos elevados", detail: `${stats.refundRate.toFixed(2)}% das vendas aprovadas` });
    }
    if (oldestWithdrawalHours > 24) {
      list.push({ id: "wd", tone: "warning", label: "Saque parado há mais de 24h", detail: `Mais antigo: ${oldestWithdrawalHours.toFixed(0)}h na fila` });
    }
    if (webhookStats.failed > 0) {
      list.push({ id: "wh", tone: "warning", label: "Webhooks falhando", detail: `${webhookStats.failed} entregas com falha nas últimas 24h` });
    }
    const degraded = acquirers.filter(a => a.is_active && a.health_status !== "healthy");
    if (degraded.length > 0) {
      list.push({ id: "acq", tone: "danger", label: "Adquirente degradada", detail: degraded.map(a => a.name).join(", ") });
    }
    if (errors.length >= 5) {
      list.push({ id: "err", tone: "warning", label: "Erros não resolvidos acumulando", detail: `${errors.length}+ erros abertos no log` });
    }
    return list;
  }, [stats, oldestWithdrawalHours, webhookStats.failed, acquirers, errors.length]);

  const queues: QueueItem[] = useMemo(() => [
    { key: "withdrawals", label: "Saques pendentes", hint: fmtCurrency(stats.pendingVolume), icon: ArrowDownToLine, count: pendingWithdrawals.length, tab: "withdrawals", tone: pendingWithdrawals.length > 0 ? "warning" : "neutral" },
    { key: "kyc", label: "Contas aguardando aprovação", hint: "Verificação de cadastro", icon: UserCheck, count: pendingKyc, tab: "sellers", tone: pendingKyc > 0 ? "warning" : "neutral" },
    { key: "disputes", label: "Disputas abertas", hint: "Medpix / chargeback", icon: ShieldAlert, count: disputesOpen, tab: "medpix", tone: disputesOpen > 0 ? "danger" : "neutral" },
    { key: "support", label: "Tickets em aberto", hint: "Atendimento ao seller", icon: LifeBuoy, count: ticketsOpen, tab: "support", tone: ticketsOpen > 0 ? "warning" : "neutral" },
    { key: "errors", label: "Erros não resolvidos", hint: "Log de aplicação", icon: Bug, count: errors.length, tab: "error-logs", tone: errors.length > 0 ? "warning" : "neutral" },
    { key: "webhooks", label: "Webhooks com falha (24h)", hint: "Entregas para sellers", icon: Webhook, count: webhookStats.failed, tab: "settings", tone: webhookStats.failed > 0 ? "danger" : "neutral" },
  ], [pendingWithdrawals.length, stats.pendingVolume, pendingKyc, disputesOpen, ticketsOpen, errors.length, webhookStats.failed, fmtCurrency]);

  const riskySellers = useMemo(() => {
    const map = new Map<string, { name: string; approved: number; bad: number; volume: number }>();
    transactions.forEach(t => {
      const uid = t.user_id;
      if (!uid) return;
      const entry = map.get(uid) ?? {
        name: profiles.find(p => p.user_id === uid)?.full_name || uid.slice(0, 8),
        approved: 0, bad: 0, volume: 0,
      };
      if (t.status === "approved") { entry.approved += 1; entry.volume += Number(t.amount || 0); }
      if (t.status === "refunded" || t.status === "chargeback") entry.bad += 1;
      map.set(uid, entry);
    });
    return Array.from(map.values())
      .filter(s => s.approved >= 5 && s.bad > 0)
      .map(s => ({ ...s, rate: (s.bad / s.approved) * 100 }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);
  }, [transactions, profiles]);

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 3) { toast.error("Digite ao menos 3 caracteres"); return; }
    setSearching(true);
    try {
      const isUuid = /^[0-9a-f-]{20,}$/i.test(q);
      const filter = isUuid
        ? `id.eq.${q}`
        : `customer_email.ilike.%${q}%,customer_name.ilike.%${q}%,customer_document.ilike.%${q}%`;
      const { data, error } = await supabase
        .from("transactions")
        .select("id, amount, status, customer_email, customer_name, created_at")
        .or(filter)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      setHits((data ?? []) as SearchHit[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "desconhecido";
      toast.error("Busca falhou: " + msg);
    } finally {
      setSearching(false);
    }
  };

  const resolveError = async (id: string) => {
    const { error } = await supabase.from("error_logs").update({ resolved: true }).eq("id", id);
    if (error) { toast.error("Não foi possível resolver"); return; }
    setErrors(prev => prev.filter(e => e.id !== id));
    toast.success("Erro marcado como resolvido");
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <FinanceiroHero
        eyebrow="Admin · Operações"
        title="Centro de Comando"
        subtitle="Filas pendentes, saúde da infraestrutura e alertas em uma única tela."
        status={{
          tone: alerts.length > 0 ? "warning" : "success",
          label: alerts.length > 0 ? `${alerts.length} alerta(s) ativo(s)` : "Tudo operacional",
          pulse: alerts.length > 0,
        }}
      />

      {/* Resumo do período */}
      <div className="grid gap-px overflow-hidden rounded-[14px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "TPV aprovado", value: fmtCurrency(stats.tpv), sub: `${stats.approvedCount} vendas` },
          { label: "Taxa de aprovação", value: `${stats.approvalRate.toFixed(1)}%`, sub: `${stats.total} tentativas` },
          { label: "Ticket médio", value: fmtCurrency(stats.ticket), sub: "por venda aprovada" },
          { label: "Fila de saques", value: fmtCurrency(stats.pendingVolume), sub: `${pendingWithdrawals.length} pedidos` },
        ].map(m => (
          <div key={m.label} className="bg-card px-4 py-3.5">
            <p className="text-[11.5px] text-muted-foreground">{m.label}</p>
            <p className="mt-1.5 text-[22px] font-semibold leading-none tabular-nums tracking-tight text-foreground">{m.value}</p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Alertas */}
      <Panel
        title="Alertas de anomalia"
        icon={AlertTriangle}
        action={
          <button onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground hover:text-foreground">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Atualizar
          </button>
        }
      >
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-[12.5px] text-success">
            <CheckCircle2 className="h-4 w-4" /> Nenhuma anomalia detectada no período selecionado.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {alerts.map(a => (
              <li key={a.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", a.tone === "danger" ? "bg-destructive" : "bg-warning")} />
                <div className="min-w-0">
                  <p className={cn("text-[12.5px] font-medium", TONE_TEXT[a.tone])}>{a.label}</p>
                  <p className="text-[11.5px] text-muted-foreground">{a.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Filas operacionais */}
      <Panel title="Filas que exigem ação" icon={Activity}>
        <div className="grid gap-px overflow-hidden rounded-[12px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {queues.map(q => (
            <button
              key={q.key}
              onClick={() => onNavigate(q.tab)}
              className="group flex items-center gap-3 bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40"
            >
              <q.icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-foreground">{q.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">{q.hint}</p>
              </div>
              <span className={cn("text-[18px] font-semibold tabular-nums", q.count > 0 ? TONE_TEXT[q.tone] : "text-muted-foreground")}>
                {q.count}
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Saúde das adquirentes */}
        <Panel title="Saúde das adquirentes" icon={Banknote}
          action={
            <button onClick={() => onNavigate("acquirers")} className="text-[11.5px] font-medium text-muted-foreground hover:text-foreground">Gerenciar</button>
          }>
          {acquirers.length === 0 ? <Empty label="Nenhuma adquirente configurada." /> : (
            <ul className="divide-y divide-border">
              {acquirers.map(a => (
                <li key={a.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full",
                    !a.is_active ? "bg-muted-foreground" : a.health_status === "healthy" ? "bg-success" : "bg-destructive")} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-foreground">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {a.is_active ? `Prioridade ${a.priority}` : "Desativada"}
                      {a.last_latency_ms != null && ` · ${a.last_latency_ms}ms`}
                    </p>
                  </div>
                  <span className="text-[12px] font-semibold tabular-nums text-foreground">
                    {Number(a.conversion_rate ?? 0).toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Webhooks */}
        <Panel title="Entregas de webhook (24h)" icon={Webhook}>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[12px] border border-border bg-border">
            {[
              { label: "Entregues", value: webhookStats.delivered, tone: "success" as const },
              { label: "Na fila", value: webhookStats.pending, tone: "neutral" as const },
              { label: "Falhas", value: webhookStats.failed, tone: "danger" as const },
            ].map(w => (
              <div key={w.label} className="bg-card px-3 py-3">
                <p className="text-[11px] text-muted-foreground">{w.label}</p>
                <p className={cn("mt-1 text-[20px] font-semibold tabular-nums leading-none", w.value > 0 ? TONE_TEXT[w.tone] : "text-muted-foreground")}>
                  {w.value}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" />
            Taxa de sucesso:{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {(() => {
                const tot = webhookStats.delivered + webhookStats.failed;
                return tot > 0 ? `${((webhookStats.delivered / tot) * 100).toFixed(1)}%` : "—";
              })()}
            </span>
          </p>
        </Panel>

        {/* Sellers em risco */}
        <Panel title="Sellers em risco" icon={ShieldCheck}
          action={<button onClick={() => onNavigate("sellers")} className="text-[11.5px] font-medium text-muted-foreground hover:text-foreground">Ver sellers</button>}>
          {riskySellers.length === 0 ? <Empty label="Nenhum seller com reembolso/chargeback relevante." /> : (
            <ul className="divide-y divide-border">
              {riskySellers.map(s => (
                <li key={s.name} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-foreground">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground">{s.approved} aprovadas · {fmtCurrency(s.volume)}</p>
                  </div>
                  <span className={cn("text-[12.5px] font-semibold tabular-nums", s.rate > 5 ? "text-destructive" : "text-warning")}>
                    {s.rate.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Bloqueios anti-fraude */}
        <Panel title="Últimos bloqueios anti-fraude" icon={ShieldAlert}
          action={<button onClick={() => onNavigate("risk-compliance")} className="text-[11.5px] font-medium text-muted-foreground hover:text-foreground">Anti-fraude</button>}>
          {fraud.length === 0 ? <Empty label="Nenhum bloqueio registrado." /> : (
            <ul className="divide-y divide-border">
              {fraud.map(f => (
                <li key={f.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-[12.5px] font-medium text-foreground">{f.block_type}</p>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {new Date(f.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="truncate text-[11.5px] text-muted-foreground">
                    {f.block_reason}{f.matched_value ? ` · ${f.matched_value}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Erros abertos */}
      <Panel title="Erros de aplicação em aberto" icon={Bug}
        action={<button onClick={() => onNavigate("error-logs")} className="text-[11.5px] font-medium text-muted-foreground hover:text-foreground">Ver todos</button>}>
        {errors.length === 0 ? <Empty label="Nenhum erro pendente." /> : (
          <ul className="divide-y divide-border">
            {errors.map(e => (
              <li key={e.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-foreground">{e.error_type}</p>
                  <p className="truncate text-[11.5px] text-muted-foreground">{e.message}</p>
                </div>
                <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">
                  <Clock className="mr-1 inline h-3 w-3" />
                  {new Date(e.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
                <button
                  onClick={() => void resolveError(e.id)}
                  className="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Resolver
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Busca global de transações */}
      <Panel title="Busca rápida de transação" icon={Search}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void runSearch(); }}
            placeholder="ID da transação, e-mail, nome ou documento do cliente"
            className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-[12.5px] text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={() => void runSearch()}
            disabled={searching}
            className="h-9 rounded-md border border-border bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            {searching ? "Buscando..." : "Buscar"}
          </button>
        </div>
        {hits !== null && (
          hits.length === 0 ? <Empty label="Nenhuma transação encontrada." /> : (
            <ul className="mt-3 divide-y divide-border">
              {hits.map(h => (
                <li key={h.id} className="flex items-center gap-3 py-2.5">
                  <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-foreground">
                      {h.customer_name || h.customer_email || h.id.slice(0, 8)}
                    </p>
                    <p className="truncate text-[11px] tabular-nums text-muted-foreground">
                      {h.id.slice(0, 8)} · {new Date(h.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11.5px] text-muted-foreground">{h.status}</span>
                  <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-foreground">
                    {fmtCurrency(Number(h.amount || 0))}
                  </span>
                </li>
              ))}
            </ul>
          )
        )}
      </Panel>
    </div>
  );
}
