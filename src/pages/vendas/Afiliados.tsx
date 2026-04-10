import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
 Users, Link2, TrendingUp, DollarSign, Copy, ExternalLink, Plus,
 CheckCircle2, Clock, Search, Percent, Zap, Shield,
 MousePointerClick, ShoppingCart, UserPlus, Sparkles,
 Activity, Target, Award, Globe, Eye, BarChart3, Flame,
 Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { EmptyState, SectionHeader, DataTable } from "@/components/PageShell";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
 { id: "my-products" as const, label: "Meus Produtos", icon: ShoppingCart, tone: "primary" },
 { id: "affiliate-of" as const, label: "Sou Afiliado", icon: UserPlus, tone: "success" },
 { id: "marketplace" as const, label: "Marketplace", icon: Globe, tone: "info" },
] as const;

type TabId = typeof TABS[number]["id"];

/* ─── Status Badge ─── */
function StatusBadge({ status }: { status: string }) {
 const cfg = {
 approved: { label: "Pago", cls: "bg-success/10 text-success border-success/15" },
 pending: { label: "Pendente", cls: "bg-warning/10 text-warning border-warning/15" },
 rejected: { label: "Recusado", cls: "bg-destructive/10 text-destructive border-destructive/15" },
 }[status] || { label: status, cls: "bg-muted/10 text-muted-foreground border-border/20" };
 return (
 <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border", cfg.cls)}>
 <span className={cn("h-1.5 w-1.5 rounded-full", status === "approved" ? "bg-success" : status === "pending" ? "bg-warning animate-pulse" : "bg-destructive")} />
 {cfg.label}
 </span>
 );
}

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
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
 className="group rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden relative"
 >
 <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", link.is_active ? "bg-primary" : "bg-muted-foreground/20")} />
 <div className="p-5 pl-5">
 <div className="flex items-start justify-between mb-3.5">
 <div className="flex items-center gap-3 min-w-0">
 <div className={cn(
 "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-border/20 transition-colors",
 link.is_active ? "bg-primary/10" : "bg-muted/15"
 )}>
 <Link2 className={cn("h-4.5 w-4.5", link.is_active ? "text-primary" : "text-muted-foreground/40")} />
 </div>
 <div className="min-w-0">
 <p className="text-[13px] font-display font-bold text-foreground truncate">{productName}</p>
 <div className="flex items-center gap-2 mt-0.5">
 <span className="text-[10px] font-bold text-primary bg-primary/8 px-1.5 py-0.5 rounded-md">{link.commission_pct}%</span>
 <span className="text-[10px] text-muted-foreground/40">comissão por venda</span>
 </div>
 </div>
 </div>
 <div className="flex items-center gap-1.5 shrink-0">
 <Switch checked={link.is_active} onCheckedChange={onToggle} />
 <button onClick={onCopy}
 className={cn(
 "h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-300 border",
 copiedSlug === link.slug
 ? "bg-success/10 text-success border-success/20"
 : "bg-card/50 text-muted-foreground/40 border-border/20 hover:bg-primary/10 hover:text-primary hover:border-primary/20"
 )}>
 {copiedSlug === link.slug ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
 </button>
 </div>
 </div>

 {/* Link URL */}
 <button
 onClick={onCopy}
 className="w-full p-2.5 rounded-xl bg-muted/10 border border-border/20 hover:border-primary/20 hover:bg-primary/[0.03] transition-all duration-300 group/link text-left"
 >
 <p className="font-mono text-[10px] text-muted-foreground/60 truncate group-hover/link:text-primary/70 transition-colors">{linkUrl}</p>
 </button>

 {/* Stats row */}
 <div className="grid grid-cols-4 gap-2 mt-4">
 {[
 { icon: MousePointerClick, label: "Cliques", value: String(link.clicks), color: "text-info" },
 { icon: ShoppingCart, label: "Vendas", value: String(sales.length), color: "text-success" },
 { icon: Target, label: "Conv.", value: `${convRate}%`, color: "text-warning" },
 { icon: DollarSign, label: "Ganho", value: fmt(linkRevenue), color: "text-primary" },
 ].map(stat => (
 <div key={stat.label} className="text-center p-2 rounded-xl bg-muted/5 border border-border/10">
 <stat.icon className={cn("h-3.5 w-3.5 mx-auto mb-1", stat.color)} />
 <p className="text-[12px] font-display font-bold text-foreground tabular-nums">{stat.value}</p>
 <p className="text-[8px] text-muted-foreground/40 uppercase tracking-wider font-bold">{stat.label}</p>
 </div>
 ))}
 </div>
 </div>
 </motion.div>
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
 <div className="mx-auto w-full max-w-[1440px] pb-20 px-1 relative">
 {/* ════════════════════════════════════════════════════════════════ */}
 {/* HERO */}
 {/* ════════════════════════════════════════════════════════════════ */}
 <motion.section
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ duration: 0.6 }}
 className="relative mb-10 rounded-3xl p-6 sm:p-8 lg:p-10 border border-border/60 bg-card shadow-sm"
 >
 <div className="absolute -inset-16 pointer-events-none">
 <motion.div animate={{ x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute top-0 -left-16 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[180px]" />
 <motion.div animate={{ x: [0, -20, 0], y: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 -right-16 w-[500px] h-[500px] bg-success/6 rounded-full blur-[160px]" />
 <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[200px]" />
 <div className="absolute inset-16 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
 </div>

 <div className="relative z-10">
 {/* Top bar */}
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-10">
 <div className="flex items-center gap-3">
 <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
 <Users className="h-4.5 w-4.5 text-primary" />
 </div>
 <span className="text-[12px] font-heading uppercase tracking-[0.15em] text-foreground/80">Afiliados</span>
 <div className="inline-flex items-center gap-2 rounded-full border border-success/15 bg-success/5 px-3 py-1.5 backdrop-blur-sm">
 <span className="relative flex h-2 w-2">
 <span className="absolute h-full w-full animate-ping rounded-full bg-success opacity-30" />
 <span className="relative h-2 w-2 rounded-full bg-success" />
 </span>
 <span className="text-[8px] font-heading uppercase tracking-[0.25em] text-success">{myLinks.filter(l => l.is_active).length + productLinks.length} Ativo{(myLinks.filter(l => l.is_active).length + productLinks.length) !== 1 ? "s" : ""}</span>
 </div>
 </div>
 <Dialog open={openCreate} onOpenChange={setOpenCreate}>
 <DialogTrigger asChild>
 <button className="h-8 px-4 rounded-full text-[10px] font-heading flex items-center gap-1.5 gradient-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 active:scale-[0.97] transition-all duration-300">
 <Plus className="h-3.5 w-3.5" /> Criar Link
 </button>
 </DialogTrigger>
 <DialogContent className="max-w-md rounded-2xl border border-border/40 bg-card/95 backdrop-blur-xl p-0 overflow-hidden">
 <div className="px-6 pt-6 pb-4 border-b border-border/20">
 <DialogHeader>
 <DialogTitle className="font-display text-lg flex items-center gap-2.5">
 <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/15">
 <Link2 className="h-5 w-5 text-primary" />
 </div>
 Criar Link de Afiliado
 </DialogTitle>
 </DialogHeader>
 </div>
 <div className="p-6 space-y-5">
 <div>
 <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-bold">Produto</Label>
 <Select value={selectedProduct} onValueChange={setSelectedProduct}>
 <SelectTrigger className="mt-1.5 rounded-xl h-11"><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
 <SelectContent className="max-h-[300px]">
 {affiliateProducts.length > 0 && (
 <>
 <div className="px-2 py-1.5 text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">Seus Produtos</div>
 {affiliateProducts.map(p => (
 <SelectItem key={`own-${p.id}`} value={p.id}>
 {p.name} — {fmt(Number(p.price))} ({(p as any).affiliate_commission || 30}%)
 </SelectItem>
 ))}
 </>
 )}
 {marketProducts.filter(mp => !affiliateProducts.some(ap => ap.id === mp.id)).length > 0 && (
 <>
 <div className="px-2 py-1.5 text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mt-1 border-t border-border/15 pt-2">Marketplace</div>
 {marketProducts.filter(mp => !affiliateProducts.some(ap => ap.id === mp.id)).map(p => (
 <SelectItem key={`mkt-${p.id}`} value={p.id}>
 {p.name} — {fmt(Number(p.price))}
 </SelectItem>
 ))}
 </>
 )}
 {affiliateProducts.length === 0 && marketProducts.length === 0 && (
 <div className="px-2 py-3 text-[11px] text-muted-foreground/40 text-center">Nenhum produto disponível</div>
 )}
 </SelectContent>
 </Select>
 </div>
 <AnimatePresence>
 {selectedProduct && (
 <motion.div
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height: "auto" }}
 exit={{ opacity: 0, height: 0 }}
 className="overflow-hidden"
 >
 <div className="p-4 rounded-xl bg-success/5 border border-success/10">
 <div className="flex items-center gap-2 mb-1.5">
 <Percent className="h-4 w-4 text-success" />
 <span className="text-[11px] font-display font-bold text-success">Comissão por Venda</span>
 </div>
 <p className="text-[11px] text-muted-foreground/60">
 Você receberá <strong className="text-success text-[14px] font-display">{
 (() => {
 const p = [...affiliateProducts, ...marketProducts].find(pr => pr.id === selectedProduct);
 return (p as any)?.affiliate_commission || 30;
 })()
 }%</strong> de cada venda realizada pelo seu link.
 </p>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 <Button onClick={handleCreateLink} className="w-full rounded-xl font-display font-bold h-11 shadow-lg shadow-primary/20" disabled={!selectedProduct}>
 <Link2 className="h-4 w-4 mr-2" /> Gerar Link de Afiliado
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>

 {/* Main stats */}
 <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }} className="mb-8">
 <p className="text-[10px] font-heading uppercase tracking-[0.2em] text-muted-foreground/40 mb-3">Programa de Afiliados</p>
 <div className="flex items-end gap-4 mb-4">
 <span className="text-5xl sm:text-6xl lg:text-7xl font-heading tabular-nums text-foreground leading-[0.85] [text-shadow:0_0_80px_hsl(var(--primary)/0.2)]">
 {fmt(totalCommissionEarned + totalProductCommPaid)}
 </span>
 </div>
 <div className="flex flex-wrap items-center gap-2 mt-4">
 <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/35 font-display border border-border/60 bg-card shadow-sm rounded-full px-3 py-1.5">
 <Link2 className="h-3 w-3 text-primary" /> {myLinks.length + productLinks.length} links
 </span>
 <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/35 font-display border border-border/60 bg-card shadow-sm rounded-full px-3 py-1.5">
 <ShoppingCart className="h-3 w-3 text-success" /> {mySales.length + productSales.length} vendas
 </span>
 <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/35 font-display border border-border/60 bg-card shadow-sm rounded-full px-3 py-1.5">
 <MousePointerClick className="h-3 w-3" /> {totalClicks} cliques
 </span>
 {conversionRate > 0 && (
 <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/35 font-display border border-border/60 bg-card shadow-sm rounded-full px-3 py-1.5">
 <Target className="h-3 w-3 text-warning" /> {conversionRate.toFixed(1)}% conv.
 </span>
 )}
 </div>
 </motion.div>

 {/* KPI strip */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
 {[
 { label: "Comissões Ganhas", value: fmt(totalCommissionEarned), color: "success", icon: DollarSign },
 { label: "Pendentes", value: fmt(totalCommissionPending), color: "warning", icon: Clock },
 { label: "Cliques Totais", value: String(totalClicks), color: "info", icon: MousePointerClick },
 { label: "Links Ativos", value: String(myLinks.filter(l => l.is_active).length), color: "primary", icon: Link2 },
 ].map((item, idx) => (
 <motion.div key={item.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 + idx * 0.08 }} className="group rounded-2xl border border-border/60 bg-card shadow-sm p-4 overflow-hidden relative">
 <div className={cn("absolute -top-16 -right-16 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[40px] pointer-events-none", `bg-${item.color}/10`)} />
 <div className="relative z-10 flex items-start justify-between">
 <div>
 <p className="text-[9px] font-heading uppercase tracking-[0.2em] text-muted-foreground/30 mb-2">{item.label}</p>
 <p className={cn("text-xl font-heading tabular-nums tracking-tight leading-none", item.color === "primary" ? "text-foreground" : `text-${item.color}`)}>{item.value}</p>
 </div>
 <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110", `bg-${item.color}/8 border-${item.color}/10 text-${item.color}/50`)}>
 <item.icon className="h-4 w-4" />
 </div>
 </div>
 </motion.div>
 ))}
 </div>
 </div>
 </motion.section>

 {/* ─── Tab Navigation — Enterprise pill style with layoutId ─── */}
 <div className="flex items-center gap-1 p-1 rounded-2xl border border-border/60 bg-card shadow-sm w-fit mb-6">
 {TABS.map(t => {
 const isActive = tab === t.id;
 const count = t.id === "my-products" ? affiliateProducts.length
 : t.id === "affiliate-of" ? myLinks.length
 : marketProducts.length;
 return (
 <button
 key={t.id}
 onClick={() => { setTab(t.id); window.scrollTo({ top: 0, behavior: "instant" }); }}
 className={cn(
 "relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-display font-bold transition-all duration-300",
 isActive ? "text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground/70"
 )}
 >
 {isActive && (
 <motion.div
 layoutId="affiliate-tab-bg"
 className="absolute inset-0 rounded-xl bg-card/80 border border-border/30 shadow-sm"
 transition={{ type: "spring", bounce: 0.12, duration: 0.4 }}
 />
 )}
 <t.icon className="h-3.5 w-3.5 relative z-10" />
 <span className="relative z-10">{t.label}</span>
 {count > 0 && (
 <span className={cn(
 "relative z-10 text-[9px] font-black px-1.5 py-0.5 rounded-md transition-colors",
 isActive ? "bg-primary/10 text-primary" : "bg-muted/15 text-muted-foreground/30"
 )}>
 {count}
 </span>
 )}
 </button>
 );
 })}
 </div>

 {/* ─── Tab Content ─── */}
 <AnimatePresence mode="wait">
 <motion.div
 key={tab}
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -8 }}
 transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
 className="space-y-6"
 >
 {/* ═══ MY PRODUCTS TAB ═══ */}
 {tab === "my-products" && (
 <>
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
 {[
 { label: "Produtos Afiliados", value: String(affiliateProducts.length), color: "primary", icon: ShoppingCart },
 { label: "Afiliados Ativos", value: String(productLinks.length), color: "success", icon: Users },
 { label: "Vendas via Afiliados", value: fmt(totalProductSalesViaAff), color: "warning", icon: TrendingUp },
 { label: "Comissões Pagas", value: fmt(totalProductCommPaid), color: "info", icon: DollarSign },
 ].map((item, idx) => (
 <motion.div key={item.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: idx * 0.08 }} className="group rounded-2xl border border-border/60 bg-card shadow-sm p-4 overflow-hidden relative">
 <div className={cn("absolute -top-16 -right-16 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[40px] pointer-events-none", `bg-${item.color}/10`)} />
 <div className="relative z-10 flex items-start justify-between">
 <div>
 <p className="text-[9px] font-heading uppercase tracking-[0.2em] text-muted-foreground/30 mb-2">{item.label}</p>
 <p className={cn("text-xl font-heading tabular-nums tracking-tight leading-none", `text-${item.color}`)}>{item.value}</p>
 </div>
 <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110", `bg-${item.color}/8 border-${item.color}/10 text-${item.color}/50`)}>
 <item.icon className="h-4 w-4" />
 </div>
 </div>
 </motion.div>
 ))}
 </div>

 <SectionHeader
 icon={<Award className="h-4.5 w-4.5" />}
 title="Produtos com Programa de Afiliados"
 subtitle={`${affiliateProducts.length} produto${affiliateProducts.length !== 1 ? "s" : ""} com afiliados habilitados`}
 />

 {affiliateProducts.length === 0 ? (
 <EmptyState icon={<Users className="h-7 w-7" />} title="Nenhum programa ativo" subtitle="Ative o programa de afiliados nas configurações do produto para começar a escalar suas vendas" />
 ) : (
 <div className="space-y-3">
 {affiliateProducts.map((p, i) => (
 <motion.div
 key={p.id}
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
 className="group rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden relative"
 >
 <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />
 <div className="p-5 pl-5">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3.5">
 {p.image_url ? (
 <img src={p.image_url} alt="" className="h-12 w-12 rounded-xl object-cover shadow-sm ring-1 ring-border/15" />
 ) : (
 <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/15">
 <ShoppingCart className="h-5 w-5 text-primary/60" />
 </div>
 )}
 <div>
 <p className="text-[13px] font-display font-bold text-foreground">{p.name}</p>
 <div className="flex items-center gap-2 mt-0.5">
 <span className="text-[11px] text-muted-foreground/60">{fmt(Number(p.price))}</span>
 <span className="text-[9px] font-bold text-success bg-success/8 px-1.5 py-0.5 rounded-md">{(p as any).affiliate_commission || 30}% comissão</span>
 </div>
 </div>
 </div>
 <div className="flex items-center gap-5">
 {[
 { label: "Afiliados", value: productLinks.filter(l => l.product_id === p.id).length, color: "text-info" },
 { label: "Vendas", value: productSales.filter(s => s.product_id === p.id).length, color: "text-success" },
 { label: "Receita", value: fmt(productSales.filter(s => s.product_id === p.id).reduce((a, s) => a + s.sale_amount, 0)), color: "text-primary" },
 ].map(stat => (
 <div key={stat.label} className="text-right hidden sm:block">
 <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.12em]">{stat.label}</p>
 <p className={cn("text-[16px] font-display font-black tabular-nums", stat.color)}>{stat.value}</p>
 </div>
 ))}
 </div>
 </div>
 </div>
 </motion.div>
 ))}
 </div>
 )}
 </>
 )}

 {/* ═══ AFFILIATE OF TAB ═══ */}
 {tab === "affiliate-of" && (
 <>
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
 {[
 { label: "Comissões Ganhas", value: fmt(totalCommissionEarned), color: "success", icon: DollarSign },
 { label: "Pendente", value: fmt(totalCommissionPending), color: "warning", icon: Clock },
 { label: "Cliques Totais", value: String(totalClicks), color: "info", icon: MousePointerClick },
 { label: "Links Ativos", value: String(myLinks.filter(l => l.is_active).length), color: "primary", icon: Link2 },
 ].map((item, idx) => (
 <motion.div key={item.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: idx * 0.08 }} className="group rounded-2xl border border-border/60 bg-card shadow-sm p-4 overflow-hidden relative">
 <div className={cn("absolute -top-16 -right-16 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[40px] pointer-events-none", `bg-${item.color}/10`)} />
 <div className="relative z-10 flex items-start justify-between">
 <div>
 <p className="text-[9px] font-heading uppercase tracking-[0.2em] text-muted-foreground/30 mb-2">{item.label}</p>
 <p className={cn("text-xl font-heading tabular-nums tracking-tight leading-none", `text-${item.color}`)}>{item.value}</p>
 </div>
 <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110", `bg-${item.color}/8 border-${item.color}/10 text-${item.color}/50`)}>
 <item.icon className="h-4 w-4" />
 </div>
 </div>
 </motion.div>
 ))}
 </div>

 <SectionHeader
 icon={<Link2 className="h-4.5 w-4.5" />}
 title="Meus Links de Afiliado"
 subtitle={`${myLinks.length} link${myLinks.length !== 1 ? "s" : ""} criado${myLinks.length !== 1 ? "s" : ""}`}
 />

 {myLinks.length === 0 ? (
 <EmptyState
 icon={<Link2 className="h-7 w-7" />}
 title="Nenhum link de afiliado"
 subtitle="Crie seu primeiro link para começar a ganhar comissões"
 action={
 <Button onClick={() => setOpenCreate(true)} className="gap-2 rounded-xl font-display font-bold shadow-lg shadow-primary/20">
 <Plus className="h-4 w-4" /> Criar Primeiro Link
 </Button>
 }
 />
 ) : (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
 {myLinks.map((link, i) => (
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
 )}

 {/* Sales history */}
 {mySales.length > 0 && (
 <>
 <SectionHeader
 icon={<Activity className="h-4.5 w-4.5" />}
 title="Histórico de Comissões"
 subtitle={`${mySales.length} transaç${mySales.length !== 1 ? "ões" : "ão"}`}
 />
 <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
 <table className="w-full">
 <thead>
 <tr className="border-b border-border/[0.06]">
 <th className="text-left px-5 py-3.5 text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/25">Produto</th>
 <th className="text-left px-4 py-3.5 text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/25">Venda</th>
 <th className="text-left px-4 py-3.5 text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/25">Comissão</th>
 <th className="text-left px-4 py-3.5 text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/25">Status</th>
 <th className="text-left px-4 py-3.5 text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/25">Data</th>
 </tr>
 </thead>
 <tbody>
 {mySales.map((s, i) => (
 <motion.tr
 key={s.id}
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ delay: i * 0.03 }}
 className="border-b border-border/[0.04] transition-all duration-200"
 >
 <td className="px-5 py-4 text-[12px] font-display font-bold">{getProductName(s.product_id)}</td>
 <td className="px-4 py-4 text-[12px] text-muted-foreground tabular-nums font-heading">{fmt(s.sale_amount)}</td>
 <td className="px-4 py-4 text-[12px] font-display font-bold text-success tabular-nums">{fmt(s.commission_amount)}</td>
 <td className="px-4 py-4"><StatusBadge status={s.status} /></td>
 <td className="px-4 py-4 text-[11px] text-muted-foreground/60 tabular-nums font-mono">{new Date(s.created_at).toLocaleDateString("pt-BR")}</td>
 </motion.tr>
 ))}
 </tbody>
 </table>
 </div>
 </>
 )}
 </>
 )}

 {/* ═══ MARKETPLACE TAB ═══ */}
 {tab === "marketplace" && (
 <>
 <div className="flex items-center gap-3">
 <div className="relative flex-1 max-w-md">
 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/15" />
 <input
 value={search}
 onChange={e => setSearch(e.target.value)}
 placeholder="Buscar produtos para afiliar..."
 className="h-9 w-full rounded-xl border border-border/8 bg-card/30 backdrop-blur-lg pl-10 pr-10 text-[12px] text-foreground placeholder:text-muted-foreground/15 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/20 transition-all font-display"
 />
 </div>
 <div className="text-[10px] text-muted-foreground/40 font-bold">
 {affiliateProducts.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())).length} produtos
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {affiliateProducts.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())).map((p, i) => (
 <motion.div
 key={p.id}
 initial={{ opacity: 0, y: 16 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
 className="group/card rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden flex flex-col hover:ring-1 hover:ring-primary/15 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
 >
 {p.image_url ? (
 <div className="relative h-36 overflow-hidden">
 <img src={p.image_url} alt="" className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-700 ease-out" />
 <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
 <div className="absolute top-3 right-3">
 <span className="text-[10px] font-black bg-success/90 text-success-foreground px-2.5 py-1 rounded-lg shadow-lg">
 {(p as any).affiliate_commission || 30}%
 </span>
 </div>
 </div>
 ) : (
 <div className="h-36 flex items-center justify-center bg-gradient-to-br from-primary/8 to-transparent relative">
 <ShoppingCart className="h-12 w-12 text-primary/10" />
 <div className="absolute top-3 right-3">
 <span className="text-[10px] font-black bg-success/90 text-success-foreground px-2.5 py-1 rounded-lg shadow-lg">
 {(p as any).affiliate_commission || 30}%
 </span>
 </div>
 </div>
 )}
 <div className="p-5 flex-1 flex flex-col">
 <h4 className="text-[13px] font-display font-bold text-foreground line-clamp-1">{p.name}</h4>
 <p className="text-[11px] text-muted-foreground/50 mt-1 line-clamp-2 leading-relaxed">{p.description || "Sem descrição"}</p>
 <div className="flex items-center justify-between mt-4 mb-4">
 <span className="text-xl font-heading text-foreground tabular-nums">{fmt(Number(p.price))}</span>
 <span className="text-[10px] text-muted-foreground/40 font-bold">por venda</span>
 </div>
 <div className="mt-auto">
 <Button
 size="sm"
 className="w-full rounded-xl text-[11px] h-10 gap-2 font-display font-bold shadow-lg shadow-primary/20"
 onClick={() => { setSelectedProduct(p.id); setOpenCreate(true); }}
 >
 <Link2 className="h-3.5 w-3.5" /> Afiliar-se a este produto
 </Button>
 </div>
 </div>
 </motion.div>
 ))}
 {affiliateProducts.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
 <div className="col-span-full">
 <EmptyState icon={<Globe className="h-7 w-7" />} title="Nenhum produto encontrado" subtitle="Não há produtos com programa de afiliados ativo no marketplace" />
 </div>
 )}
 </div>
 </>
 )}
 </motion.div>
 </AnimatePresence>

 {/* Footer info */}
 <div className="mt-6 rounded-2xl border border-border/60 bg-card shadow-sm p-5 relative overflow-hidden">
 <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />
 <div className="flex items-center gap-3.5">
 <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 ring-1 ring-primary/15">
 <Shield className="h-4 w-4 text-primary" />
 </div>
 <div>
 <p className="text-[12px] font-display font-bold text-foreground">Comissões Automáticas</p>
 <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
 Comissões são creditadas automaticamente após a confirmação do pagamento. Split calculado no servidor com total transparência.
 </p>
 </div>
 </div>
 </div>
 </div>
 );
}
