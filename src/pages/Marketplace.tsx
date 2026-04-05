import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Store, Search, Star, Users, ShoppingCart, TrendingUp, ExternalLink, Heart, Link2, CheckCircle2, Percent, DollarSign, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

type MarketplaceProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  affiliate_commission: number;
  affiliate_enabled: boolean;
  display_name: string | null;
  delivery_type: string;
};

const CATEGORIES = [
  { id: "all", label: "Todos", icon: Filter },
  { id: "curso", label: "Cursos", icon: Star },
  { id: "ebook", label: "E-books", icon: Star },
  { id: "mentoria", label: "Mentorias", icon: Users },
  { id: "software", label: "Software", icon: Star },
];

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function Marketplace() {
  const { user } = useAuth();
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<"popular" | "price_asc" | "price_desc" | "commission">("popular");
  const [affiliating, setAffiliating] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("products")
      .select("id, name, description, price, image_url, affiliate_commission, affiliate_enabled, display_name, delivery_type")
      .eq("status", "active")
      .eq("affiliate_enabled", true)
      .then(({ data }) => {
        if (data) setProducts(data as unknown as MarketplaceProduct[]);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    let result = products;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q));
    }
    if (category !== "all") result = result.filter((p) => p.delivery_type === category);
    switch (sort) {
      case "price_asc": result = [...result].sort((a, b) => a.price - b.price); break;
      case "price_desc": result = [...result].sort((a, b) => b.price - a.price); break;
      case "commission": result = [...result].sort((a, b) => b.affiliate_commission - a.affiliate_commission); break;
    }
    return result;
  }, [products, search, category, sort]);

  const avgCommission = products.length > 0 ? (products.reduce((s, p) => s + p.affiliate_commission, 0) / products.length).toFixed(0) : "0";
  const avgTicket = products.length > 0 ? (products.reduce((s, p) => s + p.price, 0) / products.length).toFixed(0) : "0";

  const handleAffiliate = async (product: MarketplaceProduct) => {
    if (!user) { toast.error("Faça login para se afiliar a este produto."); return; }
    setAffiliating(product.id);
    try {
      const { data: existing } = await supabase.from("affiliate_links").select("id").eq("product_id", product.id).eq("affiliate_user_id", user.id).maybeSingle();
      if (existing) { toast.info("Você já possui um link de afiliado para este produto!"); setAffiliating(null); return; }
      const { data: productData } = await supabase.from("products").select("user_id").eq("id", product.id).maybeSingle();
      if (!productData) { toast.error("Produto não encontrado."); setAffiliating(null); return; }
      if (productData.user_id === user.id) { toast.error("Você não pode se afiliar ao seu próprio produto."); setAffiliating(null); return; }
      const slug = `aff-${crypto.randomUUID().slice(0, 10)}`;
      const { error } = await supabase.from("affiliate_links").insert({ product_id: product.id, affiliate_user_id: user.id, owner_user_id: productData.user_id, slug, commission_pct: product.affiliate_commission });
      if (error) { toast.error("Erro ao criar link de afiliado."); } else {
        const url = `${window.location.origin}/pay/${slug}`;
        await navigator.clipboard.writeText(url);
        toast.success("Link de afiliado criado e copiado!", { description: "Acesse a página de Afiliados para gerenciar seus links." });
      }
    } catch { toast.error("Erro inesperado. Tente novamente."); }
    setAffiliating(null);
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-20 px-1 relative">
      <div className="fixed inset-0 dot-grid opacity-30 pointer-events-none z-0" />

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* HERO                                                            */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative mb-10 rounded-3xl p-6 sm:p-8 lg:p-10 mesh-gradient-hero noise-overlay scan-line"
      >
        <div className="absolute -inset-16 pointer-events-none">
          <motion.div animate={{ x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute top-0 -left-16 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[180px]" />
          <motion.div animate={{ x: [0, -20, 0], y: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 -right-16 w-[500px] h-[500px] bg-success/6 rounded-full blur-[160px]" />
          <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[200px]" />
          <div className="absolute inset-16 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center glow-primary">
              <Store className="h-4.5 w-4.5 text-primary" />
            </div>
            <span className="text-[12px] font-heading uppercase tracking-[0.15em] text-foreground/80">Marketplace</span>
          </div>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }} className="mb-8">
            <p className="text-[10px] font-heading uppercase tracking-[0.2em] text-muted-foreground/40 mb-3">Vitrine de Produtos</p>
            <div className="flex items-end gap-4 mb-4">
              <span className="text-5xl sm:text-6xl lg:text-7xl font-heading tabular-nums text-foreground leading-[0.85] [text-shadow:0_0_80px_hsl(var(--primary)/0.2)]">
                {products.length}
              </span>
              <span className="text-lg font-heading text-muted-foreground/30 mb-1">produto{products.length !== 1 ? "s" : ""}</span>
            </div>
            <p className="text-[12px] text-muted-foreground/30 font-display max-w-lg">Descubra produtos para promover como afiliado e comece a ganhar comissões</p>
          </motion.div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Produtos Disponíveis", value: String(products.length), color: "primary", icon: ShoppingCart },
              { label: "Comissão Média", value: `${avgCommission}%`, color: "success", icon: Percent },
              { label: "Ticket Médio", value: `R$ ${avgTicket}`, color: "info", icon: DollarSign },
              { label: "Resultados", value: String(filtered.length), color: "warning", icon: TrendingUp },
            ].map((item, idx) => (
              <motion.div key={item.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 + idx * 0.08 }} className="group rounded-2xl glass-panel p-4 card-premium overflow-hidden relative">
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

      {/* ─── Filters ─── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button key={cat.id} onClick={() => setCategory(cat.id)}
              className={cn(
                "relative shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-heading transition-all duration-300 active:scale-[0.97]",
                category === cat.id
                  ? "glass-panel ring-1 ring-primary/15 text-foreground shadow-sm"
                  : "text-muted-foreground/25 hover:text-muted-foreground/50 hover:bg-card/20"
              )}>
              {category === cat.id && <motion.span layoutId="mkt-cat" className="h-1.5 w-1.5 rounded-full bg-primary" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
              {cat.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/15" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou descrição..."
              className="h-9 w-full rounded-xl border border-border/8 bg-card/30 backdrop-blur-lg pl-10 pr-10 text-[12px] text-foreground placeholder:text-muted-foreground/15 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/20 transition-all font-display" />
            {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 active:scale-90"><X className="h-3.5 w-3.5 text-muted-foreground/30" /></button>}
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-9 rounded-xl border border-border/8 bg-card/30 backdrop-blur-lg px-3 text-[11px] text-foreground/60 font-heading focus:outline-none focus:ring-2 focus:ring-primary/20">
            <option value="popular">Populares</option>
            <option value="commission">Maior Comissão</option>
            <option value="price_asc">Menor Preço</option>
            <option value="price_desc">Maior Preço</option>
          </select>
        </div>
      </motion.div>

      {/* ─── Products Grid ─── */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl glass-panel p-16 flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-muted/5 border border-border/6 flex items-center justify-center">
            <Store className="h-7 w-7 text-muted-foreground/8" />
          </div>
          <p className="text-[13px] text-muted-foreground/25 font-display font-semibold">
            {products.length === 0 ? "Nenhum produto com programa de afiliados ativo" : "Nenhum produto encontrado com esses filtros"}
          </p>
          {search && <button onClick={() => setSearch("")} className="text-xs text-primary hover:underline mt-1">Limpar busca</button>}
        </motion.div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((product, i) => (
              <motion.div key={product.id}
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] }}
                layout
                className="group rounded-2xl glass-panel overflow-hidden flex flex-col hover:ring-1 hover:ring-primary/15 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 card-premium"
              >
                {/* Image */}
                <div className="relative aspect-video bg-gradient-to-br from-muted/20 to-muted/5 overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05] ease-[cubic-bezier(0.16,1,0.3,1)]" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><ShoppingCart className="h-10 w-10 text-muted-foreground/15" /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent opacity-80" />
                  <div className="absolute top-3 right-3">
                    <span className="rounded-xl bg-success/90 backdrop-blur-sm px-3 py-1.5 text-[11px] font-black text-success-foreground shadow-lg">
                      {product.affiliate_commission}% comissão
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-col flex-1 p-5">
                  <h3 className="text-[15px] font-display font-black text-foreground line-clamp-2 mb-1 tracking-[-0.02em]">{product.name}</h3>
                  {product.display_name && <p className="text-[11px] text-muted-foreground/50 mb-2 font-medium">por {product.display_name}</p>}
                  {product.description && <p className="text-[11px] text-muted-foreground/40 line-clamp-2 mb-4 leading-relaxed">{product.description}</p>}

                  <div className="mt-auto">
                    <div className="flex items-end justify-between mb-4 pb-4 border-b border-border/10">
                      <div>
                        <p className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-wider">Preço</p>
                        <p className="text-lg font-display font-black text-foreground tabular-nums tracking-tight">{fmt(product.price)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-wider">Você ganha</p>
                        <p className="text-lg font-display font-black text-success tabular-nums tracking-tight">{fmt((product.price * product.affiliate_commission) / 100)}</p>
                      </div>
                    </div>
                    <Button onClick={() => handleAffiliate(product)} disabled={affiliating === product.id}
                      className="w-full gap-2 rounded-xl h-11 text-sm font-display font-bold shadow-lg shadow-primary/20 transition-all duration-300">
                      {affiliating === product.id ? <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <Link2 className="h-4 w-4" />}
                      {affiliating === product.id ? "Criando link..." : "Afiliar-se"}
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
