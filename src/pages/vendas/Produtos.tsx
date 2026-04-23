import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  Package,
  Plus,
  Search,
  X,
  Sparkles,
  ArrowUpRight,
  LayoutGrid,
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
    <div className="mx-auto -mt-2 w-full max-w-[1440px] pb-24 md:-mt-3 md:pb-10">
      {/* ── Page header ── */}
      <div className="flex flex-col gap-6 px-5 pt-1 sm:px-7 md:pt-1">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60">
              <LayoutGrid className="h-3.5 w-3.5 text-primary" /> Catálogo operacional
            </div>
            <div className="flex items-baseline gap-3">
              <h1 className="font-display text-[26px] font-extrabold leading-none tracking-tight text-foreground sm:text-[30px]">
                Meus produtos
              </h1>
              <span className="text-[13px] tabular-nums text-muted-foreground/60">
                {products.length}
              </span>
            </div>
            <p className="text-[12px] text-muted-foreground/65">Menos ruído, mais leitura de status, preço e ações.</p>
          </div>
          <button
            onClick={() => navigate("/vendas/produtos/novo/editar")}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition-all duration-200 hover:bg-primary/90 hover:-translate-y-px"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Novo produto
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">Ativos</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <span className="font-numbers text-[28px] font-black tracking-[-0.05em] text-foreground tabular-nums">{activeCount}</span>
              <span className="text-[11px] font-semibold text-success">prontos para vender</span>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">Em revisão</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <span className="font-numbers text-[28px] font-black tracking-[-0.05em] text-foreground tabular-nums">{pendingCount}</span>
              <span className="text-[11px] font-semibold text-warning">aguardando liberação</span>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">Ação rápida</p>
            <button
              onClick={() => navigate("/vendas/produtos/novo/editar")}
              className="mt-2 inline-flex items-center gap-2 text-[12px] font-semibold text-foreground hover:text-primary"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" /> criar novo produto <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Tabs + Search row, integrated with list */}
        <div className="flex flex-col gap-3 border-b border-border/40 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-0.5">
            {tabs.map((item) => {
              const active = tab === item.value;
              return (
                <button
                  key={item.value}
                  onClick={() => setTab(item.value)}
                  className={cn(
                    "relative rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all duration-150",
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                  {item.count > 0 && (
                    <span className={cn(
                      "ml-1.5 text-[10.5px] tabular-nums",
                      active ? "text-primary" : "text-muted-foreground/45"
                    )}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="h-8 w-full rounded-lg border border-border bg-secondary/50 pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 sm:w-64"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors">
                <X className="h-3 w-3" />
              </button>
            )}
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
