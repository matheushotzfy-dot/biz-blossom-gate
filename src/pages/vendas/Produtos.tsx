import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Package, Plus, Trash2, MoreHorizontal, Copy, CheckCircle2,
  Settings2, Palette, Star, ExternalLink, Search, X, Crosshair,
  Loader2, ShoppingBag, TrendingUp, Clock, Zap, ArrowUpRight,
  BarChart3, Eye, Layers,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import PixelSettingsDialog from "@/components/PixelSettingsDialog";
import type { Tables } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

type Product = Tables<"products">;

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const STATUS: Record<string, { label: string; bg: string; text: string; dot: string; ping?: boolean }> = {
  active:         { label: "Ativo",   bg: "bg-success/[0.08]", text: "text-success",            dot: "bg-success", ping: true },
  inactive:       { label: "Inativo", bg: "bg-muted/20",       text: "text-muted-foreground/60", dot: "bg-muted-foreground/40" },
  pending_review: { label: "Revisão", bg: "bg-warning/[0.08]", text: "text-warning",            dot: "bg-warning" },
};

const DELIVERY_LABELS: Record<string, string> = {
  curso: "Curso Online",
  ebook: "E-book",
  mentoria: "Mentoria",
  software: "Software",
  servico: "Serviço",
};

export default function Produtos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: products = [], refetch: loadProducts } = useProducts();
  const [pixelProduct, setPixelProduct] = useState<Product | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "active" | "inactive" | "pending_review">("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(p => {
      if (tab !== "all" && p.status !== tab) return false;
      return !search || p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
    });
  }, [products, search, tab]);

  const activeCount = products.filter(p => p.status === "active").length;
  const pendingCount = products.filter(p => p.status === "pending_review").length;
  const totalRevenue = products.reduce((s, p) => s + Number(p.price), 0);

  const confirmDelete = async () => {
    if (!user || !deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("products").delete().eq("id", deleteTarget).eq("user_id", user.id);
    setDeleting(false); setDeleteTarget(null);
    if (error) { toast.error("Erro ao excluir produto"); return; }
    toast.success("Produto removido"); loadProducts();
  };

  const getLink = (url: string) => `${window.location.origin}/pay/${url.split("/").pop()!}`;

  const copyLink = (p: Product) => {
    if (!p.checkout_url) return;
    navigator.clipboard.writeText(getLink(p.checkout_url));
    setCopiedId(p.id);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const tabs = [
    { label: "Todos", value: "all" as const, count: products.length },
    { label: "Ativos", value: "active" as const, count: activeCount },
    { label: "Revisão", value: "pending_review" as const, count: pendingCount },
    { label: "Inativos", value: "inactive" as const },
  ];

  const st = (p: Product) => STATUS[p.status] || STATUS.inactive;

  const menu = (p: Product, btnCls: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={btnCls}><MoreHorizontal className="h-4 w-4" strokeWidth={1.6} /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-52 rounded-xl border-border/60 bg-popover/95 backdrop-blur-xl p-1.5 shadow-2xl">
        {[
          { icon: Settings2, label: "Editar produto", fn: () => navigate(`/vendas/produtos/${p.id}/editar`) },
          { icon: Palette, label: "Checkout Builder", fn: () => navigate(`/vendas/produtos/${p.id}/checkout-builder`) },
          ...(p.checkout_url ? [
            { icon: copiedId === p.id ? CheckCircle2 : Copy, label: copiedId === p.id ? "Copiado!" : "Copiar link", fn: () => copyLink(p) },
            { icon: ExternalLink, label: "Ver checkout", fn: () => window.open(getLink(p.checkout_url!), "_blank") },
          ] : []),
          { icon: Crosshair, label: "Pixels & Tracking", fn: () => setPixelProduct(p) },
          { icon: Star, label: "Área de membros", fn: () => navigate(`/vendas/conteudo/${p.id}/builder`) },
        ].map((item, i) => (
          <DropdownMenuItem key={i} onClick={item.fn} className="gap-2.5 rounded-lg px-3 py-2.5 text-[12px] cursor-pointer hover:bg-muted/30">
            <item.icon className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.7} /> {item.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="my-1 bg-border/30" />
        <DropdownMenuItem onClick={() => setDeleteTarget(p.id)} className="gap-2.5 rounded-lg px-3 py-2.5 text-[12px] text-destructive focus:text-destructive cursor-pointer">
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} /> Excluir produto
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const kpis = [
    { label: "Total", value: products.length, suffix: "", icon: Layers, color: "text-foreground", iconBg: "bg-primary/10 text-primary" },
    { label: "Ativos", value: activeCount, suffix: "", icon: TrendingUp, color: "text-success", iconBg: "bg-success/10 text-success" },
    { label: "Revisão", value: pendingCount, suffix: "", icon: Clock, color: "text-warning", iconBg: "bg-warning/10 text-warning" },
    { label: "Receita", value: totalRevenue, suffix: "currency", icon: BarChart3, color: "text-primary", iconBg: "bg-primary/10 text-primary" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-20 md:pb-16 space-y-5">

      {/* ════════════════════════════════════════════════════════════ */}
      {/* HERO HEADER                                                 */}
      {/* ════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl border border-border/50 bg-card"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-24 h-[400px] w-[400px] rounded-full bg-primary/[0.07] blur-[120px]" />
          <div className="absolute -bottom-16 -right-16 h-[300px] w-[300px] rounded-full bg-info/[0.05] blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[200px] w-[600px] rounded-full bg-success/[0.03] blur-[140px]" />
          <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 0.5px, transparent 0.5px)", backgroundSize: "16px 16px" }} />
        </div>

        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/15">
                <ShoppingBag className="h-5 w-5 text-primary" strokeWidth={1.8} />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-heading text-foreground">Meus Produtos</h1>
                  <span className="inline-flex h-5 items-center rounded-md bg-primary/10 px-2 text-[10px] font-bold tabular-nums text-primary border border-primary/15">
                    {products.length}
                  </span>
                </div>
                <p className="text-[12px] text-muted-foreground/50 mt-0.5">Gerencie e monitore seu catálogo digital</p>
              </div>
            </div>

            <button
              onClick={() => navigate("/vendas/produtos/novo/editar")}
              className="shrink-0 inline-flex h-9 sm:h-10 items-center gap-2 rounded-xl bg-gradient-to-b from-primary to-primary/80 px-4 sm:px-5 text-[12px] sm:text-[13px] font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 hover:brightness-110 active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              <span className="hidden sm:inline">Novo Produto</span>
              <span className="sm:hidden">Novo</span>
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {kpis.map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.08 + i * 0.05 }}
                className="group relative rounded-xl border border-border/30 bg-background/40 backdrop-blur-sm p-3.5 overflow-hidden hover:border-border/60 transition-all duration-300"
              >
                <div className="absolute -top-8 -right-8 h-20 w-20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-[30px] pointer-events-none bg-primary/10" />
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-heading uppercase tracking-[0.18em] text-muted-foreground/40 mb-1.5">{kpi.label}</p>
                    <p className={cn("text-lg sm:text-xl font-numbers leading-none", kpi.color)}>
                      {kpi.suffix === "currency" ? fmt(kpi.value) : kpi.value}
                    </p>
                  </div>
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110", kpi.iconBg)}>
                    <kpi.icon className="h-4 w-4" strokeWidth={1.8} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* TOOLBAR                                                     */}
      {/* ════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-0.5 rounded-xl border border-border/40 bg-card/50 p-1 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "relative shrink-0 px-3.5 py-2 rounded-lg text-[12px] font-semibold transition-all duration-200",
                tab === t.value
                  ? "bg-background text-foreground shadow-sm border border-border/50"
                  : "text-muted-foreground/50 hover:text-muted-foreground/80"
              )}
            >
              <span className="flex items-center gap-1.5">
                {t.label}
                {t.count != null && (
                  <span className={cn(
                    "inline-flex h-[16px] min-w-[16px] items-center justify-center rounded px-1 text-[9px] tabular-nums font-bold",
                    tab === t.value ? "bg-primary/15 text-primary" : "bg-muted/30 text-muted-foreground/40"
                  )}>
                    {t.count}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56 sm:flex-none">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="h-9 w-full rounded-xl border border-border/40 bg-card/50 pl-9 pr-8 text-[12px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/25 transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="hidden sm:flex items-center rounded-lg border border-border/40 bg-card/50 p-0.5">
            {(["grid", "list"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "h-8 w-8 flex items-center justify-center rounded-md transition-all",
                  viewMode === mode ? "bg-background shadow-sm text-foreground" : "text-muted-foreground/30 hover:text-muted-foreground/60"
                )}
              >
                {mode === "grid" ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="0.5" y="0.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="8.5" y="0.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="0.5" y="8.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="8.5" y="8.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="0.5" y="1" width="13" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="0.5" y="5.5" width="13" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="0.5" y="10" width="13" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/></svg>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* CONTENT                                                     */}
      {/* ════════════════════════════════════════════════════════════ */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-border/30 bg-card/20 text-center p-8"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border/40 bg-card/60 shadow-sm">
            <Package className="h-7 w-7 text-muted-foreground/30" strokeWidth={1.5} />
          </div>
          <p className="text-[15px] font-display font-bold text-foreground mb-1">
            {search || tab !== "all" ? "Nenhum resultado" : "Nenhum produto ainda"}
          </p>
          <p className="max-w-xs text-[13px] text-muted-foreground/50 leading-relaxed">
            {search || tab !== "all" ? "Ajuste os filtros para encontrar seus produtos." : "Crie seu primeiro produto digital e comece a vender hoje."}
          </p>
          {!search && tab === "all" && (
            <button
              onClick={() => navigate("/vendas/produtos/novo/editar")}
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-b from-primary to-primary/80 px-5 text-[13px] font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-[0.97]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} /> Criar meu primeiro produto
            </button>
          )}
        </motion.div>
      ) : viewMode === "grid" ? (
        /* ─── GRID VIEW ─── */
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((p, i) => {
              const s = st(p);
              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.2) }}
                  className="group relative rounded-2xl border border-border/40 bg-card overflow-hidden hover:border-border/70 hover:shadow-lg hover:shadow-primary/[0.04] transition-all duration-300 cursor-pointer"
                  onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
                >
                  {/* Product Image */}
                  <div className="relative aspect-[16/9] bg-gradient-to-br from-muted/30 to-muted/10 overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/20 border border-border/30">
                          <Package className="h-6 w-6 text-muted-foreground/20" strokeWidth={1.5} />
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-60" />

                    <div className="absolute top-3 left-3">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold backdrop-blur-md border border-border/20", s.bg, s.text)}>
                        <span className="relative flex h-[5px] w-[5px]">
                          {s.ping && <span className={cn("absolute inline-flex h-full w-full rounded-full animate-ping opacity-50", s.dot)} />}
                          <span className={cn("relative inline-flex h-[5px] w-[5px] rounded-full", s.dot)} />
                        </span>
                        {s.label}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200" onClick={e => e.stopPropagation()}>
                      {p.checkout_url && (
                        <button
                          onClick={() => copyLink(p)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-background/80 backdrop-blur-md border border-border/30 text-muted-foreground hover:text-foreground hover:bg-background transition-all shadow-sm"
                        >
                          {copiedId === p.id ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      {menu(p,
                        "flex h-7 w-7 items-center justify-center rounded-lg bg-background/80 backdrop-blur-md border border-border/30 text-muted-foreground hover:text-foreground hover:bg-background transition-all shadow-sm"
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    {p.delivery_type && (
                      <p className="text-[9px] font-heading uppercase tracking-[0.2em] text-muted-foreground/35 mb-2">
                        {DELIVERY_LABELS[p.delivery_type] || p.delivery_type}
                      </p>
                    )}

                    <h3 className="text-[14px] font-display font-bold text-foreground leading-tight line-clamp-1 mb-1 tracking-[-0.02em]">
                      {p.name}
                    </h3>

                    {p.description && (
                      <p className="text-[11px] text-muted-foreground/40 line-clamp-2 leading-relaxed mb-3">
                        {p.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-border/20">
                      <div>
                        <p className="text-[9px] text-muted-foreground/30 font-semibold uppercase tracking-wider mb-0.5">Preço</p>
                        <p className="font-numbers text-[15px] text-foreground leading-none">
                          {fmt(Number(p.price))}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        {p.checkout_url && (
                          <button
                            onClick={() => window.open(getLink(p.checkout_url!), "_blank")}
                            className="flex h-8 items-center gap-1.5 rounded-lg border border-border/40 bg-background/60 px-2.5 text-[11px] font-semibold text-muted-foreground/60 hover:text-foreground hover:border-border/70 transition-all"
                          >
                            <Eye className="h-3 w-3" /> Ver
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
                          className="flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/15 px-2.5 text-[11px] font-bold text-primary hover:bg-primary/15 transition-all"
                        >
                          Editar <ArrowUpRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        /* ─── LIST VIEW ─── */
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="overflow-hidden rounded-2xl border border-border/40 bg-card/40"
        >
          <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_120px_90px_90px_44px] items-center border-b border-border/30 px-5 py-2.5">
            {["Produto", "Tipo", "Preço", "Status", ""].map((h, i) => (
              <span key={i} className={cn("text-[9px] font-heading uppercase tracking-[0.18em] text-muted-foreground/30", i === 2 && "text-right", i === 3 && "text-center")}>
                {h}
              </span>
            ))}
          </div>

          <AnimatePresence mode="popLayout">
            {filtered.map((p) => {
              const s = st(p);
              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
                  className="group grid cursor-pointer items-center border-b border-border/15 px-5 py-3 transition-all duration-200 hover:bg-muted/[0.04] sm:grid-cols-[minmax(0,1fr)_120px_90px_90px_44px] last:border-b-0"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-muted/10 ring-1 ring-inset ring-border/40 transition-transform duration-300 group-hover:scale-[1.05]">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground/25" strokeWidth={1.5} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold tracking-[-0.01em] text-foreground leading-tight">{p.name}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground/35 max-w-[280px]">{p.description || "Sem descrição"}</p>
                    </div>
                  </div>

                  <div className="hidden sm:block">
                    <span className="text-[11px] text-muted-foreground/40 font-medium">
                      {DELIVERY_LABELS[p.delivery_type] || p.delivery_type}
                    </span>
                  </div>

                  <div className="hidden text-right sm:block">
                    <span className="font-numbers text-[13px] text-foreground">{fmt(Number(p.price))}</span>
                  </div>

                  <div className="hidden justify-center sm:flex">
                    <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold", s.text)}>
                      <span className="relative flex h-[5px] w-[5px]">
                        {s.ping && <span className={cn("absolute inline-flex h-full w-full rounded-full animate-ping opacity-50", s.dot)} />}
                        <span className={cn("relative inline-flex h-[5px] w-[5px] rounded-full", s.dot)} />
                      </span>
                      {s.label}
                    </span>
                  </div>

                  <div className="hidden justify-end sm:flex" onClick={e => e.stopPropagation()}>
                    {menu(p,
                      "flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/20 opacity-0 transition-all duration-200 hover:bg-muted/15 hover:text-foreground group-hover:opacity-100"
                    )}
                  </div>

                  <div className="col-span-full mt-2 flex items-center justify-between sm:hidden" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2.5">
                      <span className="font-numbers text-[13px] text-foreground">{fmt(Number(p.price))}</span>
                      <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold", s.text)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                        {s.label}
                      </span>
                    </div>
                    {menu(p, "flex h-7 w-7 items-center justify-center rounded-lg border border-border/40 bg-card text-muted-foreground")}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ════════ Modals ════════ */}
      {pixelProduct && (
        <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={v => { if (!v) setPixelProduct(null); }} />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-sm rounded-2xl border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-display font-bold">Excluir produto</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground/60">Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="h-9 rounded-xl text-[13px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="h-9 gap-1.5 rounded-xl bg-destructive text-[13px] text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {deleting ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
