import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Package,
  Plus,
  Trash2,
  MoreHorizontal,
  Copy,
  CheckCircle2,
  Settings2,
  Palette,
  Star,
  ExternalLink,
  Search,
  X,
  Crosshair,
  Loader2,
} from "lucide-react";
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
import { toast } from "sonner";
import PixelSettingsDialog from "@/components/PixelSettingsDialog";
import type { Tables } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

type Product = Tables<"products">;

const STATUS_MAP: Record<string, { label: string; tone: string; dot: string; ping?: boolean }> = {
  active: {
    label: "Ativo",
    tone: "text-success",
    dot: "bg-success",
    ping: true,
  },
  inactive: {
    label: "Inativo",
    tone: "text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
  pending_review: {
    label: "Revisão",
    tone: "text-warning",
    dot: "bg-warning",
  },
};

export default function Produtos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: products = [], refetch: loadProducts } = useProducts();
  const [pixelProduct, setPixelProduct] = useState<Product | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "pending_review">("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    return products.filter((product) => {
      if (statusFilter !== "all" && product.status !== statusFilter) return false;
      if (!search) return true;

      return (
        product.name.toLowerCase().includes(q) ||
        product.description?.toLowerCase().includes(q)
      );
    });
  }, [products, search, statusFilter]);

  const activeCount = products.filter((product) => product.status === "active").length;
  const pendingCount = products.filter((product) => product.status === "pending_review").length;

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

  const getCheckoutLink = (url: string) => `${window.location.origin}/pay/${url.split("/").pop()!}`;

  const copyCheckout = (product: Product) => {
    if (!product.checkout_url) return;

    navigator.clipboard.writeText(getCheckoutLink(product.checkout_url));
    setCopiedId(product.id);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const tabs: { label: string; value: typeof statusFilter; count?: number }[] = [
    { label: "Todos", value: "all", count: products.length },
    { label: "Ativos", value: "active", count: activeCount },
    { label: "Revisão", value: "pending_review", count: pendingCount },
    { label: "Inativos", value: "inactive" },
  ];

  const renderStatus = (status: string) => {
    const current = STATUS_MAP[status] || STATUS_MAP.inactive;

    return (
      <span className={cn("inline-flex items-center gap-2 text-[11px] font-medium", current.tone)}>
        <span className="relative flex h-2 w-2">
          {current.ping && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full animate-ping opacity-70",
                current.dot,
              )}
            />
          )}
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", current.dot)} />
        </span>
        {current.label}
      </span>
    );
  };

  const renderMenu = (product: Product, triggerClassName: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={triggerClassName}>
          <MoreHorizontal className="h-4 w-4" strokeWidth={1.7} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-44 rounded-xl border border-border/60 bg-popover p-1.5 shadow-lg"
      >
        <DropdownMenuItem
          onClick={() => navigate(`/vendas/produtos/${product.id}/editar`)}
          className="gap-2 rounded-lg px-2.5 py-2 text-[12px] cursor-pointer"
        >
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={1.7} />
          Editar
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => navigate(`/vendas/produtos/${product.id}/checkout-builder`)}
          className="gap-2 rounded-lg px-2.5 py-2 text-[12px] cursor-pointer"
        >
          <Palette className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={1.7} />
          Checkout Builder
        </DropdownMenuItem>

        {product.checkout_url && (
          <>
            <DropdownMenuItem
              onClick={() => copyCheckout(product)}
              className="gap-2 rounded-lg px-2.5 py-2 text-[12px] cursor-pointer"
            >
              {copiedId === product.id ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" strokeWidth={1.8} />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={1.7} />
                  Copiar link
                </>
              )}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => window.open(getCheckoutLink(product.checkout_url!), "_blank")}
              className="gap-2 rounded-lg px-2.5 py-2 text-[12px] cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={1.7} />
              Ver checkout
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuItem
          onClick={() => setPixelProduct(product)}
          className="gap-2 rounded-lg px-2.5 py-2 text-[12px] cursor-pointer"
        >
          <Crosshair className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={1.7} />
          Pixels
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => navigate(`/vendas/conteudo/${product.id}/builder`)}
          className="gap-2 rounded-lg px-2.5 py-2 text-[12px] cursor-pointer"
        >
          <Star className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={1.7} />
          Área de membros
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          onClick={() => setDeleteTarget(product.id)}
          className="gap-2 rounded-lg px-2.5 py-2 text-[12px] text-destructive focus:text-destructive cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-20 md:pb-16">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-foreground">Produtos</h1>
          <span className="inline-flex h-6 items-center rounded-md border border-border/60 bg-card px-2.5 text-[12px] font-medium text-muted-foreground">
            {products.length}
          </span>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-9 pr-9 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground/70 transition-colors hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            )}
          </div>

          <button
            onClick={() => navigate("/vendas/produtos/novo/editar")}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-primary/20 bg-gradient-to-b from-primary to-primary/90 px-4 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            Novo Produto
          </button>
        </div>
      </div>

      <div className="mb-4 border-b border-border/40">
        <div className="flex items-center gap-5 overflow-x-auto">
          {tabs.map((tab) => {
            const active = statusFilter === tab.value;

            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 pb-3 text-[13px] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground/80",
                )}
              >
                <span>{tab.label}</span>
                {tab.count != null && (
                  <span
                    className={cn(
                      "inline-flex h-5 items-center rounded-md px-1.5 text-[11px] tabular-nums",
                      active
                        ? "bg-primary/10 text-primary"
                        : "bg-muted/40 text-muted-foreground",
                    )}
                  >
                    {tab.count}
                  </span>
                )}
                {active && (
                  <motion.div
                    layoutId="products-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary"
                    transition={{ type: "spring", bounce: 0.12, duration: 0.45 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-border/50 bg-card/20 px-6 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-card/70">
            <Package className="h-5 w-5 text-muted-foreground/70" strokeWidth={1.7} />
          </div>
          <p className="text-sm font-medium text-foreground">
            {search || statusFilter !== "all" ? "Nenhum resultado encontrado" : "Nenhum produto ainda"}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {search || statusFilter !== "all"
              ? "Tente ajustar os filtros para encontrar o que procura."
              : "Crie seu primeiro produto para começar a vender."}
          </p>
          {!search && statusFilter === "all" && (
            <button
              onClick={() => navigate("/vendas/produtos/novo/editar")}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-primary/20 bg-gradient-to-b from-primary to-primary/90 px-4 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              Criar produto
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/20">
          <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_110px_140px_44px] items-center px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span>Produto</span>
            <span className="text-right">Status</span>
            <span className="text-right">Preço</span>
            <span />
          </div>

          <div className="divide-y divide-border/40">
            {filtered.map((product) => (
              <div
                key={product.id}
                onClick={() => navigate(`/vendas/produtos/${product.id}/editar`)}
                className="group grid cursor-pointer items-center px-5 py-3 transition-colors hover:bg-muted/15 sm:grid-cols-[minmax(0,1fr)_110px_140px_44px]"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted/20 ring-1 ring-inset ring-border/60">
                    {product.image_url ? (
                      <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.7} />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-foreground/5" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium tracking-[-0.01em] text-foreground">
                      {product.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {product.description || "Sem descrição cadastrada"}
                    </p>
                  </div>
                </div>

                <div className="hidden justify-end sm:flex">{renderStatus(product.status)}</div>

                <div className="hidden text-right sm:block">
                  <span className="font-mono text-sm font-semibold tabular-nums tracking-[-0.02em] text-foreground">
                    {fmt(Number(product.price))}
                  </span>
                </div>

                <div className="hidden justify-end sm:flex" onClick={(e) => e.stopPropagation()}>
                  {renderMenu(
                    product,
                    "flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-muted-foreground opacity-0 transition-all hover:border-border/60 hover:bg-card hover:text-foreground group-hover:opacity-100",
                  )}
                </div>

                <div
                  className="col-span-full mt-2 flex items-center justify-between sm:hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3">
                    {renderStatus(product.status)}
                    <span className="font-mono text-sm font-semibold tabular-nums tracking-[-0.02em] text-foreground">
                      {fmt(Number(product.price))}
                    </span>
                  </div>

                  {renderMenu(
                    product,
                    "flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-card/70 text-muted-foreground transition-colors hover:text-foreground",
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
        <AlertDialogContent className="max-w-sm rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Excluir produto</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px]">
              Tem certeza? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="h-8 rounded-lg text-[13px]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="h-8 gap-1.5 rounded-lg bg-destructive text-[13px] text-destructive-foreground hover:bg-destructive/90"
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
