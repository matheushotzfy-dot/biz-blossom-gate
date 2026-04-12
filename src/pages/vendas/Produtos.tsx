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
    <div className="mx-auto w-full max-w-[1440px] pb-24 md:pb-10">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 pb-8 pt-8 sm:px-7 md:pt-10">
        <div className="space-y-1">
          <h1 className="font-display text-[28px] font-black tracking-[-0.04em] text-foreground sm:text-[34px]">
            Meus Produtos
          </h1>
          <p className="text-[13px] text-muted-foreground/60">
            {products.length} {products.length === 1 ? "produto" : "produtos"} no catálogo
          </p>
        </div>
        <button
          onClick={() => navigate("/vendas/produtos/novo/editar")}
          className="inline-flex h-11 items-center gap-2.5 rounded-2xl bg-primary px-6 text-[13px] font-bold text-primary-foreground shadow-[0_2px_8px_hsl(var(--primary)/0.3)] transition-all duration-200 hover:bg-primary/90 hover:shadow-[0_4px_16px_hsl(var(--primary)/0.4)] hover:-translate-y-px sm:h-12 sm:px-7 sm:text-[14px]"
        >
          <Plus className="h-4.5 w-4.5" strokeWidth={2.4} />
          Novo produto
        </button>
      </div>

      {/* ── Toolbar: tabs + search ── */}
      <div className="flex flex-col gap-4 px-5 pb-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex items-center gap-1 rounded-2xl border border-border/30 bg-card/60 p-1.5 backdrop-blur-sm">
          {tabs.map((item) => {
            const active = tab === item.value;
            return (
              <button
                key={item.value}
                onClick={() => setTab(item.value)}
                className={cn(
                  "relative rounded-xl px-4 py-2 text-[13px] font-semibold transition-all duration-200",
                  active
                    ? "bg-primary/10 text-primary shadow-[0_1px_3px_hsl(var(--primary)/0.1)]"
                    : "text-muted-foreground/60 hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                {item.label}
                {item.count > 0 && (
                  <span className={cn(
                    "ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold",
                    active
                      ? "bg-primary/20 text-primary"
                      : "bg-secondary text-muted-foreground/50"
                  )}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="h-11 w-full rounded-2xl border border-border/30 bg-card/60 pl-10 pr-9 text-[13px] text-foreground backdrop-blur-sm placeholder:text-muted-foreground/40 focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10 sm:w-64"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/30 bg-card/60 text-muted-foreground/50 backdrop-blur-sm transition-all hover:border-border/50 hover:text-foreground hover:shadow-sm">
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="mx-5 mb-6 h-px bg-gradient-to-r from-transparent via-border/40 to-transparent sm:mx-7" />

      {/* ── Product grid ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-28 text-center">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-border/20 bg-gradient-to-br from-secondary/60 to-accent/30 shadow-sm">
              <Package className="h-8 w-8 text-muted-foreground/30" strokeWidth={1.4} />
            </div>
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-card bg-primary/20" />
          </div>
          <p className="mt-6 font-display text-[18px] font-bold tracking-[-0.02em] text-foreground">
            {search || tab !== "all" ? "Nenhum resultado" : "Comece por aqui"}
          </p>
          <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-muted-foreground/55">
            {search || tab !== "all" ? "Tente ajustar os filtros para encontrar o que procura." : "Crie seu primeiro produto e comece a faturar hoje."}
          </p>
          {!search && tab === "all" && (
            <button
              onClick={() => navigate("/vendas/produtos/novo/editar")}
              className="mt-7 inline-flex h-12 items-center gap-2.5 rounded-2xl bg-primary px-7 text-[14px] font-bold text-primary-foreground shadow-[0_2px_8px_hsl(var(--primary)/0.3)] transition-all hover:bg-primary/90 hover:shadow-[0_4px_16px_hsl(var(--primary)/0.4)] hover:-translate-y-px"
            >
              <Plus className="h-4.5 w-4.5" strokeWidth={2.4} />
              Criar produto
            </button>
          )}
        </div>
      ) : (
        <div className="px-5 pb-8 sm:px-7">
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
