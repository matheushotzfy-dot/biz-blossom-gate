import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Package, Plus, Trash2, Eye, MoreVertical,
  Copy, CheckCircle2,
  Link2, Settings2, Palette, Star,
  ExternalLink, Search, X, Grid3X3,
  List, Sparkles, Crosshair, Loader2,
  TrendingUp, ShoppingCart, Zap,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(p => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!search) return true;
      return p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
    });
  }, [products, search, statusFilter]);

  const activeProducts = products.filter(p => p.status === "active").length;
  const inactiveProducts = products.filter(p => p.status === "inactive").length;
  const pendingProducts = products.filter(p => p.status === "pending_review").length;

  const confirmDelete = async () => {
    if (!user || !deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("products").delete().eq("id", deleteTarget).eq("user_id", user.id);
    setDeleting(false);
    setDeleteTarget(null);
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

  const statusTabs = [
    { label: "Todos", value: "all" as const, count: products.length },
    { label: "Ativos", value: "active" as const, count: activeProducts },
    { label: "Inativos", value: "inactive" as const, count: inactiveProducts },
    { label: "Em revisão", value: "pending_review" as const, count: pendingProducts },
  ];

  const kpis = [
    { label: "Total", value: products.length, icon: Package, gradient: "from-primary/15 to-primary/5", iconColor: "text-primary", borderColor: "border-primary/10" },
    { label: "Ativos", value: activeProducts, icon: Zap, gradient: "from-success/15 to-success/5", iconColor: "text-success", borderColor: "border-success/10" },
    { label: "Em Revisão", value: pendingProducts, icon: ShoppingCart, gradient: "from-warning/15 to-warning/5", iconColor: "text-warning", borderColor: "border-warning/10" },
    { label: "Inativos", value: inactiveProducts, icon: TrendingUp, gradient: "from-destructive/15 to-destructive/5", iconColor: "text-destructive", borderColor: "border-destructive/10" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-28 md:pb-20 relative">
      {/* ═══════════════════ HEADER ═══════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="mb-6"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-display font-black text-foreground tracking-tight">Meus Produtos</h1>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                Gerencie seus infoprodutos e checkouts
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/vendas/produtos/novo/editar")}
            className="h-10 px-5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 bg-primary text-primary-foreground shadow-md shadow-primary/20 transition-all shrink-0 hover:shadow-lg hover:shadow-primary/25"
          >
            <Plus className="h-4 w-4" /> Novo Produto
          </motion.button>
        </div>
      </motion.div>

      {/* ═══════════════════ KPIs ═══════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5"
      >
        {kpis.map((kpi) => (
          <div key={kpi.label} className={cn("rounded-xl border bg-card p-4 flex items-center gap-3 transition-all", kpi.borderColor)}>
            <div className={cn("h-9 w-9 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0", kpi.gradient)}>
              <kpi.icon className={cn("h-4 w-4", kpi.iconColor)} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">{kpi.label}</p>
              <p className="text-lg font-black text-foreground tabular-nums">{kpi.value}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ═══════════════════ TOOLBAR ═══════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease }}
        className="mb-5 rounded-xl bg-card border border-border/50"
      >
        <div className="p-2.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Status tabs */}
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {statusTabs.map((tab) => {
              const isActive = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    "relative shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-all duration-200 active:scale-[0.97]",
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/15"
                      : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {isActive && (
                    <motion.span layoutId="prod-tab" className="h-1.5 w-1.5 rounded-full bg-primary" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />
                  )}
                  {tab.label}
                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded-md font-bold min-w-[20px] text-center tabular-nums", isActive ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground/40")}>{tab.count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56 sm:flex-none">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/30" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto…"
                className="h-9 w-full rounded-lg border border-border/50 bg-background pl-9 pr-9 text-[12px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 active:scale-90"><X className="h-3.5 w-3.5 text-muted-foreground/40" /></button>
              )}
            </div>
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg border border-border/50 bg-background">
              {[
                { mode: "grid" as const, icon: Grid3X3 },
                { mode: "list" as const, icon: List },
              ].map(v => (
                <button
                  key={v.mode}
                  onClick={() => setViewMode(v.mode)}
                  className={cn("h-8 w-8 rounded-md flex items-center justify-center transition-all", viewMode === v.mode ? "bg-primary/10 text-primary" : "text-muted-foreground/30 hover:text-foreground")}
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
          className="rounded-xl bg-card border border-border/50 p-12 sm:p-16 flex flex-col items-center gap-4"
        >
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center">
            <Package className="h-7 w-7 text-primary/30" />
          </div>
          <p className="text-sm text-muted-foreground/60 font-bold">
            {search || statusFilter !== "all" ? "Nenhum produto encontrado" : "Nenhum produto criado"}
          </p>
          <p className="text-xs text-muted-foreground/40 max-w-xs text-center">
            {search || statusFilter !== "all" ? "Ajuste os filtros ou busca" : "Crie seu primeiro infoproduto e comece a vender"}
          </p>
          {!search && statusFilter === "all" && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/vendas/produtos/novo/editar")}
              className="mt-2 h-10 px-5 rounded-xl text-[12px] font-bold flex items-center gap-2 bg-primary text-primary-foreground shadow-md shadow-primary/20 transition-all"
            >
              <Plus className="h-4 w-4" /> Criar Primeiro Produto
            </motion.button>
          )}
        </motion.div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.25), ease }}
              className="group relative rounded-xl bg-card border border-border/50 overflow-hidden flex flex-col hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
            >
              {/* Image */}
              <div className="relative h-44 overflow-hidden bg-gradient-to-br from-muted/20 to-muted/5">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="h-14 w-14 rounded-2xl bg-muted/20 border border-border/30 flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground/15" />
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />

                {/* Status badge */}
                <div className="absolute top-3 right-3 z-10">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold border backdrop-blur-sm", statusColor(p.status))}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(p.status), p.status === "active" && "animate-pulse")} />
                    {statusLabel(p.status)}
                  </span>
                </div>

                {/* Menu */}
                <div className="absolute top-3 left-3 z-10 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-8 w-8 rounded-lg bg-card/90 backdrop-blur-sm border border-border/20 flex items-center justify-center text-muted-foreground/60 hover:text-foreground shadow-sm active:scale-95 transition-all">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" sideOffset={6} className="w-52 rounded-xl border border-border/50 bg-card backdrop-blur-xl shadow-xl p-1">
                      <p className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Ações</p>
                      {p.checkout_url && (
                        <DropdownMenuItem onClick={() => window.open(getCheckoutLink(p.checkout_url!), "_blank")} className="gap-2.5 cursor-pointer text-[12px] font-bold rounded-lg h-9 px-3 text-muted-foreground/70 hover:text-foreground">
                          <Eye className="h-3.5 w-3.5 text-info" />
                          Ver Checkout
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => copyCheckout(p)} className="gap-2.5 cursor-pointer text-[12px] font-bold rounded-lg h-9 px-3 text-muted-foreground/70 hover:text-foreground">
                        <Copy className="h-3.5 w-3.5 text-primary" />
                        Copiar Link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPixelProduct(p)} className="gap-2.5 cursor-pointer text-[12px] font-bold rounded-lg h-9 px-3 text-muted-foreground/70 hover:text-foreground">
                        <Crosshair className="h-3.5 w-3.5 text-warning" />
                        Configurar Pixels
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/vendas/conteudo/${p.id}/builder`)} className="gap-2.5 cursor-pointer text-[12px] font-bold rounded-lg h-9 px-3 text-muted-foreground/70 hover:text-foreground">
                        <Star className="h-3.5 w-3.5 text-success" />
                        Área de Membros
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border/30 my-1" />
                      <DropdownMenuItem onClick={() => setDeleteTarget(p.id)} className="gap-2.5 cursor-pointer text-[12px] font-bold rounded-lg h-9 px-3 text-destructive/70 focus:text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir Produto
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Price Badge */}
                <div className="absolute bottom-3 right-3 z-10">
                  <span className="inline-flex items-baseline gap-0.5 rounded-lg bg-card/90 backdrop-blur-sm border border-border/20 px-2.5 py-1.5 shadow-sm">
                    <span className="text-[9px] text-muted-foreground/50 font-bold">R$</span>
                    <span className="text-base font-black tracking-tight text-primary tabular-nums">{Number(p.price).toFixed(2)}</span>
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 flex flex-1 flex-col gap-3">
                <div>
                  <h3 className="text-[13px] font-bold text-foreground leading-snug line-clamp-1">{p.name}</h3>
                  {p.description
                    ? <p className="text-[11px] text-muted-foreground/50 line-clamp-2 leading-relaxed mt-1">{p.description}</p>
                    : <p className="text-[11px] text-muted-foreground/30 italic mt-1">Sem descrição</p>
                  }
                </div>

                {/* Checkout Link */}
                {p.checkout_url && (
                  <button
                    onClick={() => copyCheckout(p)}
                    className="flex items-center gap-2 rounded-lg bg-muted/30 border border-border/30 px-3 py-2 hover:border-primary/20 hover:bg-primary/5 transition-all w-full group/link"
                  >
                    <Link2 className="h-3 w-3 text-primary/40 group-hover/link:text-primary transition-colors shrink-0" />
                    <span className="text-[10px] text-muted-foreground/40 truncate flex-1 text-left group-hover/link:text-primary/70 transition-colors font-mono">
                      {getCheckoutLink(p.checkout_url)}
                    </span>
                    <AnimatePresence mode="wait">
                      {copiedId === p.id ? (
                        <motion.div key="copied" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                          <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                        </motion.div>
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground/20 shrink-0 group-hover/link:text-primary/50 transition-colors" />
                      )}
                    </AnimatePresence>
                  </button>
                )}

                {/* Builder quick access */}
                <div className="rounded-lg border border-border/30 bg-muted/10 p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 flex items-center gap-1.5">
                      <Sparkles className="h-2.5 w-2.5 text-primary/50" /> Checkout Builder
                    </p>
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                      {checkoutThemeLabel(p.checkout_theme)}
                    </p>
                  </div>
                  <button
                    className="h-7 px-2.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/15 hover:bg-primary/15 transition-all"
                    onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)}
                  >
                    <Palette className="h-3 w-3" /> Editar
                  </button>
                </div>

                <div className="flex-1" />

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-border/20">
                  <button
                    className="gap-1.5 rounded-lg text-[11px] h-9 font-bold flex-1 flex items-center justify-center bg-primary/10 text-primary hover:bg-primary/15 border border-primary/15 transition-all active:scale-[0.97]"
                    onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
                  >
                    <Settings2 className="h-3.5 w-3.5" /> Editar
                  </button>
                  <button
                    className="gap-1.5 rounded-lg text-[11px] h-9 font-bold flex-1 flex items-center justify-center bg-muted/30 border border-border/30 text-muted-foreground/60 hover:text-foreground hover:border-border/60 transition-all active:scale-[0.97]"
                    onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)}
                  >
                    <Palette className="h-3.5 w-3.5" /> Customizar
                  </button>
                  {p.checkout_url && (
                    <button
                      className="rounded-lg h-9 w-9 shrink-0 flex items-center justify-center bg-muted/30 border border-border/30 text-muted-foreground/40 hover:text-primary hover:border-primary/20 transition-all active:scale-[0.95]"
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
            className="rounded-xl border-2 border-dashed border-border/30 hover:border-primary/30 hover:bg-primary/5 flex flex-col items-center justify-center gap-4 min-h-[340px] transition-all group/add active:scale-[0.99]"
          >
            <div className="h-12 w-12 rounded-xl bg-primary/5 group-hover/add:bg-primary/10 border border-primary/10 group-hover/add:border-primary/20 flex items-center justify-center transition-all">
              <Plus className="h-5 w-5 text-primary/30 group-hover/add:text-primary/60 transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-[13px] font-bold text-muted-foreground/40 group-hover/add:text-foreground/70 transition-colors">Novo Produto</p>
              <p className="text-[11px] text-muted-foreground/30 group-hover/add:text-muted-foreground/50 transition-colors mt-1">Clique para criar</p>
            </div>
          </motion.button>
        </div>
      ) : (
        /* ═══ LIST VIEW ═══ */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease }}
          className="rounded-xl bg-card border border-border/50 overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40">Produto</th>
                  <th className="text-left px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40">Preço</th>
                  <th className="text-left px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 hidden md:table-cell">Tema</th>
                  <th className="text-left px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40">Status</th>
                  <th className="w-36 px-4 py-3.5 hidden sm:table-cell"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3), ease }}
                    className="border-b border-border/20 transition-colors duration-150 group cursor-pointer hover:bg-muted/30 active:bg-muted/50"
                    onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="h-9 w-9 rounded-lg object-cover border border-border/20 shrink-0" />
                        ) : (
                          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-border/20 flex items-center justify-center shrink-0">
                            <Package className="h-3.5 w-3.5 text-muted-foreground/20" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[12px] font-bold text-foreground truncate max-w-[140px] sm:max-w-none">{p.name}</p>
                          {p.description && <p className="text-[10px] text-muted-foreground/40 truncate mt-0.5 max-w-[120px] sm:max-w-[250px] hidden sm:block">{p.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-[13px] font-black text-foreground tabular-nums">{fmt(Number(p.price))}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-[10px] text-muted-foreground/50 font-bold inline-flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                        {checkoutThemeLabel(p.checkout_theme)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[9px] font-bold border", statusColor(p.status))}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(p.status))} />
                        {statusLabel(p.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                        <button className="h-7 px-2.5 rounded-lg text-[10px] font-bold gap-1 flex items-center text-primary bg-primary/10 border border-primary/15 hover:bg-primary/15 transition-all"
                          onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}>
                          <Settings2 className="h-3 w-3" /> Editar
                        </button>
                        <button className="h-7 px-2.5 rounded-lg text-[10px] font-bold gap-1 flex items-center text-muted-foreground/50 hover:text-foreground border border-border/30 hover:border-border/60 transition-all"
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="rounded-xl border border-border/50 bg-card max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black text-lg">Excluir produto</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground/70 text-sm">
              Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita e todos os dados associados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="rounded-lg font-bold">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="rounded-lg font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
