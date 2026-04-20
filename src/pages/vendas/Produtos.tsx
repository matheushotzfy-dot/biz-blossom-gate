import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  Package,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

import PixelSettingsDialog from "@/components/PixelSettingsDialog";
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
  const checkoutCount = products.filter((p) => Boolean(p.checkout_url)).length;
  const avgPrice = products.length
    ? products.reduce((acc, p) => acc + Number(p.price || 0), 0) / products.length
    : 0;
  const maxPrice = products.length
    ? Math.max(...products.map((p) => Number(p.price || 0)))
    : 0;

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
    onOpenMembers: (product: Product) => handleOpenMembers(product),
    onOpenPixels: (product: Product) => setPixelProduct(product),
  };

  return (
    <div className="mx-auto w-full max-w-[1340px] px-5 pb-24 sm:px-7 md:pb-10">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4 pt-1">
        <div>
          <h1 className="font-display text-[28px] font-black tracking-[-0.025em] text-foreground sm:text-[32px]">
            Meus Produtos
          </h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Gerencie seu catálogo, checkouts e monetização.
          </p>
        </div>
        <button
          onClick={() => navigate("/vendas/produtos/novo/editar")}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-[12.5px] font-bold text-background transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Novo produto
        </button>
      </div>

      {/* ── Stats strip ── */}
      <div className="mt-5 grid grid-cols-2 divide-x divide-border overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-4">
        {[
          { label: "Total", value: String(products.length), sub: `${activeCount} ativos` },
          { label: "Checkouts", value: String(checkoutCount), sub: `${products.length - checkoutCount} pendentes` },
          { label: "Preço médio", value: formatCurrency(avgPrice), sub: "ticket médio do catálogo" },
          { label: "Maior preço", value: formatCurrency(maxPrice), sub: "produto premium" },
        ].map((stat, i) => (
          <div key={stat.label} className={cn("px-5 py-4", i >= 2 && "md:border-l-0")}>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-[22px] font-display font-black tracking-[-0.03em] text-foreground tabular-nums leading-none">
              {stat.value}
            </p>
            <p className="mt-1.5 text-[10.5px] text-muted-foreground">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-[3px]">
          {tabs.map((item) => {
            const active = tab === item.value;
            return (
              <button
                key={item.value}
                onClick={() => setTab(item.value)}
                className={cn(
                  "h-7 rounded-md px-3 text-[11.5px] font-semibold transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
                {item.count > 0 && (
                  <span className={cn(
                    "ml-1.5 text-[10px] tabular-nums",
                    active ? "text-foreground/60" : "text-muted-foreground/60"
                  )}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou descrição"
            className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-9 text-[12.5px] text-foreground placeholder:text-muted-foreground focus:border-foreground/30 focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Workspace ── */}
      <div className="mt-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-muted">
              <Package className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="mt-4 text-[14px] font-bold text-foreground">
              {search || tab !== "all" ? "Nenhum resultado" : "Comece por aqui"}
            </p>
            <p className="mt-1 max-w-[280px] text-[12px] text-muted-foreground">
              {search || tab !== "all" ? "Tente ajustar os filtros para encontrar o que procura." : "Crie seu primeiro produto e comece a faturar hoje."}
            </p>
            {!search && tab === "all" && (
              <button
                onClick={() => navigate("/vendas/produtos/novo/editar")}
                className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-foreground px-4 text-[12px] font-bold text-background hover:opacity-90 transition-opacity"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                Criar produto
              </button>
            )}
          </div>
        ) : (
          <ProductListView
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
