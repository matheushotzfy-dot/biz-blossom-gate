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
    <div className="relative mx-auto w-full max-w-[1480px] pb-24 md:pb-10 antialiased [text-rendering:geometricPrecision]" style={{ fontFeatureSettings: '"ss01","cv11","tnum","kern"' }}>
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-[500px] w-full -translate-x-1/2 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-50" />
      <div className="pointer-events-none absolute left-0 top-0 h-full w-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] mix-blend-overlay" />

      {/* ── Hero header ── */}
      <div className="relative z-10 px-5 pt-4 sm:px-8 sm:pt-6">
        <header className="border-b border-border/40 pb-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-[48px] font-black leading-[0.88] tracking-[-0.06em] text-foreground sm:text-[68px]">
                Meus <span className="text-gradient-primary">Produtos</span>
              </h1>
              <p className="mt-4 flex items-center gap-1.5 text-[12px] font-bold tracking-[-0.005em] text-foreground">
                <span className="inline-block h-2 w-[3px] rounded-full bg-primary" />
                Gerencie seu catálogo e checkouts
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:justify-end">
              <button
                onClick={() => navigate("/vendas/produtos/novo/editar")}
                className="group inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-5 text-[12px] font-black uppercase tracking-wider text-primary-foreground transition-all duration-300 hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.5)]"
              >
                <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" strokeWidth={2.75} />
                Criar Produto
              </button>
            </div>
          </div>
        </header>

        {/* Tabs + Search row */}
        <div className="flex flex-col gap-3 pb-1 animate-fade-in stagger-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex w-fit items-center gap-0.5 rounded-xl border border-border/50 bg-card/60 p-1 overflow-x-auto">
            {tabs.map((item) => {
              const active = tab === item.value;
              return (
                <button
                  key={item.value}
                  onClick={() => setTab(item.value)}
                  className={cn(
                    "group/tab relative inline-flex shrink-0 items-center gap-2 rounded-lg h-8 px-3 text-[12px] font-bold tracking-tight transition-colors duration-200",
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground/80 hover:text-foreground"
                  )}
                >
                  <span className={cn(
                    "flex h-4 w-4 items-center justify-center transition-colors",
                    active ? tabAccent[item.value] : "text-muted-foreground/50 group-hover/tab:text-foreground/70"
                  )}>
                    {tabIcon[item.value]}
                  </span>
                  <span className="font-display">{item.label}</span>
                  {item.count > 0 && (
                    <span className={cn(
                      "inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-md px-1.5 text-[10px] font-black tabular-nums tracking-tight border transition-colors",
                      active
                        ? "bg-background/80 text-foreground border-border/40"
                        : "bg-muted/30 text-muted-foreground/60 border-transparent"
                    )}>
                      {item.count}
                    </span>
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
      <div className="px-5 pt-6 pb-8 sm:px-7">
        {filtered.length === 0 ? (
          <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed border-border/60 bg-card/40 px-6 py-24 text-center animate-fade-in stagger-3">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-[1] opacity-50"
              style={{
                background:
                  "radial-gradient(50% 50% at 50% 30%, hsl(var(--primary) / 0.08), transparent 70%)",
              }}
            />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-border/60 bg-secondary/60 shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.15)]">
              <Package className="h-8 w-8 text-muted-foreground/80" strokeWidth={1.4} />
              <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-lg border border-primary/30 bg-card">
                <Sparkles className="h-3 w-3 text-primary" strokeWidth={2.5} />
              </span>
            </div>
            <p className="mt-6 font-display text-base font-black tracking-tight text-foreground">
              {search || tab !== "all" ? "Nenhum resultado encontrado" : "Comece seu catálogo"}
            </p>
            <p className="mt-1.5 max-w-[320px] text-[13px] leading-relaxed text-muted-foreground">
              {search || tab !== "all"
                ? "Tente ajustar os filtros ou termo de busca para encontrar o que procura."
                : "Crie seu primeiro produto, configure o checkout e comece a faturar hoje mesmo."}
            </p>
            {!search && tab === "all" && (
              <button
                onClick={() => navigate("/vendas/produtos/novo/editar")}
                className="group mt-7 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-[12px] font-black uppercase tracking-wider text-primary-foreground transition-all duration-300 hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.5)]"
              >
                <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" strokeWidth={2.75} />
                Criar primeiro produto
              </button>
            )}
          </div>
        ) : (
          <div className="animate-fade-in stagger-3">
            <ProductGridView
              copiedId={copiedId}
              products={filtered}
              {...menuHandlers}
            />
          </div>
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
