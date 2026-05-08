import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Users, Link2, TrendingUp, DollarSign, Copy, Plus,
  CheckCircle2, Clock, Search, Percent, Shield,
  MousePointerClick, ShoppingCart, UserPlus, Globe,
  Activity, Target, Award, Power, PowerOff, ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { EmptyState } from "@/components/PageShell";
import { cn } from "@/lib/utils";

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

const TABS = [
  { id: "my-products" as const, label: "Meus Produtos", icon: ShoppingCart },
  { id: "affiliate-of" as const, label: "Sou Afiliado", icon: UserPlus },
  { id: "marketplace" as const, label: "Marketplace", icon: Globe },
] as const;

type TabId = typeof TABS[number]["id"];

/* ─── Status Pill ─── */
function StatusPill({ status }: { status: string }) {
  const cfg = {
    approved: { label: "Pago", cls: "bg-success/10 text-success border-success/20", dot: "bg-success" },
    pending: { label: "Pendente", cls: "bg-warning/10 text-warning border-warning/20", dot: "bg-warning" },
    rejected: { label: "Recusado", cls: "bg-destructive/10 text-destructive border-destructive/20", dot: "bg-destructive" },
  }[status] || { label: status, cls: "bg-muted/30 text-muted-foreground border-border/30", dot: "bg-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold border tabular-nums", cfg.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

/* ─── KPI Tile ─── */
function KpiTile({ label, value, icon: Icon, tone = "primary", sub }: {
  label: string; value: string; icon: any; tone?: "primary" | "success" | "warning" | "info"; sub?: string;
}) {
  return (
    <Card className="p-5">
      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center mb-3", `bg-${tone}/10 text-${tone}`)}>
        <Icon className="h-4.5 w-4.5" strokeWidth={2.5} />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-1">{label}</p>
      <p className="font-display text-2xl font-black text-foreground tracking-tight tabular-nums">{value}</p>
      {sub && <p className="text-[10px] font-bold text-muted-foreground/40 mt-1">{sub}</p>}
    </Card>
  );
}

export default function Afiliados() {
  const { user } = useAuth();
  const { data: products = [] } = useProducts();

  const [tab, setTab] = useState<TabId>("my-products");
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
    const { data } = await supabase.from("products_public").select("*").eq("status", "active");
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
    const p = products.find(pr => pr.id === productId);
    return p?.name || "Produto";
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
             <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
             <h1 className="text-3xl font-black tracking-tight text-foreground">Afiliados</h1>
          </div>
          <p className="text-muted-foreground font-medium text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Programas, links e comissões em um único painel operacional.
          </p>
        </div>

        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <button className="bg-primary text-white px-8 h-12 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
              <Plus className="h-5 w-5" strokeWidth={2.5} />
              Novo link
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-border/50 shadow-2xl">
            <div className="px-8 pt-8 pb-4">
              <DialogHeader>
                <DialogTitle className="text-xl font-black flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Link2 className="h-5 w-5 text-primary" />
                  </div>
                  Criar Link de Afiliado
                </DialogTitle>
              </DialogHeader>
            </div>
            <div className="px-8 pb-8 pt-4 space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Produto</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="h-12 rounded-2xl border-border/50 bg-muted/30 px-4 font-bold"><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                  <SelectContent className="rounded-2xl border-border/50 shadow-xl p-2">
                    {affiliateProducts.length > 0 && (
                      <>
                        <div className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Seus Produtos</div>
                        {affiliateProducts.map(p => (
                          <SelectItem key={`own-${p.id}`} value={p.id} className="rounded-xl font-bold py-2.5">
                            {p.name} — {fmt(Number(p.price))}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {marketProducts.filter(mp => !affiliateProducts.some(ap => ap.id === mp.id)).length > 0 && (
                      <>
                        <div className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mt-2 border-t border-border/10 pt-4">Marketplace</div>
                        {marketProducts.filter(mp => !affiliateProducts.some(ap => ap.id === mp.id)).map(p => (
                          <SelectItem key={`mkt-${p.id}`} value={p.id} className="rounded-xl font-bold py-2.5">
                            {p.name} — {fmt(Number(p.price))}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreateLink} className="w-full h-12 rounded-2xl font-black text-sm shadow-lg shadow-primary/20" disabled={!selectedProduct}>
                Gerar Link Operacional
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ─── Global KPIs ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiTile
          label="Comissões Ganhas"
          value={fmt(totalCommissionEarned)}
          sub={`${mySales.filter(s => s.status === "approved").length} venda(s) paga(s)`}
          icon={DollarSign}
          tone="success"
        />
        <KpiTile
          label="A Receber"
          value={fmt(totalCommissionPending)}
          sub={`${mySales.filter(s => s.status === "pending").length} pendente(s)`}
          icon={Clock}
          tone="warning"
        />
        <KpiTile
          label="Cliques · Conversão"
          value={String(totalClicks)}
          sub={`${conversionRate.toFixed(2)}% conversão`}
          icon={MousePointerClick}
          tone="info"
        />
        <KpiTile
          label="Links Ativos"
          value={String(myLinks.filter(l => l.is_active).length)}
          sub={`${myLinks.length} total`}
          icon={Link2}
          tone="primary"
        />
      </div>

      {/* ─── Tabs ─── */}
      <div className="flex items-center bg-muted/30 p-1 rounded-2xl border border-border/50 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); }}
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              tab === t.id ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Workspace ── */}
      <div className="space-y-8">

      {/* ═══ MY PRODUCTS TAB ═══ */}
      {tab === "my-products" && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiTile label="Produtos" value={String(affiliateProducts.length)} icon={ShoppingCart} tone="primary" />
            <KpiTile label="Afiliados" value={String(productLinks.length)} icon={Users} tone="info" />
            <KpiTile label="Receita Afiliados" value={fmt(totalProductSalesViaAff)} icon={TrendingUp} tone="success" />
            <KpiTile label="Comissões Pagas" value={fmt(totalProductCommPaid)} icon={DollarSign} tone="warning" />
          </div>

          <Card className="border-border/40 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 px-8 py-6">
              <div>
                <CardTitle className="text-xl font-black">Programas Ativos</CardTitle>
                <CardDescription className="text-xs font-bold uppercase tracking-wider">{affiliateProducts.length} produtos configurados</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {affiliateProducts.length === 0 ? (
                <div className="p-20 text-center space-y-4">
                   <div className="h-16 w-16 bg-muted rounded-2xl flex items-center justify-center mx-auto">
                      <Users className="h-8 w-8 text-muted-foreground/30" />
                   </div>
                   <p className="text-sm font-black text-muted-foreground">Nenhum programa ativo ainda.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/10">
                        <th className="text-left px-8 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60">Produto</th>
                        <th className="text-right px-8 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60">Preço</th>
                        <th className="text-right px-8 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60">Comissão</th>
                        <th className="text-right px-8 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60">Afiliados</th>
                        <th className="text-right px-8 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60">Vendas</th>
                        <th className="text-right px-8 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60">Receita</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {affiliateProducts.map((p) => {
                        const pLinks = productLinks.filter(l => l.product_id === p.id).length;
                        const pSales = productSales.filter(s => s.product_id === p.id);
                        return (
                          <tr key={p.id} className="group hover:bg-muted/30 transition-all cursor-pointer">
                            <td className="px-8 py-4">
                              <div className="flex items-center gap-3">
                                {p.image_url ? (
                                  <img src={p.image_url} alt="" className="h-10 w-10 rounded-xl object-cover ring-1 ring-border/30" />
                                ) : (
                                  <div className="h-10 w-10 rounded-xl bg-muted/40 flex items-center justify-center">
                                    <ShoppingCart className="h-5 w-5 text-muted-foreground/60" />
                                  </div>
                                )}
                                <span className="text-sm font-black">{p.name}</span>
                              </div>
                            </td>
                            <td className="px-8 py-4 text-right text-sm font-bold text-muted-foreground tabular-nums">{fmt(Number(p.price))}</td>
                            <td className="px-8 py-4 text-right">
                              <span className="text-[10px] font-black text-success bg-success/10 px-2.5 py-1 rounded-lg border border-success/20 tabular-nums uppercase">
                                {(p as any).affiliate_commission || 30}%
                              </span>
                            </td>
                            <td className="px-8 py-4 text-right text-sm font-black text-foreground tabular-nums">{pLinks}</td>
                            <td className="px-8 py-4 text-right text-sm font-black text-foreground tabular-nums">{pSales.length}</td>
                            <td className="px-8 py-4 text-right text-sm font-black text-foreground tabular-nums">
                              {fmt(pSales.reduce((a, s) => a + s.sale_amount, 0))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

      {/* ═══ AFFILIATE OF TAB ═══ */}
      {tab === "affiliate-of" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[13px] font-heading font-bold text-foreground">Meus Links</h2>
              <span className="text-[11px] text-muted-foreground">· {myLinks.length} link(s)</span>
            </div>
            <Button size="sm" variant="outline" className="h-8 text-[11px] gap-1.5 rounded-lg" onClick={() => setOpenCreate(true)}>
              <Plus className="h-3 w-3" /> Adicionar
            </Button>
          </div>

          {myLinks.length === 0 ? (
            <EmptyState
              icon={<Link2 className="h-7 w-7" />}
              title="Nenhum link de afiliado"
              subtitle="Crie seu primeiro link para começar a ganhar comissões."
              action={
                <Button onClick={() => setOpenCreate(true)} className="gap-2 rounded-lg font-semibold">
                  <Plus className="h-4 w-4" /> Criar Primeiro Link
                </Button>
              }
            />
          ) : (
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20">
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Produto / Link</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Comissão</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cliques</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vendas</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Conv.</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ganho</th>
                    <th className="text-center px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {myLinks.map((link) => {
                    const linkSales = mySales.filter(s => s.affiliate_link_id === link.id);
                    const linkRevenue = linkSales.reduce((a, s) => a + s.commission_amount, 0);
                    const convRate = link.clicks > 0 ? ((linkSales.length / link.clicks) * 100).toFixed(1) : "0.0";
                    return (
                      <tr key={link.id} className="border-b border-border/30 last:border-0 hover:bg-muted/15 transition-colors">
                        <td className="px-4 py-3 max-w-[280px]">
                          <p className="text-[12px] font-semibold text-foreground truncate">{getProductName(link.product_id)}</p>
                          <p className="font-mono text-[10px] text-muted-foreground/70 truncate mt-0.5">/pay/{link.slug}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded tabular-nums">
                            {link.commission_pct}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-[12px] text-muted-foreground tabular-nums">{link.clicks}</td>
                        <td className="px-4 py-3 text-right text-[12px] font-semibold text-foreground tabular-nums">{linkSales.length}</td>
                        <td className="px-4 py-3 text-right text-[12px] text-warning tabular-nums">{convRate}%</td>
                        <td className="px-4 py-3 text-right text-[12px] font-bold text-success tabular-nums">{fmt(linkRevenue)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold border",
                            link.is_active
                              ? "bg-success/10 text-success border-success/20"
                              : "bg-muted/30 text-muted-foreground border-border/30"
                          )}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", link.is_active ? "bg-success" : "bg-muted-foreground")} />
                            {link.is_active ? "Ativo" : "Pausado"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => copyLink(link.slug)}
                              title="Copiar link"
                              className={cn(
                                "h-7 w-7 rounded-md flex items-center justify-center transition-colors border",
                                copiedSlug === link.slug
                                  ? "bg-success/10 text-success border-success/20"
                                  : "bg-card text-muted-foreground border-border/40 hover:bg-muted/30 hover:text-foreground"
                              )}
                            >
                              {copiedSlug === link.slug ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              onClick={() => toggleLinkActive(link)}
                              title={link.is_active ? "Pausar" : "Ativar"}
                              className="h-7 w-7 rounded-md flex items-center justify-center transition-colors border bg-card text-muted-foreground border-border/40 hover:bg-muted/30 hover:text-foreground"
                            >
                              {link.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Sales history */}
          {mySales.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-[13px] font-heading font-bold text-foreground">Histórico de Comissões</h2>
                <span className="text-[11px] text-muted-foreground">· {mySales.length} transação(ões)</span>
              </div>
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/20">
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Data</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Produto</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Venda</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">%</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Comissão</th>
                      <th className="text-center px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mySales.map((s) => (
                      <tr key={s.id} className="border-b border-border/30 last:border-0 hover:bg-muted/15 transition-colors">
                        <td className="px-4 py-3 text-[11px] text-muted-foreground tabular-nums font-mono">
                          {new Date(s.created_at).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-3 text-[12px] font-semibold text-foreground">{getProductName(s.product_id)}</td>
                        <td className="px-4 py-3 text-right text-[12px] text-muted-foreground tabular-nums">{fmt(s.sale_amount)}</td>
                        <td className="px-4 py-3 text-right text-[11px] text-muted-foreground tabular-nums">{s.commission_pct}%</td>
                        <td className="px-4 py-3 text-right text-[12px] font-bold text-success tabular-nums">{fmt(s.commission_amount)}</td>
                        <td className="px-4 py-3 text-center"><StatusPill status={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ MARKETPLACE TAB ═══ */}
      {tab === "marketplace" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar produtos para afiliar..."
                className="h-9 pl-9 text-[12px] rounded-lg"
              />
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {affiliateProducts.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())).length} produto(s)
            </span>
          </div>

          {affiliateProducts.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
            <EmptyState icon={<Globe className="h-7 w-7" />} title="Nenhum produto encontrado" subtitle="Não há produtos com programa de afiliados ativo no marketplace." />
          ) : (
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20">
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Produto</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Preço</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Comissão</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ganho/Venda</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {affiliateProducts.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())).map((p) => {
                    const pct = (p as any).affiliate_commission || 30;
                    const earnPerSale = (Number(p.price) * pct) / 100;
                    return (
                      <tr key={p.id} className="border-b border-border/30 last:border-0 hover:bg-muted/15 transition-colors">
                        <td className="px-4 py-3 max-w-[400px]">
                          <div className="flex items-center gap-3">
                            {p.image_url ? (
                              <img src={p.image_url} alt="" className="h-10 w-10 rounded-md object-cover ring-1 ring-border/30" />
                            ) : (
                              <div className="h-10 w-10 rounded-md bg-muted/40 flex items-center justify-center">
                                <ShoppingCart className="h-4 w-4 text-muted-foreground/60" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-[12px] font-semibold text-foreground truncate">{p.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{p.description || "Sem descrição"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-[12px] text-muted-foreground tabular-nums">{fmt(Number(p.price))}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-[11px] font-bold text-success bg-success/10 px-2 py-0.5 rounded tabular-nums">{pct}%</span>
                        </td>
                        <td className="px-4 py-3 text-right text-[12px] font-bold text-success tabular-nums">{fmt(earnPerSale)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-[11px] gap-1.5 rounded-md font-semibold"
                            onClick={() => { setSelectedProduct(p.id); setOpenCreate(true); }}
                          >
                            Afiliar-se <ArrowUpRight className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Footer info */}
      <div className="mt-8 rounded-lg border border-border/40 bg-muted/10 p-3 flex items-center gap-3">
        <Shield className="h-4 w-4 text-muted-foreground/60 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-snug">
          Comissões creditadas automaticamente após confirmação do pagamento. Split processado no servidor com transparência total.
        </p>
      </div>
      </div>
    </div>
  );
}
