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
  Target,
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

const metricToneStyles: Record<MetricTone, { icon: string; value: string; ring: string }> = {
  default: {
    icon: "border-border/45 bg-card/85 text-muted-foreground/70",
    value: "text-foreground",
    ring: "from-border/10 to-transparent",
  },
  success: {
    icon: "border-success/25 bg-success/12 text-success",
    value: "text-success",
    ring: "from-success/12 to-transparent",
  },
  warning: {
    icon: "border-warning/25 bg-warning/12 text-warning",
    value: "text-warning",
    ring: "from-warning/12 to-transparent",
  },
  info: {
    icon: "border-info/25 bg-info/12 text-info",
    value: "text-info",
    ring: "from-info/12 to-transparent",
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
        "group relative overflow-hidden rounded-[28px] border border-border/45 bg-background/80 p-5 text-left shadow-[0_0_0_1px_hsl(var(--border)/0.04)] backdrop-blur-sm transition-all",
        onClick && "hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_14px_40px_hsl(var(--primary)/0.08)]"
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-90", toneStyles.ring)} />
      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-2.5">
          <p className="text-[11px] font-heading uppercase tracking-[0.22em] text-muted-foreground/46">{label}</p>
          <p className={cn("font-numbers text-[34px] font-semibold leading-none tracking-[-0.07em]", toneStyles.value)}>{value}</p>
          <p className="text-[13px] leading-6 text-muted-foreground/62">{helper}</p>
        </div>
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-[18px] border", toneStyles.icon)}>
          <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
        </div>
      </div>
      {onClick && (
        <ArrowUpRight
          className="absolute bottom-5 right-5 h-4 w-4 text-muted-foreground/35 transition-all group-hover:text-primary"
          strokeWidth={1.8}
        />
      )}
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
    <div className="mx-auto w-full max-w-[1580px] space-y-6 pb-24 md:pb-14">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="relative overflow-hidden rounded-[36px] border border-border/40 bg-card shadow-[0_0_0_1px_hsl(var(--border)/0.03),0_30px_80px_hsl(var(--background)/0.35)]"
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 0% 0%, hsl(var(--primary) / 0.18), transparent 28%), radial-gradient(circle at 100% 0%, hsl(var(--info) / 0.14), transparent 24%), linear-gradient(180deg, hsl(var(--card)), hsl(var(--background)))",
          }}
        />
        <div
          className="absolute inset-x-10 inset-y-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "76px 76px",
          }}
        />
        <div className="absolute inset-y-0 left-0 w-[2px] bg-primary shadow-[0_0_20px_hsl(var(--primary)/0.45)]" />

        <div className="relative grid gap-5 p-6 sm:p-7 xl:grid-cols-[minmax(0,1.22fr)_390px] xl:items-stretch">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 shadow-[0_0_18px_hsl(var(--primary)/0.08)]">
              <Sparkles className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} />
              <span className="text-[10px] font-heading uppercase tracking-[0.24em] text-primary">Seller experience</span>
            </div>

            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <h1 className="font-display text-[clamp(2.5rem,4.8vw,4.25rem)] font-semibold leading-[0.9] tracking-[-0.08em] text-foreground">
                  Meus Produtos
                </h1>
                <p className="max-w-3xl text-[15px] leading-8 text-muted-foreground/72 sm:text-[16px]">
                  Um painel mais forte, maior e mais liso para o seller enxergar catálogo, publicação e monetização com cara de plataforma premium.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate("/vendas/produtos/novo/editar")}
                  className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-6 text-[14px] font-semibold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.12)] transition-all hover:bg-primary/90 active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.2} />
                  Novo produto
                </button>
                <button
                  onClick={() => setViewMode((current) => (current === "list" ? "grid" : "list"))}
                  className="inline-flex h-12 items-center gap-2 rounded-2xl border border-border/45 bg-background/80 px-5 text-[14px] font-medium text-foreground transition-all hover:border-primary/20 hover:bg-background"
                >
                  {viewMode === "list" ? "Explorar grid" : "Voltar para lista"}
                  <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FocusMetricCard
                icon={Package}
                label="Catálogo"
                value={String(products.length)}
                helper={`${checkoutCount} produtos publicados`}
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
                label="Em revisão"
                tone="warning"
                value={String(pendingCount)}
                helper={pendingCount ? "aguardando aprovação" : "sem pendências"}
                onClick={() => setTab("pending_review")}
              />
            </div>
          </div>

          <div className="rounded-[30px] border border-border/40 bg-background/82 p-6 shadow-[0_18px_45px_hsl(var(--background)/0.22)] backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-heading uppercase tracking-[0.24em] text-muted-foreground/42">Pulso do catálogo</p>
                <p className="mt-1 text-[14px] text-muted-foreground/64">Maturidade da operação em tempo real</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary shadow-[0_0_20px_hsl(var(--primary)/0.08)]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                seller live
              </div>
            </div>

            <div className="mt-7 rounded-[24px] border border-border/35 bg-card/78 p-5">
              <div className="flex items-end gap-3">
                <p className="font-numbers text-[58px] leading-none tracking-[-0.08em] text-foreground">{liveReadyRate}%</p>
                <p className="pb-1 text-[13px] leading-6 text-muted-foreground/60">do catálogo já está pronto para rodar com checkout</p>
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-secondary/70">
                <div className="h-full rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.25)] transition-all" style={{ width: `${liveReadyRate}%` }} />
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[22px] border border-border/35 bg-card/76 p-4">
                  <p className="text-[11px] font-heading uppercase tracking-[0.18em] text-muted-foreground/42">Ticket médio</p>
                  <p className="mt-2 font-numbers text-[24px] font-semibold tracking-[-0.05em] text-foreground">{formatCurrency(averagePrice)}</p>
                </div>
                <div className="rounded-[22px] border border-border/35 bg-card/76 p-4">
                  <p className="text-[11px] font-heading uppercase tracking-[0.18em] text-muted-foreground/42">Sem checkout</p>
                  <p className="mt-2 font-numbers text-[24px] font-semibold tracking-[-0.05em] text-foreground">{withoutCheckoutCount}</p>
                </div>
              </div>

              <div className="rounded-[22px] border border-border/35 bg-card/76 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-heading uppercase tracking-[0.18em] text-muted-foreground/42">Foco recomendado</p>
                    <p className="mt-2 text-[14px] leading-7 text-foreground">
                      {withoutCheckoutCount > 0
                        ? `${withoutCheckoutCount} produto${withoutCheckoutCount === 1 ? "" : "s"} ainda precisam de checkout para aumentar a taxa live.`
                        : pendingCount > 0
                          ? `${pendingCount} item${pendingCount === 1 ? "" : "s"} estão aguardando revisão.`
                          : "Seu catálogo está com ótimo nível de prontidão."}
                    </p>
                  </div>
                  <Target className="mt-0.5 h-5 w-5 text-primary" strokeWidth={1.8} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.06 }}
        className="overflow-hidden rounded-[32px] border border-border/40 bg-card shadow-[0_0_0_1px_hsl(var(--border)/0.03),0_24px_60px_hsl(var(--background)/0.28)]"
      >
        <div className="border-b border-border/20 px-5 py-5 sm:px-6 lg:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-heading uppercase tracking-[0.24em] text-muted-foreground/42">Catálogo do seller</span>
                <span className="rounded-full border border-border/40 bg-background/75 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground/60">
                  {filtered.length} visíveis
                </span>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {tabs.map((item) => {
                  const active = tab === item.value;

                  return (
                    <button
                      key={item.value}
                      onClick={() => setTab(item.value)}
                      className={cn(
                        "rounded-full border px-4 py-2.5 text-[13px] font-medium transition-all",
                        active
                          ? "border-primary/20 bg-primary/10 text-primary shadow-[0_0_16px_hsl(var(--primary)/0.08)]"
                          : "border-transparent bg-background/45 text-muted-foreground/62 hover:border-border/35 hover:bg-background/85 hover:text-foreground"
                      )}
                    >
                      {item.label}
                      <span className={cn("ml-1.5 tabular-nums text-[10px]", active ? "text-primary/70" : "text-muted-foreground/45")}>{item.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:w-80 sm:flex-none">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/35" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome ou descrição"
                  className="h-12 w-full rounded-2xl border border-border/45 bg-background/82 pl-11 pr-10 text-[14px] text-foreground placeholder:text-muted-foreground/35 focus:border-primary/25 focus:outline-none focus:ring-2 focus:ring-primary/10"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/35 transition-colors hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="hidden items-center rounded-2xl border border-border/45 bg-background/82 p-1 sm:flex">
                {([
                  { icon: List, value: "list" },
                  { icon: LayoutGrid, value: "grid" },
                ] as const).map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => setViewMode(mode.value)}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl transition-all",
                      viewMode === mode.value ? "bg-primary/10 text-primary shadow-[0_0_14px_hsl(var(--primary)/0.08)]" : "text-muted-foreground/38 hover:text-muted-foreground/75"
                    )}
                  >
                    <mode.icon className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-border/30 bg-background/75">
              <Package className="h-7 w-7 text-muted-foreground/25" strokeWidth={1.5} />
            </div>
            <p className="mt-5 text-[16px] font-medium text-foreground">
              {search || tab !== "all" ? "Nenhum resultado encontrado" : "Nenhum produto ainda"}
            </p>
            <p className="mt-2 max-w-sm text-[14px] leading-7 text-muted-foreground/52">
              {search || tab !== "all"
                ? "Ajuste os filtros para localizar outros produtos."
                : "Crie seu primeiro produto e monte uma operação com mais presença visual."}
            </p>
            {!search && tab === "all" && (
              <button
                onClick={() => navigate("/vendas/produtos/novo/editar")}
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-5 text-[14px] font-semibold text-primary-foreground transition-all hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" strokeWidth={2.2} />
                Criar produto
              </button>
            )}
          </div>
        ) : viewMode === "list" ? (
          <ProductListView copiedId={copiedId} products={filtered} {...menuHandlers} />
        ) : (
          <div className="p-5 sm:p-6">
            <ProductGridView copiedId={copiedId} products={filtered} {...menuHandlers} />
          </div>
        )}

        {filtered.length > 0 && (
          <div className="border-t border-border/20 px-5 py-3.5 sm:px-6 lg:px-7">
            <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground/50">
              <span>{filtered.length} de {products.length} produtos visíveis</span>
              <span className="h-1 w-1 rounded-full bg-border/80" />
              <span>Ticket médio {formatCurrency(averagePrice)}</span>
              <span className="h-1 w-1 rounded-full bg-border/80" />
              <span>{checkoutCount} publicados</span>
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
