import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageShell, PageTitle, Panel, GlassKpi } from "@/components/PageShell";
import { Store, Search, Star, Users, ShoppingCart, TrendingUp, ExternalLink, Heart, Link2, CheckCircle2, Percent, DollarSign, Filter } from "lucide-react";
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
    // Use products table with specific column selection for security
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
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q)
      );
    }

    if (category !== "all") {
      result = result.filter((p) => p.delivery_type === category);
    }

    switch (sort) {
      case "price_asc":
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      case "commission":
        result = [...result].sort((a, b) => b.affiliate_commission - a.affiliate_commission);
        break;
    }

    return result;
  }, [products, search, category, sort]);

  const avgCommission = products.length > 0
    ? (products.reduce((s, p) => s + p.affiliate_commission, 0) / products.length).toFixed(0)
    : "0";

  const avgTicket = products.length > 0
    ? (products.reduce((s, p) => s + p.price, 0) / products.length).toFixed(0)
    : "0";

  const handleAffiliate = async (product: MarketplaceProduct) => {
    if (!user) {
      toast.error("Faça login para se afiliar a este produto.");
      return;
    }
    setAffiliating(product.id);
    try {
      // Check if already affiliated
      const { data: existing } = await supabase
        .from("affiliate_links")
        .select("id")
        .eq("product_id", product.id)
        .eq("affiliate_user_id", user.id)
        .maybeSingle();

      if (existing) {
        toast.info("Você já possui um link de afiliado para este produto!");
        setAffiliating(null);
        return;
      }

      // Find owner of the product
      const { data: productData } = await supabase
        .from("products")
        .select("user_id")
        .eq("id", product.id)
        .maybeSingle();

      if (!productData) {
        toast.error("Produto não encontrado.");
        setAffiliating(null);
        return;
      }

      if (productData.user_id === user.id) {
        toast.error("Você não pode se afiliar ao seu próprio produto.");
        setAffiliating(null);
        return;
      }

      const slug = `aff-${crypto.randomUUID().slice(0, 10)}`;
      const { error } = await supabase.from("affiliate_links").insert({
        product_id: product.id,
        affiliate_user_id: user.id,
        owner_user_id: productData.user_id,
        slug,
        commission_pct: product.affiliate_commission,
      });

      if (error) {
        toast.error("Erro ao criar link de afiliado.");
      } else {
        const url = `${window.location.origin}/pay/${slug}`;
        await navigator.clipboard.writeText(url);
        toast.success("Link de afiliado criado e copiado!", {
          description: "Acesse a página de Afiliados para gerenciar seus links.",
        });
      }
    } catch {
      toast.error("Erro inesperado. Tente novamente.");
    }
    setAffiliating(null);
  };

  return (
    <PageShell>
      <PageTitle
        icon={<Store className="h-6 w-6" />}
        title="Marketplace"
        subtitle="Descubra produtos para promover como afiliado e comece a ganhar comissões"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassKpi label="Produtos Disponíveis" value={String(products.length)} icon={ShoppingCart} tone="primary" delay={0} />
        <GlassKpi label="Comissão Média" value={`${avgCommission}%`} icon={Percent} tone="success" delay={1} />
        <GlassKpi label="Ticket Médio" value={`R$ ${avgTicket}`} icon={DollarSign} tone="info" delay={2} />
        <GlassKpi label="Resultados" value={String(filtered.length)} icon={TrendingUp} tone="warning" delay={3} />
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou descrição..."
            className="w-full rounded-xl border border-border/40 bg-card/50 backdrop-blur-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-xl border border-border/40 bg-card/50 backdrop-blur-xl px-4 py-3 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        >
          <option value="popular">Mais Populares</option>
          <option value="commission">Maior Comissão</option>
          <option value="price_asc">Menor Preço</option>
          <option value="price_desc">Maior Preço</option>
        </select>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={cn(
              "whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold transition-all duration-300",
              category === cat.id
                ? "bg-primary/10 text-primary ring-1 ring-primary/20 shadow-sm"
                : "bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Panel className="py-16 text-center">
          <Store className="mx-auto h-12 w-12 text-muted-foreground/20 mb-4" />
          <p className="text-sm font-display font-bold text-muted-foreground/40">
            {products.length === 0 ? "Nenhum produto com programa de afiliados ativo" : "Nenhum produto encontrado com esses filtros"}
          </p>
          {search && (
            <button onClick={() => setSearch("")} className="text-xs text-primary hover:underline mt-2">
              Limpar busca
            </button>
          )}
        </Panel>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] }}
                layout
              >
                <Panel className="group flex flex-col overflow-hidden p-0 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/[0.05] transition-all duration-500">
                  {/* Image */}
                  <div className="relative aspect-video bg-gradient-to-br from-muted/20 to-muted/5 overflow-hidden">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05] ease-[cubic-bezier(0.16,1,0.3,1)]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ShoppingCart className="h-10 w-10 text-muted-foreground/15" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent opacity-80" />
                    <div className="absolute top-3 right-3 flex gap-2">
                      <span className="rounded-xl bg-success/90 backdrop-blur-sm px-3 py-1.5 text-[11px] font-black text-success-foreground shadow-lg">
                        {product.affiliate_commission}% comissão
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex flex-col flex-1 p-5">
                    <h3 className="text-[15px] font-display font-black text-foreground line-clamp-2 mb-1 tracking-[-0.02em]">{product.name}</h3>
                    {product.display_name && (
                      <p className="text-[11px] text-muted-foreground/50 mb-2 font-medium">por {product.display_name}</p>
                    )}
                    {product.description && (
                      <p className="text-[11px] text-muted-foreground/40 line-clamp-2 mb-4 leading-relaxed">{product.description}</p>
                    )}

                    <div className="mt-auto">
                      {/* Price + Commission */}
                      <div className="flex items-end justify-between mb-4 pb-4 border-b border-border/10">
                        <div>
                          <p className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-wider">Preço</p>
                          <p className="text-lg font-display font-black text-foreground tabular-nums tracking-tight">
                            {fmt(product.price)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-wider">Você ganha</p>
                          <p className="text-lg font-display font-black text-success tabular-nums tracking-tight">
                            {fmt((product.price * product.affiliate_commission) / 100)}
                          </p>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleAffiliate(product)}
                        disabled={affiliating === product.id}
                        className="w-full gap-2 rounded-xl h-11 text-sm font-display font-bold shadow-lg shadow-primary/20 transition-all duration-300"
                      >
                        {affiliating === product.id ? (
                          <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Link2 className="h-4 w-4" />
                        )}
                        {affiliating === product.id ? "Criando link..." : "Afiliar-se"}
                      </Button>
                    </div>
                  </div>
                </Panel>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </PageShell>
  );
}
