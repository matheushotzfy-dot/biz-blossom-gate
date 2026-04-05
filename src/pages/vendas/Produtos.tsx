import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Package, Plus, Trash2, Eye, MoreVertical,
  Copy, CheckCircle2, Zap, TrendingUp, Layers,
  Link2, BarChart3, Crosshair, Settings2, Palette, Star,
  ExternalLink, ShoppingCart, Search, X, Filter, Grid3X3,
  List, ChevronRight, Shield, Sparkles, ArrowUpRight,
  DollarSign, Banknote, Target, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { EmptyState } from "@/components/PageShell";
import PixelSettingsDialog from "@/components/PixelSettingsDialog";
import type { Tables } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

const springTransition = { type: "spring" as const, stiffness: 300, damping: 30, mass: 0.8 };

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function Produtos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: products = [], refetch: loadProducts } = useProducts();
  const [pixelProduct, setPixelProduct] = useState<Tables<"products"> | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "pending_review">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(p => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!search) return true;
      return p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
    });
  }, [products, search, statusFilter]);

  const activeProducts = products.filter(p => p.status === "active").length;
  const totalValue = products.reduce((a, p) => a + Number(p.price), 0);
  const avgPrice = products.length > 0 ? totalValue / products.length : 0;

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (!window.confirm("Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("products").delete().eq("id", id).eq("user_id", user.id);
    if (error) { toast.error("Erro ao excluir produto"); return; }
    toast.success("Produto removido"); loadProducts();
  };

  const getCheckoutLink = (url: string) => {
    const slug = url.split("/").pop()!;
    return `${window.location.origin}/pay/${slug}`;
  };

  const copyCheckout = (p: Tables<"products">) => {
    if (p.checkout_url) {
      navigator.clipboard.writeText(getCheckoutLink(p.checkout_url));
      setCopiedId(p.id);
      toast.success("Link copiado!");
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const statusLabel = (s: string) => s === "active" ? "Ativo" : s === "inactive" ? "Inativo" : "Em revisão";
  const statusColor = (s: string) =>
    s === "active" ? "text-success bg-success/10 border-success/20" :
    s === "inactive" ? "text-destructive bg-destructive/10 border-destructive/20" :
    "text-warning bg-warning/10 border-warning/20";
  const statusDot = (s: string) => s === "active" ? "bg-success" : s === "inactive" ? "bg-destructive" : "bg-warning";
  const checkoutThemeLabel = (theme?: string | null) => theme === "white" ? "Branco Premium" : theme === "dark" ? "Cinza Escuro" : "Cinza Suave";

  return (
    <div className="mx-auto w-full max-w-[1320px] pb-12 px-1">
      {/* ─── HEADER ─── */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-lg shadow-primary/10">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-[26px] font-bold tracking-tight text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Meus Produtos
              </h1>
              <p className="text-[13px] text-muted-foreground/50" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Gerencie, edite e otimize seu catálogo de infoprodutos
              </p>
            </div>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button onClick={() => navigate("/vendas/produtos/novo/editar")} className="gap-2 rounded-xl text-sm font-bold h-11 px-6 shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4" /> Novo Produto
            </Button>
          </motion.div>
        </div>

        {/* Stats strip */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total", value: String(products.length), icon: <Package className="h-4 w-4" />, color: "primary" },
            { label: "Ativos", value: String(activeProducts), icon: <Zap className="h-4 w-4" />, color: "success" },
            { label: "Catálogo", value: fmt(totalValue), icon: <Banknote className="h-4 w-4" />, color: "info" },
            { label: "Ticket Médio", value: fmt(avgPrice), icon: <Target className="h-4 w-4" />, color: "warning" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border/20 bg-card p-3.5 flex items-center gap-3">
              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", `bg-${stat.color}/10 text-${stat.color} border-${stat.color}/20`)}>
                {stat.icon}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{stat.label}</p>
                <p className="text-[16px] font-bold text-foreground leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.header>

      {/* ─── TOOLBAR ─── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: "Todos", value: "all" as const, count: products.length },
            { label: "Ativos", value: "active" as const, count: products.filter(p => p.status === "active").length },
            { label: "Inativos", value: "inactive" as const, count: products.filter(p => p.status === "inactive").length },
            { label: "Em revisão", value: "pending_review" as const, count: products.filter(p => p.status === "pending_review").length },
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[11px] font-bold transition-all active:scale-95",
                statusFilter === tab.value
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/15"
                  : "bg-card text-muted-foreground/50 hover:text-foreground border border-border/20 hover:border-border/40"
              )}
            >
              {tab.label}
              <span className={cn("rounded-lg px-1.5 py-0.5 text-[10px] font-bold tabular-nums", statusFilter === tab.value ? "bg-primary-foreground/15 text-primary-foreground" : "bg-muted/20 text-muted-foreground/35")} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/25" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto…"
              className="h-9 w-full rounded-xl border border-border/15 bg-muted/8 pl-9 pr-8 text-[12px] text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-muted-foreground/30 hover:text-foreground" /></button>
            )}
          </div>
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/8 border border-border/10">
            {[
              { mode: "grid" as const, icon: Grid3X3 },
              { mode: "list" as const, icon: List },
            ].map(v => (
              <button
                key={v.mode}
                onClick={() => setViewMode(v.mode)}
                className={cn("h-8 w-8 rounded-md flex items-center justify-center transition-all", viewMode === v.mode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground/30 hover:text-foreground")}
              >
                <v.icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ─── PRODUCTS ─── */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="h-7 w-7" />}
          title={search || statusFilter !== "all" ? "Nenhum produto encontrado" : "Nenhum produto criado"}
          subtitle={search || statusFilter !== "all" ? "Ajuste os filtros ou busca" : "Crie seu primeiro infoproduto para começar a vender."}
          action={
            !search && statusFilter === "all" ? (
              <Button onClick={() => navigate("/vendas/produtos/novo/editar")} size="sm" className="gap-2 rounded-xl shadow-lg shadow-primary/20">
                <Plus className="h-3.5 w-3.5" /> Criar Produto
              </Button>
            ) : undefined
          }
        />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
              whileHover={{ y: -4 }}
              className="group relative rounded-2xl bg-card border border-border/20 overflow-hidden flex flex-col hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all cursor-default"
            >
              {/* Image */}
              <div className="relative h-44 overflow-hidden bg-gradient-to-br from-muted/20 to-muted/5">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="h-16 w-16 rounded-2xl bg-muted/15 flex items-center justify-center border border-border/10">
                      <Package className="h-8 w-8 text-muted-foreground/12" />
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-90" />

                {/* Status */}
                <div className="absolute top-3 right-3 z-10">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold border shadow-sm backdrop-blur-sm", statusColor(p.status))}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(p.status), p.status === "active" && "animate-pulse")} />
                    {statusLabel(p.status)}
                  </span>
                </div>

                {/* Menu */}
                <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-8 w-8 rounded-xl bg-card/80 backdrop-blur-sm border border-border/20 flex items-center justify-center text-muted-foreground hover:text-foreground shadow-md active:scale-95 transition-all">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-52 rounded-xl">
                      {p.checkout_url && (
                        <DropdownMenuItem onClick={() => window.open(getCheckoutLink(p.checkout_url!), "_blank")} className="gap-2.5 cursor-pointer text-xs rounded-lg"><Eye className="h-3.5 w-3.5" /> Ver Checkout</DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => copyCheckout(p)} className="gap-2.5 cursor-pointer text-xs rounded-lg"><Copy className="h-3.5 w-3.5" /> Copiar Link</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPixelProduct(p)} className="gap-2.5 cursor-pointer text-xs rounded-lg"><Crosshair className="h-3.5 w-3.5" /> Configurar Pixels</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/vendas/conteudo/${p.id}/builder`)} className="gap-2.5 cursor-pointer text-xs rounded-lg"><Star className="h-3.5 w-3.5" /> Área de Membros</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleDelete(p.id)} className="gap-2.5 cursor-pointer text-destructive focus:text-destructive text-xs rounded-lg"><Trash2 className="h-3.5 w-3.5" /> Excluir Produto</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Price */}
                <div className="absolute bottom-3 right-3 z-10">
                  <span className="inline-flex items-baseline gap-0.5 rounded-xl bg-card/90 backdrop-blur-sm border border-border/20 px-3 py-1.5 shadow-lg">
                    <span className="text-[10px] text-muted-foreground/50 font-semibold">R$</span>
                    <span className="text-[18px] font-bold tracking-tight text-primary" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{Number(p.price).toFixed(2)}</span>
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 flex flex-1 flex-col gap-3">
                <div>
                  <h3 className="text-[14px] font-bold text-foreground leading-snug tracking-tight line-clamp-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {p.name}
                  </h3>
                  {p.description
                    ? <p className="text-[11px] text-muted-foreground/40 line-clamp-2 leading-relaxed mt-0.5">{p.description}</p>
                    : <p className="text-[11px] text-muted-foreground/20 italic mt-0.5">Sem descrição</p>
                  }
                </div>

                {/* Checkout Link */}
                {p.checkout_url && (
                  <button
                    onClick={() => copyCheckout(p)}
                    className="flex items-center gap-2.5 rounded-xl bg-muted/8 border border-border/15 px-3 py-2 hover:bg-primary/[0.04] hover:border-primary/15 transition-all w-full group/link"
                  >
                    <div className="h-6 w-6 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                      <Link2 className="h-3 w-3 text-primary/50 group-hover/link:text-primary transition-colors" />
                    </div>
                    <span className="text-[10px] text-muted-foreground/35 truncate flex-1 text-left group-hover/link:text-primary/50 transition-colors" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {getCheckoutLink(p.checkout_url)}
                    </span>
                    {copiedId === p.id
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                      : <Copy className="h-3 w-3 text-muted-foreground/20 shrink-0 group-hover/link:text-primary/40 transition-colors" />
                    }
                  </button>
                )}

                {/* Builder CTA */}
                <div className="rounded-xl border border-primary/10 bg-primary/[0.03] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-primary/60" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Checkout Builder</p>
                      <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border/15 bg-card/60 px-2 py-0.5 text-[10px] font-bold text-muted-foreground/50">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {checkoutThemeLabel(p.checkout_theme)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="gap-1.5 rounded-lg text-[10px] h-8 font-bold shadow-md shadow-primary/15 active:scale-95 transition-all"
                      onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)}
                    >
                      <Palette className="h-3 w-3" /> Builder
                    </Button>
                  </div>
                </div>

                <div className="flex-1" />

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-border/8">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 rounded-lg text-[11px] h-9 font-bold flex-1 bg-primary/[0.05] text-primary hover:bg-primary/10 border border-primary/10 hover:border-primary/20 transition-all active:scale-95"
                    onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
                  >
                    <Settings2 className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 rounded-lg text-[11px] h-9 font-bold flex-1 bg-muted/8 text-muted-foreground hover:text-foreground hover:bg-muted/15 border border-border/10 hover:border-border/25 transition-all active:scale-95"
                    onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)}
                  >
                    <Palette className="h-3.5 w-3.5" /> Customizar
                  </Button>
                  {p.checkout_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg h-9 w-9 p-0 text-muted-foreground/35 hover:text-primary hover:bg-primary/5 border border-border/10 hover:border-primary/15 transition-all active:scale-95"
                      onClick={() => window.open(getCheckoutLink(p.checkout_url!), "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {/* Add ghost card */}
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(filtered.length * 0.04, 0.3) }}
            onClick={() => navigate("/vendas/produtos/novo/editar")}
            className="rounded-2xl border-2 border-dashed border-border/12 hover:border-primary/20 hover:bg-primary/[0.02] flex flex-col items-center justify-center gap-3 min-h-[320px] transition-all group/add active:scale-[0.985]"
          >
            <div className="h-14 w-14 rounded-2xl bg-primary/[0.04] group-hover/add:bg-primary/[0.08] border border-primary/10 group-hover/add:border-primary/20 flex items-center justify-center transition-all">
              <Plus className="h-6 w-6 text-primary/25 group-hover/add:text-primary/50 transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-[13px] font-bold text-muted-foreground/35 group-hover/add:text-foreground/60 transition-colors" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Novo Produto</p>
              <p className="text-[11px] text-muted-foreground/20 group-hover/add:text-muted-foreground/35 transition-colors">Clique para criar</p>
            </div>
          </motion.button>
        </div>
      ) : (
        /* ─── LIST VIEW ─── */
        <div className="rounded-2xl border border-border/20 bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/8">
                <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/35">Produto</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/35 hidden sm:table-cell">Preço</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/35 hidden md:table-cell">Tema</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/35">Status</th>
                <th className="w-32 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <motion.tr
                  key={p.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-b border-border/[0.05] hover:bg-primary/[0.02] transition-colors group cursor-pointer"
                  onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-10 w-10 rounded-lg object-cover border border-border/10 shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-muted/10 flex items-center justify-center border border-border/10 shrink-0">
                          <Package className="h-4 w-4 text-muted-foreground/15" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-foreground truncate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{p.name}</p>
                        {p.description && <p className="text-[11px] text-muted-foreground/35 truncate mt-0.5 max-w-[250px]">{p.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <span className="text-[14px] font-bold text-foreground tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{fmt(Number(p.price))}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="text-[11px] text-muted-foreground/40 font-semibold">{checkoutThemeLabel(p.checkout_theme)}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold border", statusColor(p.status))}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(p.status))} />
                      {statusLabel(p.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-8 rounded-lg text-[10px] font-bold gap-1 text-primary bg-primary/5 hover:bg-primary/10 active:scale-95"
                        onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}>
                        <Settings2 className="h-3 w-3" /> Editar
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 rounded-lg text-[10px] font-bold gap-1 text-muted-foreground hover:text-foreground active:scale-95"
                        onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)}>
                        <Palette className="h-3 w-3" /> Builder
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pixelProduct && <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={(v) => { if (!v) setPixelProduct(null); }} />}
    </div>
  );
}
