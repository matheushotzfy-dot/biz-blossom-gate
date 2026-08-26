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

  const handleDuplicate = async (product: Product) => {
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
  };

  const handleToggleStatus = async (product: Product) => {
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
  };

  const menuHandlers = {
    onCopyLink: handleCopyLink,
    onDeleteProduct: (product: Product) => setDeleteTarget(product.id),
    onEditProduct: handleEditProduct,
    onOpenCheckout: handleOpenCheckout,
    onOpenMembers: handleOpenMembers,
    onOpenPixels: (product: Product) => setPixelProduct(product),
    onDuplicateProduct: handleDuplicate,
    onToggleStatus: handleToggleStatus,
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
    <HDShell>
      {/* ── Hero ── */}
      <HDHeader
        eyebrow={`${products.length} ${products.length === 1 ? "produto" : "produtos"} no catálogo`}
        title="Produtos"
        subtitle="Gerencie seu catálogo, checkout e área de membros em um só lugar."
        actions={
          <button
            onClick={() => navigate("/vendas/produtos/novo/editar")}
            className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-primary px-4 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            Novo produto
          </button>
        }
      />

      {/* ── Filtros + busca (linha seca, sem elevação) ── */}
      <div className="flex flex-col gap-2.5 animate-fade-in stagger-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-3 overflow-x-auto scrollbar-none sm:mx-0">
          <div className="inline-flex min-w-full items-center gap-px rounded-[10px] border border-border/60 bg-card p-px mx-3 sm:mx-0 lg:w-fit lg:min-w-0">
            {tabs.map((item) => {
              const active = tab === item.value;
              return (
                <button
                  key={item.value}
                  onClick={() => setTab(item.value)}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[9px] px-3 text-[12px] font-medium transition-colors",
                    active
                      ? "bg-muted/50 text-foreground"
                      : "text-muted-foreground/70 hover:text-foreground"
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

        <div className="flex w-full items-center gap-2 lg:w-auto">
          {showClearDraftsBtn && (
            <button
              onClick={() => setClearDraftsOpen(true)}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-border/60 bg-card px-3 text-[11.5px] font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="hidden sm:inline">Limpar rascunhos</span>
              <span className="tabular-nums">{draftIds.length}</span>
            </button>
          )}
          <div className="relative flex-1 lg:flex-none">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto"
              className="h-9 w-full rounded-[10px] border border-border/60 bg-card pl-9 pr-8 text-[12px] text-foreground placeholder:text-muted-foreground/50 transition-colors focus:border-border focus:outline-none lg:w-72"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 transition-colors hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Catálogo ── */}
      <div>
        {productsLoading ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-[12px] border border-border/60 bg-card">
                <div className="flex items-start gap-3.5 p-4">
                  <div className="h-[52px] w-[52px] shrink-0 rounded-[10px] bg-muted/40" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-1/2 rounded bg-muted/40" />
                    <div className="h-2.5 w-2/3 rounded bg-muted/25" />
                    <div className="h-5 w-24 rounded bg-muted/30" />
                  </div>
                </div>
                <div className="h-10 border-t border-border/40" />
                <div className="h-11 border-t border-border/40" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[12px] border border-dashed border-border/60 bg-card px-6 py-20 text-center animate-fade-in stagger-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-[12px] border border-border/60 bg-background">
              <Package className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
            </div>
            <p className="mt-5 font-display text-[15px] font-bold tracking-[-0.02em] text-foreground">
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
                className="mt-6 inline-flex h-9 items-center gap-2 rounded-[10px] bg-primary px-4 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" strokeWidth={2.25} />
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
    </HDShell>
  );
}
