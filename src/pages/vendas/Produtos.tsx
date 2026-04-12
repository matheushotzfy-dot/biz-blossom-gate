import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, LayoutGrid, List, Loader2, Package, Plus, Search, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import PixelSettingsDialog from "@/components/PixelSettingsDialog";
import { ProductGridView } from "@/components/products/ProductGridView";
import { ProductListView } from "@/components/products/ProductListView";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { Product } from "@/components/products/productPresentation";
import { formatCurrency, getCheckoutLink } from "@/components/products/productPresentation";

type FilterTab = "all" | "active" | "inactive" | "pending_review";

function MetricPanel({
  label,
  helper,
  value,
  icon: Icon,
  valueClassName,
  iconClassName,
}: {
  helper: string;
  label: string;
  value: string;
  icon: typeof Package;
  valueClassName?: string;
  iconClassName?: string;
}) {
  return (
    <div className="bg-background/80 px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-heading uppercase tracking-[0.18em] text-muted-foreground/35">{label}</p>
          <p className={cn("mt-2 text-[22px] font-numbers leading-none text-foreground", valueClassName)}>{value}</p>
          <p className="mt-2 text-[11px] text-muted-foreground/45">{helper}</p>
        </div>
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-2xl border border-border/25 bg-card/65 text-muted-foreground/55",
            iconClassName
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.7} />
        </div>
      </div>
    </div>
  );
}

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
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      if (tab !== "all" && product.status !== tab) return false;

      return (
        !search ||
        product.name.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query)
      );
    });
  }, [products, search, tab]);

  const activeCount = products.filter((product) => product.status === "active").length;
  const inactiveCount = products.filter((product) => product.status === "inactive").length;
  const pendingCount = products.filter((product) => product.status === "pending_review").length;
  const checkoutCount = products.filter((product) => Boolean(product.checkout_url)).length;
  const totalPrice = products.reduce((sum, product) => sum + Number(product.price), 0);
  const averagePrice = products.length ? totalPrice / products.length : 0;

  const metrics = [
    {
      label: "Catálogo",
      value: String(products.length),
      helper: "produtos cadastrados",
      icon: Package,
      valueClassName: "text-foreground",
      iconClassName: "text-info bg-info/8 border-info/15",
    },
    {
      label: "Ativos",
      value: String(activeCount),
      helper: "prontos para vender",
      icon: CheckCircle2,
      valueClassName: "text-success",
      iconClassName: "text-success bg-success/8 border-success/15",
    },
    {
      label: "Em revisão",
      value: String(pendingCount),
      helper: "aguardando aprovação",
      icon: Clock,
      valueClassName: "text-warning",
      iconClassName: "text-warning bg-warning/8 border-warning/15",
    },
    {
      label: "Ticket médio",
      value: formatCurrency(averagePrice),
      helper: `${checkoutCount} checkout${checkoutCount === 1 ? "" : "s"} ativos`,
      icon: TrendingUp,
      valueClassName: "text-info",
      iconClassName: "text-info bg-info/8 border-info/15",
    },
  ];

  const tabs = [
    { label: "Todos", value: "all" as const, count: products.length },
    { label: "Ativos", value: "active" as const, count: activeCount },
    { label: "Revisão", value: "pending_review" as const, count: pendingCount },
    { label: "Inativos", value: "inactive" as const, count: inactiveCount },
  ];

  const handleEditProduct = (product: Product) => navigate(`/vendas/produtos/${product.id}/editar`);

  const handleCheckoutBuilder = (product: Product) => navigate(`/vendas/produtos/${product.id}/checkout-builder`);

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
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", deleteTarget)
      .eq("user_id", user.id);

    setDeleting(false);
    setDeleteTarget(null);

    if (error) {
      toast.error("Erro ao excluir produto");
      return;
    }

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
    <div className="relative mx-auto w-full max-w-[1520px] pb-20 md:pb-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden rounded-[36px]">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              "radial-gradient(circle at 0% 0%, hsl(var(--info) / 0.18), transparent 30%), radial-gradient(circle at 100% 0%, hsl(var(--primary) / 0.12), transparent 26%), linear-gradient(180deg, hsl(var(--background)), hsl(var(--background) / 0))",
          }}
        />
        <div
          className="absolute inset-x-10 inset-y-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
      </div>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-[30px] border border-border/30 bg-background/70 backdrop-blur-xl"
      >
        <div
          className="absolute inset-0 opacity-80"
          style={{
            backgroundImage:
              "linear-gradient(180deg, hsl(var(--card) / 0.58), transparent 28%), radial-gradient(circle at top right, hsl(var(--info) / 0.14), transparent 28%)",
          }}
        />

        <div className="h-px w-full bg-gradient-to-r from-transparent via-info/30 to-transparent" />

        <div className="relative px-5 py-5 sm:px-6 lg:px-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/30 bg-card/55 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-info" />
                <span className="text-[10px] font-heading uppercase tracking-[0.2em] text-muted-foreground/60">
                  Command center
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <h1 className="text-[30px] font-heading leading-none text-foreground sm:text-[36px]">
                    Meus Produtos
                  </h1>
                  <span className="inline-flex items-center rounded-full border border-border/30 bg-card/55 px-2.5 py-1 text-[11px] font-medium text-muted-foreground/75">
                    {products.length} no catálogo
                  </span>
                </div>
                <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground/60 sm:text-[14px]">
                  Catálogo com leitura de operação séria: linhas densas, contraste limpo, hover discreto e foco total em produto, preço e ação.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="rounded-2xl border border-border/25 bg-card/45 px-4 py-3">
                <p className="text-[10px] font-heading uppercase tracking-[0.18em] text-muted-foreground/40">Pronto para vender</p>
                <p className="mt-1 text-[13px] font-medium text-foreground">
                  {activeCount} ativos · {checkoutCount} checkout live
                </p>
              </div>

              <button
                onClick={() => navigate("/vendas/produtos/novo/editar")}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-info px-5 text-[13px] font-medium text-info-foreground transition-all hover:brightness-105 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" strokeWidth={2.2} />
                Novo Produto
              </button>
            </div>
          </div>

          <div className="mt-7 grid gap-px overflow-hidden rounded-[26px] border border-border/20 bg-border/15 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricPanel key={metric.label} {...metric} />
            ))}
          </div>
        </div>
      </motion.section>

      <section className="mt-4 overflow-hidden rounded-[30px] border border-border/30 bg-card/75 backdrop-blur-xl">
        <div className="border-b border-border/15 px-4 py-4 sm:px-5 lg:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-5 overflow-x-auto pb-1">
            {tabs.map((item) => (
              <button
                key={item.value}
                onClick={() => setTab(item.value)}
                className={cn(
                  "relative shrink-0 pb-2 text-[12px] font-medium transition-colors",
                  tab === item.value ? "text-foreground" : "text-muted-foreground/45 hover:text-muted-foreground/75"
                )}
              >
                <span className="flex items-center gap-1.5">
                  {item.label}
                  {item.count != null && (
                    <span
                      className={cn(
                          "rounded-full px-1.5 py-0.5 text-[9px] font-medium tabular-nums",
                          tab === item.value ? "bg-info/10 text-info" : "bg-muted/20 text-muted-foreground/40"
                      )}
                    >
                      {item.count}
                    </span>
                  )}
                </span>
                {tab === item.value && (
                  <motion.span
                    layoutId="products-clean-tab"
                    className="absolute inset-x-0 bottom-0 h-px rounded-full bg-info"
                    transition={{ type: "spring", bounce: 0.18, duration: 0.45 }}
                  />
                )}
              </button>
            ))}
              </div>

              <p className="mt-3 text-[11px] text-muted-foreground/45">
                Mostrando {filtered.length} de {products.length} produtos · ticket médio {formatCurrency(averagePrice)}
              </p>
          </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-72 sm:flex-none">
                <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/35" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar produto"
                  className="h-10 w-full rounded-xl border border-border/25 bg-background/75 pl-10 pr-9 text-[12px] text-foreground placeholder:text-muted-foreground/35 focus:border-info/35 focus:outline-none focus:ring-2 focus:ring-info/10"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/35 hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="hidden items-center rounded-xl border border-border/25 bg-background/70 p-0.5 sm:flex">
                {([
                  { icon: List, value: "list" },
                  { icon: LayoutGrid, value: "grid" },
                ] as const).map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => setViewMode(mode.value)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg transition-all",
                      viewMode === mode.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground/35 hover:text-muted-foreground/70"
                    )}
                  >
                    <mode.icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-border/25 bg-background/75">
              <Package className="h-7 w-7 text-muted-foreground/25" strokeWidth={1.5} />
            </div>
            <p className="mt-5 text-[15px] font-medium text-foreground">
              {search || tab !== "all" ? "Nenhum resultado encontrado" : "Nenhum produto ainda"}
            </p>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground/50">
              {search || tab !== "all"
                ? "Ajuste seus filtros para localizar outros produtos."
                : "Crie seu primeiro produto e comece a montar um catálogo com cara de plataforma grande."}
            </p>
            {!search && tab === "all" && (
              <button
                onClick={() => navigate("/vendas/produtos/novo/editar")}
                className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-info px-4 text-[13px] font-medium text-info-foreground transition-all hover:brightness-105"
              >
                <Plus className="h-4 w-4" strokeWidth={2.2} />
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
      </section>

      {pixelProduct && (
        <PixelSettingsDialog
          product={pixelProduct}
          open={!!pixelProduct}
          onOpenChange={(open) => {
            if (!open) setPixelProduct(null);
          }}
        />
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="max-w-sm rounded-2xl border-border/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-foreground">Excluir produto</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground/60">
              Tem certeza? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="h-9 rounded-xl text-[13px]">
              Cancelar
            </AlertDialogCancel>
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
