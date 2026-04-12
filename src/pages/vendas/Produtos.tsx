import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  Package,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";

import PixelSettingsDialog from "@/components/PixelSettingsDialog";
import { ProductGridView } from "@/components/products/ProductGridView";
import type { Product } from "@/components/products/productPresentation";
import { getCheckoutLink } from "@/components/products/productPresentation";
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((product) => {
      if (tab !== "all" && product.status !== tab) return false;
      return !q || product.name.toLowerCase().includes(q) || product.description?.toLowerCase().includes(q);
    });
  }, [products, search, tab]);

  const activeCount = products.filter((p) => p.status === "active").length;
  const inactiveCount = products.filter((p) => p.status === "inactive").length;
  const pendingCount = products.filter((p) => p.status === "pending_review").length;

  const tabs = [
    { label: "Todos", value: "all" as const, count: products.length },
    { label: "Ativos", value: "active" as const, count: activeCount },
    { label: "Em revisão", value: "pending_review" as const, count: pendingCount },
    { label: "Inativos", value: "inactive" as const, count: inactiveCount },
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

  const menuHandlers = {
    onCopyLink: handleCopyLink,
    onDeleteProduct: (product: Product) => setDeleteTarget(product.id),
    onEditProduct: handleEditProduct,
    onOpenCheckout: handleOpenCheckout,
    onOpenMembers: handleOpenMembers,
    onOpenPixels: (product: Product) => setPixelProduct(product),
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-0 pb-24 md:pb-10">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 pb-5 pt-6 sm:px-7 md:pt-8">
        <h1 className="font-display text-[28px] font-black tracking-[-0.04em] text-foreground sm:text-[32px]">Produtos</h1>
        <button
          onClick={() => navigate("/vendas/produtos/novo/editar")}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-[13px] font-bold text-primary-foreground transition-colors hover:bg-primary/90 sm:h-11 sm:px-6 sm:text-[14px]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.2} />
          Adicionar produto
        </button>
      </div>

      {/* ── Toolbar: tabs + search ── */}
      <div className="flex flex-col gap-4 border-b border-border/50 px-5 pb-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card p-1">
          {tabs.map((item) => {
            const active = tab === item.value;
            return (
              <button
                key={item.value}
                onClick={() => setTab(item.value)}
                className={cn(
                  "rounded-md px-3.5 py-2 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar"
              className="h-10 w-full rounded-lg border border-border/60 bg-card pl-9 pr-8 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:border-ring/40 focus:outline-none sm:w-56"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground/60 transition-colors hover:text-foreground">
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* ── Product grid ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <Package className="h-10 w-10 text-muted-foreground/25" strokeWidth={1.5} />
          <p className="mt-4 text-[15px] font-medium text-foreground">
            {search || tab !== "all" ? "Nenhum resultado encontrado" : "Nenhum produto ainda"}
          </p>
          <p className="mt-1.5 max-w-xs text-[13px] leading-6 text-muted-foreground/60">
            {search || tab !== "all" ? "Tente ajustar os filtros." : "Adicione seu primeiro produto para começar a vender."}
          </p>
          {!search && tab === "all" && (
            <button
              onClick={() => navigate("/vendas/produtos/novo/editar")}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-[13px] font-bold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              Criar produto
            </button>
          )}
        </div>
      ) : (
        <div className="px-5 py-5 sm:px-7">
          <ProductGridView copiedId={copiedId} products={filtered} {...menuHandlers} />
        </div>
      )}

      {/* ── Dialogs ── */}
      {pixelProduct && (
        <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={(open) => { if (!open) setPixelProduct(null); }} />
      )}
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
    </div>
  );
}
