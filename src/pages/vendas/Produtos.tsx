import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  FileEdit,
  Layers,
  Loader2,
  Package,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
  XCircle,
  ShoppingBag,
  TrendingUp,
  BarChart3,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import PixelSettingsDialog from "@/components/PixelSettingsDialog";
import { ProductGridView } from "@/components/products/ProductGridView";
import type { Product } from "@/components/products/productPresentation";
import { getCheckoutLink, getEffectiveStatus } from "@/components/products/productPresentation";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useProducts, useTransactions } from "@/hooks/useQueryData";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "active" | "draft" | "pending_review" | "inactive";

const fmt = (v: number) =>
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Produtos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: products = [], refetch: loadProducts } = useProducts();
  const { data: transactions = [] } = useTransactions();

  const [pixelProduct, setPixelProduct] = useState<Product | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [clearDraftsOpen, setClearDraftsOpen] = useState(false);
  const [clearingDrafts, setClearingDrafts] = useState(false);

  const productsWithStatus = useMemo(
    () => products.map((p) => ({ product: p, eff: getEffectiveStatus(p) })),
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return productsWithStatus
      .filter(({ product, eff }) => {
        if (tab !== "all" && eff !== tab) return false;
        return !q || product.name.toLowerCase().includes(q) || product.description?.toLowerCase().includes(q);
      })
      .map(({ product }) => product);
  }, [productsWithStatus, search, tab]);

  const counts = useMemo(() => {
    const c = { active: 0, draft: 0, pending_review: 0, inactive: 0 };
    for (const { eff } of productsWithStatus) {
      if (eff in c) (c as any)[eff]++;
    }
    return c;
  }, [productsWithStatus]);

  const draftIds = useMemo(
    () => productsWithStatus.filter((p) => p.eff === "draft").map((p) => p.product.id),
    [productsWithStatus]
  );

  // Product metrics
  const metrics = useMemo(() => {
    const totalProducts = products.length;
    const activeProducts = counts.active;
    const totalRevenue = transactions
      .filter(t => t.status === "completed")
      .reduce((acc, t) => acc + Number(t.net_amount), 0);
    const avgPrice = products.length > 0 ? products.reduce((acc, p) => acc + Number(p.price), 0) / products.length : 0;
    return { totalProducts, activeProducts, totalRevenue, avgPrice };
  }, [products, counts, transactions]);

  const tabs = [
    { label: "Todos", value: "all" as const, count: products.length, dot: "" },
    { label: "Ativos", value: "active" as const, count: counts.active, dot: "bg-success" },
    { label: "Rascunhos", value: "draft" as const, count: counts.draft, dot: "bg-muted-foreground" },
    { label: "Em revisão", value: "pending_review" as const, count: counts.pending_review, dot: "bg-warning" },
    { label: "Inativos", value: "inactive" as const, count: counts.inactive, dot: "bg-destructive" },
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

  const confirmClearDrafts = async () => {
    if (!user || draftIds.length === 0) return;
    setClearingDrafts(true);
    const { error } = await supabase.from("products").delete().in("id", draftIds).eq("user_id", user.id);
    setClearingDrafts(false);
    setClearDraftsOpen(false);
    if (error) { toast.error("Erro ao limpar rascunhos"); return; }
    toast.success(`${draftIds.length} rascunho(s) removido(s)`);
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

  const showClearDraftsBtn = tab === "draft" && draftIds.length > 0;

  const metricCards = [
    { label: "Total de Produtos", value: metrics.totalProducts.toString(), icon: Package, color: "text-primary", sub: "Cadastrados na plataforma" },
    { label: "Produtos Ativos", value: metrics.activeProducts.toString(), icon: Zap, color: "text-success", sub: "Prontos para vender" },
    { label: "Receita Total", value: fmt(metrics.totalRevenue), icon: TrendingUp, color: "text-primary", sub: "De todos os produtos" },
    { label: "Preço Médio", value: fmt(metrics.avgPrice), icon: BarChart3, color: "text-info", sub: "Média dos seus produtos" },
  ];

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
            <h1 className="text-3xl font-black tracking-tight text-foreground">Meus Produtos</h1>
          </div>
          <p className="text-muted-foreground font-medium text-sm flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Gerencie seu catálogo, checkouts e configurações de venda.
          </p>
        </div>

        <button
          onClick={() => navigate("/vendas/produtos/novo/editar")}
          className="bg-primary text-primary-foreground px-8 h-12 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus className="h-5 w-5" strokeWidth={2.75} />
          Criar Produto
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map((card) => (
          <Card key={card.label} className="border-border/40 hover:border-border transition-colors">
            <CardHeader className="p-5 pb-2">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{card.label}</span>
                <card.icon className={cn("h-4 w-4 opacity-40", card.color)} />
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <p className="text-2xl font-black tracking-tight">{card.value}</p>
              <p className="text-[10px] font-bold text-muted-foreground/40 mt-1">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Workspace Card */}
      <Card className="border-border/40 overflow-hidden">
        {/* Toolbar Header */}
        <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-border/40 px-8 py-6">
          <div className="space-y-1">
            <h2 className="text-xl font-black">Catálogo de Produtos</h2>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span className="font-mono font-black text-foreground tabular-nums">{filtered.length}</span> {filtered.length === 1 ? "produto" : "produtos"} encontrados
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {showClearDraftsBtn && (
              <button
                onClick={() => setClearDraftsOpen(true)}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 text-[11px] font-black uppercase tracking-wider text-destructive transition-all hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2.5} />
                Limpar Rascunhos
              </button>
            )}
            <div className="relative group">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50 transition-colors group-focus-within:text-primary" strokeWidth={2.2} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto..."
                className="h-11 w-full rounded-2xl border border-border bg-card pl-11 pr-10 text-sm font-medium text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15 sm:w-72"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Tabs */}
        <div className="overflow-x-auto border-b border-border/40 bg-muted/10">
          <div className="flex min-w-max items-stretch px-6">
            {tabs.map((item) => {
              const active = tab === item.value;
              return (
                <button
                  key={item.value}
                  onClick={() => setTab(item.value)}
                  className={cn(
                    "group relative flex items-center gap-2.5 whitespace-nowrap px-5 py-4 text-[12.5px] font-bold tracking-tight transition-all",
                    active ? "text-foreground" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/30",
                  )}
                >
                  {item.dot ? (
                    <span className={cn("h-1.5 w-1.5 rounded-full", item.dot, active ? "opacity-100" : "opacity-40")} />
                  ) : (
                    <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-foreground" : "bg-muted-foreground/40")} />
                  )}
                  <span>{item.label}</span>
                  <span className={cn(
                    "ml-0.5 inline-flex h-[18px] min-w-[22px] items-center justify-center rounded-md px-1.5 text-[10.5px] font-black tabular-nums",
                    active ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground/80"
                  )}>
                    {item.count}
                  </span>
                  {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 lg:p-8">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-border/60 bg-muted/30">
                <Package className="h-8 w-8 text-muted-foreground/60" strokeWidth={1.4} />
                <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-lg border border-primary/30 bg-card">
                  <Sparkles className="h-3 w-3 text-primary" strokeWidth={2.5} />
                </span>
              </div>
              <p className="mt-6 text-base font-black tracking-tight text-foreground">
                {search || tab !== "all" ? "Nenhum resultado encontrado" : "Comece seu catálogo"}
              </p>
              <p className="mt-1.5 max-w-[320px] text-[13px] leading-relaxed text-muted-foreground">
                {search || tab !== "all"
                  ? "Tente ajustar os filtros ou termo de busca para encontrar o que procura."
                  : "Crie seu primeiro produto, configure o checkout e comece a faturar hoje mesmo."}
              </p>
              {!search && tab === "all" && (
                <button
                  onClick={() => navigate("/vendas/produtos/novo/editar")}
                  className="group mt-7 bg-primary text-primary-foreground px-6 h-11 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" strokeWidth={2.75} />
                  Criar primeiro produto
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
      </Card>

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

      <AlertDialog open={clearDraftsOpen} onOpenChange={setClearDraftsOpen}>
        <AlertDialogContent className="max-w-sm rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Limpar todos os rascunhos</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground">
              Você está prestes a excluir <span className="font-bold text-destructive">{draftIds.length} rascunho(s)</span> que ainda não foram finalizados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearingDrafts} className="h-9 rounded-lg text-[13px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClearDrafts} disabled={clearingDrafts} className="h-9 gap-1.5 rounded-lg bg-destructive text-[13px] text-destructive-foreground hover:bg-destructive/90">
              {clearingDrafts && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {clearingDrafts ? "Limpando…" : `Excluir ${draftIds.length}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
