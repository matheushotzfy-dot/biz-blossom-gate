import { useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownToLine, ArrowRight, Bug, CheckCircle2,
  Clock, CreditCard, Gauge, LifeBuoy, RefreshCw, Search, ShieldAlert, ShieldCheck,
  UserCheck, Webhook, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommandCenter } from "@/features/admin-finance/useCommandCenter";
import { validateCommandSearch } from "@/features/admin-finance/commandCenterModel";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

interface Props {
  dateRange: { from: Date; to: Date };
  fmtCurrency: (v: number) => string;
  onNavigate: (tabId: string) => void;
}

type QueueKey =
  | "withdrawals" | "disputes" | "support" | "kyc" | "errors" | "webhooks" | "refunds" | "chargebacks";

interface QueueItem {
  key: QueueKey;
  label: string;
  hint: string;
  icon: LucideIcon;
  count: number;
  tab: string;
  tone: "neutral" | "warning" | "danger";
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
    <section className="min-w-0 rounded-[14px] border border-border bg-card">
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

function PanelLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick}
      className="h-8 shrink-0 gap-1 px-2 text-[11.5px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
      {children}<ArrowRight className="h-3 w-3" />
    </Button>
  );
}

const SEARCH_STATUS: Record<string, string> = {
  approved: "Pago", completed: "Pago", paid: "Pago", pending: "Pendente", processing: "Processando", waiting_payment: "Aguardando",
  failed: "Recusado", refused: "Recusado", expired: "Expirado", cancelled: "Cancelado", canceled: "Cancelado",
  refunded: "Estornado", partially_refunded: "Estorno parcial", chargeback: "Chargeback",
};

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
  dateRange, fmtCurrency, onNavigate,
}: Props) {
  const command = useCommandCenter(dateRange);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchRequest = useRef(0);
  const errors = command.data?.operations.errors ?? [];
  const fraud = command.data?.operations.fraud ?? [];
  const webhookStats = command.data?.operations.webhooks ?? { delivered: 0, failed: 0, pending: 0 };
  const appStats = command.data?.operations.apps ?? { delivered: 0, failed: 0, pending: 0 };
  const operations = command.data?.operations;
  const metrics = command.data?.metrics;
  const errorCount = operations?.error_count ?? 0;
  const oldestWithdrawalHours = operations?.withdrawals.oldest ? Math.max(0, (Date.now() - Date.parse(operations.withdrawals.oldest)) / 3600000) : 0;
  const stats = {
    total: metrics?.summary.attempts ?? 0,
    approvedCount: metrics?.summary.sales ?? 0,
    approvalRate: metrics?.summary.attempts ? metrics.summary.sales / metrics.summary.attempts * 100 : 0,
    chargebackRate: metrics?.summary.attempts ? metrics.risk.chargebacks / metrics.summary.attempts * 100 : 0,
    tpv: metrics?.summary.gross ?? 0,
    ticket: metrics?.summary.sales ? metrics.summary.gross / metrics.summary.sales : 0,
    pendingVolume: operations?.withdrawals.amount ?? 0,
  };
  const pendingWithdrawalCount = operations?.withdrawals.count ?? 0;
  const pendingKyc = operations?.kyc ?? 0;
  const disputesOpen = operations?.med ?? 0;
  const ticketsOpen = operations?.support ?? 0;
  const riskySellers = operations?.risky_sellers ?? [];
  const loading = command.isFetching;

  const alerts = useMemo(() => {
    const list: { id: string; label: string; detail: string; tone: "warning" | "danger" }[] = [];
    if (stats.total >= 20 && stats.approvalRate < 55) {
      list.push({ id: "approval", tone: "danger", label: "Conversão abaixo do esperado", detail: `${stats.approvalRate.toFixed(1)}% de aprovação no período` });
    }
    if (stats.chargebackRate > 1) {
      list.push({ id: "cb", tone: "danger", label: "Chargeback acima de 1%", detail: `${stats.chargebackRate.toFixed(2)}% das tentativas reais` });
    }
    if (oldestWithdrawalHours > 24) {
      list.push({ id: "wd", tone: "warning", label: "Saque parado há mais de 24h", detail: `Mais antigo: ${oldestWithdrawalHours.toFixed(0)}h na fila` });
    }
    if (webhookStats.failed > 0) {
      list.push({ id: "wh", tone: "warning", label: "Webhooks falhando", detail: `${webhookStats.failed} ${webhookStats.failed === 1 ? "entrega com falha" : "entregas com falha"} nas últimas 24h` });
    }
    if (errorCount > 0) {
      list.push({ id: "err", tone: "warning", label: "Erros não resolvidos acumulando", detail: `${errorCount} ${errorCount === 1 ? "registro aberto" : "registros abertos"}; revisar a causa antes de encerrar` });
    }
    if (appStats.failed > 0) list.push({ id: "apps", tone: "warning", label: "Integrações com falha", detail: `${appStats.failed} ${appStats.failed === 1 ? "evento não entregue" : "eventos não entregues"} nas últimas 24h` });
    return list;
  }, [stats.total, stats.approvalRate, stats.chargebackRate, oldestWithdrawalHours, webhookStats.failed, appStats.failed, errorCount]);

  const queues: QueueItem[] = useMemo(() => [
    { key: "withdrawals", label: "Saques pendentes", hint: fmtCurrency(stats.pendingVolume), icon: ArrowDownToLine, count: pendingWithdrawalCount, tab: "withdrawals", tone: pendingWithdrawalCount > 0 ? "warning" : "neutral" },
    { key: "kyc", label: "Verificações para analisar", hint: "Documentos enviados", icon: UserCheck, count: pendingKyc, tab: "kyc", tone: pendingKyc > 0 ? "warning" : "neutral" },
    { key: "disputes", label: "MED PIX em análise", hint: "MED e pré-MED em aberto", icon: ShieldAlert, count: disputesOpen, tab: "medpix", tone: disputesOpen > 0 ? "danger" : "neutral" },
    { key: "chargebacks", label: "Chargebacks abertos", hint: "Contestação de cartão", icon: CreditCard, count: operations?.chargebacks ?? 0, tab: "chargeback", tone: "warning" },
    { key: "refunds", label: "Reembolsos para confirmar", hint: "Aprovação manual do dono", icon: ArrowDownToLine, count: operations?.refunds ?? 0, tab: "refund-approvals", tone: "warning" },
    { key: "support", label: "Tickets em aberto", hint: "Atendimento ao seller", icon: LifeBuoy, count: ticketsOpen, tab: "support", tone: ticketsOpen > 0 ? "warning" : "neutral" },
    { key: "errors", label: "Erros não resolvidos", hint: "Log de aplicação", icon: Bug, count: errorCount, tab: "error-logs", tone: errorCount > 0 ? "warning" : "neutral" },
    { key: "webhooks", label: "Webhooks com falha (24h)", hint: "Entregas para sellers", icon: Webhook, count: webhookStats.failed, tab: "settings", tone: webhookStats.failed > 0 ? "danger" : "neutral" },
  ], [pendingWithdrawalCount, stats.pendingVolume, pendingKyc, disputesOpen, ticketsOpen, errorCount, webhookStats.failed, operations?.chargebacks, operations?.refunds, fmtCurrency]);

  const runSearch = async () => {
    if (searching) return;
    let q: string;
    try { q = validateCommandSearch(query); } catch (e) { toast.error(e instanceof Error ? e.message : "Digite entre 3 e 120 caracteres"); return; }
    const request = ++searchRequest.current;
    setSearching(true);
    setHits(null);
    try {
      const { data, error } = await supabase.rpc("admin_search_transactions", { _query: q });
      if (error) throw error;
      if (request === searchRequest.current) setHits(data ?? []);
    } catch {
      // mensagem crua do banco não ajuda o admin: diz o que aconteceu e o que fazer
      if (request === searchRequest.current) toast.error("Não foi possível buscar agora. Tente de novo em instantes.");
    } finally {
      if (request === searchRequest.current) setSearching(false);
    }
  };

  if (command.isPending) return <div role="status" aria-label="Carregando Centro de comando" className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-64" /></div>;
  if (!command.data) return <div role="alert" className="space-y-3 rounded-lg border border-destructive p-5"><h2 className="font-semibold text-destructive">Centro de comando indisponível</h2><p className="text-sm text-muted-foreground">Não foi possível verificar as filas. O estado da operação não foi confirmado.</p><Button variant="outline" disabled={loading} onClick={() => void command.refetch()}>Tentar novamente</Button></div>;

  return (
    <div className="space-y-5 animate-fade-in">
      {command.isError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="min-w-0 flex-1 text-[12.5px] font-medium text-destructive">
            Não foi possível atualizar as filas. Os números abaixo são de {new Date(command.data.operations.checked_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} e podem estar desatualizados.
          </p>
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void command.refetch()}>Tentar de novo</Button>
        </div>
      )}
      <AdminPageHeader
        eyebrow="Admin · Operações"
        title="Centro de Comando"
        subtitle={`Período: ${dateRange.from.toLocaleDateString("pt-BR")} a ${dateRange.to.toLocaleDateString("pt-BR")} · Filas atuais · Atualizado ${new Date(command.data.operations.checked_at).toLocaleTimeString("pt-BR")}`}
        status={{
          tone: alerts.length > 0 ? "warning" : "success",
          label: alerts.length > 0 ? (alerts.length === 1 ? "1 alerta ativo" : `${alerts.length} alertas ativos`) : "Sem alertas nos dados consultados",
          pulse: alerts.length > 0,
        }}
      />

      {/* Resumo do período */}
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-px overflow-hidden rounded-[14px] border border-border bg-border lg:grid-cols-[repeat(4,minmax(0,1fr))]">
        {[
          { label: "TPV aprovado", value: fmtCurrency(stats.tpv), sub: `${stats.approvedCount} vendas` },
          { label: "Taxa de aprovação", value: `${stats.approvalRate.toFixed(1)}%`, sub: `${stats.total} tentativas` },
          { label: "Ticket médio", value: fmtCurrency(stats.ticket), sub: "por venda aprovada" },
          { label: "Fila de saques", value: fmtCurrency(stats.pendingVolume), sub: `${pendingWithdrawalCount} pedidos` },
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
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void command.refetch()} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground hover:text-foreground">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Atualizar
          </Button>
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
        <div className="grid grid-cols-[minmax(0,1fr)] gap-px overflow-hidden rounded-[12px] border border-border bg-border sm:grid-cols-[repeat(2,minmax(0,1fr))]">
          {queues.map(q => (
            <Button
              key={q.key}
              variant="ghost"
              onClick={() => onNavigate(q.tab)}
              className="group flex h-auto min-h-16 items-center justify-start gap-3 whitespace-normal rounded-none bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40"
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
            </Button>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
        {/* Webhooks */}
        <Panel title="Entregas de webhook (24h)" icon={Webhook}>
          <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-px overflow-hidden rounded-[12px] border border-border bg-border">
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
          action={<PanelLink onClick={() => onNavigate("sellers")}>Ver sellers</PanelLink>}>
          {riskySellers.length === 0 ? <Empty label="Nenhum seller com reembolso/chargeback relevante." /> : (
            <ul className="divide-y divide-border">
              {riskySellers.map(s => (
                <li key={s.user_id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
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
        <Panel title="Últimos bloqueios" icon={ShieldAlert}
          action={<PanelLink onClick={() => onNavigate("risk-compliance")}>Anti-fraude</PanelLink>}>
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

      <Panel title="Entregas de integrações (24h)" icon={Webhook}>
        <div className="flex flex-wrap gap-6 text-sm tabular-nums"><span>Entregues: {appStats.delivered}</span><span>Na fila: {appStats.pending}</span><span className={cn(appStats.failed > 0 && "text-destructive")}>Falhas: {appStats.failed}</span></div>
      </Panel>
      {/* Erros abertos */}
      <Panel title="Erros em aberto" icon={Bug}
        action={<PanelLink onClick={() => onNavigate("error-logs")}>Ver todos</PanelLink>}>
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
                <Button
                  variant="outline" size="sm" onClick={() => onNavigate("error-logs")}
                  className="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Investigar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Busca global de transações */}
      <Panel title="Busca rápida de transação" icon={Search}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            aria-label="Buscar transação"
            maxLength={120}
            value={query}
            onChange={(e) => { setQuery(e.target.value); searchRequest.current += 1; setHits(null); setSearching(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") void runSearch(); }}
            placeholder="ID, e-mail, nome ou documento"
            className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-[12.5px] text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            onClick={() => void runSearch()}
            disabled={searching}
            className="h-9 rounded-md border border-border bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            {searching ? "Buscando..." : "Buscar"}
          </Button>
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
                  <span className="shrink-0 text-[11.5px] text-muted-foreground">{SEARCH_STATUS[h.status] ?? h.status}</span>
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
