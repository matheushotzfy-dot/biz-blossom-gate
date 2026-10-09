import { useCallback, useEffect, useMemo, useState } from "react";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, ArrowLeft, ArrowRight, CreditCard, DollarSign, LogOut, RefreshCw, Search, Shield, Users, WalletCards } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StaffRequestForm } from "@/features/staff/StaffRequestForm";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PortfolioSeller {
  seller_user_id: string;
  started_at: string;
  full_name: string | null;
  email: string | null;
  account_status: string | null;
  seller_type: string | null;
  sales_count: number;
  volume: number;
  net_volume: number;
}

interface PortfolioMetrics {
  seller_count: number;
  sales_count: number;
  volume: number;
  ticket_average: number;
  refunds: number;
  chargebacks: number;
  medpix: number;
  commission_generated: number;
  commission_reversed: number;
  commission_balance: number;
}

interface PortfolioResponse {
  metrics: PortfolioMetrics;
  permissions: string[];
  sellers: PortfolioSeller[];
  total_sellers: number;
  page: number;
  page_size: number;
}

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [days, setDays] = useState(30);

  const range = useMemo(() => ({ from: startOfDay(subDays(new Date(), days - 1)), to: endOfDay(new Date()) }), [days]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: result, error: requestError } = await supabase.rpc("get_staff_portfolio_dashboard" as never, {
      _from: range.from.toISOString(), _to: range.to.toISOString(), _page: page, _search: submittedSearch,
    } as never);
    if (requestError) { setError("Não foi possível carregar sua carteira. Nenhum total foi estimado."); setData(null); }
    else setData(result as unknown as PortfolioResponse);
    setLoading(false);
  }, [page, range.from, range.to, submittedSearch]);

  useEffect(() => { void load(); }, [load]);

  const logout = async () => { await supabase.auth.signOut(); navigate("/gerentes"); };
  const metrics = data?.metrics;
  const flags = staffActionFlags(data?.permissions);
  const canViewTransactions = flags.viewTransactions;
  const selectedSeller = data?.sellers.find(s => s.seller_user_id === selectedId) ?? null;
  const totalPages = Math.max(1, Math.ceil((data?.total_sellers ?? 0) / (data?.page_size ?? 25)));
  const riskTotal = Number(metrics?.refunds ?? 0) + Number(metrics?.chargebacks ?? 0) + Number(metrics?.medpix ?? 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center border border-primary/30 bg-primary/10"><Shield className="h-4 w-4 text-primary" /></div><div><h1 className="font-display text-sm font-bold">Carteira da equipe</h1><p className="text-[10px] text-muted-foreground">Somente vínculos ativos e dados posteriores à atribuição</p></div></div>
          <div className="flex gap-2"><Button variant="outline" size="icon" onClick={() => void load()} aria-label="Atualizar"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></Button><Button variant="outline" onClick={() => void logout()}><LogOut className="mr-2 h-4 w-4" />Sair</Button></div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6">
        <section className="flex flex-col gap-3 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-semibold uppercase text-primary">Operação isolada</p><h2 className="font-display text-2xl font-bold">Desempenho da sua carteira</h2><p className="mt-1 text-sm text-muted-foreground">{format(range.from, "dd/MM/yyyy", { locale: ptBR })} a {format(range.to, "dd/MM/yyyy", { locale: ptBR })}</p></div>
          <div className="flex flex-wrap gap-2">{[1, 7, 30, 90, 365].map(value => <Button key={value} size="sm" variant={days === value ? "default" : "outline"} onClick={() => { setDays(value); setPage(1); }}>{value === 1 ? "Hoje" : value === 365 ? "1 ano" : `${value} dias`}</Button>)}</div>
        </section>

        {error && <div role="alert" className="flex items-center justify-between gap-3 border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"><span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</span><Button variant="outline" size="sm" onClick={() => void load()}>Tentar novamente</Button></div>}

        <section className="grid gap-px border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Sellers ativos", value: metrics?.seller_count ?? 0, icon: Users },
            { label: "Vendas", value: metrics?.sales_count ?? 0, icon: CreditCard },
            { label: "Volume movimentado", value: money(metrics?.volume ?? 0), icon: DollarSign },
            { label: "Ticket médio", value: money(metrics?.ticket_average ?? 0), icon: WalletCards },
            { label: "Reembolsos", value: metrics?.refunds ?? 0, icon: AlertTriangle },
            { label: "Chargebacks", value: metrics?.chargebacks ?? 0, icon: AlertTriangle },
            { label: "MED PIX", value: metrics?.medpix ?? 0, icon: AlertTriangle },
            { label: "Comissão disponível", value: money(metrics?.commission_balance ?? 0), icon: DollarSign },
          ].map(item => <article key={item.label} className="min-h-28 bg-card p-4"><div className="flex items-center justify-between"><p className="text-xs font-medium text-muted-foreground">{item.label}</p><item.icon className="h-4 w-4 text-primary" /></div><p className="mt-4 font-mono text-xl font-bold tabular-nums">{loading ? "—" : item.value}</p></article>)}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 border border-border bg-card">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-display font-bold">Sellers da carteira</h3><p className="text-xs text-muted-foreground">Ranking pelo período selecionado</p></div><form className="flex gap-2" onSubmit={event => { event.preventDefault(); setPage(1); setSubmittedSearch(search.trim()); }}><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} className="pl-9" placeholder="Nome, e-mail ou ID" /></div><Button type="submit">Buscar</Button></form></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="bg-muted/30 text-left text-xs text-muted-foreground"><tr><th className="p-3">Seller</th><th className="p-3">Vínculo</th><th className="p-3 text-right">Vendas</th><th className="p-3 text-right">Movimentado</th><th className="p-3 text-right">Líquido</th></tr></thead><tbody>{(data?.sellers ?? []).map(seller => <tr key={seller.seller_user_id} className="border-t border-border"><td className="p-3"><p className="font-medium">{seller.full_name || "Sem nome"}</p><p className="text-xs text-muted-foreground">{seller.email || seller.seller_user_id}</p></td><td className="p-3 text-xs text-muted-foreground">desde {format(new Date(seller.started_at), "dd/MM/yyyy HH:mm")}</td><td className="p-3 text-right font-mono tabular-nums">{seller.sales_count}</td><td className="p-3 text-right font-mono tabular-nums">{money(seller.volume)}</td><td className="p-3 text-right font-mono tabular-nums">{money(seller.net_volume)}</td></tr>)}</tbody></table></div>
            {!loading && !(data?.sellers.length) && <p className="p-10 text-center text-sm text-muted-foreground">Nenhum seller ativo encontrado.</p>}
            <div className="flex items-center justify-between border-t border-border p-3"><p className="text-xs text-muted-foreground">Página {page} de {totalPages}</p><div className="flex gap-2"><Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(value => value - 1)} aria-label="Página anterior"><ArrowLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage(value => value + 1)} aria-label="Próxima página"><ArrowRight className="h-4 w-4" /></Button></div></div>
          </div>
          <aside className="space-y-4">
            <div className="border border-border bg-card p-4"><h3 className="text-sm font-semibold">Risco no período</h3><p className="mt-3 font-mono text-3xl font-bold tabular-nums">{riskTotal}</p><p className="mt-1 text-xs text-muted-foreground">Reembolsos, chargebacks e MED PIX da carteira atual.</p></div>
            <details className="border border-border bg-card p-4"><summary className="cursor-pointer text-sm font-semibold">Solicitar ação ao dono</summary><div className="mt-4"><StaffRequestForm /></div></details>
            {!canViewTransactions && <div className="border border-warning/40 bg-warning/10 p-4 text-xs text-warning">A visualização detalhada de transações não foi concedida para esta conta.</div>}
          </aside>
        </section>
      </main>
    </div>
  );
}