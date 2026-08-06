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
  TrendingUp,
  ShoppingCart,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { HDShell, HDHeader, HDStat, HDStatGrid } from "@/components/hd/HDPage";
import { useTransactions } from "@/hooks/useQueryData";
import { isApprovedTransaction } from "@/lib/utils";


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
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "active" | "draft" | "pending_review" | "inactive";

export default function Produtos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: products = [], refetch: loadProducts, isLoading: productsLoading } = useProducts();
  const { data: transactions = [] } = useTransactions();

  const [pixelProduct, setPixelProduct] = useState<Product | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [clearDraftsOpen, setClearDraftsOpen] = useState(false);
  const [clearingDrafts, setClearingDrafts] = useState(false);

  // Pre-compute effective status for every product (handles auto-draft).
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
    const c: Record<"active" | "draft" | "pending_review" | "inactive", number> = { active: 0, draft: 0, pending_review: 0, inactive: 0 };
    for (const { eff } of productsWithStatus) {
      if (eff in c) c[eff as keyof typeof c]++;
    }
    return c;
  }, [productsWithStatus]);

  const draftIds = useMemo(
    () => productsWithStatus.filter((p) => p.eff === "draft").map((p) => p.product.id),
    [productsWithStatus]
  );

  // 30-day KPIs (dashboard-style)
  const kpi = useMemo(() => {
    const now = Date.now();
    const cutoff = now - 30 * 86400000;
    const recent = transactions.filter((t) => new Date(t.created_at).getTime() >= cutoff);
    const approved = recent.filter((t) => isApprovedTransaction(t.status));
    const revenue = approved.reduce((s, t) => s + Number(t.amount), 0);
    const productRevenue = new Map<string, number>();
    approved.forEach((t) => {
      if (!t.product_id) return;
      productRevenue.set(t.product_id, (productRevenue.get(t.product_id) || 0) + Number(t.amount));
    });
    const bestProductId = [...productRevenue.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const bestProduct = bestProductId ? products.find((p) => p.id === bestProductId)?.name : null;
    return { salesCount: approved.length, revenue, avgTicket: approved.length ? revenue / approved.length : 0, bestProduct };
  }, [transactions, products]);

  const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const tabs = [
    { label: "Todos", value: "all" as const, count: products.length },
    { label: "Ativos", value: "active" as const, count: counts.active },
    { label: "Rascunhos", value: "draft" as const, count: counts.draft },
    { label: "Em revisão", value: "pending_review" as const, count: counts.pending_review },
    { label: "Inativos", value: "inactive" as const, count: counts.inactive },
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
    // Soft delete: keep record for admin audit (sales, customers, history)
    const { error } = await supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString(), status: "inactive" })
      .eq("id", deleteTarget)
      .eq("user_id", user.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (error) { toast.error("Erro ao excluir produto"); return; }
    toast.success("Produto removido");
    await loadProducts();
  };

  const confirmClearDrafts = async () => {
    if (!user || draftIds.length === 0) return;
    setClearingDrafts(true);
    // Drafts can be hard-deleted (no sales history)
    const { error } = await supabase.from("products").delete().in("id", draftIds).eq("user_id", user.id);
    setClearingDrafts(false);
    setClearDraftsOpen(false);
    if (error) { toast.error("Erro ao limpar rascunhos"); return; }
    toast.success(`${draftIds.length} rascunho(s) removido(s)`);
    await loadProducts();
  };

  const handleDuplicate = async (product: Product) => {
    if (!user) return;
    const slug = crypto.randomUUID().slice(0, 8);
    const checkoutUrl = `${window.location.origin}/pay/${slug}`;
    const { error } = await supabase.from("products").insert({
      user_id: user.id,
      name: `${product.name} (cópia)`,
      description: product.description,
      price: product.price,
      status: "pending_review",
      image_url: product.image_url,
      display_name: product.display_name,
      delivery_type: product.delivery_type,
      checkout_url: checkoutUrl,
    });
    if (error) { toast.error("Erro ao duplicar produto"); return; }
    toast.success("Produto duplicado! Aguardando revisão.");
    await loadProducts();
  };

  const handleToggleStatus = async (product: Product) => {
    if (!user) return;
    const next = product.status === "active" ? "inactive" : "active";
    const { error } = await supabase
      .from("products")
      .update({ status: next })
      .eq("id", product.id)
      .eq("user_id", user.id);
    if (error) { toast.error("Erro ao alterar status"); return; }
    toast.success(next === "active" ? "Vendas reativadas!" : "Vendas pausadas. Produto fora do checkout público.");
    await loadProducts();
  };

  const menuHandlers = {
    onCopyLink: handleCopyLink,
    onDeleteProduct: (product: Product) => setDeleteTarget(product.id),
    onEditProduct: handleEditProduct,
    onOpenCheckout: handleOpenCheckout,
    onOpenMembers: handleOpenMembers,
    onOpenPixels: (product: Product) => setPixelProduct(product),
    onDuplicateProduct: handleDuplicate,
    onToggleStatus: handleToggleStatus,
  };

  const showClearDraftsBtn = tab === "draft" && draftIds.length > 0;

  const tabIcon: Record<FilterTab, JSX.Element> = {
    all: <Layers className="h-3 w-3" strokeWidth={2.5} />,
    active: <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />,
    draft: <FileEdit className="h-3 w-3" strokeWidth={2.5} />,
    pending_review: <Clock className="h-3 w-3" strokeWidth={2.5} />,
    inactive: <XCircle className="h-3 w-3" strokeWidth={2.5} />,
  };

  const tabAccent: Record<FilterTab, string> = {
    all: "text-foreground",
    active: "text-success",
    draft: "text-muted-foreground",
    pending_review: "text-warning",
    inactive: "text-destructive",
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4 sm:space-y-6 px-3 pb-24 pt-1 sm:px-7 md:pb-10">
      {/* ── Hero (Financeiro pattern) ── */}
      <FinanceiroHero
        eyebrow={`${products.length} ${products.length === 1 ? "produto" : "produtos"} no catálogo`}
        title="Produtos"
        subtitle="Gerencie seu catálogo, checkout e área de membros em um só lugar."
        status={counts.pending_review > 0
          ? { tone: "warning", label: `${counts.pending_review} em revisão`, pulse: true }
          : counts.active > 0
            ? { tone: "success", label: `${counts.active} ativos` }
            : undefined}
        actions={
          <button
            onClick={() => navigate("/vendas/produtos/novo/editar")}
            className="group inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[12px] font-bold uppercase tracking-wider text-primary-foreground transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" strokeWidth={2.5} />
            Novo produto
          </button>
        }
      />

      {/* ── KPI grid (Dashboard-style) ── */}
      <HDStatGrid>
        <HDStat label="Produtos no catálogo" value={String(products.length)} sub={`${counts.active} ativos`} icon={Package} tone="primary" />
        <HDStat label="Vendas · 30 dias" value={String(kpi.salesCount)} sub="pedidos aprovados" icon={ShoppingCart} tone="neutral" />
        <HDStat label="Receita · 30 dias" value={fmtBRL(kpi.revenue)} sub={`Ticket médio ${fmtBRL(kpi.avgTicket)}`} icon={TrendingUp} tone="success" />
        <HDStat label="Top do período" value={kpi.bestProduct ? (kpi.bestProduct.length > 18 ? kpi.bestProduct.slice(0, 18) + "…" : kpi.bestProduct) : "—"} sub="Produto mais vendido" icon={DollarSign} tone="warning" />
      </HDStatGrid>


      {/* ── Tabs + Search row ── */}
      <div className="flex flex-col gap-3 animate-fade-in stagger-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-3 sm:mx-0 overflow-x-auto scrollbar-none">
          <div className="inline-flex min-w-full lg:min-w-0 lg:w-fit items-center gap-1 rounded-xl border border-border/50 bg-card p-1 mx-3 sm:mx-0">
            {tabs.map((item) => {
              const active = tab === item.value;
              return (
                <button
                  key={item.value}
                  onClick={() => setTab(item.value)}
                  className={cn(
                    "group/tab relative inline-flex h-8 shrink-0 items-center gap-2 overflow-hidden rounded-lg px-3 text-[12px] font-bold tracking-tight transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] whitespace-nowrap",
                    active
                      ? "bg-secondary text-foreground ring-1 ring-border/60"
                      : "text-muted-foreground/80 hover:bg-secondary/70 hover:text-foreground"
                  )}
                >
                  <span className="pointer-events-none absolute inset-x-2 top-0 h-px bg-primary/50 opacity-0 transition-opacity duration-300 group-hover/tab:opacity-100" />
                  <span className={cn(
                    "flex h-4 w-4 items-center justify-center transition-all duration-300",
                    active ? tabAccent[item.value] : "text-muted-foreground/50 group-hover/tab:scale-110 group-hover/tab:text-primary"
                  )}>
                    {tabIcon[item.value]}
                  </span>
                  <span className="font-display">{item.label}</span>
                  {item.count > 0 && (
                    <span className={cn(
                      "inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-md px-1.5 text-[10px] font-black tabular-nums tracking-tight border transition-colors",
                      active
                        ? "bg-background/80 text-foreground border-border/40"
                        : "bg-muted/30 text-muted-foreground/60 border-transparent"
                    )}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto">
          {showClearDraftsBtn && (
            <button
              onClick={() => setClearDraftsOpen(true)}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/[0.06] px-3 text-[11px] font-bold uppercase tracking-wider text-destructive transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
              <span className="hidden sm:inline">Limpar rascunhos</span>
              <span className="rounded bg-destructive/20 px-1.5 py-px text-[10px] tabular-nums">{draftIds.length}</span>
            </button>
          )}
          <div className="relative group flex-1 lg:flex-none">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50 transition-colors group-focus-within:text-primary" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="h-9 w-full rounded-lg border border-border/60 bg-secondary/40 pl-9 pr-8 text-xs font-medium text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary/50 focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/15 lg:w-72"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-secondary hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>



      {/* ── Product workspace ── */}
      <div>

        {productsLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-[20px] border border-border/40 bg-card/40 overflow-hidden animate-pulse">
                <div className="aspect-[16/10] w-full bg-muted/50" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-3/4 rounded bg-muted/60" />
                  <div className="h-3 w-1/2 rounded bg-muted/40" />
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="h-12 rounded-xl bg-muted/30" />
                    <div className="h-12 rounded-xl bg-muted/30" />
                  </div>
                  <div className="h-10 rounded-lg bg-muted/40" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed border-border/60 bg-card/40 px-6 py-24 text-center animate-fade-in stagger-3">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-[1] opacity-50"
              style={{
                background:
                  "radial-gradient(50% 50% at 50% 30%, hsl(var(--primary) / 0.08), transparent 70%)",
              }}
            />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-border/60 bg-secondary/60 shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.15)]">
              <Package className="h-8 w-8 text-muted-foreground/80" strokeWidth={1.4} />
              <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-lg border border-primary/30 bg-card">
                <Sparkles className="h-3 w-3 text-primary" strokeWidth={2.5} />
              </span>
            </div>
            <p className="mt-6 font-display text-base font-black tracking-tight text-foreground">
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
                className="group mt-7 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-[12px] font-black uppercase tracking-wider text-primary-foreground transition-all duration-300 hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.5)]"
              >
                <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" strokeWidth={2.75} />
                Criar primeiro produto
              </button>
            )}
          </div>
        ) : (
          <div className="animate-fade-in stagger-3">
            <ProductGridView
              copiedId={copiedId}
              products={filtered}
              {...menuHandlers}
            />
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}
      {pixelProduct && (
        <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={(open) => { if (!open) setPixelProduct(null); }} />
      )}

      {/* Delete single product */}
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

      {/* Clear all drafts */}
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
