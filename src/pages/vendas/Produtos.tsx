import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  LayoutGrid,
  List,
  Loader2,
  Package,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import PixelSettingsDialog from "@/components/PixelSettingsDialog";
import { ProductActionsMenu } from "@/components/products/ProductActionsMenu";
import { ProductStatusIndicator } from "@/components/products/ProductStatusIndicator";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Product } from "@/components/products/productPresentation";
import { DELIVERY_LABELS, formatCompactDate, formatCurrency, getCheckoutLink } from "@/components/products/productPresentation";

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
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (tab !== "all" && p.status !== tab) return false;
      return !q || p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
    });
  }, [products, search, tab]);

  const activeCount = products.filter((p) => p.status === "active").length;
  const pendingCount = products.filter((p) => p.status === "pending_review").length;
  const inactiveCount = products.filter((p) => p.status === "inactive").length;
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

  const handlers = {
    onCopyLink: handleCopyLink,
    onDeleteProduct: (p: Product) => setDeleteTarget(p.id),
    onEditProduct: handleEditProduct,
    onOpenCheckout: handleOpenCheckout,
    onOpenMembers: (p: Product) => navigate(`/vendas/conteudo/${p.id}/builder`),
    onOpenPixels: (p: Product) => setPixelProduct(p),
  };

  const stats = [
    { label: "Total", value: products.length, color: "text-foreground" },
    { label: "Ativos", value: activeCount, color: "text-success" },
    { label: "Revisão", value: pendingCount, color: "text-warning" },
    { label: "Checkouts", value: checkoutCount, color: "text-info" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 pb-20 md:pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground sm:text-3xl">
            Produtos
          </h1>
          <p className="text-sm text-muted-foreground">
            {products.length} produto{products.length !== 1 && "s"} · ticket médio{" "}
            <span className="font-numbers">{formatCurrency(avgPrice)}</span>
          </p>
        </div>
        <button
          onClick={() => navigate("/vendas/produtos/novo/editar")}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.2} />
          Novo produto
        </button>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border/60 bg-card px-4 py-3.5"
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
              {s.label}
            </p>
            <p className={cn("mt-1 text-2xl font-numbers font-bold leading-none", s.color)}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="rounded-2xl border border-border/60 bg-card">
        <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                  tab === t.value
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-secondary-foreground"
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "ml-1.5 text-[11px] tabular-nums",
                    tab === t.value ? "text-secondary-foreground/70" : "text-muted-foreground/50"
                  )}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 sm:w-64 sm:flex-none">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="h-9 w-full rounded-lg border border-border/60 bg-background pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* View toggle */}
            <div className="hidden rounded-lg border border-border/60 bg-background p-0.5 sm:flex">
              {([{ icon: List, v: "list" as const }, { icon: LayoutGrid, v: "grid" as const }]).map((m) => (
                <button
                  key={m.v}
                  onClick={() => setViewMode(m.v)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                    viewMode === m.v ? "bg-secondary text-secondary-foreground shadow-sm" : "text-muted-foreground/40 hover:text-muted-foreground"
                  )}
                >
                  <m.icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        {filtered.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center border-t border-border/40 px-6 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-background">
              <Package className="h-6 w-6 text-muted-foreground/30" strokeWidth={1.5} />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">
              {search || tab !== "all" ? "Nenhum resultado" : "Nenhum produto"}
            </p>
            <p className="mt-1.5 max-w-xs text-[13px] text-muted-foreground/60">
              {search || tab !== "all"
                ? "Tente ajustar seus filtros."
                : "Crie seu primeiro produto para começar."}
            </p>
            {!search && tab === "all" && (
              <button
                onClick={() => navigate("/vendas/produtos/novo/editar")}
                className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                <Plus className="h-4 w-4" />
                Criar produto
              </button>
            )}
          </div>
        ) : viewMode === "list" ? (
          /* ── TABLE VIEW ── */
          <>
            {/* Desktop table */}
            <div className="hidden border-t border-border/40 md:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="h-10 pl-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                      Produto
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                      Tipo
                    </TableHead>
                    <TableHead className="h-10 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                      Preço
                    </TableHead>
                    <TableHead className="h-10 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                      Status
                    </TableHead>
                    <TableHead className="h-10 w-14 pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((product) => (
                    <TableRow
                      key={product.id}
                      onClick={() => handleEditProduct(product)}
                      className="group cursor-pointer border-border/40 transition-colors hover:bg-accent/30"
                    >
                      <TableCell className="py-3 pl-4">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-background">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground/25" strokeWidth={1.5} />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground/60">
                              {product.description || "Sem descrição"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="rounded-md border border-border/50 bg-secondary/50 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground/80">
                          {DELIVERY_LABELS[product.delivery_type] || product.delivery_type}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <span className="font-numbers text-sm font-semibold text-foreground">
                          {formatCurrency(Number(product.price))}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-center">
                        <div className="flex justify-center">
                          <ProductStatusIndicator status={product.status} />
                        </div>
                      </TableCell>
                      <TableCell className="py-3 pr-4">
                        <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                          <ProductActionsMenu
                            copied={copiedId === product.id}
                            product={product}
                            {...handlers}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="border-t border-border/40 md:hidden">
              {filtered.map((product) => (
                <div
                  key={product.id}
                  onClick={() => handleEditProduct(product)}
                  className="flex cursor-pointer items-center gap-3 border-b border-border/40 px-4 py-3 transition-colors last:border-b-0 active:bg-accent/30"
                >
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-background">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground/25" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                      <span className="shrink-0 font-numbers text-sm font-semibold text-foreground">
                        {formatCurrency(Number(product.price))}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <ProductStatusIndicator status={product.status} tone="soft" />
                      <span className="text-[11px] text-muted-foreground/50">
                        {DELIVERY_LABELS[product.delivery_type] || product.delivery_type}
                      </span>
                    </div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <ProductActionsMenu
                      copied={copiedId === product.id}
                      product={product}
                      triggerClassName="h-8 w-8"
                      {...handlers}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* ── GRID VIEW ── */
          <div className="grid gap-3 border-t border-border/40 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((product) => (
              <div
                key={product.id}
                onClick={() => handleEditProduct(product)}
                className="group cursor-pointer rounded-2xl border border-border/60 bg-background p-4 transition-all hover:border-border hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-card">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground/20" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-foreground">{product.name}</h3>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground/60">{product.description || "Sem descrição"}</p>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <ProductActionsMenu copied={copiedId === product.id} product={product} {...handlers} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between border-t border-border/40 pt-3">
                  <div>
                    <p className="font-numbers text-lg font-bold text-foreground">{formatCurrency(Number(product.price))}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <ProductStatusIndicator status={product.status} tone="soft" />
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEditProduct(product); }}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-secondary px-3 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                  >
                    Editar
                    <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="border-t border-border/40 px-4 py-3">
            <p className="text-xs text-muted-foreground/50">
              {filtered.length} de {products.length} produtos
            </p>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {pixelProduct && (
        <PixelSettingsDialog
          product={pixelProduct}
          open={!!pixelProduct}
          onOpenChange={(open) => { if (!open) setPixelProduct(null); }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Excluir produto</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Tem certeza? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="h-9 rounded-lg text-sm">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="h-9 gap-1.5 rounded-lg bg-destructive text-sm text-destructive-foreground hover:bg-destructive/90"
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
