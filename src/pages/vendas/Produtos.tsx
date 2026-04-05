import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Package, Plus, Trash2, Eye, MoreVertical,
  Copy, CheckCircle2, Zap, Layers,
  Link2, Settings2, Palette, Star,
  ExternalLink, Search, X, Grid3X3,
  List, Banknote, Target, Crosshair,
  TrendingUp, ShoppingCart, BarChart3, Sparkles,
  ArrowRight, Crown, Flame,
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

const ease = [0.16, 1, 0.3, 1] as const;
const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/* ─── Sparkline Mini ─── */
function MiniSparkline({ color }: { color: string }) {
  const points = Array.from({ length: 12 }, (_, i) => 20 + Math.sin(i * 0.8) * 10 + Math.random() * 8);
  const max = Math.max(...points);
  const min = Math.min(...points);
  const h = 24; const w = 60;
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / (max - min)) * h;
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-40 group-hover:opacity-80 transition-opacity duration-500">
      <defs>
        <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`hsl(var(--${color}))`} stopOpacity="0.5" />
          <stop offset="100%" stopColor={`hsl(var(--${color}))`} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${w},${h} L0,${h} Z`} fill={`url(#spark-${color})`} />
      <path d={path} fill="none" stroke={`hsl(var(--${color}))`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Live Pulse ─── */
function LivePulse({ count }: { count: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-success/15 bg-success/5 px-3 py-1.5 backdrop-blur-sm">
      <span className="relative flex h-2 w-2">
        <span className="absolute h-full w-full animate-ping rounded-full bg-success opacity-30" />
        <span className="relative h-2 w-2 rounded-full bg-success" />
      </span>
      <span className="text-[8px] font-display font-black uppercase tracking-[0.25em] text-success">{count} Ativo{count !== 1 ? "s" : ""}</span>
    </div>
  );
}

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
    <div className="mx-auto w-full max-w-[1440px] pb-20 px-1 relative">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.08, 0.15, 0.08] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute -top-48 -right-48 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[200px]" />
        <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.05, 0.1, 0.05] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-info/15 rounded-full blur-[180px]" />
      </div>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative mb-8 rounded-2xl bg-card/95 ring-1 ring-border/20 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-info/3 pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

        <div className="relative z-10 p-6 md:p-8">
          {/* Top bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <div>
                <span className="text-[10px] font-display font-black uppercase tracking-[0.2em] text-muted-foreground/40">Meus Produtos</span>
                <span className="text-[8px] text-muted-foreground/20 font-mono block mt-0.5">catálogo completo</span>
              </div>
              <LivePulse count={activeProducts} />
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/vendas/produtos/novo/editar")}
              className="h-10 px-5 rounded-xl text-[11px] font-display font-bold flex items-center gap-2 gradient-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all duration-300"
            >
              <Plus className="h-3.5 w-3.5" /> Novo Produto
            </motion.button>
          </div>

          {/* Hero metric */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, ease }} className="mb-8">
            <p className="text-[9px] font-display font-bold uppercase tracking-[0.2em] text-muted-foreground/30 mb-2">Catálogo de Produtos</p>
            <div className="flex items-end gap-3">
              <span className="text-5xl sm:text-6xl lg:text-7xl font-display font-black tabular-nums text-foreground leading-[0.85] tracking-[-0.04em]" style={{ textShadow: "0 0 60px hsl(var(--primary) / 0.15)" }}>
                {products.length}
              </span>
              <span className="text-lg font-display font-bold text-muted-foreground/20 mb-1">produto{products.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {[
                { icon: Zap, label: `${activeProducts} ativos`, color: "success" },
                { icon: Banknote, label: `catálogo ${fmt(totalValue)}`, color: "primary" },
                { icon: Target, label: `ticket médio ${fmt(avgPrice)}`, color: "warning" },
              ].map((chip) => (
                <span key={chip.label} className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/35 font-display font-medium rounded-lg bg-muted/5 ring-1 ring-border/10 px-2.5 py-1.5">
                  <chip.icon className={cn("h-3 w-3", `text-${chip.color}`)} /> {chip.label}
                </span>
              ))}
            </div>
          </motion.div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total Produtos", value: String(products.length), color: "primary", icon: Package },
              { label: "Ativos", value: String(activeProducts), color: "success", icon: Zap, delta: activeProducts > 0 ? `${Math.round((activeProducts / Math.max(products.length, 1)) * 100)}%` : null },
              { label: "Valor Catálogo", value: fmt(totalValue), color: "info", icon: Banknote },
              { label: "Ticket Médio", value: fmt(avgPrice), color: "warning", icon: Target },
            ].map((item, idx) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 + idx * 0.06, ease }}
                className="group relative rounded-xl bg-card/95 ring-1 ring-border/15 p-4 overflow-hidden hover:ring-border/30 transition-all duration-300"
              >
                <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", `bg-${item.color}`)} />
                <div className={cn("absolute -top-12 -right-12 w-28 h-28 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[40px] pointer-events-none", `bg-${item.color}/10`)} />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center ring-1 transition-all duration-300", `bg-${item.color}/8 ring-${item.color}/12 text-${item.color}/60 group-hover:bg-${item.color}/12 group-hover:ring-${item.color}/20`)}>
                      <item.icon className="h-3.5 w-3.5" />
                    </div>
                    <MiniSparkline color={item.color} />
                  </div>
                  <p className="text-[9px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground/30 mb-1">{item.label}</p>
                  <div className="flex items-end gap-2">
                    <p className={cn("text-lg font-display font-black tabular-nums tracking-[-0.03em] leading-none", `text-${item.color}`)}>{item.value}</p>
                    {"delta" in item && item.delta && (
                      <span className="text-[9px] font-display font-bold text-success/60 flex items-center gap-0.5 mb-0.5">
                        <TrendingUp className="h-2.5 w-2.5" /> {item.delta}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ═══════════════════ TOOLBAR ═══════════════════ */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, ease }} className="mb-6">
        <div className="rounded-xl bg-card/95 ring-1 ring-border/15 p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Status tabs */}
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {statusTabs.map((tab) => {
              const isActive = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    "relative shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] font-display font-bold transition-all duration-200 active:scale-[0.97]",
                    isActive
                      ? "bg-primary/8 ring-1 ring-primary/15 text-foreground"
                      : "text-muted-foreground/30 hover:text-muted-foreground/50 hover:bg-muted/5"
                  )}
                >
                  {isActive && (
                    <motion.span layoutId="prod-tab" className="h-1.5 w-1.5 rounded-full bg-primary" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />
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
                className="h-9 w-full rounded-lg ring-1 ring-border/10 bg-muted/5 pl-9 pr-9 text-[11px] text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-display"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 active:scale-90"><X className="h-3.5 w-3.5 text-muted-foreground/30" /></button>
              )}
            </div>
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg ring-1 ring-border/10 bg-muted/5">
              {[
                { mode: "grid" as const, icon: Grid3X3 },
                { mode: "list" as const, icon: List },
              ].map(v => (
                <button
                  key={v.mode}
                  onClick={() => setViewMode(v.mode)}
                  className={cn("h-8 w-8 rounded-md flex items-center justify-center transition-all", viewMode === v.mode ? "bg-primary/10 text-primary ring-1 ring-primary/15" : "text-muted-foreground/25 hover:text-foreground")}
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
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-card/95 ring-1 ring-border/15 p-16 flex flex-col items-center gap-4">
          <div className="h-20 w-20 rounded-2xl bg-primary/5 ring-1 ring-primary/10 flex items-center justify-center relative">
            <Package className="h-8 w-8 text-primary/20" />
            <div className="absolute -inset-4 rounded-3xl bg-primary/5 blur-2xl pointer-events-none" />
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
              className="mt-3 h-10 px-6 rounded-xl text-[12px] font-display font-bold flex items-center gap-2 gradient-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all"
            >
              <Plus className="h-4 w-4" /> Criar Primeiro Produto
            </motion.button>
          )}
        </motion.div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.3), ease }}
              whileHover={{ y: -4, transition: { duration: 0.3, ease } }}
              className="group relative rounded-2xl bg-card/95 ring-1 ring-border/15 overflow-hidden flex flex-col hover:ring-primary/20 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500"
            >
              {/* Accent bar */}
              <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full z-20", p.status === "active" ? "bg-success" : p.status === "inactive" ? "bg-destructive" : "bg-warning")} />

              {/* Ambient glow on hover */}
              <div className="absolute -inset-4 bg-primary/[0.02] rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-2xl pointer-events-none" />

              {/* Image */}
              <div className="relative h-48 overflow-hidden bg-gradient-to-br from-muted/8 to-transparent">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-info/[0.03]" />
                    <div className="h-16 w-16 rounded-2xl bg-muted/8 ring-1 ring-border/8 flex items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground/10" />
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />

                {/* Status badge */}
                <div className="absolute top-3 right-3 z-10">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[9px] font-display font-bold ring-1 backdrop-blur-sm", statusColor(p.status))}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(p.status), p.status === "active" && "animate-pulse")} style={p.status === "active" ? { boxShadow: "0 0 6px hsl(var(--success))" } : undefined} />
                    {statusLabel(p.status)}
                  </span>
                </div>

                {/* Menu */}
                <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-8 w-8 rounded-lg bg-card/80 backdrop-blur-sm ring-1 ring-border/15 flex items-center justify-center text-muted-foreground hover:text-foreground shadow-lg active:scale-95 transition-all">
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
                  <span className="inline-flex items-baseline gap-0.5 rounded-xl bg-card/90 backdrop-blur-md ring-1 ring-border/10 px-3 py-1.5 shadow-lg">
                    <span className="text-[9px] text-muted-foreground/40 font-display font-bold">R$</span>
                    <span className="text-[18px] font-display font-black tracking-[-0.03em] text-primary tabular-nums" style={{ textShadow: "0 0 20px hsl(var(--primary) / 0.25)" }}>{Number(p.price).toFixed(2)}</span>
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 flex flex-1 flex-col gap-3 relative z-10">
                <div>
                  <h3 className="text-[14px] font-display font-bold text-foreground leading-snug tracking-[-0.02em] line-clamp-1">
                    {p.name}
                  </h3>
                  {p.description
                    ? <p className="text-[11px] text-muted-foreground/30 line-clamp-2 leading-relaxed mt-1 font-display">{p.description}</p>
                    : <p className="text-[11px] text-muted-foreground/15 italic mt-1 font-display">Sem descrição</p>
                  }
                </div>

                {/* Checkout Link */}
                {p.checkout_url && (
                  <button
                    onClick={() => copyCheckout(p)}
                    className="flex items-center gap-2.5 rounded-xl bg-muted/5 ring-1 ring-border/10 px-3 py-2.5 hover:ring-primary/15 hover:bg-primary/[0.02] transition-all w-full group/link"
                  >
                    <div className="h-7 w-7 rounded-lg bg-primary/8 ring-1 ring-primary/12 flex items-center justify-center shrink-0">
                      <Link2 className="h-3 w-3 text-primary/40 group-hover/link:text-primary transition-colors" />
                    </div>
                    <span className="text-[10px] text-muted-foreground/25 truncate flex-1 text-left group-hover/link:text-primary/50 transition-colors font-mono">
                      {getCheckoutLink(p.checkout_url)}
                    </span>
                    <AnimatePresence mode="wait">
                      {copiedId === p.id ? (
                        <motion.div key="copied" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                          <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                        </motion.div>
                      ) : (
                        <motion.div key="copy" initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                          <Copy className="h-3 w-3 text-muted-foreground/15 shrink-0 group-hover/link:text-primary/40 transition-colors" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                )}

                {/* Builder CTA */}
                <div className="rounded-xl ring-1 ring-primary/8 bg-gradient-to-r from-primary/[0.03] to-transparent p-3 relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-primary/5 blur-2xl pointer-events-none" />
                  <div className="flex items-center justify-between gap-3 relative z-10">
                    <div className="min-w-0">
                      <p className="text-[9px] font-display font-bold uppercase tracking-[0.2em] text-primary/50 flex items-center gap-1.5">
                        <Sparkles className="h-2.5 w-2.5" /> Checkout Builder
                      </p>
                      <div className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-muted/5 ring-1 ring-border/8 px-2 py-0.5 text-[10px] font-display font-bold text-muted-foreground/40">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {checkoutThemeLabel(p.checkout_theme)}
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="h-8 px-3.5 rounded-lg text-[10px] font-display font-bold flex items-center gap-1.5 gradient-primary text-primary-foreground shadow-md shadow-primary/15 transition-all"
                      onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)}
                    >
                      <Palette className="h-3 w-3" /> Builder
                    </motion.button>
                  </div>
                </div>

                <div className="flex-1" />

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-border/8">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="gap-1.5 rounded-xl text-[11px] h-9 font-display font-bold flex-1 flex items-center justify-center bg-primary/8 text-primary hover:bg-primary/12 ring-1 ring-primary/12 hover:ring-primary/20 transition-all"
                    onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
                  >
                    <Settings2 className="h-3.5 w-3.5" /> Editar
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="gap-1.5 rounded-xl text-[11px] h-9 font-display font-bold flex-1 flex items-center justify-center bg-muted/5 ring-1 ring-border/10 text-muted-foreground/40 hover:text-foreground hover:ring-border/20 transition-all"
                    onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)}
                  >
                    <Palette className="h-3.5 w-3.5" /> Customizar
                  </motion.button>
                  {p.checkout_url && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="rounded-xl h-9 w-9 flex items-center justify-center bg-muted/5 ring-1 ring-border/10 text-muted-foreground/25 hover:text-primary hover:ring-primary/15 transition-all"
                      onClick={() => window.open(getCheckoutLink(p.checkout_url!), "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {/* Add ghost card */}
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(filtered.length * 0.05, 0.3), ease }}
            onClick={() => navigate("/vendas/produtos/novo/editar")}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            className="rounded-2xl border-2 border-dashed border-border/10 hover:border-primary/20 hover:bg-primary/[0.02] flex flex-col items-center justify-center gap-4 min-h-[420px] transition-all group/add relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.01] to-transparent opacity-0 group-hover/add:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/[0.04] group-hover/add:bg-primary/[0.08] ring-1 ring-primary/8 group-hover/add:ring-primary/15 flex items-center justify-center transition-all relative">
                <Plus className="h-7 w-7 text-primary/20 group-hover/add:text-primary/50 transition-colors" />
                <div className="absolute -inset-3 rounded-3xl bg-primary/5 blur-xl opacity-0 group-hover/add:opacity-100 transition-opacity" />
              </div>
              <div className="text-center">
                <p className="text-[14px] font-display font-bold text-muted-foreground/25 group-hover/add:text-foreground/50 transition-colors">Novo Produto</p>
                <p className="text-[11px] text-muted-foreground/15 group-hover/add:text-muted-foreground/30 transition-colors font-display mt-1">Clique para criar</p>
              </div>
            </div>
          </motion.button>
        </div>
      ) : (
        /* ═══ LIST VIEW ═══ */
        <div className="rounded-2xl bg-card/95 ring-1 ring-border/15 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/8">
                <th className="text-left px-5 py-4 text-[9px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground/25">Produto</th>
                <th className="text-left px-4 py-4 text-[9px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground/25 hidden sm:table-cell">Preço</th>
                <th className="text-left px-4 py-4 text-[9px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground/25 hidden md:table-cell">Tema</th>
                <th className="text-left px-4 py-4 text-[9px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground/25">Status</th>
                <th className="w-36 px-4 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <motion.tr
                  key={p.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3), ease }}
                  className="border-b border-border/5 transition-all duration-200 group cursor-pointer hover:bg-primary/[0.02]"
                  onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-11 w-11 rounded-xl object-cover ring-1 ring-border/10 shrink-0" />
                      ) : (
                        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/5 to-transparent ring-1 ring-border/8 flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-muted-foreground/15" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[13px] font-display font-bold text-foreground truncate">{p.name}</p>
                        {p.description && <p className="text-[10px] text-muted-foreground/25 truncate mt-0.5 max-w-[250px] font-display">{p.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell">
                    <span className="text-[14px] font-display font-black text-foreground tabular-nums">{fmt(Number(p.price))}</span>
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
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="h-8 px-3 rounded-lg text-[10px] font-display font-bold gap-1 flex items-center text-primary bg-primary/8 ring-1 ring-primary/12 hover:bg-primary/12 transition-all"
                        onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}>
                        <Settings2 className="h-3 w-3" /> Editar
                      </motion.button>
                      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="h-8 px-3 rounded-lg text-[10px] font-display font-bold gap-1 flex items-center text-muted-foreground/30 hover:text-foreground ring-1 ring-border/10 hover:ring-border/20 transition-all"
                        onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)}>
                        <Palette className="h-3 w-3" /> Builder
                      </motion.button>
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
