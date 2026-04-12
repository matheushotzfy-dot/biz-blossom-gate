import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  Package,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

import PixelSettingsDialog from "@/components/PixelSettingsDialog";
import { ProductGridView } from "@/components/products/ProductGridView";
import { ProductListView } from "@/components/products/ProductListView";
import type { Product } from "@/components/products/productPresentation";
import { formatCurrency, getCheckoutLink } from "@/components/products/productPresentation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "active" | "inactive" | "pending_review";

export default function Produtos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: products = [], refetch: loadProducts } = useProducts();

  const [pixelProduct, setPixelProduct] = useState<Product | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (tab !== "all" && p.status !== tab) return false;
      return !q || p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
    });
  }, [products, search, tab]);

  const activeCount = products.filter((p) => p.status === "active").length;
  const inactiveCount = products.filter((p) => p.status === "inactive").length;
  const pendingCount = products.filter((p) => p.status === "pending_review").length;
  const checkoutCount = products.filter((p) => Boolean(p.checkout_url)).length;
  const totalPrice = products.reduce((s, p) => s + Number(p.price), 0);
  const avgPrice = products.length ? totalPrice / products.length : 0;

  const tabs: { label: string; value: FilterTab; count: number }[] = [
    { label: "Todos", value: "all", count: products.length },
    { label: "Ativos", value: "active", count: activeCount },
    { label: "Em revisão", value: "pending_review", count: pendingCount },
    { label: "Inativos", value: "inactive", count: inactiveCount },
  ];

  const handleEditProduct = (p: Product) => navigate(`/vendas/produtos/${p.id}/editar`);
  const handleOpenMembers = (p: Product) => navigate(`/vendas/conteudo/${p.id}/builder`);
  const handleOpenCheckout = (p: Product) => {
    if (!p.checkout_url) return;
    window.open(getCheckoutLink(p.checkout_url), "_blank", "noopener,noreferrer");
  };
  const handleCopyLink = async (p: Product) => {
    if (!p.checkout_url) return;
    try {
      await navigator.clipboard.writeText(getCheckoutLink(p.checkout_url));
      setCopiedId(p.id);
      toast.success("Link copiado!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };
  const confirmDelete = async () => {
    if (!user || !deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("products").delete().eq("id", deleteTarget).eq("user_id", user.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (error) { toast.error("Erro ao excluir produto"); return; }
    toast.success("Produto removido");
    await loadProducts();
  };

  const menuHandlers = {
    onCopyLink: handleCopyLink,
    onDeleteProduct: (p: Product) => setDeleteTarget(p.id),
    onEditProduct: handleEditProduct,
    onOpenCheckout: handleOpenCheckout,
    onOpenMembers: handleOpenMembers,
    onOpenPixels: (p: Product) => setPixelProduct(p),
  };

  const kpis = [
    { label: "Catálogo", value: String(products.length), icon: Package, color: "text-foreground", iconBg: "bg-info/10 text-info border-info/20" },
    { label: "Ativos", value: String(activeCount), icon: CheckCircle2, color: "text-success", iconBg: "bg-success/10 text-success border-success/20" },
    { label: "Em revisão", value: String(pendingCount), icon: Clock3, color: "text-warning", iconBg: "bg-warning/10 text-warning border-warning/20" },
    { label: "Checkouts", value: String(checkoutCount), icon: Link2, color: "text-info", iconBg: "bg-info/10 text-info border-info/20" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 pb-20 md:pb-12">
      {/* ── Header row ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="font-heading text-[26px] font-bold tracking-[-0.04em] text-foreground sm:text-[32px]">
            Meus Produtos
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {products.length} produto{products.length !== 1 && "s"} · ticket médio{" "}
            <span className="font-numbers font-semibold text-foreground">{formatCurrency(avgPrice)}</span>
          </p>
        </div>

        <button
          onClick={() => navigate("/vendas/produtos/novo/editar")}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-[13px] font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.2} />
          Novo produto
        </button>
      </motion.div>

      {/* ── KPI strip ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.06 }}
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/55">{kpi.label}</p>
                <p className={cn("mt-2 font-numbers text-[28px] font-bold leading-none tracking-[-0.04em]", kpi.color)}>
                  {kpi.value}
                </p>
              </div>
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl border", kpi.iconBg)}>
                <kpi.icon className="h-4 w-4" strokeWidth={1.8} />
              </div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── Main table card ── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.12 }}
        className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm"
      >
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-border/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {tabs.map((t) => {
              const active = tab === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={cn(
                    "relative shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-secondary text-secondary-foreground shadow-sm"
                      : "text-muted-foreground/60 hover:text-foreground hover:bg-accent/40"
                  )}
                >
                  {t.label}
                  <span className={cn(
                    "ml-1.5 tabular-nums text-[11px]",
                    active ? "text-secondary-foreground/60" : "text-muted-foreground/40"
                  )}>
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 sm:w-60 sm:flex-none">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="h-9 w-full rounded-lg border border-border/50 bg-background pl-9 pr-8 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* View toggle */}
            <div className="hidden items-center rounded-lg border border-border/50 bg-background p-0.5 sm:flex">
              {([{ icon: List, v: "list" as const }, { icon: LayoutGrid, v: "grid" as const }]).map((m) => (
                <button
                  key={m.v}
                  onClick={() => setViewMode(m.v)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                    viewMode === m.v
                      ? "bg-secondary text-secondary-foreground shadow-sm"
                      : "text-muted-foreground/40 hover:text-muted-foreground"
                  )}
                >
                  <m.icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        {filtered.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/50 bg-background">
              <Package className="h-6 w-6 text-muted-foreground/30" strokeWidth={1.5} />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">
              {search || tab !== "all" ? "Nenhum resultado" : "Nenhum produto ainda"}
            </p>
            <p className="mt-1.5 max-w-xs text-[13px] text-muted-foreground/60">
              {search || tab !== "all"
                ? "Ajuste os filtros para encontrar produtos."
                : "Crie seu primeiro produto para começar a vender."}
            </p>
            {!search && tab === "all" && (
              <button
                onClick={() => navigate("/vendas/produtos/novo/editar")}
                className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
              >
                <Plus className="h-4 w-4" />
                Criar produto
              </button>
            )}
          </div>
        ) : viewMode === "list" ? (
          <ProductListView copiedId={copiedId} products={filtered} {...menuHandlers} />
        ) : (
          <div className="p-4 sm:p-5">
            <ProductGridView copiedId={copiedId} products={filtered} {...menuHandlers} />
          </div>
        )}

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="border-t border-border/40 px-4 py-2.5 sm:px-5">
            <p className="text-[11px] text-muted-foreground/50">
              {filtered.length} de {products.length} produto{products.length !== 1 && "s"}
            </p>
          </div>
        )}
      </motion.section>

      {/* Dialogs */}
      {pixelProduct && (
        <PixelSettingsDialog
          product={pixelProduct}
          open={!!pixelProduct}
          onOpenChange={(open) => { if (!open) setPixelProduct(null); }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-sm rounded-2xl border-border/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-foreground">Excluir produto</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground/60">
              Tem certeza? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="h-9 rounded-xl text-[13px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="h-9 gap-1.5 rounded-xl bg-destructive text-[13px] text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {deleting ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
