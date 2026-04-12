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
  Sparkles,
  X,
  type LucideIcon,
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
type MetricTone = "default" | "success" | "warning" | "info";

const metricToneStyles: Record<MetricTone, { icon: string; value: string }> = {
  default: {
    icon: "border-border/45 bg-card/80 text-muted-foreground/65",
    value: "text-foreground",
  },
  success: {
    icon: "border-success/20 bg-success/10 text-success",
    value: "text-success",
  },
  warning: {
    icon: "border-warning/20 bg-warning/10 text-warning",
    value: "text-warning",
  },
  info: {
    icon: "border-info/20 bg-info/10 text-info",
    value: "text-info",
  },
};

function FocusMetricCard({
  helper,
  icon: Icon,
  label,
  onClick,
  tone = "default",
  value,
}: {
  helper: string;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  tone?: MetricTone;
  value: string;
}) {
  const Comp = onClick ? "button" : "div";
  const toneStyles = metricToneStyles[tone];

  return (
    <Comp
      {...(onClick ? { type: "button", onClick } : {})}
      className={cn(
        "group relative overflow-hidden rounded-[24px] border border-border/45 bg-background/75 p-4 text-left shadow-sm backdrop-blur-sm transition-all",
        onClick && "hover:-translate-y-0.5 hover:bg-background"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[10px] font-heading uppercase tracking-[0.2em] text-muted-foreground/45">{label}</p>
          <p className={cn("font-numbers text-[26px] font-semibold leading-none tracking-[-0.05em]", toneStyles.value)}>{value}</p>
          <p className="text-[12px] text-muted-foreground/60">{helper}</p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border", toneStyles.icon)}>
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </div>
      </div>
      {onClick && <ArrowUpRight className="absolute bottom-4 right-4 h-3.5 w-3.5 text-muted-foreground/35 transition-all group-hover:text-foreground" strokeWidth={1.8} />}
    </Comp>
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
    const q = search.trim().toLowerCase();

    return products.filter((product) => {
      if (tab !== "all" && product.status !== tab) return false;

      return !q || product.name.toLowerCase().includes(q) || product.description?.toLowerCase().includes(q);
    });
  }, [products, search, tab]);

  const activeCount = products.filter((product) => product.status === "active").length;
  const inactiveCount = products.filter((product) => product.status === "inactive").length;
  const pendingCount = products.filter((product) => product.status === "pending_review").length;
  const checkoutCount = products.filter((product) => Boolean(product.checkout_url)).length;
  const withoutCheckoutCount = products.length - checkoutCount;
  const totalPrice = products.reduce((sum, product) => sum + Number(product.price), 0);
  const averagePrice = products.length ? totalPrice / products.length : 0;
  const liveReadyRate = products.length ? Math.round((checkoutCount / products.length) * 100) : 0;

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
    <div className="mx-auto w-full max-w-[1520px] space-y-5 pb-20 md:pb-12">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="relative overflow-hidden rounded-[32px] border border-border/45 bg-card shadow-[var(--card-shadow)]"
      >
        <div
          className="absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              "radial-gradient(circle at 0% 0%, hsl(var(--info) / 0.14), transparent 28%), radial-gradient(circle at 100% 0%, hsl(var(--primary) / 0.1), transparent 24%), linear-gradient(135deg, hsl(var(--card)), hsl(var(--background)))",
          }}
        />
        <div
          className="absolute inset-x-10 inset-y-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />

        <div className="relative grid gap-4 p-5 sm:p-6 xl:grid-cols-[minmax(0,1.18fr)_360px] xl:items-stretch">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/45 bg-background/75 px-3 py-1.5 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-info" strokeWidth={1.8} />
              <span className="text-[10px] font-heading uppercase tracking-[0.22em] text-muted-foreground/60">Seller cockpit</span>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <h1 className="font-display text-[clamp(2rem,4vw,3.15rem)] font-semibold leading-[0.94] tracking-[-0.06em] text-foreground">
                  Meus Produtos
                </h1>
                <p className="max-w-2xl text-[14px] leading-7 text-muted-foreground/70 sm:text-[15px]">
                  Um cockpit mais intuitivo para o seller controlar produto, preço, checkout e publicação sem cara de dashboard genérico.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => navigate("/vendas/produtos/novo/editar")}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-5 text-[13px] font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.2} />
                  Novo produto
                </button>
                <button
                  onClick={() => setViewMode((current) => (current === "list" ? "grid" : "list"))}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border/45 bg-background/75 px-4 text-[13px] font-medium text-foreground transition-all hover:bg-background"
                >
                  {viewMode === "list" ? "Explorar em grid" : "Voltar para lista"}
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <FocusMetricCard
                icon={Package}
                label="Catálogo"
                value={String(products.length)}
                helper={`${checkoutCount} com checkout publicado`}
                onClick={() => setTab("all")}
              />
              <FocusMetricCard
                icon={CheckCircle2}
                label="Prontos agora"
                tone="success"
                value={String(activeCount)}
                helper="ativos para vender"
                onClick={() => setTab("active")}
              />
              <FocusMetricCard
                icon={Clock3}
                label="Revisão"
                tone="warning"
                value={String(pendingCount)}
                helper={pendingCount ? "aguardando aprovação" : "sem pendências"}
                onClick={() => setTab("pending_review")}
              />
            </div>
          </div>

          <div className="rounded-[28px] border border-border/45 bg-background/80 p-5 shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-heading uppercase tracking-[0.22em] text-muted-foreground/45">Taxa live do catálogo</p>
                <p className="mt-1 text-[13px] text-muted-foreground/65">Quanto do catálogo já está pronto para rodar</p>
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
              <div className="flex items-end gap-3">
                <p className="font-numbers text-[50px] leading-none tracking-[-0.06em] text-foreground">{liveReadyRate}%</p>
                <p className="pb-1 text-[13px] text-muted-foreground/60">{checkoutCount} checkout publicados</p>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary/70">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${liveReadyRate}%` }} />
              </div>
            </div>

            <div className="mt-6 grid gap-px overflow-hidden rounded-[22px] border border-border/40 bg-border/25">
              <div className="flex items-center justify-between bg-card/85 px-4 py-3">
                <span className="text-[12px] text-muted-foreground/60">Ticket médio</span>
                <span className="font-numbers text-[13px] font-semibold text-foreground">{formatCurrency(averagePrice)}</span>
              </div>
              <div className="flex items-center justify-between bg-card/85 px-4 py-3">
                <span className="text-[12px] text-muted-foreground/60">Sem checkout</span>
                <span className="font-numbers text-[13px] font-semibold text-foreground">{withoutCheckoutCount}</span>
              </div>
              <div className="flex items-center justify-between bg-card/85 px-4 py-3">
                <span className="text-[12px] text-muted-foreground/60">Em revisão</span>
                <span className="font-numbers text-[13px] font-semibold text-foreground">{pendingCount}</span>
              </div>
              <div className="flex items-center justify-between bg-card/85 px-4 py-3">
                <span className="text-[12px] text-muted-foreground/60">Visual atual</span>
                <span className="text-[12px] font-medium text-foreground">{viewMode === "list" ? "Lista densa" : "Grid premium"}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.06 }}
        className="overflow-hidden rounded-[30px] border border-border/45 bg-card shadow-[var(--card-shadow)]"
      >
        <div className="border-b border-border/20 px-4 py-4 sm:px-5 lg:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-heading uppercase tracking-[0.22em] text-muted-foreground/45">Catálogo do seller</span>
                <span className="rounded-full border border-border/40 bg-background/75 px-2 py-0.5 text-[10px] font-medium text-muted-foreground/60">
                  {filtered.length} visíveis
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {tabs.map((item) => {
                  const active = tab === item.value;

                  return (
                    <button
                      key={item.value}
                      onClick={() => setTab(item.value)}
                      className={cn(
                        "rounded-full border px-3.5 py-2 text-[12px] font-medium transition-all",
                        active
                          ? "border-border/45 bg-secondary text-secondary-foreground shadow-sm"
                          : "border-transparent bg-background/40 text-muted-foreground/60 hover:border-border/35 hover:bg-background/75 hover:text-foreground"
                      )}
                    >
                      {item.label}
                      <span className={cn("ml-1.5 tabular-nums text-[10px]", active ? "text-secondary-foreground/65" : "text-muted-foreground/45")}>{item.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-72 sm:flex-none">
                <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/35" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome ou descrição"
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
                      viewMode === mode.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground/35 hover:text-muted-foreground/75"
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
          <div className="flex min-h-[300px] flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-border/30 bg-background/75">
              <Package className="h-7 w-7 text-muted-foreground/25" strokeWidth={1.5} />
            </div>
            <p className="mt-5 text-[15px] font-medium text-foreground">
              {search || tab !== "all" ? "Nenhum resultado encontrado" : "Nenhum produto ainda"}
            </p>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground/50">
              {search || tab !== "all"
                ? "Ajuste os filtros para localizar outros produtos."
                : "Crie seu primeiro produto para montar um catálogo com mais presença e clareza."}
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

        {filtered.length > 0 && (
          <div className="border-t border-border/20 px-4 py-3 sm:px-5 lg:px-6">
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground/50">
              <span>{filtered.length} de {products.length} produtos visíveis</span>
              <span className="h-1 w-1 rounded-full bg-border/80" />
              <span>Ticket médio {formatCurrency(averagePrice)}</span>
              <span className="h-1 w-1 rounded-full bg-border/80" />
              <span>{checkoutCount} checkout publicados</span>
            </div>
          </div>
        )}
      </motion.section>

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
