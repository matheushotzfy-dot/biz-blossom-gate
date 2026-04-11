import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Package, Plus, Trash2, MoreHorizontal, Copy, CheckCircle2,
  Settings2, Palette, Star, ExternalLink, Search, X, Crosshair,
  Loader2, ShoppingBag, TrendingUp, Clock, Zap,
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

const STATUS: Record<string, { label: string; cls: string; dot: string; ping?: boolean }> = {
  active:         { label: "Ativo",   cls: "bg-success/10 text-success border-success/20",        dot: "bg-success", ping: true },
  inactive:       { label: "Inativo", cls: "bg-muted/30 text-muted-foreground border-border/40",  dot: "bg-muted-foreground/50" },
  pending_review: { label: "Revisão", cls: "bg-warning/10 text-warning border-warning/20",        dot: "bg-warning" },
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

  const kpis = [
    { label: "Total de Produtos", value: String(products.length), icon: ShoppingBag, accent: "text-primary" },
    { label: "Produtos Ativos", value: String(activeCount), icon: TrendingUp, accent: "text-success" },
    { label: "Em Revisão", value: String(pendingCount), icon: Clock, accent: "text-warning" },
    { label: "Receita Potencial", value: fmt(totalRevenue), icon: Zap, accent: "text-primary" },
  ];

  const st = (p: Product) => STATUS[p.status] || STATUS.inactive;

  const menu = (p: Product, btnCls: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={btnCls}><MoreHorizontal className="h-4 w-4" strokeWidth={1.6} /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-48 rounded-xl border-border/60 bg-popover p-1.5 shadow-xl">
        {[
          { icon: Settings2, label: "Editar produto", fn: () => navigate(`/vendas/produtos/${p.id}/editar`) },
          { icon: Palette, label: "Checkout Builder", fn: () => navigate(`/vendas/produtos/${p.id}/checkout-builder`) },
          ...(p.checkout_url ? [
            { icon: copiedId === p.id ? CheckCircle2 : Copy, label: copiedId === p.id ? "Copiado!" : "Copiar link", fn: () => copyLink(p) },
            { icon: ExternalLink, label: "Ver checkout", fn: () => window.open(getLink(p.checkout_url!), "_blank") },
          ] : []),
          { icon: Crosshair, label: "Pixels", fn: () => setPixelProduct(p) },
          { icon: Star, label: "Área de membros", fn: () => navigate(`/vendas/conteudo/${p.id}/builder`) },
        ].map((item, i) => (
          <DropdownMenuItem key={i} onClick={item.fn} className="gap-2.5 rounded-lg px-2.5 py-2 text-[12px] cursor-pointer">
            <item.icon className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.7} /> {item.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem onClick={() => setDeleteTarget(p.id)} className="gap-2.5 rounded-lg px-2.5 py-2 text-[12px] text-destructive focus:text-destructive cursor-pointer">
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-20 md:pb-16">
      {/* ═══ HERO ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative mb-8 rounded-2xl border border-border/60 bg-card p-6 overflow-hidden"
      >
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -top-20 -left-20 h-[300px] w-[300px] rounded-full bg-primary/[0.06] blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-[250px] w-[250px] rounded-full bg-success/[0.04] blur-[100px]" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-[-0.04em] text-foreground">Meus Produtos</h1>
              <span className="inline-flex h-6 items-center rounded-full border border-border/60 bg-muted/30 px-2.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                {products.length}
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground/70">Gerencie seu catálogo de produtos digitais</p>
          </div>

          <button
            onClick={() => navigate("/vendas/produtos/novo/editar")}
            className="inline-flex h-10 items-center gap-2.5 rounded-xl bg-gradient-to-b from-primary to-primary/85 px-5 text-[13px] font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:brightness-110 active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Novo Produto
          </button>
        </div>

        {/* KPI strip */}
        <div className="relative z-10 mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 + i * 0.06 }}
              className="group rounded-xl border border-border/40 bg-background/50 p-4 transition-colors hover:border-border/70"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50">{kpi.label}</p>
                <div className={cn("h-7 w-7 rounded-lg bg-muted/20 flex items-center justify-center transition-transform group-hover:scale-110", kpi.accent)}>
                  <kpi.icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                </div>
              </div>
              <p className={cn("text-xl font-bold tabular-nums tracking-[-0.03em] leading-none", kpi.accent === "text-success" || kpi.accent === "text-warning" ? kpi.accent : "text-foreground")}>
                {kpi.value}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ═══ TOOLBAR ═══ */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 border-b border-border/30 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "relative shrink-0 px-3.5 pb-3 pt-1 text-[13px] font-semibold transition-colors",
                tab === t.value ? "text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground/70"
              )}
            >
              {t.label}
              {t.count != null && (
                <span className={cn(
                  "ml-1.5 inline-flex h-[18px] items-center rounded-md px-1.5 text-[10px] tabular-nums font-semibold",
                  tab === t.value ? "bg-primary/15 text-primary" : "bg-muted/30 text-muted-foreground/50"
                )}>
                  {t.count}
                </span>
              )}
              {tab === t.value && (
                <motion.div
                  layoutId="prod-tab-v2"
                  className="absolute bottom-0 left-1.5 right-1.5 h-0.5 rounded-full bg-primary"
                  transition={{ type: "spring", bounce: 0.12, duration: 0.45 }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            className="h-9 w-full rounded-xl border border-border/50 bg-card/60 pl-10 pr-9 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ═══ TABLE ═══ */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-border/40 bg-card/30 text-center"
        >
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/50 bg-card">
            <Package className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold text-foreground">
            {search || tab !== "all" ? "Nenhum resultado" : "Nenhum produto ainda"}
          </p>
          <p className="mt-1 max-w-xs text-[13px] text-muted-foreground/60">
            {search || tab !== "all" ? "Ajuste os filtros para encontrar seus produtos." : "Crie seu primeiro produto digital e comece a vender."}
          </p>
          {!search && tab === "all" && (
            <button
              onClick={() => navigate("/vendas/produtos/novo/editar")}
              className="mt-5 inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-b from-primary to-primary/85 px-4 text-[13px] font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} /> Criar produto
            </button>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="overflow-hidden rounded-2xl border border-border/50 bg-card/30"
        >
          {/* Header */}
          <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_130px_100px_44px] items-center border-b border-border/40 px-5 py-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/40">Produto</span>
            <span className="text-right text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/40">Preço</span>
            <span className="text-center text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/40">Status</span>
            <span />
          </div>

          {/* Rows */}
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
                  className="group grid cursor-pointer items-center border-b border-border/25 px-5 py-4 transition-all duration-200 hover:bg-muted/[0.06] sm:grid-cols-[minmax(0,1fr)_130px_100px_44px] last:border-b-0"
                >
                  {/* Product */}
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted/15 ring-1 ring-inset ring-border/50 transition-transform duration-300 group-hover:scale-[1.04]">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground/30" strokeWidth={1.5} />
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-foreground/[0.05]" />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-foreground leading-tight">
                        {p.name}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-muted-foreground/50 max-w-[340px]">
                        {p.description || "Sem descrição"}
                      </p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="hidden text-right sm:block">
                    <span className="font-mono text-[14px] font-bold tabular-nums tracking-[-0.02em] text-foreground">
                      {fmt(Number(p.price))}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="hidden justify-center sm:flex">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em]", s.cls)}>
                      <span className="relative flex h-[6px] w-[6px]">
                        {s.ping && <span className={cn("absolute inline-flex h-full w-full rounded-full animate-ping opacity-60", s.dot)} />}
                        <span className={cn("relative inline-flex h-[6px] w-[6px] rounded-full", s.dot)} />
                      </span>
                      {s.label}
                    </span>
                  </div>

                  {/* Menu */}
                  <div className="hidden justify-end sm:flex" onClick={e => e.stopPropagation()}>
                    {menu(p,
                      "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/25 opacity-0 transition-all duration-200 hover:bg-muted/20 hover:text-foreground group-hover:opacity-100"
                    )}
                  </div>

                  {/* Mobile bottom */}
                  <div className="col-span-full mt-2.5 flex items-center justify-between sm:hidden" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[13px] font-bold tabular-nums text-foreground">{fmt(Number(p.price))}</span>
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", s.cls)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                        {s.label}
                      </span>
                    </div>
                    {menu(p, "flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-card text-muted-foreground")}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Modals */}
      {pixelProduct && (
        <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={v => { if (!v) setPixelProduct(null); }} />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">Excluir produto</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px]">Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription>
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
