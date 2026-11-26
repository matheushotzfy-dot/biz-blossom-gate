import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfDay, startOfDay, subDays } from "date-fns";
import { AlertTriangle, Coins, CreditCard, Gauge, LifeBuoy, LogOut, Moon, PanelLeft, RefreshCw, Send, Shield, Sun, Users, X, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/useTheme";
import { useSellerSkin } from "@/hooks/useSellerSkin";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { useMinWidth } from "@/hooks/useMinWidth";
import { cn } from "@/lib/utils";
import AdminDateBar from "@/pages/admin/AdminDateBar";
import { ROLE_LABEL, parsePortfolio, staffError, type Portfolio, type SectionId } from "./staffPanelModel";
import { PortfolioSection } from "./PortfolioSection";
import { SellersSection } from "./SellersSection";
import { SellerSheet } from "./SellerSheet";

const TransactionsSection = lazy(() => import("./TransactionsSection"));
const CommissionSection = lazy(() => import("./CommissionSection"));
const RequestsSection = lazy(() => import("./RequestsSection"));
const SupportCenter = lazy(() => import("@/features/admin-support/SupportCenter"));

interface NavEntry { id: SectionId; label: string; icon: LucideIcon; hint: string }

/** Seções que a conta pode abrir: depende do papel (gerente tem comissão e pedidos) e das permissões. */
export function sectionsFor(p: Pick<Portfolio, "role" | "flags"> | null): NavEntry[] {
  const all: (NavEntry & { show: boolean })[] = [
    { id: "carteira", label: "Carteira", icon: Gauge, hint: "Resumo do período", show: true },
    { id: "sellers", label: "Sellers", icon: Users, hint: "Sellers da sua carteira", show: true },
    { id: "vendas", label: "Vendas", icon: CreditCard, hint: "Vendas da carteira", show: !!p?.flags.viewTransactions },
    { id: "suporte", label: "Suporte", icon: LifeBuoy, hint: "Chamados dos sellers", show: !!p?.flags.viewSupport },
    { id: "comissao", label: "Comissão", icon: Coins, hint: "Seu saldo e pagamentos", show: p?.role === "manager" },
    { id: "pedidos", label: "Pedidos ao dono", icon: Send, hint: "Pedidos que só o dono aprova", show: p?.role === "manager" },
  ];
  return all.filter((s) => s.show).map(({ show: _show, ...s }) => s);
}

const PERIOD_SECTIONS = new Set<SectionId>(["carteira", "sellers", "vendas", "comissao"]);

/**
 * Painel da equipe (gerentes e funcionários). Tudo vem de RPCs que só enxergam a carteira ativa da conta e o que
 * aconteceu depois do vínculo; cada ação é conferida de novo no servidor (permissão + vínculo).
 */
export default function StaffPanel() {
  useSellerSkin();
  useIdleLogout(30, "/gerentes");
  useEffect(() => {
    document.documentElement.classList.add("vp-admin");
    return () => document.documentElement.classList.remove("vp-admin");
  }, []);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const [params, setParams] = useSearchParams();
  const [range, setRange] = useState(() => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }));
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openSeller, setOpenSeller] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const openMenuRef = useRef<HTMLButtonElement>(null);
  // No desktop o menu está sempre à vista; no celular ele é uma gaveta e fica `inert` enquanto fechada.
  const desktop = useMinWidth(1024);

  const q = useQuery({
    queryKey: ["staff-portfolio", range.from.toISOString(), range.to.toISOString(), page, search],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_staff_portfolio_dashboard", { _from: range.from.toISOString(), _to: range.to.toISOString(), _page: page, _search: search });
      if (error) throw error;
      return parsePortfolio(data);
    },
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  const data = q.data ?? null;
  const sections = useMemo(() => sectionsFor(data), [data]);
  const requested = (params.get("s") ?? "carteira") as SectionId;
  const active: SectionId = sections.some((s) => s.id === requested) ? requested : "carteira";
  const current = sections.find((s) => s.id === active);

  const go = (id: SectionId) => {
    setMenuOpen(false);
    setParams((p) => { const n = new URLSearchParams(p); if (id === "carteira") n.delete("s"); else n.set("s", id); return n; }, { replace: true });
  };

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenuOpen(false); openMenuRef.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const logout = async () => {
    await supabase.auth.signOut();
    qc.clear();
    navigate("/gerentes", { replace: true });
  };

  const refreshAll = () => { void qc.invalidateQueries({ queryKey: ["staff-portfolio"] }); void qc.invalidateQueries({ queryKey: ["staff-seller"] }); void qc.invalidateQueries({ queryKey: ["staff-tx"] }); void qc.invalidateQueries({ queryKey: ["staff-commission"] }); };
  const themeLabel = theme === "dark" ? "Tema claro" : "Tema escuro";

  return (
    <div className="admin-frame flex h-screen overflow-hidden af-bg-soft af-text">
      {menuOpen && <div className="fixed inset-0 z-[60] bg-background/80 lg:hidden" onClick={() => setMenuOpen(false)} role="presentation" />}

      <aside
        aria-label="Menu do painel da equipe"
        {...(!desktop && !menuOpen ? ({ inert: "" } as object) : {})}
        className={cn(
          "relative z-[70] flex h-full w-[256px] shrink-0 flex-col af-surface af-border border-r lg:z-20",
          "max-lg:fixed max-lg:left-0 max-lg:top-0 max-lg:max-w-[86vw] max-lg:transition-transform",
          menuOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
        )}
      >
        <div className="flex h-[64px] shrink-0 items-center gap-3 px-4 af-border border-b">
          <div className="ax-brand-mark"><Shield className="h-[18px] w-[18px]" strokeWidth={2.25} /></div>
          <div className="min-w-0 flex-1">
            <p className="ax-brand-name">Vemprapay</p>
            <p className="ax-brand-sub">{data ? `Equipe · ${ROLE_LABEL[data.role]}` : "Painel da equipe"}</p>
          </div>
          <button onClick={() => setMenuOpen(false)} aria-label="Fechar menu" className="ml-auto grid h-8 w-8 place-items-center rounded-md af-muted lg:hidden"><X className="h-4 w-4" /></button>
        </div>
        <nav aria-label="Seções do painel" className="flex-1 overflow-y-auto px-2.5 py-3">
          <div className="space-y-0.5">
            {sections.map((s) => (
              <button key={s.id} type="button" onClick={() => go(s.id)} aria-current={active === s.id ? "page" : undefined} data-active={active === s.id ? "true" : "false"} className="admin-nav-item ax-nav-item">
                <s.icon strokeWidth={2} />
                <span className="truncate">{s.label}</span>
                {s.id === "sellers" && data && data.metrics.kycPending > 0 && (
                  <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-warning px-1.5 text-[11px] font-bold text-warning-foreground" aria-label={`${data.metrics.kycPending} verificações para analisar`}>{data.metrics.kycPending}</span>
                )}
              </button>
            ))}
          </div>
          {data && !data.flags.viewTransactions && !data.flags.viewSupport && data.role === "employee" && (
            <p className="mx-3 mt-6 text-[12.5px] leading-relaxed af-muted">Vendas e suporte aparecem aqui quando o dono liberar essas permissões para você.</p>
          )}
        </nav>
        <div className="shrink-0 space-y-0.5 p-2 af-border border-t">
          <button onClick={toggleTheme} className="ax-side-foot flex sm:hidden">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}<span>{themeLabel}</span></button>
          <button onClick={() => void logout()} className="ax-side-foot flex"><LogOut className="h-4 w-4" /><span>Sair</span></button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[64px] shrink-0 items-center gap-2 px-3 af-surface af-border border-b sm:gap-3 sm:px-4 lg:px-6">
          <button ref={openMenuRef} onClick={() => setMenuOpen(true)} aria-label="Abrir menu" aria-expanded={menuOpen} className="ax-iconbtn grid lg:hidden"><PanelLeft className="h-4 w-4" /></button>
          <h1 className="ax-crumb-title min-w-0 truncate">{current?.label ?? "Carteira"}</h1>
          {PERIOD_SECTIONS.has(active) ? <AdminDateBar range={range} onChange={(r) => { setRange(r); setPage(1); }} /> : <div className="flex-1" />}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button onClick={toggleTheme} aria-label={themeLabel} title={themeLabel} className="ax-iconbtn hidden sm:grid">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
            <button onClick={refreshAll} disabled={q.isFetching} aria-label="Atualizar" title="Atualizar agora. O painel também atualiza sozinho a cada minuto." className="ax-refresh flex">
              <RefreshCw className={cn("h-3.5 w-3.5", q.isFetching && "animate-spin")} /><span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </header>

        <main className="admin-shell flex-1 overflow-y-auto af-bg-soft scrollbar-thin" data-admin-content>
          <div className="admin-fluid p-5 lg:p-7 xl:p-9">
            <div className="mx-auto max-w-[1400px]">
              {q.isError && (
                <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13.5px] text-destructive">
                  <span className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{data ? "Não foi possível atualizar. Os números abaixo são da última leitura." : `Não foi possível carregar sua carteira. ${staffError(q.error)}`}</span>
                  <button onClick={() => void q.refetch()} className="shrink-0 rounded-md border border-destructive/40 bg-background px-3 py-1.5 text-[12.5px] font-semibold text-foreground">Tentar de novo</button>
                </div>
              )}
              <Suspense fallback={<div className="min-h-[320px] animate-pulse rounded-2xl bg-card/40" aria-label="Carregando" />}>
                {active === "carteira" && <PortfolioSection data={data} loading={q.isPending} range={range} onOpenSeller={setOpenSeller} onGo={go} />}
                {active === "sellers" && (
                  <SellersSection data={data} loading={q.isPending} fetching={q.isFetching} search={search} page={page}
                    onSearch={(v) => { setSearch(v); setPage(1); }} onPage={setPage} onOpen={setOpenSeller} />
                )}
                {active === "vendas" && data && <TransactionsSection range={range} />}
                {active === "suporte" && data && <SupportCenter isAdmin={false} hasSupportAccess={data.flags.viewSupport} />}
                {active === "comissao" && data && <CommissionSection data={data} range={range} />}
                {active === "pedidos" && data && <RequestsSection />}
              </Suspense>
            </div>
          </div>
        </main>
      </div>

      <SellerSheet sellerId={openSeller} portfolio={data} onClose={() => setOpenSeller(null)} onChanged={() => void qc.invalidateQueries({ queryKey: ["staff-portfolio"] })} />
    </div>
  );
}
