import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
 DollarSign, TrendingUp, MousePointerClick, ShoppingCart,
 Calendar, Award, Target, BarChart3, Link2, Copy, ExternalLink,
} from "lucide-react";
import { PageShell, PageTitle, GlassKpi, Panel, EmptyState } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";
import { motion } from "framer-motion";

const fmt = formatCurrency;

type AffLink = {
 id: string; product_id: string; slug: string; commission_pct: number;
 clicks: number; is_active: boolean; created_at: string;
};
type AffSale = {
 id: string; affiliate_link_id: string; sale_amount: number;
 commission_amount: number; commission_pct: number; status: string; created_at: string;
};

export default function DashboardAfiliado() {
 const { user } = useAuth();
 const [links, setLinks] = useState<AffLink[]>([]);
 const [sales, setSales] = useState<AffSale[]>([]);
 const [loading, setLoading] = useState(true);
 const [products, setProducts] = useState<Record<string, string>>({});

 useEffect(() => {
 if (!user?.id) return;
 const load = async () => {
 setLoading(true);
 const [linksRes, salesRes] = await Promise.all([
 supabase.from("affiliate_links").select("*").eq("affiliate_user_id", user.id),
 supabase.from("affiliate_sales").select("*").eq("affiliate_user_id", user.id).order("created_at", { ascending: false }),
 ]);
 if (linksRes.error || salesRes.error) toast.error("Não foi possível carregar seus dados de afiliado");
 const myLinks = (linksRes.data || []) as AffLink[];
 setLinks(myLinks);
 setSales((salesRes.data || []) as AffSale[]);

 // Fetch product names
 const productIds = [...new Set(myLinks.map(l => l.product_id))];
 if (productIds.length) {
 const { data: prods } = await supabase.from("products_public").select("id, name").in("id", productIds);
 if (prods) {
 const map: Record<string, string> = {};
 prods.forEach(p => { map[p.id] = p.name; });
 setProducts(map);
 }
 }
 setLoading(false);
 };
 load();
 }, [user?.id]);

 const stats = useMemo(() => {
 const totalClicks = links.reduce((a, l) => a + l.clicks, 0);
 const totalSales = sales.length;
 const totalCommission = sales.filter(s => s.status === "approved").reduce((a, s) => a + s.commission_amount, 0);
 const pendingCommission = sales.filter(s => s.status === "pending").reduce((a, s) => a + s.commission_amount, 0);
 const conversionRate = totalClicks > 0 ? (totalSales / totalClicks) * 100 : 0;
 const totalRevenue = sales.filter(s => s.status === "approved").reduce((a, s) => a + s.sale_amount, 0);
 return { totalClicks, totalSales, totalCommission, pendingCommission, conversionRate, totalRevenue };
 }, [links, sales]);

 const copyLink = (slug: string) => {
 navigator.clipboard.writeText(`${window.location.origin}/pay/${slug}`);
 toast.success("Link copiado!");
 };

 if (loading) {
 return <PageShell><PageTitle icon={<Award className="h-6 w-6" />} title="Painel do Afiliado" subtitle="Suas métricas de afiliado" /><div className="text-muted-foreground text-sm py-12 text-center">Carregando...</div></PageShell>;
 }

 if (links.length === 0) {
 return (
 <PageShell>
 <PageTitle icon={<Award className="h-6 w-6" />} title="Painel do Afiliado" subtitle="Suas métricas de afiliado" />
 <EmptyState icon={<Link2 className="h-10 w-10" />} title="Nenhum link de afiliado" subtitle="Você ainda não é afiliado de nenhum produto. Acesse a página de Afiliados para se afiliar." />
 </PageShell>
 );
 }

 return (
 <PageShell>
 <PageTitle icon={<Award className="h-6 w-6" />} title="Painel do Afiliado" subtitle="Suas métricas de afiliado" />

 {/* KPIs */}
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
 <GlassKpi icon={MousePointerClick} label="Cliques" value={String(stats.totalClicks)} />
 <GlassKpi icon={ShoppingCart} label="Vendas" value={String(stats.totalSales)} />
 <GlassKpi icon={Target} label="Conversão" value={`${stats.conversionRate.toFixed(1)}%`} />
 <GlassKpi icon={DollarSign} label="Comissões Pagas" value={fmt(stats.totalCommission)} />
 <GlassKpi icon={TrendingUp} label="Comissões Pendentes" value={fmt(stats.pendingCommission)} />
 <GlassKpi icon={BarChart3} label="Receita Gerada" value={fmt(stats.totalRevenue)} />
 </div>

 {/* My Links */}
 <Panel className="mb-6">
 <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" />Meus Links de Afiliado</h3>
 <div className="grid gap-3">
 {links.map(link => (
 <motion.div key={link.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
 className="flex items-center justify-between p-4 rounded-xl border border-border/20 bg-card/50">
 <div className="flex-1 min-w-0">
 <div className="font-semibold text-foreground text-sm truncate">{products[link.product_id] || "Produto"}</div>
 <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
 <span>{link.commission_pct}% comissão</span>
 <span>• {link.clicks} cliques</span>
 <span>• {sales.filter(s => s.affiliate_link_id === link.id).length} vendas</span>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border",
 link.is_active ? "bg-success/10 text-success border-success/20" : "bg-muted/10 text-muted-foreground border-border/20"
 )}>{link.is_active ? "Ativo" : "Inativo"}</span>
 <Button variant="outline" size="sm" onClick={() => copyLink(link.slug)} className="gap-1">
 <Copy className="h-3 w-3" /> Copiar
 </Button>
 </div>
 </motion.div>
 ))}
 </div>
 </Panel>

 {/* Recent Sales */}
 <Panel>
 <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" />Vendas Recentes</h3>
 {sales.length === 0 ? (
 <p className="text-sm text-muted-foreground text-center py-8">Nenhuma venda registrada ainda.</p>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-border/20 text-xs text-muted-foreground">
 <th className="text-left py-3 px-3 font-medium">Data</th>
 <th className="text-left py-3 px-3 font-medium">Valor Venda</th>
 <th className="text-left py-3 px-3 font-medium">Comissão</th>
 <th className="text-left py-3 px-3 font-medium">%</th>
 <th className="text-left py-3 px-3 font-medium">Status</th>
 </tr>
 </thead>
 <tbody>
 {sales.slice(0, 20).map(sale => {
 const cfg = sale.status === "approved"
 ? { label: "Pago", cls: "bg-success/10 text-success border-success/20" }
 : sale.status === "pending"
 ? { label: "Pendente", cls: "bg-warning/10 text-warning border-warning/20" }
 : { label: sale.status, cls: "bg-muted/10 text-muted-foreground border-border/20" };
 return (
 <tr key={sale.id} className="border-b border-border/10 hover:bg-muted/5">
 <td className="py-3 px-3 text-muted-foreground">{new Date(sale.created_at).toLocaleDateString("pt-BR")}</td>
 <td className="py-3 px-3 font-medium text-foreground">{fmt(sale.sale_amount)}</td>
 <td className="py-3 px-3 font-bold text-success">{fmt(sale.commission_amount)}</td>
 <td className="py-3 px-3 text-muted-foreground">{sale.commission_pct}%</td>
 <td className="py-3 px-3">
 <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border", cfg.cls)}>
 {cfg.label}
 </span>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 </Panel>
 </PageShell>
 );
}
