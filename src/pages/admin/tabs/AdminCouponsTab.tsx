import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Tag, Search, ToggleLeft, Percent, DollarSign, Users, ChevronDown, ChevronUp,
  ShoppingBag, X,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import type { Tables } from "@/integrations/supabase/types";
import { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle, AdminKpi } from "./AdminOverviewTab";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn, isApprovedTransaction } from "@/lib/utils";

type StatusFilter = "all" | "active" | "inactive" | "expired";

interface Props {
  profiles: Tables<"profiles">[];
  products: Tables<"products">[];
  transactions: Tables<"transactions">[];
  fmtCurrency: (v: number) => string;
}

export default function AdminCouponsTab({ profiles, products, transactions, fmtCurrency }: Props) {
  const [coupons, setCoupons] = useState<Tables<"coupons">[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [detail, setDetail] = useState<Tables<"coupons"> | null>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    supabase.from("coupons").select("*").order("created_at", { ascending: false }).limit(1000)
      .then(({ data, error }) => { if (error) { toast.error("Erro ao carregar cupons"); return; } if (data) { setCoupons(data); setTruncated(data.length === 1000); } });
  }, []);

  const sellerMap = useMemo(() => {
    const m = new Map<string, Tables<"profiles">>();
    for (const p of profiles) m.set(p.user_id, p);
    return m;
  }, [profiles]);
  const productMap = useMemo(() => {
    const m = new Map<string, Tables<"products">>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);
  const getSellerName = (userId: string) => sellerMap.get(userId)?.full_name || sellerMap.get(userId)?.email || "—";

  // Index transactions by coupon
  const txByCoupon = useMemo(() => {
    const m = new Map<string, Tables<"transactions">[]>();
    for (const t of transactions) {
      if (!t.coupon_id) continue;
      const arr = m.get(t.coupon_id) || [];
      arr.push(t);
      m.set(t.coupon_id, arr);
    }
    return m;
  }, [transactions]);

  const getCouponStats = (cid: string) => {
    const txs = txByCoupon.get(cid) || [];
    const completed = txs.filter(t => isApprovedTransaction(t.status));
    const discount = completed.reduce((a, t) => a + Number(t.discount_amount || 0), 0);
    const gross = completed.reduce((a, t) => a + Number(t.amount), 0);
    const uniqueBuyers = new Set(completed.map(t => t.customer_email).filter(Boolean)).size;
    return { txs, completed, discount, gross, uniqueBuyers };
  };

  const active = coupons.filter(c => c.is_active).length;
  const expired = coupons.filter(c => c.expires_at && new Date(c.expires_at) < new Date()).length;
  const totalUses = coupons.reduce((a, c) => a + (c.current_uses || 0), 0);
  const totalDiscount = coupons.reduce((a, c) => a + Number(c.total_discount_amount || 0), 0);

  const filtered = coupons.filter(c => {
    const expiredCoupon = !!c.expires_at && new Date(c.expires_at) < new Date();
    if (statusFilter === "active" && (!c.is_active || expiredCoupon)) return false;
    if (statusFilter === "inactive" && c.is_active) return false;
    if (statusFilter === "expired" && !expiredCoupon) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return c.code.toLowerCase().includes(s) || getSellerName(c.user_id).toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Promoções"
        title="Cupons da plataforma"
        subtitle={`${coupons.length} cupons · ${active} ativos · ${totalUses} utilizações · ${fmtCurrency(totalDiscount)} descontados`}
      />
      {truncated && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-2 text-xs font-semibold text-warning">
          Mostrando os 1000 registros mais recentes; totais podem estar incompletos
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminKpi icon={<Tag className="h-5 w-5" />} label="Total Cupons" value={String(coupons.length)} sub="Criados" gradient="from-violet-500 to-purple-600" glowColor="rgba(139,92,246,0.15)" />
        <AdminKpi icon={<ToggleLeft className="h-5 w-5" />} label="Ativos" value={String(active)} sub={`${expired} expirados`} gradient="from-emerald-500 to-emerald-600" glowColor="rgba(52,211,153,0.15)" />
        <AdminKpi icon={<Percent className="h-5 w-5" />} label="Utilizações" value={String(totalUses)} sub="Vendas com cupom" gradient="from-blue-500 to-indigo-600" glowColor="rgba(59,130,246,0.15)" />
        <AdminKpi icon={<DollarSign className="h-5 w-5" />} label="Descontado" value={fmtCurrency(totalDiscount)} sub="Em campanhas" gradient="from-amber-500 to-orange-600" glowColor="rgba(245,158,11,0.15)" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Filtrar cupons por status" className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border/60 bg-card p-1">
          {([['all','Todos',coupons.length],['active','Ativos',active],['inactive','Pausados',coupons.filter(c => !c.is_active).length],['expired','Expirados',expired]] as const).map(([id,label,count]) => <button key={id} type="button" role="tab" aria-selected={statusFilter === id} onClick={() => setStatusFilter(id)} className={cn("h-8 shrink-0 rounded-lg px-3 text-xs font-bold transition-colors", statusFilter === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{label} <span className="ml-1 tabular-nums opacity-70">{count}</span></button>)}
        </div>
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input placeholder="Buscar cupom ou vendedor..." value={search} onChange={e => setSearch(e.target.value)} className="w-full h-10 pl-10 pr-4 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30" />
        </div>
      </div>

      <AdminPanel>
        <PanelTitle color="violet" icon={<Tag className="h-4 w-4" />}>Cupons ({filtered.length})</PanelTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              {["Código", "Vendedor", "Produto", "Tipo", "Valor", "Usos", "Limite", "Desc. Total", "Compradores", "Status", "Expira", ""].map(h => (
                <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(c => {
                const stats = getCouponStats(c.id);
                const product = c.product_id ? productMap.get(c.product_id) : null;
                return (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setDetail(c)}>
                    <td className="p-3 font-mono text-xs font-bold text-violet-400">{c.code}</td>
                    <td className="p-3 text-xs text-muted-foreground truncate max-w-[140px]">{getSellerName(c.user_id)}</td>
                    <td className="p-3 text-xs text-muted-foreground truncate max-w-[140px]">{product?.name || <span className="italic text-muted-foreground/50">Todos</span>}</td>
                    <td className="p-3 text-[10px] uppercase text-muted-foreground">{c.discount_type}</td>
                    <td className="p-3 text-xs font-bold text-foreground">{c.discount_type === "percentage" ? `${Number(c.discount_value)}%` : fmtCurrency(Number(c.discount_value))}</td>
                    <td className="p-3"><span className="text-xs font-bold bg-muted/30 px-2 py-0.5 rounded text-foreground">{c.current_uses}</span></td>
                    <td className="p-3 text-xs text-muted-foreground">{c.max_uses || "∞"}</td>
                    <td className="p-3 text-xs font-bold text-warning tabular-nums">{fmtCurrency(stats.discount || Number(c.total_discount_amount || 0))}</td>
                    <td className="p-3 text-xs font-bold text-info">{stats.uniqueBuyers}</td>
                    <td className="p-3"><StatusBadge status={c.is_active ? "active" : "inactive"} /></td>
                    <td className="p-3 text-[10px] text-muted-foreground">{c.expires_at ? new Date(c.expires_at).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1" onClick={() => setDetail(c)}>
                        <Users className="h-3 w-3" /> Detalhes
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={12} className="p-10 text-center text-muted-foreground text-xs">Nenhum cupom</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl">
          {detail && (() => {
            const stats = getCouponStats(detail.id);
            const product = detail.product_id ? productMap.get(detail.product_id) : null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-violet-400" />
                    <span className="font-mono">{detail.code}</span>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Kpi label="Tipo" value={detail.discount_type === "percentage" ? `${Number(detail.discount_value)}%` : fmtCurrency(Number(detail.discount_value))} />
                    <Kpi label="Usos" value={`${detail.current_uses}/${detail.max_uses || "∞"}`} />
                    <Kpi label="Descontado" value={fmtCurrency(stats.discount || Number(detail.total_discount_amount || 0))} />
                    <Kpi label="Compradores únicos" value={String(stats.uniqueBuyers)} />
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-3 grid grid-cols-2 gap-3 text-xs">
                    <div><p className="text-[10px] uppercase text-muted-foreground">Vendedor</p><p className="font-bold text-foreground">{getSellerName(detail.user_id)}</p></div>
                    <div><p className="text-[10px] uppercase text-muted-foreground">Produto</p><p className="font-bold text-foreground">{product?.name || "Todos do vendedor"}</p></div>
                    <div><p className="text-[10px] uppercase text-muted-foreground">Criado</p><p className="text-foreground">{new Date(detail.created_at).toLocaleString("pt-BR")}</p></div>
                    <div><p className="text-[10px] uppercase text-muted-foreground">Expira</p><p className="text-foreground">{detail.expires_at ? new Date(detail.expires_at).toLocaleString("pt-BR") : "Sem expiração"}</p></div>
                  </div>

                  <div className="rounded-xl border border-border bg-card/40 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1"><ShoppingBag className="h-3 w-3" /> Vendas com este cupom ({stats.completed.length})</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-border/40 text-[10px] uppercase text-muted-foreground">
                          <th className="text-left p-2 font-bold">Comprador</th>
                          <th className="text-left p-2 font-bold">Email</th>
                          <th className="text-right p-2 font-bold">Valor</th>
                          <th className="text-right p-2 font-bold">Desconto</th>
                          <th className="text-left p-2 font-bold">Data</th>
                        </tr></thead>
                        <tbody>
                          {stats.completed.slice(0, 100).map(t => (
                            <tr key={t.id} className="border-b border-border/20 hover:bg-muted/10">
                              <td className="p-2 font-medium text-foreground truncate max-w-[140px]">{t.customer_name || "—"}</td>
                              <td className="p-2 text-muted-foreground truncate max-w-[200px]">{t.customer_email || "—"}</td>
                              <td className="p-2 text-right font-bold tabular-nums text-foreground">{fmtCurrency(Number(t.amount))}</td>
                              <td className="p-2 text-right font-bold tabular-nums text-warning">−{fmtCurrency(Number(t.discount_amount || 0))}</td>
                              <td className="p-2 text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString("pt-BR")}</td>
                            </tr>
                          ))}
                          {stats.completed.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Sem vendas concretizadas</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-base font-black text-foreground tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
