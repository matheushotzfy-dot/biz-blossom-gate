import { useCallback, useMemo, useState } from "react";
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
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { HDShell, HDHeader } from "@/components/hd/HDPage";


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
  const { data: products = [], refetch: loadProducts, isLoading: productsLoading } = useProducts();

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
    const c: Record<"active" | "draft" | "pending_review" | "inactive", number> = { active: 0, draft: 0, pending_review: 0, inactive: 0 };
    for (const { eff } of productsWithStatus) {
      if (eff in c) c[eff as keyof typeof c]++;
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

  const handleEditProduct = useCallback((product: Product) => navigate(`/vendas/produtos/${product.id}/editar`), [navigate]);
  const handleOpenMembers = useCallback((product: Product) => navigate(`/vendas/conteudo/${product.id}/builder`), [navigate]);
  const handleOpenCheckout = useCallback((product: Product) => {
    if (!product.checkout_url) return;
    window.open(getCheckoutLink(product.checkout_url), "_blank", "noopener,noreferrer");
  }, []);
  const handleCopyLink = useCallback(async (product: Product) => {
    if (!product.checkout_url) return;
    try {
      await navigator.clipboard.writeText(getCheckoutLink(product.checkout_url));
      setCopiedId(product.id);
      toast.success("Link copiado!");
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }, []);
  const confirmDelete = async () => {
    if (!user || !deleteTarget) return;
    setDeleting(true);
    // Soft delete: keep record for admin audit (sales, customers, history)
    const { error } = await supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString(), status: "inactive" })
      .eq("id", deleteTarget)
      .eq("user_id", user.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (error) { toast.error("Erro ao excluir produto"); return; }
    toast.success("Produto removido");
    await loadProducts();
  };

  const confirmClearDrafts = async () => {
    if (!user || draftIds.length === 0) return;
    setClearingDrafts(true);
    // Drafts can be hard-deleted (no sales history)
    const { error } = await supabase.from("products").delete().in("id", draftIds).eq("user_id", user.id);
    setClearingDrafts(false);
    setClearDraftsOpen(false);
    if (error) { toast.error("Erro ao limpar rascunhos"); return; }
    toast.success(`${draftIds.length} rascunho(s) removido(s)`);
    await loadProducts();
  };

  const handleDuplicate = useCallback(async (product: Product) => {
    if (!user) return;
    const slug = crypto.randomUUID().slice(0, 8);
    const checkoutUrl = `${window.location.origin}/pay/${slug}`;
    const { error } = await supabase.from("products").insert({
      user_id: user.id,
      name: `${product.name} (cópia)`,
      description: product.description,
      price: product.price,
      status: "pending_review",
      image_url: product.image_url,
      display_name: product.display_name,
      delivery_type: product.delivery_type,
      checkout_url: checkoutUrl,
    });
    if (error) { toast.error("Erro ao duplicar produto"); return; }
    toast.success("Produto duplicado! Aguardando revisão.");
    await loadProducts();
  }, [user, loadProducts]);

  const handleToggleStatus = useCallback(async (product: Product) => {
    if (!user) return;
    const next = product.status === "active" ? "inactive" : "active";
    const { error } = await supabase
      .from("products")
      .update({ status: next })
      .eq("id", product.id)
      .eq("user_id", user.id);
    if (error) { toast.error("Erro ao alterar status"); return; }
    toast.success(next === "active" ? "Vendas reativadas!" : "Vendas pausadas. Produto fora do checkout público.");
    await loadProducts();
  }, [user, loadProducts]);

  const handleDeleteProduct = useCallback((product: Product) => setDeleteTarget(product.id), []);
  const handleOpenPixels = useCallback((product: Product) => setPixelProduct(product), []);

  const menuHandlers = useMemo(() => ({
    onCopyLink: handleCopyLink,
    onDeleteProduct: handleDeleteProduct,
    onEditProduct: handleEditProduct,
    onOpenCheckout: handleOpenCheckout,
    onOpenMembers: handleOpenMembers,
    onOpenPixels: handleOpenPixels,
    onDuplicateProduct: handleDuplicate,
    onToggleStatus: handleToggleStatus,
  }), [handleCopyLink, handleDeleteProduct, handleEditProduct, handleOpenCheckout, handleOpenMembers, handleOpenPixels, handleDuplicate, handleToggleStatus]);

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
    <HDShell>
      {/* ── Hero ── */}
      <HDHeader
        eyebrow={`${products.length} ${products.length === 1 ? "produto" : "produtos"} no catálogo`}
        title="Produtos"
        subtitle="Gerencie seu catálogo, checkout e área de membros em um só lugar."
        actions={
          <div className="flex items-center gap-2">
            {showClearDraftsBtn && (
              <button
                onClick={() => setClearDraftsOpen(true)}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border/60 bg-card px-3 text-[12px] font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
                <span className="hidden sm:inline">Limpar rascunhos</span>
                <span className="tabular-nums">{draftIds.length}</span>
              </button>
            )}
            <button
              onClick={() => navigate("/vendas/produtos/novo/editar")}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" strokeWidth={2.25} />
              Novo produto
            </button>
          </div>
        }
      />

      {/* ── Filtros + busca ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-2 overflow-x-auto scrollbar-none sm:mx-0">
          <div className="mx-2 inline-flex min-w-full items-center gap-px rounded-xl border border-border/60 bg-card p-px sm:mx-0 lg:w-fit lg:min-w-0">
            {tabs.map((item) => {
              const active = tab === item.value;
              return (
                <button
                  key={item.value}
                  onClick={() => setTab(item.value)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3.5 text-[12px] font-medium transition-colors",
                    active ? "bg-muted/50 text-foreground" : "text-muted-foreground/70 hover:text-foreground",
                  )}
                >
                  <span className={cn("flex h-3.5 w-3.5 items-center justify-center", active ? tabAccent[item.value] : "text-muted-foreground/40")}>
                    {tabIcon[item.value]}
                  </span>
                  {item.label}
                  {item.count > 0 && (
                    <span className={cn("text-[11px] tabular-nums", active ? "text-foreground/60" : "text-muted-foreground/40")}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/45" size={15} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            className="h-10 w-full rounded-xl border border-border/60 bg-card pl-10 pr-9 text-[12.5px] font-medium text-foreground transition-colors placeholder:text-muted-foreground/40 focus:border-primary/30 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Limpar busca"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>


      {/* ── Catálogo ── */}
      {productsLoading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-[24px] border border-border/60 bg-card">
              <div className="aspect-[16/9] w-full animate-pulse bg-muted/30" />
              <div className="space-y-2.5 p-4">
                <div className="h-3 w-3/4 animate-pulse rounded-full bg-muted/40" />
                <div className="h-2.5 w-1/2 animate-pulse rounded-full bg-muted/25" />
                <div className="h-4 w-24 animate-pulse rounded-full bg-muted/35" />
                <div className="h-7 w-full animate-pulse rounded-full bg-muted/20" />
              </div>
            </div>
          ))}
        </div>

      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-border/60 bg-card px-6 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-[12px] border border-border/60 bg-muted/30">
            <Package className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
          </div>
          <p className="mt-5 text-[14px] font-black text-foreground">
            {search || tab !== "all" ? "Nenhum resultado encontrado" : "Comece seu catálogo"}
          </p>
          <p className="mt-1.5 max-w-[320px] text-[12.5px] leading-relaxed text-muted-foreground/70">
            {search || tab !== "all"
              ? "Ajuste os filtros ou o termo de busca para encontrar o que procura."
              : "Crie seu primeiro produto, configure o checkout e comece a faturar hoje mesmo."}
          </p>
          {!search && tab === "all" && (
            <button
              onClick={() => navigate("/vendas/produtos/novo/editar")}
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" strokeWidth={2.25} />
              Criar primeiro produto
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
    </HDShell>
  );
}
