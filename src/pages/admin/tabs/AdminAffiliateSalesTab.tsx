import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, DollarSign, TrendingUp, Link2, ShoppingCart, Search, Percent } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type AffiliateSale = Tables<"affiliate_sales">;
type AffiliateLink = Tables<"affiliate_links">;

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function AdminAffiliateSalesTab({
  profiles,
  products,
  fmtCurrency,
}: {
  profiles: Tables<"profiles">[];
  products: Tables<"products">[];
  fmtCurrency: (v: number) => string;
}) {
  const [sales, setSales] = useState<AffiliateSale[]>([]);
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const [salesRes, linksRes] = await Promise.all([
        supabase.from("affiliate_sales").select("*").order("created_at", { ascending: false }),
        supabase.from("affiliate_links").select("*"),
      ]);
      if (salesRes.data) setSales(salesRes.data);
      if (linksRes.data) setLinks(linksRes.data);
    };
    load();
  }, []);

  const getName = (userId: string) => profiles.find(p => p.user_id === userId)?.full_name || userId.slice(0, 8);
  const getProductName = (productId: string) => products.find(p => p.id === productId)?.name || "Produto";

  // Only products that have at least one affiliate sale
  const productsWithSales = useMemo(() => {
    const productIds = new Set(sales.map(s => s.product_id));
    return products.filter(p => productIds.has(p.id));
  }, [sales, products]);

  const filteredProducts = useMemo(() => {
    if (!search) return productsWithSales;
    const q = search.toLowerCase();
    return productsWithSales.filter(p => p.name.toLowerCase().includes(q));
  }, [productsWithSales, search]);

  // Global KPIs
  const totalRevenue = sales.reduce((a, s) => a + Number(s.sale_amount), 0);
  const totalCommissions = sales.reduce((a, s) => a + Number(s.commission_amount), 0);
  const uniqueAffiliates = new Set(links.map(l => l.affiliate_user_id)).size;
  const approvedSales = sales.filter(s => s.status === "approved");
  const approvedCommissions = approvedSales.reduce((a, s) => a + Number(s.commission_amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
          <Users className="h-5 w-5 text-indigo-400" /> Vendas de Afiliados
        </h2>
        <p className="text-[12px] text-white/30 mt-1">Apenas produtos com vendas via afiliados são exibidos</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Vendas Totais", value: fmt(totalRevenue), icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10", sub: `${sales.length} transações` },
          { label: "Comissões Pagas", value: fmt(approvedCommissions), icon: DollarSign, color: "text-indigo-400", bg: "bg-indigo-500/10", sub: `${approvedSales.length} aprovadas` },
          { label: "Comissões Pendentes", value: fmt(totalCommissions - approvedCommissions), icon: Percent, color: "text-amber-400", bg: "bg-amber-500/10", sub: "aguardando" },
          { label: "Afiliados Únicos", value: String(uniqueAffiliates), icon: Users, color: "text-violet-400", bg: "bg-violet-500/10", sub: `${links.length} links criados` },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{kpi.label}</span>
              <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center", kpi.bg)}>
                <kpi.icon className={cn("h-4 w-4", kpi.color)} />
              </div>
            </div>
            <p className="text-2xl font-black text-white tracking-tight">{kpi.value}</p>
            <p className="text-[10px] text-white/20 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
        <Input
          placeholder="Buscar produto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 rounded-xl h-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20"
        />
      </div>

      {/* Products with affiliate sales */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-16 text-white/20 text-sm">
          Nenhum produto com vendas de afiliados encontrado
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProducts.map(product => {
            const productSales = sales.filter(s => s.product_id === product.id);
            const productLinks = links.filter(l => l.product_id === product.id);
            const productRevenue = productSales.reduce((a, s) => a + Number(s.sale_amount), 0);
            const productCommissions = productSales.reduce((a, s) => a + Number(s.commission_amount), 0);
            const uniqueProductAffiliates = new Set(productLinks.map(l => l.affiliate_user_id)).size;
            const sellerName = getName(product.user_id);

            return (
              <div key={product.id} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
                {/* Product header */}
                <div className="p-5 border-b border-white/[0.05] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                      <ShoppingCart className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-white">{product.name}</p>
                      <p className="text-[11px] text-white/30">Seller: {sellerName} · {fmt(Number(product.price))}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-[9px] text-white/25 uppercase tracking-wider">Afiliados</p>
                      <p className="text-lg font-bold text-violet-400">{uniqueProductAffiliates}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/25 uppercase tracking-wider">Vendas</p>
                      <p className="text-lg font-bold text-emerald-400">{productSales.length}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/25 uppercase tracking-wider">Receita</p>
                      <p className="text-lg font-bold text-white">{fmt(productRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/25 uppercase tracking-wider">Comissões</p>
                      <p className="text-lg font-bold text-amber-400">{fmt(productCommissions)}</p>
                    </div>
                  </div>
                </div>

                {/* Sales table */}
                {productSales.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.04] text-white/25 text-[10px] uppercase tracking-wider">
                          {["Afiliado", "Venda", "Comissão (%)", "Valor Comissão", "Status", "Data"].map(h => (
                            <th key={h} className="text-left p-3 font-bold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.03]">
                        {productSales.slice(0, 10).map(sale => (
                          <tr key={sale.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="p-3 text-[12px] font-medium text-white/70">{getName(sale.affiliate_user_id)}</td>
                            <td className="p-3 text-[12px] text-white/50">{fmt(Number(sale.sale_amount))}</td>
                            <td className="p-3 text-[12px] text-indigo-400 font-semibold">{Number(sale.commission_pct)}%</td>
                            <td className="p-3 text-[12px] text-emerald-400 font-bold">{fmt(Number(sale.commission_amount))}</td>
                            <td className="p-3">
                              <span className={cn(
                                "inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-bold border",
                                sale.status === "approved" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                                sale.status === "pending" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                                sale.status === "rejected" && "bg-red-500/10 text-red-400 border-red-500/20",
                              )}>
                                {sale.status === "approved" ? "Pago" : sale.status === "pending" ? "Pendente" : "Recusado"}
                              </span>
                            </td>
                            <td className="p-3 text-[11px] text-white/30">{new Date(sale.created_at).toLocaleDateString("pt-BR")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {productSales.length > 10 && (
                      <p className="text-center text-[10px] text-white/20 py-2">+{productSales.length - 10} vendas adicionais</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
