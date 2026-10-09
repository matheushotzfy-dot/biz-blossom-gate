import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, DollarSign, TrendingUp, Link2, ShoppingCart, Search, Percent, Award,
  ChevronRight, ExternalLink, Crown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle, AdminKpi } from "./AdminOverviewTab";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";

type AffiliateSale = Tables<"affiliate_sales">;
type AffiliateLink = Tables<"affiliate_links">;

export default function AdminAffiliateSalesTab({
  profiles, products, fmtCurrency,
}: {
  profiles: Tables<"profiles">[];
  products: Tables<"products">[];
  fmtCurrency: (v: number) => string;
}) {
  const [sales, setSales] = useState<AffiliateSale[]>([]);
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"affiliates" | "products">("affiliates");
  const [affiliateDetail, setAffiliateDetail] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("affiliate_sales").select("*").order("created_at", { ascending: false }).limit(2000),
      supabase.from("affiliate_links").select("*").limit(2000),
    ]).then(([salesRes, linksRes]) => {
      if (salesRes.error || linksRes.error) toast.error("Erro ao carregar afiliados");
      if (salesRes.data) setSales(salesRes.data);
      if (linksRes.data) setLinks(linksRes.data);
    });
  }, []);

  const profileMap = useMemo(() => {
    const m = new Map<string, Tables<"profiles">>();
    for (const p of profiles) m.set(p.user_id, p);
    return m;
  }, [profiles]);
  const productMap = useMemo(() => {
    const m = new Map<string, Tables<"products">>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const getName = (userId: string) => profileMap.get(userId)?.full_name || profileMap.get(userId)?.email || userId.slice(0, 8);
  const getEmail = (userId: string) => profileMap.get(userId)?.email || "";
  const getProduct = (id: string) => productMap.get(id);

  // Build affiliate rankings
  const affiliates = useMemo(() => {
    type Row = {
      userId: string; name: string; email: string;
      links: number; products: Set<string>; sellers: Set<string>;
      totalSales: number; approvedSales: number; pendingSales: number; rejectedSales: number;
      revenue: number; commissionsApproved: number; commissionsPending: number; commissionsTotal: number;
    };
    const map = new Map<string, Row>();
    for (const l of links) {
      let row = map.get(l.affiliate_user_id);
      if (!row) {
        row = {
          userId: l.affiliate_user_id, name: getName(l.affiliate_user_id), email: getEmail(l.affiliate_user_id),
          links: 0, products: new Set(), sellers: new Set(),
          totalSales: 0, approvedSales: 0, pendingSales: 0, rejectedSales: 0,
          revenue: 0, commissionsApproved: 0, commissionsPending: 0, commissionsTotal: 0,
        };
        map.set(l.affiliate_user_id, row);
      }
      row.links += 1;
      row.products.add(l.product_id);
      row.sellers.add(l.owner_user_id);
    }
    for (const s of sales) {
      let row = map.get(s.affiliate_user_id);
      if (!row) {
        row = {
          userId: s.affiliate_user_id, name: getName(s.affiliate_user_id), email: getEmail(s.affiliate_user_id),
          links: 0, products: new Set(), sellers: new Set(),
          totalSales: 0, approvedSales: 0, pendingSales: 0, rejectedSales: 0,
          revenue: 0, commissionsApproved: 0, commissionsPending: 0, commissionsTotal: 0,
        };
        map.set(s.affiliate_user_id, row);
      }
      row.totalSales += 1;
      row.revenue += Number(s.sale_amount);
      row.commissionsTotal += Number(s.commission_amount);
      row.products.add(s.product_id);
      row.sellers.add(s.seller_user_id);
      if (s.status === "approved") { row.approvedSales += 1; row.commissionsApproved += Number(s.commission_amount); }
      else if (s.status === "pending") { row.pendingSales += 1; row.commissionsPending += Number(s.commission_amount); }
      else if (s.status === "rejected") row.rejectedSales += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.commissionsTotal - a.commissionsTotal);
  }, [sales, links, profileMap]);

  // Build per-product rankings
  const productRows = useMemo(() => {
    const map = new Map<string, {
      productId: string; productName: string; price: number; sellerId: string; sellerName: string;
      affiliates: Set<string>; links: number; sales: number; revenue: number; commissions: number; approvedSales: number;
    }>();
    for (const l of links) {
      const p = getProduct(l.product_id);
      let row = map.get(l.product_id);
      if (!row) {
        row = {
          productId: l.product_id, productName: p?.name || "—", price: Number(p?.price || 0),
          sellerId: l.owner_user_id, sellerName: getName(l.owner_user_id),
          affiliates: new Set(), links: 0, sales: 0, revenue: 0, commissions: 0, approvedSales: 0,
        };
        map.set(l.product_id, row);
      }
      row.affiliates.add(l.affiliate_user_id);
      row.links += 1;
    }
    for (const s of sales) {
      let row = map.get(s.product_id);
      if (!row) {
        const p = getProduct(s.product_id);
        row = {
          productId: s.product_id, productName: p?.name || "—", price: Number(p?.price || 0),
          sellerId: s.seller_user_id, sellerName: getName(s.seller_user_id),
          affiliates: new Set(), links: 0, sales: 0, revenue: 0, commissions: 0, approvedSales: 0,
        };
        map.set(s.product_id, row);
      }
      row.affiliates.add(s.affiliate_user_id);
      row.sales += 1;
      row.revenue += Number(s.sale_amount);
      row.commissions += Number(s.commission_amount);
      if (s.status === "approved") row.approvedSales += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.commissions - a.commissions);
  }, [sales, links, productMap, profileMap]);

  const filteredAffiliates = useMemo(() => {
    if (!search) return affiliates;
    const q = search.toLowerCase();
    return affiliates.filter(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
  }, [affiliates, search]);
  const filteredProducts = useMemo(() => {
    if (!search) return productRows;
    const q = search.toLowerCase();
    return productRows.filter(p => p.productName.toLowerCase().includes(q) || p.sellerName.toLowerCase().includes(q));
  }, [productRows, search]);

  // KPIs
  const totalRevenue = sales.reduce((a, s) => a + Number(s.sale_amount), 0);
  const totalCommissions = sales.reduce((a, s) => a + Number(s.commission_amount), 0);
  const approvedCommissions = sales.filter(s => s.status === "approved").reduce((a, s) => a + Number(s.commission_amount), 0);
  const pendingCommissions = sales.filter(s => s.status === "pending").reduce((a, s) => a + Number(s.commission_amount), 0);
  const uniqueAffiliates = new Set(links.map(l => l.affiliate_user_id)).size;
  const activeAffiliates = new Set(sales.map(s => s.affiliate_user_id)).size;

  const detail = affiliateDetail ? affiliates.find(a => a.userId === affiliateDetail) : null;
  const detailSales = detail ? sales.filter(s => s.affiliate_user_id === detail.userId) : [];
  const detailLinks = detail ? links.filter(l => l.affiliate_user_id === detail.userId) : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Programa de Afiliados"
        title="Vendas e Comissões"
        subtitle={`${uniqueAffiliates} afiliados cadastrados · ${activeAffiliates} com vendas · ${fmtCurrency(totalCommissions)} em comissões`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <AdminKpi icon={<Users className="h-4 w-4" />} label="Afiliados" value={String(uniqueAffiliates)} sub={`${activeAffiliates} vendendo`} gradient="from-violet-600 to-purple-700" glowColor="rgba(139,92,246,0.2)" />
        <AdminKpi icon={<Link2 className="h-4 w-4" />} label="Links Ativos" value={String(links.filter(l => l.is_active).length)} sub={`${links.length} total`} gradient="from-indigo-600 to-indigo-700" glowColor="rgba(99,102,241,0.2)" />
        <AdminKpi icon={<TrendingUp className="h-4 w-4" />} label="Receita Gerada" value={fmtCurrency(totalRevenue)} sub={`${sales.length} vendas`} gradient="from-emerald-600 to-emerald-700" glowColor="rgba(52,211,153,0.2)" />
        <AdminKpi icon={<DollarSign className="h-4 w-4" />} label="Comissões Pagas" value={fmtCurrency(approvedCommissions)} sub="aprovadas" gradient="from-blue-600 to-blue-700" glowColor="rgba(59,130,246,0.2)" />
        <AdminKpi icon={<Percent className="h-4 w-4" />} label="Comissões Pendentes" value={fmtCurrency(pendingCommissions)} sub="aguardando" gradient="from-amber-600 to-orange-600" glowColor="rgba(245,158,11,0.2)" />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-muted/30 border border-border rounded-xl p-1">
          <button onClick={() => setView("affiliates")}
            className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
              view === "affiliates" ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground")}>
            <Users className="inline h-3 w-3 mr-1" /> Por Afiliado
          </button>
          <button onClick={() => setView("products")}
            className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
              view === "products" ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground")}>
            <ShoppingCart className="inline h-3 w-3 mr-1" /> Por Produto
          </button>
        </div>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={view === "affiliates" ? "Buscar afiliado..." : "Buscar produto..."} value={search} onChange={e => setSearch(e.target.value)}
            className="pl-10 rounded-xl h-10 bg-muted/30 border-border" />
        </div>
      </div>

      {view === "affiliates" ? (
        <AdminPanel>
          <PanelTitle color="violet" icon={<Award className="h-4 w-4" />}>Ranking de Afiliados ({filteredAffiliates.length})</PanelTitle>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                {["#", "Afiliado", "Produtos", "Sellers", "Links", "Vendas", "Aprov.", "Pend.", "Receita", "Comissões Total", "Aprovadas", ""].map(h => (
                  <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filteredAffiliates.map((a, i) => (
                  <tr key={a.userId} className={cn("border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer", i < 3 && "bg-muted/10")}
                    onClick={() => setAffiliateDetail(a.userId)}>
                    <td className="p-3">{i < 3 ? <Crown className={cn("h-3.5 w-3.5", i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : "text-orange-400")} /> : <span className="text-[10px] text-muted-foreground">#{i + 1}</span>}</td>
                    <td className="p-3"><p className="text-xs font-bold text-foreground">{a.name}</p><p className="text-[10px] text-muted-foreground/70">{a.email}</p></td>
                    <td className="p-3 text-xs text-foreground">{a.products.size}</td>
                    <td className="p-3 text-xs text-muted-foreground">{a.sellers.size}</td>
                    <td className="p-3 text-xs text-muted-foreground">{a.links}</td>
                    <td className="p-3 text-xs font-bold text-foreground">{a.totalSales}</td>
                    <td className="p-3 text-xs font-bold text-emerald-400">{a.approvedSales}</td>
                    <td className="p-3 text-xs font-bold text-amber-400">{a.pendingSales}</td>
                    <td className="p-3 text-xs font-bold text-foreground tabular-nums">{fmtCurrency(a.revenue)}</td>
                    <td className="p-3 text-xs font-black text-primary tabular-nums">{fmtCurrency(a.commissionsTotal)}</td>
                    <td className="p-3 text-xs font-bold text-emerald-400 tabular-nums">{fmtCurrency(a.commissionsApproved)}</td>
                    <td className="p-3"><ChevronRight className="h-4 w-4 text-muted-foreground" /></td>
                  </tr>
                ))}
                {filteredAffiliates.length === 0 && <tr><td colSpan={12} className="p-12 text-center text-muted-foreground text-xs">Nenhum afiliado encontrado</td></tr>}
              </tbody>
            </table>
          </div>
        </AdminPanel>
      ) : (
        <AdminPanel>
          <PanelTitle color="emerald" icon={<ShoppingCart className="h-4 w-4" />}>Produtos com Afiliados ({filteredProducts.length})</PanelTitle>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                {["Produto", "Seller (Dono)", "Preço", "Afiliados", "Links", "Vendas", "Aprov.", "Receita", "Comissões"].map(h => (
                  <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filteredProducts.map(p => (
                  <tr key={p.productId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="p-3"><p className="text-xs font-bold text-foreground truncate max-w-[240px]">{p.productName}</p></td>
                    <td className="p-3 text-xs text-muted-foreground">{p.sellerName}</td>
                    <td className="p-3 text-xs font-bold text-primary tabular-nums">{fmtCurrency(p.price)}</td>
                    <td className="p-3 text-xs font-bold text-violet-400">{p.affiliates.size}</td>
                    <td className="p-3 text-xs text-muted-foreground">{p.links}</td>
                    <td className="p-3 text-xs font-bold text-foreground">{p.sales}</td>
                    <td className="p-3 text-xs font-bold text-emerald-400">{p.approvedSales}</td>
                    <td className="p-3 text-xs font-bold text-foreground tabular-nums">{fmtCurrency(p.revenue)}</td>
                    <td className="p-3 text-xs font-black text-primary tabular-nums">{fmtCurrency(p.commissions)}</td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && <tr><td colSpan={9} className="p-12 text-center text-muted-foreground text-xs">Nenhum produto com afiliados</td></tr>}
              </tbody>
            </table>
          </div>
        </AdminPanel>
      )}

      {/* Affiliate Detail */}
      <Dialog open={!!affiliateDetail} onOpenChange={(o) => !o && setAffiliateDetail(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-violet-400" /> {detail.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">{detail.email}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Stat label="Comissões Total" value={fmtCurrency(detail.commissionsTotal)} tone="primary" />
                  <Stat label="Aprovadas" value={fmtCurrency(detail.commissionsApproved)} tone="success" />
                  <Stat label="Pendentes" value={fmtCurrency(detail.commissionsPending)} tone="warning" />
                  <Stat label="Receita Gerada" value={fmtCurrency(detail.revenue)} />
                  <Stat label="Vendas" value={String(detail.totalSales)} />
                  <Stat label="Aprovadas" value={String(detail.approvedSales)} tone="success" />
                  <Stat label="Pendentes" value={String(detail.pendingSales)} tone="warning" />
                  <Stat label="Recusadas" value={String(detail.rejectedSales)} tone="destructive" />
                </div>

                <div className="rounded-xl border border-border bg-card/40 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1"><Link2 className="h-3 w-3" /> Links de afiliação ({detailLinks.length})</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-border/40 text-[10px] uppercase text-muted-foreground">
                        <th className="text-left p-2 font-bold">Produto</th>
                        <th className="text-left p-2 font-bold">Seller</th>
                        <th className="text-left p-2 font-bold">Slug</th>
                        <th className="text-right p-2 font-bold">Cliques</th>
                        <th className="text-right p-2 font-bold">Comissão %</th>
                        <th className="text-left p-2 font-bold">Status</th>
                      </tr></thead>
                      <tbody>
                        {detailLinks.map(l => {
                          const p = getProduct(l.product_id);
                          return (
                            <tr key={l.id} className="border-b border-border/20">
                              <td className="p-2 font-medium text-foreground truncate max-w-[200px]">{p?.name || "—"}</td>
                              <td className="p-2 text-muted-foreground">{getName(l.owner_user_id)}</td>
                              <td className="p-2 font-mono text-[10px] text-violet-400">{l.slug}</td>
                              <td className="p-2 text-right text-foreground">{l.clicks}</td>
                              <td className="p-2 text-right font-bold text-primary">{Number(l.commission_pct)}%</td>
                              <td className="p-2"><StatusBadge status={l.is_active ? "active" : "inactive"} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card/40 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1"><DollarSign className="h-3 w-3" /> Histórico de vendas ({detailSales.length})</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-border/40 text-[10px] uppercase text-muted-foreground">
                        <th className="text-left p-2 font-bold">Produto</th>
                        <th className="text-left p-2 font-bold">Seller</th>
                        <th className="text-right p-2 font-bold">Venda</th>
                        <th className="text-right p-2 font-bold">%</th>
                        <th className="text-right p-2 font-bold">Comissão</th>
                        <th className="text-left p-2 font-bold">Status</th>
                        <th className="text-left p-2 font-bold">Data</th>
                      </tr></thead>
                      <tbody>
                        {detailSales.slice(0, 100).map(s => {
                          const p = getProduct(s.product_id);
                          return (
                            <tr key={s.id} className="border-b border-border/20">
                              <td className="p-2 font-medium text-foreground truncate max-w-[180px]">{p?.name || "—"}</td>
                              <td className="p-2 text-muted-foreground truncate max-w-[140px]">{getName(s.seller_user_id)}</td>
                              <td className="p-2 text-right font-bold tabular-nums text-foreground">{fmtCurrency(Number(s.sale_amount))}</td>
                              <td className="p-2 text-right text-primary">{Number(s.commission_pct)}%</td>
                              <td className="p-2 text-right font-black tabular-nums text-emerald-400">{fmtCurrency(Number(s.commission_amount))}</td>
                              <td className="p-2"><StatusBadge status={s.status} /></td>
                              <td className="p-2 text-[10px] text-muted-foreground">{new Date(s.created_at).toLocaleDateString("pt-BR")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "destructive" | "primary" }) {
  const c = tone === "success" ? "text-emerald-400" : tone === "warning" ? "text-amber-400" : tone === "destructive" ? "text-red-400" : tone === "primary" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("text-base font-black tabular-nums mt-0.5", c)}>{value}</p>
    </div>
  );
}
