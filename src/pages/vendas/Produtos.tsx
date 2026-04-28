import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  FileEdit,
  Layers,
  Loader2,
  Package,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import PixelSettingsDialog from "@/components/PixelSettingsDialog";
import { ProductGridView } from "@/components/products/ProductGridView";
import type { Product } from "@/components/products/productPresentation";
import { getCheckoutLink, getEffectiveStatus } from "@/components/products/productPresentation";
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

type FilterTab = "all" | "active" | "draft" | "pending_review" | "inactive";

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
  const [clearDraftsOpen, setClearDraftsOpen] = useState(false);
  const [clearingDrafts, setClearingDrafts] = useState(false);

  // Pre-compute effective status for every product (handles auto-draft).
  const productsWithStatus = useMemo(
    () => products.map((p) => ({ product: p, eff: getEffectiveStatus(p) })),
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return productsWithStatus
      .filter(({ product, eff }) => {
        if (tab !== "all" && eff !== tab) return false;
        return !q || product.name.toLowerCase().includes(q) || product.description?.toLowerCase().includes(q);
      })
      .map(({ product }) => product);
  }, [productsWithStatus, search, tab]);

  const counts = useMemo(() => {
    const c = { active: 0, draft: 0, pending_review: 0, inactive: 0 };
    for (const { eff } of productsWithStatus) {
      if (eff in c) (c as any)[eff]++;
    }
    return c;
  }, [productsWithStatus]);

  const draftIds = useMemo(
    () => productsWithStatus.filter((p) => p.eff === "draft").map((p) => p.product.id),
    [productsWithStatus]
  );

  const tabs = [
    { label: "Todos", value: "all" as const, count: products.length },
    { label: "Ativos", value: "active" as const, count: counts.active },
    { label: "Rascunhos", value: "draft" as const, count: counts.draft },
    { label: "Em revisão", value: "pending_review" as const, count: counts.pending_review },
    { label: "Inativos", value: "inactive" as const, count: counts.inactive },
  ];

  const handleEditProduct = (product: Product) => navigate(`/vendas/produtos/${product.id}/editar`);
  const handleOpenMembers = (product: Product) => navigate(`/vendas/conteudo/${product.id}/builder`);
  const handleOpenCheckout = (product: Product) => {
    if (!product.checkout_url) return;
    window.open(getCheckoutLink(product.checkout_url), "_blank", "noopener,noreferrer");
  };
  const handleCopyLink = async (product: Product) => {
    if (!product.checkout_url) return;
    try {
      await navigator.clipboard.writeText(getCheckoutLink(product.checkout_url));
      setCopiedId(product.id);
      toast.success("Link copiado!");
      window.setTimeout(() => setCopiedId(null), 2000);
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

  const confirmClearDrafts = async () => {
    if (!user || draftIds.length === 0) return;
    setClearingDrafts(true);
    const { error } = await supabase.from("products").delete().in("id", draftIds).eq("user_id", user.id);
    setClearingDrafts(false);
    setClearDraftsOpen(false);
    if (error) { toast.error("Erro ao limpar rascunhos"); return; }
    toast.success(`${draftIds.length} rascunho(s) removido(s)`);
    await loadProducts();
  };

  const menuHandlers = {
    onCopyLink: handleCopyLink,
    onDeleteProduct: (product: Product) => setDeleteTarget(product.id),
    onEditProduct: handleEditProduct,
    onOpenCheckout: handleOpenCheckout,
    onOpenMembers: handleOpenMembers,
    onOpenPixels: (product: Product) => setPixelProduct(product),
  };

  const showClearDraftsBtn = tab === "draft" && draftIds.length > 0;

  const tabIcon: Record<FilterTab, JSX.Element> = {
    all: <Layers className="h-3 w-3" strokeWidth={2.5} />,
    active: <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />,
    draft: <FileEdit className="h-3 w-3" strokeWidth={2.5} />,
    pending_review: <Clock className="h-3 w-3" strokeWidth={2.5} />,
    inactive: <XCircle className="h-3 w-3" strokeWidth={2.5} />,
  };

  const tabAccent: Record<FilterTab, string> = {
    all: "text-foreground",
    active: "text-success",
    draft: "text-muted-foreground",
    pending_review: "text-warning",
    inactive: "text-destructive",
  };

  return (
    <div className="mx-auto -mt-2 w-full max-w-[1440px] pb-24 md:-mt-3 md:pb-10">
      {/* ── Hero header ── */}
      <div className="relative flex flex-col gap-7 px-5 pt-1 sm:px-7 md:pt-1">
        {/* Subtle radial accent behind title */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-12 left-0 h-48 w-[520px] -z-[1] opacity-60 blur-3xl"
          style={{
            background:
              "radial-gradient(60% 60% at 20% 50%, hsl(var(--primary) / 0.10), transparent 70%)",
          }}
        />

        <div className="flex flex-wrap items-end justify-between gap-4 animate-fade-in">
          <div className="flex flex-col gap-2">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border/50 bg-secondary/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/80">
              <Sparkles className="h-3 w-3 text-primary" strokeWidth={2.5} />
              Catálogo
            </span>
            <h1 className="font-display text-[40px] font-black leading-[0.9] tracking-[-0.055em] text-foreground sm:text-[52px]">
              Meus produtos
            </h1>
            <p className="max-w-[520px] text-[13px] leading-relaxed text-muted-foreground">
              Gerencie ofertas, links de checkout e a saúde de cada produto da sua operação.
            </p>
          </div>
          <button
            onClick={() => navigate("/vendas/produtos/novo/editar")}
            className="group inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-[13px] font-black uppercase tracking-wider text-primary-foreground transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.5)]"
          >
            <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" strokeWidth={2.75} />
            Novo produto
          </button>
        </div>

        {/* KPI ribbon — minimalista, tabular */}
        <div className="grid grid-cols-2 gap-2 animate-fade-in stagger-1 sm:grid-cols-4">
          {[
            { label: "Total", value: products.length, accent: "text-foreground", dot: "bg-foreground/40" },
            { label: "Ativos", value: counts.active, accent: "text-success", dot: "bg-success" },
            { label: "Rascunhos", value: counts.draft, accent: "text-muted-foreground", dot: "bg-muted-foreground/50" },
            { label: "Em revisão", value: counts.pending_review, accent: "text-warning", dot: "bg-warning" },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="group relative overflow-hidden rounded-xl border border-border/40 bg-card/60 px-4 py-3 transition-all duration-300 hover:border-border hover:bg-card"
            >
              <div className="flex items-center gap-2">
                <span className={cn("h-1.5 w-1.5 rounded-full", kpi.dot)} />
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70">{kpi.label}</p>
              </div>
              <p className={cn("mt-1.5 font-display text-2xl font-black tabular-nums tracking-tight", kpi.accent)}>
                {kpi.value}
              </p>
            </div>
          ))}
        </div>

        {/* Tabs + Search row */}
        <div className="flex flex-col gap-3 border-b border-border/40 pb-3 animate-fade-in stagger-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 overflow-x-auto">
            {tabs.map((item) => {
              const active = tab === item.value;
              return (
                <button
                  key={item.value}
                  onClick={() => setTab(item.value)}
                  className={cn(
                    "relative inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all duration-200",
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <span className={cn("transition-colors", active ? tabAccent[item.value] : "text-muted-foreground/60")}>
                    {tabIcon[item.value]}
                  </span>
                  {item.label}
                  {item.count > 0 && (
                    <span className={cn(
                      "ml-0.5 rounded-md px-1.5 py-px text-[10px] font-black tabular-nums",
                      active ? "bg-background/60 text-foreground" : "text-muted-foreground/50"
                    )}>
                      {item.count}
                    </span>
                  )}
                  {active && (
                    <span className="absolute -bottom-[13px] left-2 right-2 h-[2px] rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {showClearDraftsBtn && (
              <button
                onClick={() => setClearDraftsOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/[0.06] px-3 text-[11.5px] font-black uppercase tracking-wider text-destructive transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground hover:-translate-y-px"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                Limpar rascunhos
                <span className="rounded bg-destructive/20 px-1.5 py-px text-[10px] tabular-nums">{draftIds.length}</span>
              </button>
            )}
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50 transition-colors group-focus-within:text-primary" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto..."
                className="h-9 w-full rounded-lg border border-border/60 bg-secondary/40 pl-9 pr-8 text-xs font-medium text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary/50 focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/15 sm:w-72"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-secondary hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Product workspace ── */}
      <div className="px-5 pt-4 pb-8 sm:px-7">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-secondary">
              <Package className="h-7 w-7 text-muted-foreground" strokeWidth={1.4} />
            </div>
            <p className="mt-5 text-sm font-semibold text-foreground">
              {search || tab !== "all" ? "Nenhum resultado" : "Comece por aqui"}
            </p>
            <p className="mt-1.5 max-w-[260px] text-xs leading-relaxed text-muted-foreground">
              {search || tab !== "all" ? "Tente ajustar os filtros para encontrar o que procura." : "Crie seu primeiro produto e comece a faturar hoje."}
            </p>
            {!search && tab === "all" && (
              <button
                onClick={() => navigate("/vendas/produtos/novo/editar")}
                className="mt-6 inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                Criar produto
              </button>
            )}
          </div>
        ) : (
          <ProductGridView
            copiedId={copiedId}
            products={filtered}
            {...menuHandlers}
          />
        )}
      </div>

      {/* ── Dialogs ── */}
      {pixelProduct && (
        <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={(open) => { if (!open) setPixelProduct(null); }} />
      )}

      {/* Delete single product */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-sm rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Excluir produto</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground">Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="h-9 rounded-lg text-[13px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="h-9 gap-1.5 rounded-lg bg-destructive text-[13px] text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {deleting ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear all drafts */}
      <AlertDialog open={clearDraftsOpen} onOpenChange={setClearDraftsOpen}>
        <AlertDialogContent className="max-w-sm rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Limpar todos os rascunhos</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground">
              Você está prestes a excluir <span className="font-bold text-destructive">{draftIds.length} rascunho(s)</span> que ainda não foram finalizados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearingDrafts} className="h-9 rounded-lg text-[13px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClearDrafts} disabled={clearingDrafts} className="h-9 gap-1.5 rounded-lg bg-destructive text-[13px] text-destructive-foreground hover:bg-destructive/90">
              {clearingDrafts && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {clearingDrafts ? "Limpando…" : `Excluir ${draftIds.length}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
