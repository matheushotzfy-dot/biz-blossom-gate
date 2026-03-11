import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Users, Link2, TrendingUp, DollarSign, Copy, ExternalLink, Eye, Plus,
  BarChart3, CheckCircle2, Clock, XCircle, Search, Percent, Zap, Shield,
  ArrowUpRight, MousePointerClick, ShoppingCart, UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState } from "@/components/PageShell";
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

  // Marketplace products (affiliate-enabled products from other sellers)
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
    if (linksRes.data) setLinks(linksRes.data as AffiliateLink[]);
    if (salesRes.data) setSales(salesRes.data as AffiliateSale[]);
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

  // Generate affiliate link
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
        <PageTitle icon={<Users className="h-6 w-6" />} title="Afiliados" subtitle="Gerencie seu programa de afiliados e comissões" />
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-lg h-9 text-[12px] font-medium">
              <Plus className="h-3.5 w-3.5" /> Criar Link de Afiliado
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-xl border border-border/40 dark:border-foreground/[0.06] bg-card/95 dark:bg-card/90 backdrop-blur-xl p-0 overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-border/30 dark:border-foreground/[0.05]">
              <DialogHeader>
                <DialogTitle className="font-display text-lg flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Link2 className="h-4 w-4 text-primary" />
                  </div>
                  Criar Link de Afiliado
                </DialogTitle>
              </DialogHeader>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Produto</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="mt-1.5 rounded-lg"><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                  <SelectContent>
                    {affiliateProducts.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Seus Produtos</div>
                        {affiliateProducts.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} — {fmt(Number(p.price))} ({(p as any).affiliate_commission || 30}% comissão)
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              {selectedProduct && (
                <div className="p-4 rounded-lg bg-success/5 border border-success/10">
                  <div className="flex items-center gap-2 mb-1">
                    <Percent className="h-3.5 w-3.5 text-success" />
                    <span className="text-[11px] font-bold text-success">Comissão</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground">
                    Você receberá <strong className="text-success">{
                      (() => {
                        const p = [...affiliateProducts, ...marketProducts].find(p => p.id === selectedProduct);
                        return (p as any)?.affiliate_commission || 30;
                      })()
                    }%</strong> de cada venda realizada pelo seu link.
                  </p>
                </div>
              )}
              <Button onClick={handleCreateLink} className="w-full rounded-lg font-medium h-11" disabled={!selectedProduct}>
                <Link2 className="h-4 w-4 mr-2" /> Gerar Link
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/30 border border-border w-fit">
        {([
          { id: "my-products" as const, label: "Meus Produtos", icon: ShoppingCart },
          { id: "affiliate-of" as const, label: "Sou Afiliado", icon: UserPlus },
          { id: "marketplace" as const, label: "Marketplace", icon: Search },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
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
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
              className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-muted-foreground">Produtos com Afiliados</span>
                <ShoppingCart className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-display font-bold text-foreground">{affiliateProducts.length}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.06 }}
              className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-muted-foreground">Afiliados Ativos</span>
                <Users className="h-4 w-4 text-success" />
              </div>
              <p className="text-2xl font-display font-bold text-foreground">{productLinks.length}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.12 }}
              className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-muted-foreground">Vendas via Afiliados</span>
                <TrendingUp className="h-4 w-4 text-warning" />
              </div>
              <p className="text-2xl font-display font-bold text-foreground">{fmt(totalProductSalesViaAff)}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.18 }}
              className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-muted-foreground">Comissões Pagas</span>
                <DollarSign className="h-4 w-4 text-destructive" />
              </div>
              <p className="text-2xl font-display font-bold text-foreground">{fmt(totalProductCommPaid)}</p>
            </motion.div>
          </div>

          {/* Product affiliate list */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Produtos com Programa de Afiliados</h3>
            {affiliateProducts.length === 0 ? (
              <EmptyState icon={<Users className="h-7 w-7" />} title="Nenhum programa ativo" subtitle="Ative afiliados nas configurações do produto" />
            ) : affiliateProducts.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {p.image_url && (
                      <img src={p.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    )}
                    <div>
                      <p className="text-sm font-bold text-foreground">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">{fmt(Number(p.price))} · {(p as any).affiliate_commission || 30}% comissão</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Afiliados</p>
                      <p className="text-sm font-bold">{productLinks.filter(l => l.product_id === p.id).length}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Vendas</p>
                      <p className="text-sm font-bold">{productSales.filter(s => s.product_id === p.id).length}</p>
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
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
              className="col-span-2 rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-medium text-muted-foreground">Comissões Ganhas</span>
                <DollarSign className="h-4 w-4 text-success" />
              </div>
              <p className="text-4xl font-display font-bold text-foreground tracking-tight">{fmt(totalCommissionEarned)}</p>
              <p className="text-[11px] text-muted-foreground/70 mt-1">{mySales.filter(s => s.status === "approved").length} vendas aprovadas</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }}
              className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-muted-foreground">Pendente</span>
                <Clock className="h-4 w-4 text-warning" />
              </div>
              <p className="text-2xl font-display font-bold text-foreground">{fmt(totalCommissionPending)}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.16 }}
              className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-muted-foreground">Cliques / Conv.</span>
                <MousePointerClick className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-display font-bold text-foreground">{totalClicks}</p>
              <p className="text-[11px] text-muted-foreground/70">{conversionRate.toFixed(1)}% conversão</p>
            </motion.div>
          </div>

          {/* My affiliate links */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Meus Links de Afiliado</h3>
            {myLinks.length === 0 ? (
              <EmptyState icon={<Link2 className="h-7 w-7" />} title="Nenhum link" subtitle="Crie seu primeiro link de afiliado" />
            ) : myLinks.map((link, i) => {
              const linkUrl = `${window.location.origin}/pay/${link.slug}`;
              const linkSales = mySales.filter(s => s.affiliate_link_id === link.id);
              const linkRevenue = linkSales.reduce((a, s) => a + s.commission_amount, 0);
              return (
                <motion.div key={link.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-foreground">{getProductName(link.product_id)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{link.commission_pct}% comissão</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={link.is_active} onCheckedChange={() => toggleLinkActive(link)} />
                      <button onClick={() => copyLink(link.slug)}
                        className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                          copiedSlug === link.slug ? "bg-success/10 text-success" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                        )}>
                        {copiedSlug === link.slug ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/20 border border-border/20 mb-3">
                    <p className="font-mono text-[10px] text-muted-foreground truncate">{linkUrl}</p>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="flex items-center gap-1.5">
                      <MousePointerClick className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-[11px] text-muted-foreground">{link.clicks} cliques</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ShoppingCart className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-[11px] text-muted-foreground">{linkSales.length} vendas</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-3 w-3 text-success/50" />
                      <span className="text-[11px] font-bold text-success">{fmt(linkRevenue)}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Sales history */}
          {mySales.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground">Histórico de Comissões</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30">
                      {["Produto", "Venda", "Comissão", "Status", "Data"].map(h => (
                        <th key={h} className="text-left p-3 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {mySales.map(s => (
                      <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 text-[12px] font-medium">{getProductName(s.product_id)}</td>
                        <td className="p-3 text-[12px]">{fmt(s.sale_amount)}</td>
                        <td className="p-3 text-[12px] font-bold text-success">{fmt(s.commission_amount)}</td>
                        <td className="p-3">
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium uppercase",
                            s.status === "approved" && "bg-success/10 text-success",
                            s.status === "pending" && "bg-warning/10 text-warning",
                            s.status === "rejected" && "bg-destructive/10 text-destructive",
                          )}>
                            {s.status === "approved" ? "Pago" : s.status === "pending" ? "Pendente" : "Recusado"}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-muted-foreground">{new Date(s.created_at).toLocaleDateString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── MARKETPLACE TAB ─── */}
      {tab === "marketplace" && (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos para afiliar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {affiliateProducts.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())).map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] overflow-hidden">
                {p.image_url && (
                  <img src={p.image_url} alt="" className="w-full h-32 object-cover" />
                )}
                <div className="p-4">
                  <h4 className="text-sm font-bold text-foreground">{p.name}</h4>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{p.description || "Sem descrição"}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-lg font-display font-bold text-foreground">{fmt(Number(p.price))}</span>
                    <span className="px-2 py-0.5 rounded-md bg-success/10 text-success text-[10px] font-bold">
                      {(p as any).affiliate_commission || 30}% comissão
                    </span>
                  </div>
                  <Button size="sm" className="w-full mt-3 rounded-lg text-[11px] h-8 gap-1.5"
                    onClick={() => { setSelectedProduct(p.id); setOpenCreate(true); }}>
                    <Link2 className="h-3 w-3" /> Afiliar-se
                  </Button>
                </div>
              </motion.div>
            ))}
            {affiliateProducts.length === 0 && (
              <div className="col-span-full">
                <EmptyState icon={<Search className="h-7 w-7" />} title="Nenhum produto disponível" subtitle="Ainda não há produtos com programa de afiliados ativo" />
              </div>
            )}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-4">
        <div className="flex items-center gap-3">
          <Shield className="h-4 w-4 text-primary shrink-0" />
          <p className="text-[11px] text-muted-foreground/70">
            Comissões são creditadas automaticamente após a confirmação do pagamento. Split calculado no servidor.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
