import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageShell, PageTitle, Panel } from "@/components/PageShell";
import { Store, Search, Star, Users, ShoppingCart, TrendingUp, ExternalLink, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

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
  { id: "all", label: "Todos" },
  { id: "curso", label: "Cursos" },
  { id: "ebook", label: "E-books" },
  { id: "mentoria", label: "Mentorias" },
  { id: "software", label: "Software" },
];

export default function Marketplace() {
  const { user } = useAuth();
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<"popular" | "price_asc" | "price_desc" | "commission">("popular");

  useEffect(() => {
    supabase
      .from("products")
      .select("id, name, description, price, image_url, affiliate_commission, affiliate_enabled, display_name, delivery_type")
      .eq("status", "active")
      .eq("affiliate_enabled", true)
      .then(({ data }) => {
        if (data) setProducts(data);
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
      result = result.filter((p) => p.delivery_type === category || category === "all");
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

  return (
    <PageShell>
      <PageTitle
        icon={<Store className="h-6 w-6" />}
        title="Marketplace"
        subtitle="Descubra produtos para promover como afiliado"
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Panel className="text-center py-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Produtos Disponíveis</p>
          <p className="text-2xl font-display font-black text-foreground mt-1">{products.length}</p>
        </Panel>
        <Panel className="text-center py-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Comissão Média</p>
          <p className="text-2xl font-display font-black text-primary mt-1">
            {products.length > 0
              ? (products.reduce((s, p) => s + p.affiliate_commission, 0) / products.length).toFixed(0)
              : 0}
            %
          </p>
        </Panel>
        <Panel className="text-center py-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ticket Médio</p>
          <p className="text-2xl font-display font-black text-foreground mt-1">
            R${" "}
            {products.length > 0
              ? (products.reduce((s, p) => s + p.price, 0) / products.length).toFixed(0)
              : "0"}
          </p>
        </Panel>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produtos..."
            className="w-full rounded-xl border border-border/50 bg-muted/30 pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        >
          <option value="popular">Mais Populares</option>
          <option value="commission">Maior Comissão</option>
          <option value="price_asc">Menor Preço</option>
          <option value="price_desc">Maior Preço</option>
        </select>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={cn(
              "whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold transition",
              category === cat.id
                ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                : "bg-muted/30 text-muted-foreground hover:text-foreground"
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
          <Store className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">
            {products.length === 0 ? "Nenhum produto com programa de afiliados ativo" : "Nenhum produto encontrado com esses filtros"}
          </p>
        </Panel>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((product) => (
            <Panel key={product.id} className="group flex flex-col overflow-hidden p-0">
              {/* Image */}
              <div className="relative aspect-video bg-muted/30 overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ShoppingCart className="h-10 w-10 text-muted-foreground/20" />
                  </div>
                )}
                <div className="absolute top-3 right-3 flex gap-2">
                  <span className="rounded-full bg-primary/90 px-3 py-1 text-[11px] font-black text-primary-foreground shadow-lg">
                    {product.affiliate_commission}% comissão
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="flex flex-col flex-1 p-5">
                <h3 className="text-base font-bold text-foreground line-clamp-2 mb-1">{product.name}</h3>
                {product.display_name && (
                  <p className="text-xs text-muted-foreground mb-2">por {product.display_name}</p>
                )}
                {product.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-4">{product.description}</p>
                )}

                <div className="mt-auto flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Preço</p>
                    <p className="text-lg font-black text-foreground">
                      R$ {product.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Você ganha</p>
                    <p className="text-lg font-black text-primary">
                      R${" "}
                      {((product.price * product.affiliate_commission) / 100).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>

                <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary/90">
                  <ExternalLink className="h-4 w-4" />
                  Afiliar-se
                </button>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </PageShell>
  );
}
