import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Package, Plus, Trash2, Eye, MoreVertical,
  Copy, CheckCircle2, Zap,
  Link2, Settings2, Palette, Star,
  ExternalLink, Search, X, Grid3X3,
  List, Banknote, Target, Crosshair,
  TrendingUp, Sparkles, Crown,
  ArrowRight, ArrowUpRight, ArrowDownRight,
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
const fmtCompact = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 10_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}K`;
  return fmt(v);
};

/* ─── Animated Number ─── */
function AnimatedNumber({ value, formatter = fmt, duration = 800 }: { value: number; formatter?: (v: number) => string; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;
    if (from === to) return;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);
  return <>{formatter(display)}</>;
}

/* ─── Sparkline ─── */
function Sparkline({ data, color = "primary" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 80; const h = 28;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
  const fillPoints = `0,${h} ${points} ${w},${h}`;
  const id = `spark-prod-${color}-${data.length}`;
  return (
    <svg width={w} height={h} className="shrink-0 opacity-60 group-hover:opacity-100 transition-opacity duration-500" viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`hsl(var(--${color}))`} stopOpacity={0.3} />
          <stop offset="100%" stopColor={`hsl(var(--${color}))`} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#${id})`} />
      <polyline points={points} fill="none" stroke={`hsl(var(--${color}))`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── GlowCard ─── */
function GlowCard({ children, className, glowColor = "primary", delay = 0 }: { children: React.ReactNode; className?: string; glowColor?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease }}
      className={cn("relative group rounded-2xl bg-card/95 ring-1 ring-border/15 overflow-hidden backdrop-blur-sm", className)}
    >
      <div className={cn("absolute -top-24 -right-24 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-[60px] pointer-events-none", `bg-${glowColor}/12`)} />
      <div className={cn("absolute -bottom-16 -left-16 w-32 h-32 rounded-full opacity-0 group-hover:opacity-60 transition-opacity duration-1000 blur-[40px] pointer-events-none", `bg-${glowColor}/6`)} />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />
      <div className={cn("absolute bottom-0 left-[10%] right-[10%] h-px opacity-0 group-hover:opacity-100 transition-opacity duration-700", `bg-gradient-to-r from-transparent via-${glowColor}/20 to-transparent`)} />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

/* ─── KPI Tile ─── */
function KpiTile({ label, value, icon: Icon, color = "primary", delay = 0, formatter = fmtCompact, sparkData }: {
  label: string; value: number; icon: any; color?: string; delay?: number; formatter?: (v: number) => string; sparkData?: number[];
}) {
  return (
    <GlowCard glowColor={color} delay={delay} className="p-5 hover:ring-border/30 transition-all duration-300">
      <div className={cn("absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity duration-500", `bg-${color}`)} />
      <div className="flex items-start justify-between mb-3">
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg", `bg-${color}/10 border-${color}/12 text-${color} group-hover:bg-${color}/15`)}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        {sparkData && sparkData.length > 1 && <Sparkline data={sparkData} color={color} />}
      </div>
      <p className="text-[9px] font-display font-bold uppercase tracking-[0.2em] text-muted-foreground/35 mb-1.5">{label}</p>
      <span className={cn("text-xl sm:text-2xl font-display font-black tabular-nums tracking-[-0.03em] leading-none", `text-${color}`)}>
        <AnimatedNumber value={value} formatter={formatter} />
      </span>
    </GlowCard>
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
      <span className="text-[8px] sm:text-[9px] font-display font-black uppercase tracking-[0.2em] text-success">{count} Ativo{count !== 1 ? "s" : ""}</span>
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

  // Fake sparkline data for KPIs
  const sparkProducts = useMemo(() => Array.from({ length: 12 }, (_, i) => Math.max(0, products.length - 3 + Math.floor(Math.sin(i) * 2 + Math.random() * 2))), [products.length]);
  const sparkActive = useMemo(() => Array.from({ length: 12 }, (_, i) => Math.max(0, activeProducts - 2 + Math.floor(Math.sin(i * 0.7) * 1.5 + Math.random() * 2))), [activeProducts]);
  const sparkValue = useMemo(() => Array.from({ length: 12 }, (_, i) => Math.max(0, totalValue * (0.7 + Math.sin(i * 0.5) * 0.2 + Math.random() * 0.15))), [totalValue]);
  const sparkAvg = useMemo(() => Array.from({ length: 12 }, (_, i) => Math.max(0, avgPrice * (0.8 + Math.sin(i * 0.6) * 0.15 + Math.random() * 0.1))), [avgPrice]);

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
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.08, 0.15, 0.08] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute -top-48 -right-48 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[200px]" />
        <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.05, 0.1, 0.05] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-info/15 rounded-full blur-[180px]" />
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.03, 0.08, 0.03] }} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-success/10 rounded-full blur-[160px]" />
      </div>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <GlowCard glowColor="primary" delay={0} className="mb-5 sm:mb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-info/3 pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.012]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

        <div className="relative z-10 p-5 sm:p-6 md:p-8">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
            <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
              <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center shrink-0 shadow-lg shadow-primary/5">
                <Package className="h-[18px] w-[18px] sm:h-5 sm:w-5 text-primary" />
              </div>
              <div>
                <span className="text-[10px] sm:text-[11px] font-display font-black uppercase tracking-[0.2em] text-muted-foreground/50">Meus Produtos</span>
              </div>
              <LivePulse count={activeProducts} />
            </div>
            <motion.button
              whileHover={{ scale: 1.03, boxShadow: "0 20px 40px -10px hsl(var(--primary) / 0.3)" }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/vendas/produtos/novo/editar")}
              className="h-10 sm:h-11 px-5 sm:px-6 rounded-xl text-[11px] sm:text-[12px] font-display font-bold flex items-center justify-center gap-2 gradient-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-300 shrink-0"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Novo Produto
            </motion.button>
          </div>

          {/* Hero metric */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, ease }} className="mb-8 sm:mb-10">
            <p className="text-[9px] sm:text-[10px] font-display font-bold uppercase tracking-[0.25em] text-primary/60 mb-2 sm:mb-3 flex items-center gap-2">
              <Crown className="h-3 w-3" /> Catálogo de Produtos
            </p>
            <div className="flex items-end gap-3 sm:gap-4">
              <span className="text-[64px] sm:text-[80px] lg:text-[104px] font-display font-black tabular-nums text-foreground leading-[0.85] tracking-[-0.04em]" style={{ textShadow: "0 0 80px hsl(var(--primary) / 0.15)" }}>
                <AnimatedNumber value={products.length} formatter={(v) => String(Math.round(v))} />
              </span>
              <span className="text-base sm:text-lg font-display font-bold text-muted-foreground/20 mb-2 sm:mb-3">produto{products.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4 sm:mt-5">
              <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground/40 font-display font-medium rounded-xl bg-muted/5 ring-1 ring-border/10 px-3 py-2 backdrop-blur-sm">
                <Zap className="h-3 w-3 text-success" /> {activeProducts} ativos
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground/40 font-display font-medium rounded-xl bg-muted/5 ring-1 ring-border/10 px-3 py-2 backdrop-blur-sm">
                <Banknote className="h-3 w-3 text-primary" /> catálogo {fmtCompact(totalValue)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground/40 font-display font-medium rounded-xl bg-muted/5 ring-1 ring-border/10 px-3 py-2 backdrop-blur-sm">
                <Target className="h-3 w-3 text-warning" /> ticket médio {fmtCompact(avgPrice)}
              </span>
            </div>
          </motion.div>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <KpiTile label="Total Produtos" value={products.length} icon={Package} color="primary" delay={0.2} formatter={(v) => String(Math.round(v))} sparkData={sparkProducts} />
            <KpiTile label="Ativos" value={activeProducts} icon={Zap} color="success" delay={0.26} formatter={(v) => String(Math.round(v))} sparkData={sparkActive} />
            <KpiTile label="Valor Catálogo" value={totalValue} icon={Banknote} color="info" delay={0.32} formatter={fmtCompact} sparkData={sparkValue} />
            <KpiTile label="Ticket Médio" value={avgPrice} icon={Target} color="warning" delay={0.38} formatter={fmtCompact} sparkData={sparkAvg} />
          </div>
        </div>
      </GlowCard>

      {/* ═══════════════════ TOOLBAR ═══════════════════ */}
      <GlowCard glowColor="primary" delay={0.2} className="mb-4 sm:mb-6">
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
      </GlowCard>

      {/* ═══════════════════ PRODUCTS ═══════════════════ */}
      {filtered.length === 0 ? (
        <GlowCard glowColor="primary" delay={0.2} className="p-10 sm:p-16 flex flex-col items-center gap-5">
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
              className="mt-3 h-11 px-6 rounded-xl text-[12px] font-display font-bold flex items-center gap-2 gradient-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all"
            >
              <Plus className="h-4 w-4" /> Criar Primeiro Produto
            </motion.button>
          )}
        </GlowCard>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {filtered.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: Math.min(i * 0.06, 0.35), ease }}
              whileHover={{ y: -6, transition: { duration: 0.35, ease } }}
              className="group relative rounded-2xl bg-card/95 ring-1 ring-border/15 overflow-hidden flex flex-col hover:ring-primary/25 hover:shadow-2xl hover:shadow-primary/8 transition-all duration-500 backdrop-blur-sm"
            >
              {/* Accent bar */}
              <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full z-20 transition-all duration-500", p.status === "active" ? "bg-success group-hover:shadow-[0_0_12px_hsl(var(--success)/0.4)]" : p.status === "inactive" ? "bg-destructive" : "bg-warning")} />

              {/* Multi-layer ambient glow */}
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/[0.04] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[50px] pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-info/[0.03] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-[40px] pointer-events-none" />

              {/* Top shimmer */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent z-20" />

              {/* Image */}
              <div className="relative h-44 sm:h-52 overflow-hidden bg-gradient-to-br from-muted/8 to-transparent">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-info/[0.04]" />
                    <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
                    <div className="h-16 w-16 rounded-2xl bg-muted/8 ring-1 ring-border/8 flex items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground/10" />
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />

                {/* Status badge */}
                <div className="absolute top-3 right-3 z-10">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[9px] sm:text-[10px] font-display font-bold ring-1 backdrop-blur-md shadow-lg", statusColor(p.status))}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(p.status), p.status === "active" && "animate-pulse")} style={p.status === "active" ? { boxShadow: "0 0 8px hsl(var(--success))" } : undefined} />
                    {statusLabel(p.status)}
                  </span>
                </div>

                {/* Menu */}
                <div className="absolute top-3 left-3 z-10 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-9 w-9 rounded-xl bg-card/80 backdrop-blur-md ring-1 ring-border/15 flex items-center justify-center text-muted-foreground hover:text-foreground shadow-lg active:scale-95 transition-all">
                        <MoreVertical className="h-4 w-4" />
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
                  <span className="inline-flex items-baseline gap-0.5 rounded-xl bg-card/90 backdrop-blur-md ring-1 ring-border/10 px-3.5 py-2 shadow-xl">
                    <span className="text-[9px] text-muted-foreground/40 font-display font-bold">R$</span>
                    <span className="text-[20px] sm:text-[22px] font-display font-black tracking-[-0.03em] text-primary tabular-nums" style={{ textShadow: "0 0 24px hsl(var(--primary) / 0.3)" }}>{Number(p.price).toFixed(2)}</span>
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-5 flex flex-1 flex-col gap-3 relative z-10">
                <div>
                  <h3 className="text-[14px] sm:text-[15px] font-display font-bold text-foreground leading-snug tracking-[-0.02em] line-clamp-1">
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
                    className="flex items-center gap-2.5 rounded-xl bg-muted/5 ring-1 ring-border/10 px-3 py-2.5 hover:ring-primary/15 hover:bg-primary/[0.02] transition-all w-full group/link backdrop-blur-sm"
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
                <div className="rounded-xl ring-1 ring-primary/10 bg-gradient-to-r from-primary/[0.04] to-transparent p-3.5 relative overflow-hidden backdrop-blur-sm">
                  <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-primary/5 blur-2xl pointer-events-none" />
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
                  <div className="flex items-center justify-between gap-3 relative z-10">
                    <div className="min-w-0">
                      <p className="text-[9px] font-display font-bold uppercase tracking-[0.2em] text-primary/50 flex items-center gap-1.5">
                        <Sparkles className="h-2.5 w-2.5" /> Checkout Builder
                      </p>
                      <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-muted/5 ring-1 ring-border/8 px-2 py-0.5 text-[10px] font-display font-bold text-muted-foreground/40">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                        {checkoutThemeLabel(p.checkout_theme)}
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="h-9 px-4 rounded-lg text-[10px] font-display font-bold flex items-center gap-1.5 gradient-primary text-primary-foreground shadow-md shadow-primary/15 transition-all"
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
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ scale: 1.02 }}
                    className="gap-1.5 rounded-xl text-[11px] h-11 sm:h-10 font-display font-bold flex-1 flex items-center justify-center bg-primary/8 text-primary hover:bg-primary/12 ring-1 ring-primary/12 hover:ring-primary/20 hover:shadow-lg hover:shadow-primary/10 transition-all active:scale-[0.97]"
                    onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
                  >
                    <Settings2 className="h-3.5 w-3.5" /> Editar
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ scale: 1.02 }}
                    className="gap-1.5 rounded-xl text-[11px] h-11 sm:h-10 font-display font-bold flex-1 flex items-center justify-center bg-muted/5 ring-1 ring-border/10 text-muted-foreground/40 hover:text-foreground hover:ring-border/20 hover:shadow-lg transition-all active:scale-[0.97]"
                    onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)}
                  >
                    <Palette className="h-3.5 w-3.5" /> Customizar
                  </motion.button>
                  {p.checkout_url && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.05 }}
                      className="rounded-xl h-11 w-11 sm:h-10 sm:w-10 shrink-0 flex items-center justify-center bg-muted/5 ring-1 ring-border/10 text-muted-foreground/25 hover:text-primary hover:ring-primary/15 hover:shadow-lg hover:shadow-primary/10 transition-all active:scale-[0.95]"
                      onClick={() => window.open(getCheckoutLink(p.checkout_url!), "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Bottom glow line */}
              <div className="absolute bottom-0 left-[10%] right-[10%] h-px opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
            </motion.div>
          ))}

          {/* Add ghost card */}
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(filtered.length * 0.05, 0.3), ease }}
            onClick={() => navigate("/vendas/produtos/novo/editar")}
            whileHover={{ scale: 1.01, y: -4 }}
            whileTap={{ scale: 0.985 }}
            className="rounded-2xl border-2 border-dashed border-border/10 hover:border-primary/20 hover:bg-primary/[0.02] flex flex-col items-center justify-center gap-4 min-h-[340px] sm:min-h-[420px] transition-all group/add relative overflow-hidden backdrop-blur-sm"
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
        <GlowCard glowColor="primary" delay={0.2}>
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
                          <img src={p.image_url} alt="" className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl object-cover ring-1 ring-border/10 shrink-0 group-hover:ring-primary/15 transition-all" />
                        ) : (
                          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-gradient-to-br from-primary/5 to-transparent ring-1 ring-border/8 flex items-center justify-center shrink-0 group-hover:ring-primary/15 transition-all">
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
                      <span className="text-[13px] sm:text-[14px] font-display font-black text-foreground tabular-nums">{fmt(Number(p.price))}</span>
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
                        <motion.button whileTap={{ scale: 0.97 }} className="h-8 px-3 rounded-lg text-[10px] font-display font-bold gap-1 flex items-center text-primary bg-primary/8 ring-1 ring-primary/12 hover:bg-primary/12 hover:shadow-md hover:shadow-primary/10 transition-all"
                          onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}>
                          <Settings2 className="h-3 w-3" /> Editar
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.97 }} className="h-8 px-3 rounded-lg text-[10px] font-display font-bold gap-1 flex items-center text-muted-foreground/30 hover:text-foreground ring-1 ring-border/10 hover:ring-border/20 hover:shadow-md transition-all"
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
        </GlowCard>
      )}

      {pixelProduct && <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={(v) => { if (!v) setPixelProduct(null); }} />}
    </div>
  );
}
