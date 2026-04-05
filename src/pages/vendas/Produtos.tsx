import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Package, Plus, Trash2, Eye, MoreVertical,
  Copy, CheckCircle2, Zap, Layers,
  Link2, Settings2, Palette, Star,
  ExternalLink, Search, X, Grid3X3,
  List, Banknote, Target, Crosshair,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { EmptyState } from "@/components/PageShell";
import PixelSettingsDialog from "@/components/PixelSettingsDialog";
import type { Tables } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

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

  const statusTabs = [
    { label: "Todos", value: "all" as const, count: products.length },
    { label: "Ativos", value: "active" as const, count: products.filter(p => p.status === "active").length },
    { label: "Inativos", value: "inactive" as const, count: products.filter(p => p.status === "inactive").length },
    { label: "Em revisão", value: "pending_review" as const, count: products.filter(p => p.status === "pending_review").length },
  ];

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
          <motion.div animate={{ x: [0, -20, 0], y: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 -right-16 w-[500px] h-[500px] bg-info/6 rounded-full blur-[160px]" />
          <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[200px]" />
          <motion.div animate={{ opacity: [0.4, 0.65, 0.4] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} className="absolute -bottom-20 left-[10%] right-[10%] h-[200px] bg-primary/6 rounded-full blur-[120px]" />
          <div className="absolute inset-16 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        </div>

        <div className="relative z-10">
          {/* Top bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center glow-primary">
                <Package className="h-4.5 w-4.5 text-primary" />
              </div>
              <span className="text-[12px] font-heading uppercase tracking-[0.15em] text-foreground/80">Meus Produtos</span>
              <div className="inline-flex items-center gap-2 rounded-full border border-success/15 bg-success/5 px-3 py-1.5 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-success opacity-30" />
                  <span className="relative h-2 w-2 rounded-full bg-success" />
                </span>
                <span className="text-[8px] font-heading uppercase tracking-[0.25em] text-success">{activeProducts} Ativo{activeProducts !== 1 ? "s" : ""}</span>
              </div>
            </div>
            <button
              onClick={() => navigate("/vendas/produtos/novo/editar")}
              className="h-8 px-4 rounded-full text-[10px] font-heading flex items-center gap-1.5 gradient-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 active:scale-[0.97] transition-all duration-300"
            >
              <Plus className="h-3.5 w-3.5" /> Novo Produto
            </button>
          </div>

          {/* Main stats */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }} className="mb-8">
            <p className="text-[10px] font-heading uppercase tracking-[0.2em] text-muted-foreground/40 mb-3">Catálogo de Produtos</p>
            <div className="flex items-end gap-4 mb-4">
              <span className="text-5xl sm:text-6xl lg:text-7xl font-heading tabular-nums text-foreground leading-[0.85] [text-shadow:0_0_80px_hsl(var(--primary)/0.2)]">
                {products.length}
              </span>
              <span className="text-lg font-heading text-muted-foreground/30 mb-1">produto{products.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/35 font-display glass-panel rounded-full px-3 py-1.5">
                <Zap className="h-3 w-3 text-success" /> {activeProducts} ativos
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/35 font-display glass-panel rounded-full px-3 py-1.5">
                <Banknote className="h-3 w-3" /> catálogo {fmt(totalValue)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/35 font-display glass-panel rounded-full px-3 py-1.5">
                <Target className="h-3 w-3" /> ticket médio {fmt(avgPrice)}
              </span>
            </div>
          </motion.div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total Produtos", value: String(products.length), color: "primary", icon: Package },
              { label: "Ativos", value: String(activeProducts), color: "success", icon: Zap },
              { label: "Valor Catálogo", value: fmt(totalValue), color: "info", icon: Banknote },
              { label: "Ticket Médio", value: fmt(avgPrice), color: "warning", icon: Target },
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

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* TOOLBAR                                                         */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }} className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {statusTabs.map((tab) => {
            const isActive = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "relative shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-heading transition-all duration-300 active:scale-[0.97]",
                  isActive
                    ? "glass-panel ring-1 ring-primary/15 text-foreground shadow-sm"
                    : "text-muted-foreground/25 hover:text-muted-foreground/50 hover:bg-card/20"
                )}
              >
                {isActive && (
                  <motion.span layoutId="prod-tab" className="h-1.5 w-1.5 rounded-full bg-primary" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />
                )}
                {tab.label}
                <span className={cn("text-[9px] px-1.5 py-0.5 rounded-md font-heading min-w-[20px] text-center tabular-nums", isActive ? "bg-foreground/5 text-foreground/60" : "bg-muted/10 text-muted-foreground/20")}>{tab.count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/15" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto…"
              className="h-9 w-full rounded-xl border border-border/8 bg-card/30 backdrop-blur-lg pl-10 pr-10 text-[12px] text-foreground placeholder:text-muted-foreground/15 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/20 transition-all font-display"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 active:scale-90"><X className="h-3.5 w-3.5 text-muted-foreground/30" /></button>
            )}
          </div>
          <div className="flex items-center gap-0.5 p-0.5 rounded-xl glass-panel">
            {[
              { mode: "grid" as const, icon: Grid3X3 },
              { mode: "list" as const, icon: List },
            ].map(v => (
              <button
                key={v.mode}
                onClick={() => setViewMode(v.mode)}
                className={cn("h-8 w-8 rounded-lg flex items-center justify-center transition-all", viewMode === v.mode ? "bg-primary/10 text-primary shadow-sm" : "text-muted-foreground/25 hover:text-foreground")}
              >
                <v.icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* PRODUCTS                                                        */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl glass-panel p-16 flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-muted/5 border border-border/6 flex items-center justify-center">
            <Package className="h-7 w-7 text-muted-foreground/8" />
          </div>
          <p className="text-[13px] text-muted-foreground/25 font-display font-semibold">
            {search || statusFilter !== "all" ? "Nenhum produto encontrado" : "Nenhum produto criado"}
          </p>
          <p className="text-[11px] text-muted-foreground/15 font-display">
            {search || statusFilter !== "all" ? "Ajuste os filtros ou busca" : "Crie seu primeiro infoproduto para começar a vender"}
          </p>
          {!search && statusFilter === "all" && (
            <button onClick={() => navigate("/vendas/produtos/novo/editar")} className="mt-2 h-9 px-5 rounded-xl text-[11px] font-heading flex items-center gap-1.5 gradient-primary text-primary-foreground shadow-lg shadow-primary/20 active:scale-[0.97] transition-all">
              <Plus className="h-3.5 w-3.5" /> Criar Produto
            </button>
          )}
        </motion.div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.3) }}
              className="group relative rounded-2xl glass-panel overflow-hidden flex flex-col hover:ring-1 hover:ring-primary/15 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 card-premium"
            >
              {/* Image */}
              <div className="relative h-44 overflow-hidden bg-gradient-to-br from-muted/10 to-muted/5">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="h-16 w-16 rounded-2xl bg-muted/10 flex items-center justify-center border border-border/6">
                      <Package className="h-8 w-8 text-muted-foreground/8" />
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-90" />

                {/* Status */}
                <div className="absolute top-3 right-3 z-10">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-heading border backdrop-blur-sm", statusColor(p.status))}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(p.status), p.status === "active" && "animate-pulse")} />
                    {statusLabel(p.status)}
                  </span>
                </div>

                {/* Menu */}
                <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-8 w-8 rounded-xl bg-card/80 backdrop-blur-sm border border-border/15 flex items-center justify-center text-muted-foreground hover:text-foreground shadow-lg active:scale-95 transition-all">
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

                {/* Price */}
                <div className="absolute bottom-3 right-3 z-10">
                  <span className="inline-flex items-baseline gap-0.5 rounded-xl glass-panel px-3 py-1.5 shadow-lg border border-border/10">
                    <span className="text-[9px] text-muted-foreground/40 font-heading">R$</span>
                    <span className="text-[18px] font-heading tracking-tight text-primary">{Number(p.price).toFixed(2)}</span>
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 flex flex-1 flex-col gap-3">
                <div>
                  <h3 className="text-[14px] font-display font-bold text-foreground leading-snug tracking-tight line-clamp-1">
                    {p.name}
                  </h3>
                  {p.description
                    ? <p className="text-[11px] text-muted-foreground/30 line-clamp-2 leading-relaxed mt-0.5 font-display">{p.description}</p>
                    : <p className="text-[11px] text-muted-foreground/15 italic mt-0.5 font-display">Sem descrição</p>
                  }
                </div>

                {/* Checkout Link */}
                {p.checkout_url && (
                  <button
                    onClick={() => copyCheckout(p)}
                    className="flex items-center gap-2.5 rounded-xl glass-panel px-3 py-2 hover:ring-1 hover:ring-primary/15 transition-all w-full group/link"
                  >
                    <div className="h-6 w-6 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                      <Link2 className="h-3 w-3 text-primary/40 group-hover/link:text-primary transition-colors" />
                    </div>
                    <span className="text-[10px] text-muted-foreground/25 truncate flex-1 text-left group-hover/link:text-primary/50 transition-colors font-mono">
                      {getCheckoutLink(p.checkout_url)}
                    </span>
                    {copiedId === p.id
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                      : <Copy className="h-3 w-3 text-muted-foreground/15 shrink-0 group-hover/link:text-primary/40 transition-colors" />
                    }
                  </button>
                )}

                {/* Builder CTA */}
                <div className="rounded-xl border border-primary/8 bg-primary/[0.02] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[9px] font-heading uppercase tracking-[0.2em] text-primary/50">Checkout Builder</p>
                      <div className="mt-1 inline-flex items-center gap-1.5 rounded-full glass-panel px-2 py-0.5 text-[10px] font-heading text-muted-foreground/40">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {checkoutThemeLabel(p.checkout_theme)}
                      </div>
                    </div>
                    <button
                      className="h-8 px-3 rounded-lg text-[10px] font-heading flex items-center gap-1 gradient-primary text-primary-foreground shadow-md shadow-primary/15 active:scale-95 transition-all"
                      onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)}
                    >
                      <Palette className="h-3 w-3" /> Builder
                    </button>
                  </div>
                </div>

                <div className="flex-1" />

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-border/[0.06]">
                  <button
                    className="gap-1.5 rounded-xl text-[11px] h-9 font-heading flex-1 flex items-center justify-center bg-primary/[0.06] text-primary hover:bg-primary/10 border border-primary/10 hover:border-primary/20 transition-all active:scale-95"
                    onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
                  >
                    <Settings2 className="h-3.5 w-3.5" /> Editar
                  </button>
                  <button
                    className="gap-1.5 rounded-xl text-[11px] h-9 font-heading flex-1 flex items-center justify-center glass-panel text-muted-foreground/40 hover:text-foreground transition-all active:scale-95"
                    onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)}
                  >
                    <Palette className="h-3.5 w-3.5" /> Customizar
                  </button>
                  {p.checkout_url && (
                    <button
                      className="rounded-xl h-9 w-9 flex items-center justify-center glass-panel text-muted-foreground/25 hover:text-primary hover:ring-1 hover:ring-primary/15 transition-all active:scale-95"
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
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(filtered.length * 0.04, 0.3) }}
            onClick={() => navigate("/vendas/produtos/novo/editar")}
            className="rounded-2xl border-2 border-dashed border-border/8 hover:border-primary/15 hover:bg-primary/[0.02] flex flex-col items-center justify-center gap-3 min-h-[320px] transition-all group/add active:scale-[0.985]"
          >
            <div className="h-14 w-14 rounded-2xl bg-primary/[0.04] group-hover/add:bg-primary/[0.08] border border-primary/8 group-hover/add:border-primary/15 flex items-center justify-center transition-all">
              <Plus className="h-6 w-6 text-primary/20 group-hover/add:text-primary/50 transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-[13px] font-display font-semibold text-muted-foreground/25 group-hover/add:text-foreground/50 transition-colors">Novo Produto</p>
              <p className="text-[11px] text-muted-foreground/15 group-hover/add:text-muted-foreground/30 transition-colors font-display">Clique para criar</p>
            </div>
          </motion.button>
        </div>
      ) : (
        /* ─── LIST VIEW ─── */
        <div className="rounded-2xl glass-panel overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/[0.06]">
                <th className="text-left px-5 py-3.5 text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/25">Produto</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/25 hidden sm:table-cell">Preço</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/25 hidden md:table-cell">Tema</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/25">Status</th>
                <th className="w-32 px-4 py-3.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <motion.tr
                  key={p.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className="border-b border-border/[0.04] row-glow transition-all duration-200 group cursor-pointer"
                  onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-10 w-10 rounded-lg object-cover border border-border/10 shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-muted/8 flex items-center justify-center border border-border/6 shrink-0">
                          <Package className="h-4 w-4 text-muted-foreground/10" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[13px] font-display font-bold text-foreground truncate">{p.name}</p>
                        {p.description && <p className="text-[11px] text-muted-foreground/25 truncate mt-0.5 max-w-[250px] font-display">{p.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell">
                    <span className="text-[14px] font-heading text-foreground tabular-nums">{fmt(Number(p.price))}</span>
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-[11px] text-muted-foreground/30 font-display font-semibold">{checkoutThemeLabel(p.checkout_theme)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-heading border", statusColor(p.status))}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(p.status))} />
                      {statusLabel(p.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                      <button className="h-8 px-3 rounded-lg text-[10px] font-heading gap-1 flex items-center text-primary bg-primary/5 hover:bg-primary/10 active:scale-95 transition-all"
                        onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}>
                        <Settings2 className="h-3 w-3" /> Editar
                      </button>
                      <button className="h-8 px-3 rounded-lg text-[10px] font-heading gap-1 flex items-center text-muted-foreground/30 hover:text-foreground active:scale-95 transition-all"
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
      )}

      {pixelProduct && <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={(v) => { if (!v) setPixelProduct(null); }} />}
    </div>
  );
}
