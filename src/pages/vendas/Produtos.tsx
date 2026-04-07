import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Package, Plus, Trash2, Eye, MoreVertical,
  Copy, CheckCircle2, Zap,
  Link2, Settings2, Palette, Star,
  ExternalLink, Search, X, Grid3X3,
  List, Sparkles, Crosshair,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import PixelSettingsDialog from "@/components/PixelSettingsDialog";
import type { Tables } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

const ease = [0.16, 1, 0.3, 1] as const;
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
    s === "active" ? "text-success bg-success/8 ring-success/15" :
    s === "inactive" ? "text-destructive bg-destructive/8 ring-destructive/15" :
    "text-warning bg-warning/8 ring-warning/15";
  const statusDot = (s: string) => s === "active" ? "bg-success" : s === "inactive" ? "bg-destructive" : "bg-warning";
  const checkoutThemeLabel = (theme?: string | null) => theme === "white" ? "Branco Premium" : theme === "dark" ? "Cinza Escuro" : "Cinza Suave";

  const statusTabs = [
    { label: "Todos", value: "all" as const, count: products.length },
    { label: "Ativos", value: "active" as const, count: products.filter(p => p.status === "active").length },
    { label: "Inativos", value: "inactive" as const, count: products.filter(p => p.status === "inactive").length },
    { label: "Em revisão", value: "pending_review" as const, count: products.filter(p => p.status === "pending_review").length },
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-28 md:pb-20 relative">
      {/* ═══════════════════ HEADER ═══════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="mb-6 sm:mb-8"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center shadow-lg shadow-primary/5">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-display font-black text-foreground tracking-[-0.02em]">Meus Produtos</h1>
              <p className="text-[11px] text-muted-foreground/40 font-display">
                {products.length} produto{products.length !== 1 ? "s" : ""}
                {activeProducts > 0 && <span className="text-success"> · {activeProducts} ativo{activeProducts !== 1 ? "s" : ""}</span>}
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.03, boxShadow: "0 20px 40px -10px hsl(var(--primary) / 0.3)" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/vendas/produtos/novo/editar")}
            className="h-10 sm:h-11 px-5 sm:px-6 rounded-xl text-[12px] font-display font-bold flex items-center justify-center gap-2 gradient-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-300 shrink-0"
          >
            <Plus className="h-4 w-4" /> Novo Produto
          </motion.button>
        </div>
      </motion.div>

      {/* ═══════════════════ TOOLBAR ═══════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease }}
        className="mb-5 sm:mb-6 rounded-2xl bg-card/80 ring-1 ring-border/10 backdrop-blur-sm"
      >
        <div className="p-2.5 sm:p-3 flex flex-col gap-2.5 sm:gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Status tabs */}
          <div className="flex gap-1 overflow-x-auto scrollbar-none -mx-0.5 px-0.5">
            {statusTabs.map((tab) => {
              const isActive = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    "relative shrink-0 inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-lg text-[10px] sm:text-[11px] font-display font-bold transition-all duration-200 active:scale-[0.97]",
                    isActive
                      ? "bg-primary/8 ring-1 ring-primary/15 text-foreground shadow-sm"
                      : "text-muted-foreground/30 hover:text-muted-foreground/50 hover:bg-muted/5"
                  )}
                >
                  {isActive && (
                    <motion.span layoutId="prod-tab" className="h-1.5 w-1.5 rounded-full bg-primary shadow-sm shadow-primary/50" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />
                  )}
                  {tab.label}
                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded-md font-display font-bold min-w-[20px] text-center tabular-nums", isActive ? "bg-primary/10 text-primary/70" : "bg-muted/5 text-muted-foreground/20")}>{tab.count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56 sm:flex-none">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/20" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto…"
                className="h-9 w-full rounded-lg ring-1 ring-border/10 bg-muted/5 pl-9 pr-9 text-[11px] text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-display backdrop-blur-sm"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 active:scale-90"><X className="h-3.5 w-3.5 text-muted-foreground/30" /></button>
              )}
            </div>
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg ring-1 ring-border/10 bg-muted/5 backdrop-blur-sm">
              {[
                { mode: "grid" as const, icon: Grid3X3 },
                { mode: "list" as const, icon: List },
              ].map(v => (
                <button
                  key={v.mode}
                  onClick={() => setViewMode(v.mode)}
                  className={cn("h-8 w-8 rounded-md flex items-center justify-center transition-all", viewMode === v.mode ? "bg-primary/10 text-primary ring-1 ring-primary/15 shadow-sm" : "text-muted-foreground/25 hover:text-foreground")}
                >
                  <v.icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════ PRODUCTS ═══════════════════ */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease }}
          className="rounded-2xl bg-card/80 ring-1 ring-border/10 p-10 sm:p-16 flex flex-col items-center gap-5 backdrop-blur-sm"
        >
          <div className="h-20 w-20 rounded-2xl bg-primary/5 ring-1 ring-primary/10 flex items-center justify-center relative">
            <Package className="h-8 w-8 text-primary/20" />
          </div>
          <p className="text-[14px] text-muted-foreground/40 font-display font-bold">
            {search || statusFilter !== "all" ? "Nenhum produto encontrado" : "Nenhum produto criado"}
          </p>
          <p className="text-[11px] text-muted-foreground/20 font-display max-w-xs text-center">
            {search || statusFilter !== "all" ? "Ajuste os filtros ou busca" : "Crie seu primeiro infoproduto e comece a vender"}
          </p>
          {!search && statusFilter === "all" && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/vendas/produtos/novo/editar")}
              className="mt-3 h-11 px-6 rounded-xl text-[12px] font-display font-bold flex items-center gap-2 gradient-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all"
            >
              <Plus className="h-4 w-4" /> Criar Primeiro Produto
            </motion.button>
          )}
        </motion.div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {filtered.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: Math.min(i * 0.05, 0.3), ease }}
              className="group relative rounded-2xl bg-card/95 ring-1 ring-border/10 overflow-hidden flex flex-col hover:ring-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500"
            >
              {/* Image */}
              <div className="relative h-44 sm:h-48 overflow-hidden bg-gradient-to-br from-muted/8 to-transparent">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700 ease-out" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-info/[0.03]" />
                    <div className="h-14 w-14 rounded-2xl bg-muted/8 ring-1 ring-border/8 flex items-center justify-center">
                      <Package className="h-7 w-7 text-muted-foreground/10" />
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />

                {/* Status badge */}
                <div className="absolute top-3 right-3 z-10">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-display font-bold ring-1 backdrop-blur-md shadow-lg", statusColor(p.status))}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(p.status), p.status === "active" && "animate-pulse")} />
                    {statusLabel(p.status)}
                  </span>
                </div>

                {/* Menu */}
                <div className="absolute top-3 left-3 z-10 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-8 w-8 rounded-lg bg-card/80 backdrop-blur-md ring-1 ring-border/15 flex items-center justify-center text-muted-foreground hover:text-foreground shadow-lg active:scale-95 transition-all">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-52 rounded-xl border border-border/20 bg-card/95 backdrop-blur-xl shadow-2xl">
                      {p.checkout_url && (
                        <DropdownMenuItem onClick={() => window.open(getCheckoutLink(p.checkout_url!), "_blank")} className="gap-2.5 cursor-pointer text-xs rounded-lg"><Eye className="h-3.5 w-3.5" /> Ver Checkout</DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => copyCheckout(p)} className="gap-2.5 cursor-pointer text-xs rounded-lg"><Copy className="h-3.5 w-3.5" /> Copiar Link</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPixelProduct(p)} className="gap-2.5 cursor-pointer text-xs rounded-lg"><Crosshair className="h-3.5 w-3.5" /> Configurar Pixels</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/vendas/conteudo/${p.id}/builder`)} className="gap-2.5 cursor-pointer text-xs rounded-lg"><Star className="h-3.5 w-3.5" /> Área de Membros</DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border/10" />
                      <DropdownMenuItem onClick={() => handleDelete(p.id)} className="gap-2.5 cursor-pointer text-destructive focus:text-destructive text-xs rounded-lg"><Trash2 className="h-3.5 w-3.5" /> Excluir Produto</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Price Badge */}
                <div className="absolute bottom-3 right-3 z-10">
                  <span className="inline-flex items-baseline gap-0.5 rounded-lg bg-card/90 backdrop-blur-md ring-1 ring-border/10 px-3 py-1.5 shadow-xl">
                    <span className="text-[9px] text-muted-foreground/40 font-display font-bold">R$</span>
                    <span className="text-lg font-display font-black tracking-[-0.03em] text-primary tabular-nums">{Number(p.price).toFixed(2)}</span>
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-5 flex flex-1 flex-col gap-3">
                <div>
                  <h3 className="text-[14px] font-display font-bold text-foreground leading-snug tracking-[-0.01em] line-clamp-1">{p.name}</h3>
                  {p.description
                    ? <p className="text-[11px] text-muted-foreground/35 line-clamp-2 leading-relaxed mt-1 font-display">{p.description}</p>
                    : <p className="text-[11px] text-muted-foreground/15 italic mt-1 font-display">Sem descrição</p>
                  }
                </div>

                {/* Checkout Link */}
                {p.checkout_url && (
                  <button
                    onClick={() => copyCheckout(p)}
                    className="flex items-center gap-2 rounded-lg bg-muted/5 ring-1 ring-border/8 px-3 py-2 hover:ring-primary/15 hover:bg-primary/[0.02] transition-all w-full group/link"
                  >
                    <Link2 className="h-3 w-3 text-primary/30 group-hover/link:text-primary/60 transition-colors shrink-0" />
                    <span className="text-[10px] text-muted-foreground/25 truncate flex-1 text-left group-hover/link:text-primary/50 transition-colors font-mono">
                      {getCheckoutLink(p.checkout_url)}
                    </span>
                    <AnimatePresence mode="wait">
                      {copiedId === p.id ? (
                        <motion.div key="copied" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                          <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                        </motion.div>
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground/15 shrink-0 group-hover/link:text-primary/40 transition-colors" />
                      )}
                    </AnimatePresence>
                  </button>
                )}

                {/* Builder quick access */}
                <div className="rounded-lg ring-1 ring-border/8 bg-muted/[0.03] p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground/30 flex items-center gap-1.5">
                      <Sparkles className="h-2.5 w-2.5 text-primary/40" /> Checkout Builder
                    </p>
                    <p className="text-[10px] font-display font-medium text-muted-foreground/25 mt-0.5 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                      {checkoutThemeLabel(p.checkout_theme)}
                    </p>
                  </div>
                  <button
                    className="h-8 px-3 rounded-lg text-[10px] font-display font-bold flex items-center gap-1.5 bg-primary/8 text-primary ring-1 ring-primary/12 hover:bg-primary/12 transition-all"
                    onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)}
                  >
                    <Palette className="h-3 w-3" /> Editar
                  </button>
                </div>

                <div className="flex-1" />

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-border/6">
                  <button
                    className="gap-1.5 rounded-lg text-[11px] h-10 font-display font-bold flex-1 flex items-center justify-center bg-primary/8 text-primary hover:bg-primary/12 ring-1 ring-primary/12 hover:ring-primary/20 transition-all active:scale-[0.97]"
                    onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
                  >
                    <Settings2 className="h-3.5 w-3.5" /> Editar
                  </button>
                  <button
                    className="gap-1.5 rounded-lg text-[11px] h-10 font-display font-bold flex-1 flex items-center justify-center bg-muted/5 ring-1 ring-border/8 text-muted-foreground/40 hover:text-foreground hover:ring-border/20 transition-all active:scale-[0.97]"
                    onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)}
                  >
                    <Palette className="h-3.5 w-3.5" /> Customizar
                  </button>
                  {p.checkout_url && (
                    <button
                      className="rounded-lg h-10 w-10 shrink-0 flex items-center justify-center bg-muted/5 ring-1 ring-border/8 text-muted-foreground/25 hover:text-primary hover:ring-primary/15 transition-all active:scale-[0.95]"
                      onClick={() => window.open(getCheckoutLink(p.checkout_url!), "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {/* Add ghost card */}
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(filtered.length * 0.04, 0.25), ease }}
            onClick={() => navigate("/vendas/produtos/novo/editar")}
            className="rounded-2xl border-2 border-dashed border-border/10 hover:border-primary/20 hover:bg-primary/[0.02] flex flex-col items-center justify-center gap-4 min-h-[340px] sm:min-h-[400px] transition-all group/add active:scale-[0.99]"
          >
            <div className="h-14 w-14 rounded-2xl bg-primary/[0.04] group-hover/add:bg-primary/[0.08] ring-1 ring-primary/8 group-hover/add:ring-primary/15 flex items-center justify-center transition-all">
              <Plus className="h-6 w-6 text-primary/20 group-hover/add:text-primary/50 transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-[13px] font-display font-bold text-muted-foreground/25 group-hover/add:text-foreground/50 transition-colors">Novo Produto</p>
              <p className="text-[11px] text-muted-foreground/15 group-hover/add:text-muted-foreground/30 transition-colors font-display mt-1">Clique para criar</p>
            </div>
          </motion.button>
        </div>
      ) : (
        /* ═══ LIST VIEW ═══ */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease }}
          className="rounded-2xl bg-card/80 ring-1 ring-border/10 backdrop-blur-sm overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-border/8">
                  <th className="text-left px-5 py-4 text-[9px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground/25">Produto</th>
                  <th className="text-left px-4 py-4 text-[9px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground/25">Preço</th>
                  <th className="text-left px-4 py-4 text-[9px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground/25 hidden md:table-cell">Tema</th>
                  <th className="text-left px-4 py-4 text-[9px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground/25">Status</th>
                  <th className="w-36 px-4 py-4 hidden sm:table-cell"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3), ease }}
                    className="border-b border-border/5 transition-all duration-200 group cursor-pointer hover:bg-primary/[0.02] active:bg-primary/[0.04]"
                    onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="h-10 w-10 rounded-lg object-cover ring-1 ring-border/10 shrink-0 group-hover:ring-primary/15 transition-all" />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/5 to-transparent ring-1 ring-border/8 flex items-center justify-center shrink-0 group-hover:ring-primary/15 transition-all">
                            <Package className="h-4 w-4 text-muted-foreground/15" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[12px] sm:text-[13px] font-display font-bold text-foreground truncate max-w-[140px] sm:max-w-none">{p.name}</p>
                          {p.description && <p className="text-[10px] text-muted-foreground/25 truncate mt-0.5 max-w-[120px] sm:max-w-[250px] font-display hidden sm:block">{p.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-[13px] font-display font-black text-foreground tabular-nums">{fmt(Number(p.price))}</span>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-[10px] text-muted-foreground/30 font-display font-bold inline-flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/30" />
                        {checkoutThemeLabel(p.checkout_theme)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[9px] font-display font-bold ring-1", statusColor(p.status))}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(p.status))} />
                        {statusLabel(p.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                        <button className="h-8 px-3 rounded-lg text-[10px] font-display font-bold gap-1 flex items-center text-primary bg-primary/8 ring-1 ring-primary/12 hover:bg-primary/12 transition-all"
                          onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}>
                          <Settings2 className="h-3 w-3" /> Editar
                        </button>
                        <button className="h-8 px-3 rounded-lg text-[10px] font-display font-bold gap-1 flex items-center text-muted-foreground/30 hover:text-foreground ring-1 ring-border/10 hover:ring-border/20 transition-all"
                          onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)}>
                          <Palette className="h-3 w-3" /> Builder
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {pixelProduct && <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={(v) => { if (!v) setPixelProduct(null); }} />}
    </div>
  );
}
