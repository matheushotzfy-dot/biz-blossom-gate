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

const metricToneStyles: Record<MetricTone, { glow: string; icon: string; rail: string; value: string }> = {
  default: {
    glow: "from-sidebar-primary/10 to-transparent",
    icon: "border-sidebar-border/70 bg-sidebar/90 text-sidebar-foreground/70",
    rail: "bg-sidebar-primary/55",
    value: "text-foreground",
  },
  success: {
    glow: "from-primary/12 to-transparent",
    icon: "border-success/25 bg-success/12 text-success",
    rail: "bg-success",
    value: "text-foreground",
  },
  warning: {
    glow: "from-warning/12 to-transparent",
    icon: "border-warning/25 bg-warning/12 text-warning",
    rail: "bg-warning",
    value: "text-foreground",
  },
  info: {
    glow: "from-info/12 to-transparent",
    icon: "border-info/25 bg-info/12 text-info",
    rail: "bg-info",
    value: "text-foreground",
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
        "seller-panel group min-h-[168px] rounded-[30px] p-6 text-left transition-all duration-300",
        onClick && "hover:-translate-y-1 hover:border-sidebar-primary/25 hover:bg-sidebar-accent/84 hover:shadow-[0_24px_48px_hsl(var(--background)/0.14)]"
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-90", toneStyles.glow)} />
      <span className={cn("absolute inset-y-6 left-0 w-[3px] rounded-r-full shadow-[0_0_18px_hsl(var(--sidebar-primary)/0.28)]", toneStyles.rail)} />
      <div className="relative z-[1] flex h-full flex-col justify-between gap-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <p className="text-[11px] font-heading uppercase tracking-[0.22em] text-sidebar-foreground/48">{label}</p>
            <p className={cn("font-display text-[40px] font-black leading-none tracking-[-0.07em]", toneStyles.value)}>{value}</p>
          </div>
          <div className={cn("flex h-14 w-14 items-center justify-center rounded-[18px] border shadow-[inset_0_1px_0_hsl(var(--foreground)/0.03)]", toneStyles.icon)}>
            <Icon className="h-5 w-5" strokeWidth={1.8} />
          </div>
        </div>

        <div className="flex items-end justify-between gap-4">
          <p className="max-w-[16rem] text-[14px] leading-6 text-muted-foreground/70">{helper}</p>
          {onClick && <ArrowUpRight className="h-4 w-4 shrink-0 text-sidebar-foreground/42 transition-all group-hover:text-sidebar-primary" strokeWidth={1.8} />}
        </div>
      </div>
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
    <div className="mx-auto w-full max-w-[1720px] space-y-7 pb-24 md:pb-16">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="seller-shell rounded-[40px]"
      >
        <div
          className="pointer-events-none absolute inset-x-10 inset-y-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--sidebar-foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--sidebar-foreground)) 1px, transparent 1px)",
            backgroundSize: "84px 84px",
          }}
        />
        <div className="absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-sidebar-primary shadow-[0_0_24px_hsl(var(--sidebar-primary)/0.42)]" />

        <div className="relative z-[1] grid gap-0 xl:grid-cols-[minmax(0,1.18fr)_430px]">
          <div className="p-7 sm:p-9 xl:p-11">
            <div className="space-y-8">
              <div className="flex flex-wrap items-center gap-3">
                <span className="seller-pill inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em]">
                  <Sparkles className="h-3.5 w-3.5 text-sidebar-primary" strokeWidth={1.8} />
                  seller cockpit
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary shadow-[0_0_18px_hsl(var(--primary)/0.12)]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  seller live
                </span>
              </div>

              <div className="max-w-4xl space-y-4">
                <h1 className="font-display text-[clamp(3.2rem,6vw,5.5rem)] font-black leading-[0.88] tracking-[-0.09em] text-foreground">
                  Meus Produtos
                </h1>
                <p className="max-w-3xl text-[16px] leading-8 text-muted-foreground/74 sm:text-[17px]">
                  Uma visão maior, mais lisa e com a mesma energia premium da sidebar para o seller operar catálogo, checkout e monetização sem cara de layout genérico.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate("/vendas/produtos/novo/editar")}
                  className="inline-flex h-14 items-center gap-2.5 rounded-[18px] bg-primary px-7 text-[14px] font-semibold text-primary-foreground shadow-[0_18px_40px_hsl(var(--primary)/0.16)] transition-all hover:bg-primary/90 active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.2} />
                  Novo produto
                </button>
                <button
                  onClick={() => setViewMode((current) => (current === "list" ? "grid" : "list"))}
                  className="inline-flex h-14 items-center gap-2.5 rounded-[18px] border border-sidebar-border/70 bg-sidebar-accent/58 px-6 text-[14px] font-semibold text-sidebar-accent-foreground transition-all hover:border-sidebar-primary/25 hover:bg-sidebar-accent/80"
                >
                  {viewMode === "list" ? "Abrir grid" : "Voltar pra lista"}
                  <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FocusMetricCard
                  icon={Package}
                  label="Catálogo"
                  value={String(products.length)}
                  helper={`${products.length} produto${products.length === 1 ? "" : "s"} no seu arsenal`}
                  onClick={() => setTab("all")}
                />
                <FocusMetricCard
                  icon={CheckCircle2}
                  label="Ativos"
                  tone="success"
                  value={String(activeCount)}
                  helper="prontos para vender agora"
                  onClick={() => setTab("active")}
                />
                <FocusMetricCard
                  icon={Clock3}
                  label="Em revisão"
                  tone="warning"
                  value={String(pendingCount)}
                  helper={pendingCount ? "aguardando aprovação" : "sem pendências de análise"}
                  onClick={() => setTab("pending_review")}
                />
                <FocusMetricCard
                  icon={Link2}
                  label="Checkout live"
                  tone="info"
                  value={String(checkoutCount)}
                  helper={`${liveReadyRate}% do catálogo com checkout pronto`}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-sidebar-border/65 bg-sidebar-accent/38 p-7 sm:p-9 xl:border-l xl:border-t-0 xl:p-10">
            <div className="seller-panel rounded-[34px] p-6 sm:p-7">
              <div className="relative z-[1] space-y-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-heading uppercase tracking-[0.22em] text-sidebar-foreground/46">Pulso do catálogo</p>
                    <p className="mt-1 text-[14px] text-muted-foreground/66">Nível de prontidão da operação em tempo real</p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-sidebar-primary/18 bg-sidebar/84 px-3 py-1.5 text-[11px] font-semibold text-sidebar-primary">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sidebar-primary opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-sidebar-primary" />
                    </span>
                    live
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-end gap-3">
                    <p className="font-numbers text-[68px] leading-none tracking-[-0.08em] text-foreground">{liveReadyRate}%</p>
                    <p className="max-w-[12rem] pb-2 text-[14px] leading-6 text-muted-foreground/68">do catálogo já está publicado com checkout pronto</p>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-sidebar/70 ring-1 ring-sidebar-border/60">
                    <div className="h-full rounded-full bg-sidebar-primary shadow-[0_0_18px_hsl(var(--sidebar-primary)/0.28)] transition-all" style={{ width: `${liveReadyRate}%` }} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-sidebar-border/60 bg-sidebar/84 p-4">
                    <p className="text-[11px] font-heading uppercase tracking-[0.18em] text-sidebar-foreground/42">Ticket médio</p>
                    <p className="mt-2 font-numbers text-[26px] font-black tracking-[-0.05em] text-foreground">{formatCurrency(averagePrice)}</p>
                  </div>
                  <div className="rounded-[24px] border border-sidebar-border/60 bg-sidebar/84 p-4">
                    <p className="text-[11px] font-heading uppercase tracking-[0.18em] text-sidebar-foreground/42">Sem checkout</p>
                    <p className="mt-2 font-numbers text-[26px] font-black tracking-[-0.05em] text-foreground">{withoutCheckoutCount}</p>
                  </div>
                </div>

                <div className="grid gap-px overflow-hidden rounded-[24px] border border-sidebar-border/60 bg-sidebar-border/40">
                  <div className="flex items-center justify-between bg-sidebar/84 px-4 py-3.5">
                    <span className="text-[12px] text-muted-foreground/66">Ativos agora</span>
                    <span className="font-numbers text-[16px] text-foreground">{activeCount}</span>
                  </div>
                  <div className="flex items-center justify-between bg-sidebar/84 px-4 py-3.5">
                    <span className="text-[12px] text-muted-foreground/66">Em revisão</span>
                    <span className="font-numbers text-[16px] text-foreground">{pendingCount}</span>
                  </div>
                </div>

                <div className="rounded-[28px] border border-sidebar-border/60 bg-sidebar/88 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-heading uppercase tracking-[0.18em] text-sidebar-foreground/42">Foco recomendado</p>
                      <p className="mt-2 text-[15px] leading-7 text-foreground">
                        {withoutCheckoutCount > 0
                          ? `${withoutCheckoutCount} produto${withoutCheckoutCount === 1 ? "" : "s"} ainda precisam de checkout para empurrar a taxa live.`
                          : pendingCount > 0
                            ? `${pendingCount} item${pendingCount === 1 ? "" : "s"} ainda estão aguardando revisão.`
                            : "Seu catálogo está com ótimo nível de prontidão e cara de operação forte."}
                      </p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-primary/20 bg-primary/10 text-primary">
                      <Target className="h-4 w-4" strokeWidth={1.8} />
                    </div>
                  </div>
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
        className="seller-shell rounded-[36px]"
      >
        <div className="relative z-[1] border-b border-sidebar-border/60 px-5 py-5 sm:px-6 lg:px-8">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px] xl:items-end">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[11px] font-heading uppercase tracking-[0.24em] text-sidebar-foreground/44">Catálogo do seller</span>
                <span className="seller-pill rounded-full px-3 py-1 text-[11px] font-semibold">{filtered.length} visíveis</span>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {tabs.map((item) => {
                  const active = tab === item.value;

                  return (
                    <button
                      key={item.value}
                      onClick={() => setTab(item.value)}
                      className={cn(
                        "rounded-full border px-5 py-3 text-[13px] font-semibold transition-all",
                        active
                          ? "border-sidebar-primary/35 bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_0_20px_hsl(var(--sidebar-primary)/0.12)]"
                          : "border-transparent bg-sidebar-accent/35 text-sidebar-foreground/72 hover:border-sidebar-border/70 hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      {item.label}
                      <span className={cn("ml-1.5 tabular-nums text-[11px]", active ? "text-sidebar-primary" : "text-sidebar-foreground/48")}>{item.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="seller-soft-input relative flex-1 rounded-[24px] transition-all focus-within:border-primary/25 focus-within:shadow-[0_0_0_1px_hsl(var(--primary)/0.10)] sm:max-w-[380px]">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-foreground/42" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome ou descrição"
                  className="h-14 w-full rounded-[24px] bg-transparent pl-12 pr-11 text-[15px] text-foreground placeholder:text-muted-foreground/42 focus:outline-none"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-sidebar-foreground/42 transition-colors hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="hidden items-center rounded-[24px] border border-sidebar-border/70 bg-sidebar-accent/52 p-1.5 sm:flex">
                {([
                  { icon: List, value: "list" },
                  { icon: LayoutGrid, value: "grid" },
                ] as const).map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => setViewMode(mode.value)}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-[16px] transition-all",
                      viewMode === mode.value
                        ? "bg-sidebar text-sidebar-accent-foreground shadow-[0_0_20px_hsl(var(--sidebar-primary)/0.10)]"
                        : "text-sidebar-foreground/44 hover:text-sidebar-accent-foreground"
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
          <div className="relative z-[1] px-5 py-10 sm:px-6 lg:px-8">
            <div className="seller-panel flex min-h-[340px] flex-col items-center justify-center rounded-[32px] px-6 py-12 text-center">
              <div className="relative z-[1] flex flex-col items-center">
                <div className="flex h-18 w-18 items-center justify-center rounded-[24px] border border-sidebar-border/60 bg-sidebar/84">
                  <Package className="h-8 w-8 text-sidebar-foreground/28" strokeWidth={1.5} />
                </div>
                <p className="mt-6 text-[19px] font-semibold text-foreground">
                  {search || tab !== "all" ? "Nenhum resultado encontrado" : "Nenhum produto ainda"}
                </p>
                <p className="mt-2 max-w-md text-[15px] leading-8 text-muted-foreground/60">
                  {search || tab !== "all"
                    ? "Ajuste os filtros para localizar outros produtos."
                    : "Crie seu primeiro produto e comece com um catálogo mais forte, organizado e pronto para vender."}
                </p>
                {!search && tab === "all" && (
                  <button
                    onClick={() => navigate("/vendas/produtos/novo/editar")}
                    className="mt-7 inline-flex h-12 items-center gap-2 rounded-[18px] bg-primary px-6 text-[14px] font-semibold text-primary-foreground transition-all hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.2} />
                    Criar produto
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : viewMode === "list" ? (
          <ProductListView copiedId={copiedId} products={filtered} {...menuHandlers} />
        ) : (
          <div className="relative z-[1] p-5 sm:p-6 lg:p-7">
            <ProductGridView copiedId={copiedId} products={filtered} {...menuHandlers} />
          </div>
        )}

        {filtered.length > 0 && (
          <div className="relative z-[1] border-t border-sidebar-border/60 px-5 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground/56">
              <span>{filtered.length} de {products.length} produtos visíveis</span>
              <span className="h-1 w-1 rounded-full bg-sidebar-border/90" />
              <span>Ticket médio {formatCurrency(averagePrice)}</span>
              <span className="h-1 w-1 rounded-full bg-sidebar-border/90" />
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
