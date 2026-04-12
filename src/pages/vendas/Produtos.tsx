import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  Package,
  Plus,
  Search,
  type LucideIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";

import PixelSettingsDialog from "@/components/PixelSettingsDialog";
import { ProductGridView } from "@/components/products/ProductGridView";
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

function HeroMetric({
  icon: Icon,
  label,
  value,
  helper,
  valueClassName,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  helper: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-[22px] border border-border/45 bg-background/75 px-4 py-4 shadow-[var(--card-shadow)] backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[10px] font-heading uppercase tracking-[0.22em] text-muted-foreground/45">{label}</p>
          <p className={cn("font-numbers text-[28px] leading-none tracking-[-0.05em] text-foreground", valueClassName)}>{value}</p>
          <p className="text-[12px] text-muted-foreground/60">{helper}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/40 bg-card/80 text-muted-foreground/55">
          <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
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
    },
    {
      label: "Ativos",
      value: String(activeCount),
      helper: "prontos para vender",
      icon: CheckCircle2,
      valueClassName: "text-success",
    },
    {
      label: "Em revisão",
      value: String(pendingCount),
      helper: "aguardando aprovação",
      icon: Clock3,
      valueClassName: "text-warning",
    },
    {
      label: "Checkout live",
      value: String(checkoutCount),
      helper: `ticket médio ${formatCurrency(averagePrice)}`,
      icon: Link2,
      valueClassName: "text-info",
    },
  ];

  const tabs = [
    { label: "Todos", value: "all" as const, count: products.length },
    { label: "Ativos", value: "active" as const, count: activeCount },
    { label: "Revisão", value: "pending_review" as const, count: pendingCount },
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
    <div className="relative mx-auto w-full max-w-[1520px] space-y-5 pb-20 md:pb-14">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38 }}
        className="relative overflow-hidden rounded-[34px] border border-border/45 bg-card shadow-[var(--card-shadow)]"
      >
        <div
          className="absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              "radial-gradient(circle at 0% 0%, hsl(var(--info) / 0.14), transparent 28%), radial-gradient(circle at 100% 0%, hsl(var(--primary) / 0.10), transparent 24%), linear-gradient(135deg, hsl(var(--card)), hsl(var(--background)))",
          }}
        />
        <div
          className="absolute inset-x-12 inset-y-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />

        <div className="relative grid gap-6 px-5 py-6 sm:px-7 sm:py-7 xl:grid-cols-[minmax(0,1.1fr)_380px] xl:items-end xl:gap-8">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/45 bg-background/75 px-3 py-1.5 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-info" />
              <span className="text-[10px] font-heading uppercase tracking-[0.24em] text-muted-foreground/60">
                Catálogo premium
              </span>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl font-display text-[clamp(2.7rem,5vw,4.9rem)] font-semibold leading-[0.92] tracking-[-0.06em] text-foreground">
                Seus produtos com presença de
                <span className="block text-info">plataforma grande.</span>
              </h1>
              <p className="max-w-2xl text-[14px] leading-7 text-muted-foreground/70 sm:text-[15px]">
                Uma vitrine mais forte, com tipografia de autoridade, composição mais elegante e leitura direta de produto, preço, checkout e ação.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate("/vendas/produtos/novo/editar")}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-5 text-[13px] font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" strokeWidth={2.2} />
                Novo Produto
              </button>
              <button
                onClick={() => setTab("active")}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border/45 bg-background/75 px-4 text-[13px] font-medium text-foreground transition-all hover:bg-background"
              >
                Ver ativos agora
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <HeroMetric key={metric.label} {...metric} />
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-border/45 bg-background/80 p-5 shadow-[var(--card-shadow)] backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-heading uppercase tracking-[0.22em] text-muted-foreground/45">
                  Panorama da operação
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground/65">Leitura rápida do seu catálogo</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/45 bg-card/80 px-2.5 py-1 text-[10px] font-medium text-muted-foreground/60">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                live
              </div>
            </div>

            <div className="mt-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/40">Prontos para vender</p>
              <p className="mt-2 font-numbers text-[44px] leading-none tracking-[-0.05em] text-foreground">{activeCount}</p>
              <p className="mt-2 text-[13px] text-muted-foreground/60">{checkoutCount} checkout publicados e {pendingCount} aguardando revisão</p>
            </div>

            <div className="mt-6 grid gap-px overflow-hidden rounded-[22px] border border-border/40 bg-border/25">
              <div className="flex items-center justify-between bg-card/85 px-4 py-3">
                <span className="text-[12px] text-muted-foreground/60">Ticket médio</span>
                <span className="font-numbers text-[13px] font-semibold text-foreground">{formatCurrency(averagePrice)}</span>
              </div>
              <div className="flex items-center justify-between bg-card/85 px-4 py-3">
                <span className="text-[12px] text-muted-foreground/60">Potencial bruto</span>
                <span className="font-numbers text-[13px] font-semibold text-foreground">{formatCurrency(totalPrice)}</span>
              </div>
              <div className="flex items-center justify-between bg-card/85 px-4 py-3">
                <span className="text-[12px] text-muted-foreground/60">Produtos sem checkout</span>
                <span className="font-numbers text-[13px] font-semibold text-foreground">{products.length - checkoutCount}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <section className="overflow-hidden rounded-[34px] border border-border/45 bg-card shadow-[var(--card-shadow)]">
        <div className="border-b border-border/20 px-4 py-4 sm:px-5 lg:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap gap-2">
                {tabs.map((item) => {
                  const active = tab === item.value;

                  return (
                    <button
                      key={item.value}
                      onClick={() => setTab(item.value)}
                      className="relative shrink-0 rounded-full px-3.5 py-2"
                    >
                      {active && (
                        <motion.span
                          layoutId="products-premium-tab"
                          className="absolute inset-0 rounded-full border border-border/40 bg-secondary shadow-sm"
                          transition={{ type: "spring", bounce: 0.18, duration: 0.45 }}
                        />
                      )}
                      <span
                        className={cn(
                          "relative flex items-center gap-2 text-[12px] font-medium",
                          active ? "text-secondary-foreground" : "text-muted-foreground/55 hover:text-foreground"
                        )}
                      >
                        {item.label}
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                            active ? "bg-background/80 text-secondary-foreground/70" : "bg-muted/25 text-muted-foreground/50"
                          )}
                        >
                          {item.count}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div>
                <p className="text-[11px] font-heading uppercase tracking-[0.18em] text-muted-foreground/38">Visualização do catálogo</p>
                <p className="mt-1 text-[12px] text-muted-foreground/55">
                  Mostrando {filtered.length} de {products.length} produtos · ticket médio {formatCurrency(averagePrice)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-72 sm:flex-none">
                <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/35" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar produto"
                  className="h-11 w-full rounded-2xl border border-border/45 bg-background/80 pl-10 pr-9 text-[13px] text-foreground placeholder:text-muted-foreground/35 focus:border-info/35 focus:outline-none focus:ring-2 focus:ring-info/10"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/35 transition-colors hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="hidden items-center rounded-2xl border border-border/45 bg-background/80 p-1 sm:flex">
                {([
                  { icon: List, value: "list" },
                  { icon: LayoutGrid, value: "grid" },
                ] as const).map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => setViewMode(mode.value)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
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
          <div className="flex min-h-[340px] flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-border/25 bg-background/75">
              <Package className="h-7 w-7 text-muted-foreground/25" strokeWidth={1.5} />
            </div>
            <p className="mt-5 text-[16px] font-medium text-foreground">
              {search || tab !== "all" ? "Nenhum resultado encontrado" : "Nenhum produto ainda"}
            </p>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground/50">
              {search || tab !== "all"
                ? "Ajuste os filtros para localizar outros produtos."
                : "Crie seu primeiro produto e monte um catálogo com presença mais premium."}
            </p>
            {!search && tab === "all" && (
              <button
                onClick={() => navigate("/vendas/produtos/novo/editar")}
                className="mt-6 inline-flex h-10 items-center gap-2 rounded-2xl bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-all hover:bg-primary/90"
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
