import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldAlert, Wallet, TrendingUp, RotateCcw, ArrowDownToLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { brl, type Seller360 } from "./types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SellerAcquirersSection, SellerRewardsSection, SellerTransactionsSection, SellerWithdrawalsSection } from "./SellerDetailSections";

interface Seller360PanelProps {
  userId: string;
  onChanged?: () => void;
}

const RISK_STYLE: Record<Seller360["risk_level"], string> = {
  low: "bg-primary/10 text-primary border-primary/30",
  medium: "bg-accent text-accent-foreground border-border",
  high: "bg-destructive/10 text-destructive border-destructive/30",
};
const RISK_LABEL: Record<Seller360["risk_level"], string> = { low: "Risco baixo", medium: "Risco médio", high: "Risco alto" };

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "danger" | "muted" }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 break-words font-mono text-base font-semibold tabular-nums", tone === "danger" && "text-destructive", tone === "muted" && "text-muted-foreground")}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Wallet; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{title}</h4>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">{children}</div>
    </section>
  );
}

/** Complete one-screen view of a seller: balances, sales, disputes, withdrawals, risk and balance actions. */
export function Seller360Panel({ userId, onChanged }: Seller360PanelProps) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["seller-360", user?.id, userId], enabled: Boolean(user), staleTime: 30000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc("get_seller_360", { _user_id: userId }).abortSignal(signal);
      if (error || !data) throw new Error("Não foi possível carregar a visão do seller");
      return data as unknown as Seller360;
    },
  });
  const load = useCallback(() => query.refetch(), [query.refetch]);
  const data = query.data;
  if (query.isError) return <div role="alert" className="space-y-3 border border-destructive/30 p-4 text-sm text-destructive">Não foi possível carregar a visão do seller.<Button variant="outline" onClick={() => void load()}>Tentar novamente</Button></div>;
  if (!data) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando" /></div>;

  const { balance: b, sales: s, disputes: d, withdrawals: w } = data;
  const ticket = s.approved_count > 0 ? s.approved_amount / s.approved_count : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold", RISK_STYLE[data.risk_level])}>
          <ShieldAlert className="h-3.5 w-3.5" />{RISK_LABEL[data.risk_level]} · {data.risk_score}/100
        </span>
        <span className="text-xs text-muted-foreground">Conta com {data.account_age_days} dias · Chargeback/MED {data.chargeback_rate}% · Reembolso {data.refund_rate}%</span>
        {data.chargeback_rate > 1 && <span className="text-xs font-semibold text-destructive">Acima do limite de 1%</span>}
      </div>

      <Section icon={Wallet} title="Saldo">
        <Tile label="Disponível" value={brl(b.available)} />
        <Tile label="Bloqueado em disputas" value={brl(b.held_disputes)} tone={b.held_disputes > 0 ? "danger" : "muted"} />
        <Tile label="Reserva retida" value={brl(b.retained)} tone="muted" />
        <Tile label="Saques pendentes" value={brl(b.pending_withdrawals)} tone="muted" />
        <Tile label="Saldo negativo" value={brl(b.negative)} tone={b.negative < 0 ? "danger" : "muted"} sub={b.negative < 0 ? "Saques travados até quitar" : undefined} />
        <Tile label="Livro-caixa" value={brl(b.ledger)} tone="muted" />
      </Section>

      <Section icon={TrendingUp} title="Vendas">
        <Tile label="Faturamento aprovado" value={brl(s.approved_amount)} sub={`${s.approved_count} ${s.approved_count === 1 ? "venda" : "vendas"}`} />
        <Tile label="Últimos 30 dias" value={brl(s.last_30d_amount)} />
        <Tile label="Ticket médio" value={brl(ticket)} />
        <Tile label="Líquido do seller" value={brl(s.net_amount)} />
        <Tile label="Taxas da plataforma" value={brl(s.fees_amount)} />
        <Tile label="Última venda" value={s.last_sale_at ? new Date(s.last_sale_at).toLocaleDateString("pt-BR") : "—"} tone="muted" />
      </Section>

      <Section icon={RotateCcw} title="Reembolsos e disputas">
        <Tile label="Reembolsado" value={brl(s.refunded_amount)} sub={`${s.refunded_count} ${s.refunded_count === 1 ? "venda" : "vendas"}`} />
        <Tile label="Disputas abertas" value={String(d.open)} tone={d.open > 0 ? "danger" : "muted"} />
        <Tile label="Ganhas / perdidas" value={`${d.won} / ${d.lost}`} sub={`${d.total} no total`} />
      </Section>

      <Section icon={ArrowDownToLine} title="Saques">
        <Tile label="Pagos" value={brl(w.paid)} sub={`${w.count} ${w.count === 1 ? "pedido" : "pedidos"}`} />
        <Tile label="Pendentes" value={brl(w.pending)} tone="muted" />
        <Tile label="Recusados" value={String(w.rejected_count)} tone="muted" />
      </Section>

      <Tabs defaultValue="tx">
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="tx">Transações</TabsTrigger>
          <TabsTrigger value="wd">Saques</TabsTrigger>
          <TabsTrigger value="acq">Adquirentes</TabsTrigger>
          <TabsTrigger value="rw">Premiações</TabsTrigger>
        </TabsList>
        <TabsContent value="tx" className="mt-3"><SellerTransactionsSection key={userId} userId={userId} /></TabsContent>
        <TabsContent value="wd" className="mt-3"><SellerWithdrawalsSection key={userId} userId={userId} onChanged={() => { void load(); onChanged?.(); }} /></TabsContent>
        <TabsContent value="acq" className="mt-3"><SellerAcquirersSection userId={userId} /></TabsContent>
        <TabsContent value="rw" className="mt-3"><SellerRewardsSection userId={userId} /></TabsContent>
      </Tabs>
    </div>
  );
}
