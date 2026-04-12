import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Copy,
  Crosshair,
  ExternalLink,
  Layers,
  Loader2,
  MoreHorizontal,
  Package,
  Palette,
  Plus,
  Search,
  Settings2,
  ShoppingBag,
  Star,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import PixelSettingsDialog from "@/components/PixelSettingsDialog";
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

type Product = Tables<"products">;
type ProductStatus = Product["status"];

type StatusMeta = {
  label: string;
  text: string;
  dot: string;
  soft: string;
  pulse?: boolean;
};

const fmt = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const STATUS: Record<string, StatusMeta> = {
  active: {
    label: "Ativo",
    text: "text-success",
    dot: "bg-success",
    soft: "border-success/20 bg-success/10",
    pulse: true,
  },
  inactive: {
    label: "Inativo",
    text: "text-muted-foreground/60",
    dot: "bg-muted-foreground/45",
    soft: "border-border/25 bg-muted/15",
  },
  pending_review: {
    label: "Revisão",
    text: "text-warning",
    dot: "bg-warning",
    soft: "border-warning/20 bg-warning/10",
  },
};

const DELIVERY_LABELS: Record<string, string> = {
  curso: "Curso online",
  ebook: "E-book",
  mentoria: "Mentoria",
  software: "Software",
  servico: "Serviço",
};

function StatusIndicator({
  status,
  tone = "plain",
}: {
  status: ProductStatus;
  tone?: "plain" | "soft";
}) {
  const meta = STATUS[status] || STATUS.inactive;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        tone === "soft"
          ? [
              "rounded-full border px-2.5 py-1 text-[10px] font-semibold",
              meta.soft,
              meta.text,
            ]
          : ["text-[10px] font-semibold", meta.text]
      )}
    >
      <span className="relative flex h-[6px] w-[6px]">
        {meta.pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full animate-ping opacity-45",
              meta.dot
            )}
          />
        )}
        <span className={cn("relative inline-flex h-[6px] w-[6px] rounded-full", meta.dot)} />
      </span>
      {meta.label}
    </span>
  );
}

function SummaryMetric({
  label,
  value,
  icon: Icon,
  valueClassName,
  iconClassName,
}: {
  label: string;
  value: string;
  icon: typeof Layers;
  valueClassName?: string;
  iconClassName?: string;
}) {
  return (
    <div className="bg-background/70 p-4 sm:p-4.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-heading uppercase tracking-[0.18em] text-muted-foreground/40">
            {label}
          </p>
          <p className={cn("mt-2 text-xl font-numbers leading-none text-foreground", valueClassName)}>{value}</p>
        </div>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl border border-border/30 bg-card text-muted-foreground/55",
            iconClassName
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.8} />
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
  const [tab, setTab] = useState<"all" | "active" | "inactive" | "pending_review">("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  const filtered = useMemo(() => {
    const query = search.toLowerCase();

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
  const pendingCount = products.filter((product) => product.status === "pending_review").length;
  const totalRevenue = products.reduce((sum, product) => sum + Number(product.price), 0);

  const metrics = [
    {
      label: "Produtos",
      value: String(products.length),
      icon: Layers,
      valueClassName: "text-foreground",
      iconClassName: "text-info bg-info/8 border-info/15",
    },
    {
      label: "Ativos",
      value: String(activeCount),
      icon: TrendingUp,
      valueClassName: "text-success",
      iconClassName: "text-success bg-success/8 border-success/15",
    },
    {
      label: "Revisão",
      value: String(pendingCount),
      icon: Clock,
      valueClassName: "text-warning",
      iconClassName: "text-warning bg-warning/8 border-warning/15",
    },
    {
      label: "Receita potencial",
      value: fmt(totalRevenue),
      icon: BarChart3,
      valueClassName: "text-info",
      iconClassName: "text-info bg-info/8 border-info/15",
    },
  ];

  const tabs = [
    { label: "Todos", value: "all" as const, count: products.length },
    { label: "Ativos", value: "active" as const, count: activeCount },
    { label: "Revisão", value: "pending_review" as const, count: pendingCount },
    { label: "Inativos", value: "inactive" as const },
  ];

  const getLink = (url: string) => `${window.location.origin}/pay/${url.split("/").pop()!}`;

  const copyLink = (product: Product) => {
    if (!product.checkout_url) return;

    navigator.clipboard.writeText(getLink(product.checkout_url));
    setCopiedId(product.id);
    toast.success("Link copiado!");
    window.setTimeout(() => setCopiedId(null), 2000);
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
    loadProducts();
  };

  const renderMenu = (product: Product, buttonClassName: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={buttonClassName}>
          <MoreHorizontal className="h-4 w-4" strokeWidth={1.6} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-52 rounded-2xl border border-border/40 bg-popover p-1.5 shadow-xl"
      >
        {[
          { icon: Settings2, label: "Editar produto", fn: () => navigate(`/vendas/produtos/${product.id}/editar`) },
          { icon: Palette, label: "Checkout Builder", fn: () => navigate(`/vendas/produtos/${product.id}/checkout-builder`) },
          ...(product.checkout_url
            ? [
                {
                  icon: copiedId === product.id ? CheckCircle2 : Copy,
                  label: copiedId === product.id ? "Copiado!" : "Copiar link",
                  fn: () => copyLink(product),
                },
                {
                  icon: ExternalLink,
                  label: "Ver checkout",
                  fn: () => window.open(getLink(product.checkout_url!), "_blank"),
                },
              ]
            : []),
          { icon: Crosshair, label: "Pixels & Tracking", fn: () => setPixelProduct(product) },
          { icon: Star, label: "Área de membros", fn: () => navigate(`/vendas/conteudo/${product.id}/builder`) },
        ].map((item) => (
          <DropdownMenuItem
            key={item.label}
            onClick={item.fn}
            className="gap-2.5 rounded-xl px-3 py-2.5 text-[12px] cursor-pointer hover:bg-muted/25"
          >
            <item.icon className="h-3.5 w-3.5 text-muted-foreground/55" strokeWidth={1.7} />
            {item.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="my-1 bg-border/25" />
        <DropdownMenuItem
          onClick={() => setDeleteTarget(product.id)}
          className="gap-2.5 rounded-xl px-3 py-2.5 text-[12px] text-destructive focus:text-destructive cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
          Excluir produto
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-4 pb-20 md:pb-16">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="overflow-hidden rounded-[28px] border border-border/40 bg-card"
      >
        <div className="h-px w-full bg-gradient-to-r from-transparent via-info/35 to-transparent" />

        <div className="p-5 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/35 bg-background/70 px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-info" />
                <span className="text-[10px] font-heading uppercase tracking-[0.18em] text-muted-foreground/55">
                  Catálogo digital
                </span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-[28px] font-heading leading-none text-foreground sm:text-[34px]">
                    Meus Produtos
                  </h1>
                  <span className="inline-flex items-center rounded-full border border-info/20 bg-info/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-info">
                    {products.length}
                  </span>
                </div>
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground/55 sm:text-[14px]">
                  Uma visão mais limpa, mais séria e mais bonita do seu catálogo — com foco em produto, preço e operação.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate("/vendas/produtos/novo/editar")}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-info px-5 text-[13px] font-semibold text-info-foreground transition-all hover:brightness-105 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              Novo Produto
            </button>
          </div>

          <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-border/25 bg-border/15 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <SummaryMetric key={metric.label} {...metric} />
            ))}
          </div>
        </div>
      </motion.section>

      <section className="overflow-hidden rounded-[28px] border border-border/40 bg-card">
        <div className="flex flex-col gap-4 border-b border-border/20 px-4 py-4 sm:px-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-end gap-5 overflow-x-auto">
            {tabs.map((item) => (
              <button
                key={item.value}
                onClick={() => setTab(item.value)}
                className={cn(
                  "relative shrink-0 pb-2 text-[12px] font-semibold transition-colors",
                  tab === item.value ? "text-foreground" : "text-muted-foreground/45 hover:text-muted-foreground/75"
                )}
              >
                <span className="flex items-center gap-1.5">
                  {item.label}
                  {item.count != null && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums",
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

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-60 sm:flex-none">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/35" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar produto"
                className="h-10 w-full rounded-xl border border-border/35 bg-background/75 pl-9 pr-9 text-[12px] text-foreground placeholder:text-muted-foreground/35 focus:outline-none focus:ring-2 focus:ring-info/15 focus:border-info/20"
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

            <div className="hidden sm:flex items-center rounded-xl border border-border/35 bg-background/70 p-0.5">
              {(["list", "grid"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg transition-all",
                    viewMode === mode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground/35 hover:text-muted-foreground/70"
                  )}
                >
                  {mode === "grid" ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="0.5" y="0.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                      <rect x="8.5" y="0.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                      <rect x="0.5" y="8.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                      <rect x="8.5" y="8.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="0.5" y="1" width="13" height="3" rx="1" stroke="currentColor" strokeWidth="1.2" />
                      <rect x="0.5" y="5.5" width="13" height="3" rx="1" stroke="currentColor" strokeWidth="1.2" />
                      <rect x="0.5" y="10" width="13" height="3" rx="1" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex min-h-[320px] flex-col items-center justify-center px-6 py-12 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/35 bg-background/80">
              <Package className="h-7 w-7 text-muted-foreground/25" strokeWidth={1.5} />
            </div>
            <p className="mt-5 text-[15px] font-semibold text-foreground">
              {search || tab !== "all" ? "Nenhum resultado encontrado" : "Nenhum produto ainda"}
            </p>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground/50">
              {search || tab !== "all"
                ? "Ajuste seus filtros para localizar outros produtos."
                : "Crie seu primeiro produto e comece a estruturar seu catálogo com mais presença visual."}
            </p>
            {!search && tab === "all" && (
              <button
                onClick={() => navigate("/vendas/produtos/novo/editar")}
                className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-info px-4 text-[13px] font-semibold text-info-foreground transition-all hover:brightness-105"
              >
                <Plus className="h-4 w-4" strokeWidth={2.2} />
                Criar produto
              </button>
            )}
          </motion.div>
        ) : viewMode === "list" ? (
          <div>
            <div className="hidden sm:grid grid-cols-[64px_minmax(0,1fr)_130px_90px_40px] items-center px-5 py-3 text-[9px] font-heading uppercase tracking-[0.18em] text-muted-foreground/30">
              <span />
              <span>Produto</span>
              <span className="text-right">Preço</span>
              <span className="text-center">Status</span>
              <span />
            </div>

            <AnimatePresence initial={false} mode="popLayout">
              {filtered.map((product) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => navigate(`/vendas/produtos/${product.id}/editar`)}
                  className="group grid cursor-pointer items-center gap-3 border-t border-border/15 px-4 py-3.5 transition-colors hover:bg-background/60 sm:grid-cols-[64px_minmax(0,1fr)_130px_90px_40px] sm:px-5"
                >
                  <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-border/30 bg-background/75">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground/20" strokeWidth={1.5} />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-foreground/[0.04]" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-[13px] font-semibold text-foreground sm:text-[14px]">{product.name}</h3>
                      <span className="rounded-full border border-info/15 bg-info/8 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-info">
                        {DELIVERY_LABELS[product.delivery_type] || product.delivery_type}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground/45">{product.description || "Sem descrição"}</p>
                  </div>

                  <div className="hidden text-right sm:block">
                    <p className="text-[9px] font-heading uppercase tracking-[0.16em] text-muted-foreground/25">Preço</p>
                    <p className="mt-1 font-numbers text-[14px] text-foreground">{fmt(Number(product.price))}</p>
                  </div>

                  <div className="hidden justify-center sm:flex">
                    <StatusIndicator status={product.status} />
                  </div>

                  <div className="hidden justify-end sm:flex" onClick={(event) => event.stopPropagation()}>
                    {renderMenu(
                      product,
                      "flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground/25 opacity-0 transition-all hover:bg-background hover:text-foreground group-hover:opacity-100"
                    )}
                  </div>

                  <div className="col-span-full mt-1 flex items-center justify-between sm:hidden" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center gap-2.5">
                      <span className="font-numbers text-[13px] text-foreground">{fmt(Number(product.price))}</span>
                      <StatusIndicator status={product.status} />
                    </div>
                    {renderMenu(
                      product,
                      "flex h-8 w-8 items-center justify-center rounded-xl border border-border/30 bg-background text-muted-foreground/60"
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence initial={false} mode="popLayout">
                {filtered.map((product) => (
                  <motion.article
                    key={product.id}
                    layout
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.22 }}
                    onClick={() => navigate(`/vendas/produtos/${product.id}/editar`)}
                    className="group cursor-pointer rounded-[24px] border border-border/30 bg-background/70 p-4 transition-all hover:border-info/20 hover:bg-background"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-2xl border border-border/30 bg-card">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground/20" strokeWidth={1.5} />
                          </div>
                        )}
                        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-foreground/[0.04]" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[9px] font-heading uppercase tracking-[0.18em] text-muted-foreground/35">
                              {DELIVERY_LABELS[product.delivery_type] || product.delivery_type}
                            </p>
                            <h3 className="mt-1 line-clamp-2 text-[15px] font-semibold leading-tight text-foreground">
                              {product.name}
                            </h3>
                          </div>
                          <div onClick={(event) => event.stopPropagation()}>
                            {renderMenu(
                              product,
                              "flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground/35 transition-all hover:bg-card hover:text-foreground"
                            )}
                          </div>
                        </div>

                        <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/45">
                          {product.description || "Sem descrição"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3 border-t border-border/15 pt-3">
                      <div>
                        <p className="text-[9px] font-heading uppercase tracking-[0.16em] text-muted-foreground/25">Preço</p>
                        <p className="mt-1 font-numbers text-[16px] text-foreground">{fmt(Number(product.price))}</p>
                      </div>
                      <StatusIndicator status={product.status} tone="soft" />
                    </div>

                    <div className="mt-3 flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                      {product.checkout_url && (
                        <button
                          onClick={() => window.open(getLink(product.checkout_url!), "_blank")}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border/35 bg-card px-3 text-[12px] font-semibold text-muted-foreground/65 transition-all hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
                          Checkout
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/vendas/produtos/${product.id}/editar`)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-info px-3 text-[12px] font-semibold text-info-foreground transition-all hover:brightness-105"
                      >
                        Editar
                        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </button>
                    </div>
                  </motion.article>
                ))}
              </AnimatePresence>
            </div>
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
