import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Users, Link2, TrendingUp, DollarSign, Copy, ExternalLink, Eye, Plus,
  BarChart3, CheckCircle2, Clock, XCircle, Search, Percent, Zap, Shield,
  ArrowUpRight, MousePointerClick, ShoppingCart, UserPlus, Sparkles,
  Activity, Target, Award, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState, GlassKpi } from "@/components/PageShell";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type AffiliateLink = {
  id: string; product_id: string; affiliate_user_id: string; owner_user_id: string;
  slug: string; commission_pct: number; clicks: number; is_active: boolean; created_at: string;
};
type AffiliateSale = {
  id: string; affiliate_link_id: string; transaction_id: string; product_id: string;
  affiliate_user_id: string; seller_user_id: string; sale_amount: number;
  commission_amount: number; commission_pct: number; status: string; created_at: string;
};

/* KpiCard uses shared GlassKpi */

/* ─── Affiliate Link Card ─── */
function AffiliateLinkCard({ link, productName, sales, copiedSlug, onCopy, onToggle, index }: {
  link: AffiliateLink; productName: string; sales: AffiliateSale[];
  copiedSlug: string | null; onCopy: () => void; onToggle: () => void; index: number;
}) {
  const linkUrl = `${window.location.origin}/pay/${link.slug}`;
  const linkRevenue = sales.reduce((a, s) => a + s.commission_amount, 0);
  const convRate = link.clicks > 0 ? ((sales.length / link.clicks) * 100).toFixed(1) : "0.0";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group rounded-2xl bg-card/60 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-5 hover:border-primary/15 transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Link2 className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-foreground truncate">{productName}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{link.commission_pct}% comissão</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch checked={link.is_active} onCheckedChange={onToggle} />
          <button onClick={onCopy}
            className={cn(
              "h-9 w-9 rounded-xl flex items-center justify-center transition-all",
              copiedSlug === link.slug ? "bg-success/10 text-success" : "bg-muted/30 text-muted-foreground hover:bg-primary/10 hover:text-primary"
            )}>
            {copiedSlug === link.slug ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Link URL */}
      <div className="p-3 rounded-xl bg-muted/15 border border-border/20 mb-4 group-hover:bg-primary/5 group-hover:border-primary/15 transition-all">
        <p className="font-mono text-[11px] text-muted-foreground truncate">{linkUrl}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: MousePointerClick, label: "Cliques", value: String(link.clicks), color: "text-info" },
          { icon: ShoppingCart, label: "Vendas", value: String(sales.length), color: "text-success" },
          { icon: Target, label: "Conv.", value: `${convRate}%`, color: "text-warning" },
          { icon: DollarSign, label: "Ganho", value: fmt(linkRevenue), color: "text-primary" },
        ].map(stat => (
          <div key={stat.label} className="text-center">
            <stat.icon className={cn("h-3.5 w-3.5 mx-auto mb-1", stat.color)} />
            <p className="text-[13px] font-bold text-foreground">{stat.value}</p>
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function Afiliados() {
  const { user } = useAuth();
  const { data: products = [] } = useProducts();

  const [tab, setTab] = useState<"my-products" | "affiliate-of" | "marketplace">("my-products");
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [sales, setSales] = useState<AffiliateSale[]>([]);
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [marketProducts, setMarketProducts] = useState<any[]>([]);

  const affiliateProducts = useMemo(
    () => products.filter((p: any) => p.affiliate_enabled),
    [products]
  );

  const loadData = async () => {
    if (!user) return;
    const [linksRes, salesRes] = await Promise.all([
      supabase.from("affiliate_links" as any).select("*").or(`affiliate_user_id.eq.${user.id},owner_user_id.eq.${user.id}`).order("created_at", { ascending: false }),
      supabase.from("affiliate_sales" as any).select("*").or(`affiliate_user_id.eq.${user.id},seller_user_id.eq.${user.id}`).order("created_at", { ascending: false }),
    ]);
    if (linksRes.data) setLinks(linksRes.data as unknown as AffiliateLink[]);
    if (salesRes.data) setSales(salesRes.data as unknown as AffiliateSale[]);
  };

  const loadMarketplace = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("products_public")
      .select("*")
      .eq("status", "active");
    if (data) setMarketProducts(data.filter((p: any) => p.id));
  };

  useEffect(() => { loadData(); loadMarketplace(); }, [user?.id]);

  const handleCreateLink = async () => {
    if (!user || !selectedProduct) return;
    const product = [...affiliateProducts, ...marketProducts].find(p => p.id === selectedProduct);
    if (!product) { toast.error("Produto não encontrado"); return; }
    const slug = `aff-${crypto.randomUUID().slice(0, 10)}`;
    const { error } = await supabase.from("affiliate_links" as any).insert({
      product_id: selectedProduct,
      affiliate_user_id: user.id,
      owner_user_id: (product as any).user_id || user.id,
      slug,
      commission_pct: (product as any).affiliate_commission || 30,
    });
    if (error) { toast.error("Erro ao criar link de afiliado"); return; }
    toast.success("Link de afiliado criado!");
    setOpenCreate(false); setSelectedProduct("");
    loadData();
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/pay/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const toggleLinkActive = async (link: AffiliateLink) => {
    await supabase.from("affiliate_links" as any).update({ is_active: !link.is_active }).eq("id", link.id);
    loadData();
  };

  // KPIs
  const myLinks = links.filter(l => l.affiliate_user_id === user?.id);
  const productLinks = links.filter(l => l.owner_user_id === user?.id && l.affiliate_user_id !== user?.id);
  const mySales = sales.filter(s => s.affiliate_user_id === user?.id);
  const productSales = sales.filter(s => s.seller_user_id === user?.id);
  const totalCommissionEarned = mySales.filter(s => s.status === "approved").reduce((a, s) => a + s.commission_amount, 0);
  const totalCommissionPending = mySales.filter(s => s.status === "pending").reduce((a, s) => a + s.commission_amount, 0);
  const totalClicks = myLinks.reduce((a, l) => a + l.clicks, 0);
  const totalProductSalesViaAff = productSales.reduce((a, s) => a + s.sale_amount, 0);
  const totalProductCommPaid = productSales.filter(s => s.status === "approved").reduce((a, s) => a + s.commission_amount, 0);
  const conversionRate = totalClicks > 0 ? ((mySales.length / totalClicks) * 100) : 0;

  const getProductName = (productId: string) => {
    const p = products.find(p => p.id === productId);
    return p?.name || "Produto";
  };

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageTitle icon={<Users className="h-6 w-6" />} title="Afiliados" subtitle="Gerencie seu programa de afiliados e maximize suas comissões" />
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl text-sm font-semibold h-10 px-5 shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4" /> Criar Link de Afiliado
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl border border-border/40 dark:border-foreground/[0.06] bg-card/95 dark:bg-card/90 backdrop-blur-xl p-0 overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-border/30 dark:border-foreground/[0.05]">
              <DialogHeader>
                <DialogTitle className="font-display text-lg flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Link2 className="h-5 w-5 text-primary" />
                  </div>
                  Criar Link de Afiliado
                </DialogTitle>
              </DialogHeader>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Produto</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="mt-1.5 rounded-xl h-11"><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {affiliateProducts.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Seus Produtos</div>
                        {affiliateProducts.map(p => (
                          <SelectItem key={`own-${p.id}`} value={p.id}>
                            {p.name} — {fmt(Number(p.price))} ({(p as any).affiliate_commission || 30}% comissão)
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {marketProducts.filter(mp => !affiliateProducts.some(ap => ap.id === mp.id)).length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-1 border-t border-border/20 pt-2">Marketplace</div>
                        {marketProducts.filter(mp => !affiliateProducts.some(ap => ap.id === mp.id)).map(p => (
                          <SelectItem key={`mkt-${p.id}`} value={p.id}>
                            {p.name} — {fmt(Number(p.price))}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {affiliateProducts.length === 0 && marketProducts.length === 0 && (
                      <div className="px-2 py-3 text-[11px] text-muted-foreground text-center">Nenhum produto disponível</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              {selectedProduct && (
                <div className="p-4 rounded-xl bg-success/5 border border-success/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Percent className="h-4 w-4 text-success" />
                    <span className="text-[12px] font-bold text-success">Comissão por Venda</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground">
                    Você receberá <strong className="text-success text-[14px]">{
                      (() => {
                        const p = [...affiliateProducts, ...marketProducts].find(p => p.id === selectedProduct);
                        return (p as any)?.affiliate_commission || 30;
                      })()
                    }%</strong> de cada venda realizada pelo seu link.
                  </p>
                </div>
              )}
              <Button onClick={handleCreateLink} className="w-full rounded-xl font-semibold h-11 shadow-lg shadow-primary/20" disabled={!selectedProduct}>
                <Link2 className="h-4 w-4 mr-2" /> Gerar Link
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/30 border border-border/40 w-fit">
        {([
          { id: "my-products" as const, label: "Meus Produtos", icon: ShoppingCart },
          { id: "affiliate-of" as const, label: "Sou Afiliado", icon: UserPlus },
          { id: "marketplace" as const, label: "Marketplace", icon: Globe },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all",
              tab === t.id ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"
            )}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* ─── MY PRODUCTS TAB ─── */}
      {tab === "my-products" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <GlassKpi label="Produtos Afiliados" value={String(affiliateProducts.length)} icon={ShoppingCart} tone="primary" sub="com programa ativo" delay={0} />
            <GlassKpi label="Afiliados Ativos" value={String(productLinks.length)} icon={Users} tone="success" sub="promovendo" delay={1} />
            <GlassKpi label="Vendas via Afiliados" value={fmt(totalProductSalesViaAff)} icon={TrendingUp} tone="warning" sub="faturamento" delay={2} />
            <GlassKpi label="Comissões Pagas" value={fmt(totalProductCommPaid)} icon={DollarSign} tone="destructive" sub="aos afiliados" delay={3} />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" /> Produtos com Programa de Afiliados
            </h3>
            {affiliateProducts.length === 0 ? (
              <EmptyState icon={<Users className="h-7 w-7" />} title="Nenhum programa ativo" subtitle="Ative afiliados nas configurações do produto para começar" />
            ) : affiliateProducts.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group rounded-2xl bg-card/60 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-5 hover:border-primary/15 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="h-12 w-12 rounded-xl object-cover shadow-sm" />
                    ) : (
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <ShoppingCart className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div>
                      <p className="text-[14px] font-bold text-foreground">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{fmt(Number(p.price))} · <span className="text-success font-semibold">{(p as any).affiliate_commission || 30}% comissão</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div className="hidden sm:block">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Afiliados</p>
                      <p className="text-lg font-display font-bold">{productLinks.filter(l => l.product_id === p.id).length}</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Vendas</p>
                      <p className="text-lg font-display font-bold">{productSales.filter(s => s.product_id === p.id).length}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Receita</p>
                      <p className="text-lg font-display font-bold text-primary">{fmt(productSales.filter(s => s.product_id === p.id).reduce((a, s) => a + s.sale_amount, 0))}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* ─── AFFILIATE OF TAB ─── */}
      {tab === "affiliate-of" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <GlassKpi label="Comissões Ganhas" value={fmt(totalCommissionEarned)} icon={DollarSign} tone="success" sub={`${mySales.filter(s => s.status === "approved").length} vendas aprovadas`} delay={0} large />
            <GlassKpi label="Pendente" value={fmt(totalCommissionPending)} icon={Clock} tone="warning" sub="aguardando" delay={1} large />
            <GlassKpi label="Cliques Totais" value={String(totalClicks)} icon={MousePointerClick} tone="info" sub={`${conversionRate.toFixed(1)}% conversão`} delay={2} />
            <GlassKpi label="Links Ativos" value={String(myLinks.filter(l => l.is_active).length)} icon={Link2} tone="primary" sub={`de ${myLinks.length} total`} delay={3} />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" /> Meus Links de Afiliado
            </h3>
            {myLinks.length === 0 ? (
              <EmptyState icon={<Link2 className="h-7 w-7" />} title="Nenhum link" subtitle="Crie seu primeiro link de afiliado para começar a ganhar comissões" />
            ) : myLinks.map((link, i) => (
              <AffiliateLinkCard
                key={link.id}
                link={link}
                productName={getProductName(link.product_id)}
                sales={mySales.filter(s => s.affiliate_link_id === link.id)}
                copiedSlug={copiedSlug}
                onCopy={() => copyLink(link.slug)}
                onToggle={() => toggleLinkActive(link)}
                index={i}
              />
            ))}
          </div>

          {/* Sales history */}
          {mySales.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-success" /> Histórico de Comissões
              </h3>
              <div className="rounded-2xl bg-card/60 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/30">
                        {["Produto", "Venda", "Comissão", "Status", "Data"].map(h => (
                          <th key={h} className="text-left p-4 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {mySales.map(s => (
                        <tr key={s.id} className="hover:bg-muted/10 transition-colors">
                          <td className="p-4 text-[13px] font-semibold">{getProductName(s.product_id)}</td>
                          <td className="p-4 text-[13px] text-muted-foreground">{fmt(s.sale_amount)}</td>
                          <td className="p-4 text-[13px] font-bold text-success">{fmt(s.commission_amount)}</td>
                          <td className="p-4">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold",
                              s.status === "approved" && "bg-success/10 text-success border border-success/15",
                              s.status === "pending" && "bg-warning/10 text-warning border border-warning/15",
                              s.status === "rejected" && "bg-destructive/10 text-destructive border border-destructive/15",
                            )}>
                              {s.status === "approved" ? "Pago" : s.status === "pending" ? "Pendente" : "Recusado"}
                            </span>
                          </td>
                          <td className="p-4 text-[12px] text-muted-foreground">{new Date(s.created_at).toLocaleDateString("pt-BR")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── MARKETPLACE TAB ─── */}
      {tab === "marketplace" && (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input
              placeholder="Buscar produtos para afiliar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 rounded-xl h-10"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {affiliateProducts.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())).map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="group rounded-2xl bg-card/60 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] overflow-hidden hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500">
                {p.image_url ? (
                  <div className="relative h-36 overflow-hidden">
                    <img src={p.image_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
                  </div>
                ) : (
                  <div className="h-36 flex items-center justify-center bg-gradient-to-br from-primary/8 to-transparent">
                    <ShoppingCart className="h-12 w-12 text-primary/15" />
                  </div>
                )}
                <div className="p-5">
                  <h4 className="text-[14px] font-bold text-foreground line-clamp-1">{p.name}</h4>
                  <p className="text-[11px] text-muted-foreground/60 mt-1 line-clamp-2">{p.description || "Sem descrição"}</p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-xl font-display font-black text-foreground">{fmt(Number(p.price))}</span>
                    <span className="px-3 py-1 rounded-full bg-success/10 text-success text-[11px] font-bold border border-success/15">
                      {(p as any).affiliate_commission || 30}%
                    </span>
                  </div>
                  <Button size="sm" className="w-full mt-4 rounded-xl text-[12px] h-10 gap-2 font-semibold shadow-lg shadow-primary/20"
                    onClick={() => { setSelectedProduct(p.id); setOpenCreate(true); }}>
                    <Link2 className="h-3.5 w-3.5" /> Afiliar-se
                  </Button>
                </div>
              </motion.div>
            ))}
            {affiliateProducts.length === 0 && (
              <div className="col-span-full">
                <EmptyState icon={<Globe className="h-7 w-7" />} title="Nenhum produto disponível" subtitle="Ainda não há produtos com programa de afiliados ativo" />
              </div>
            )}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="rounded-2xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-foreground">Comissões Automáticas</p>
            <p className="text-[11px] text-muted-foreground/60">
              Comissões são creditadas automaticamente após a confirmação do pagamento. Split calculado no servidor.
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
