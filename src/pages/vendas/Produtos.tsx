import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Package, Plus, Trash2, MoreVertical,
  Copy, CheckCircle2, Settings2, Palette, Star,
  ExternalLink, Search, X, Crosshair, Loader2,
  TrendingUp, ShoppingBag, Clock,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import PixelSettingsDialog from "@/components/PixelSettingsDialog";
import type { Tables } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function Produtos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: products = [], refetch: loadProducts } = useProducts();
  const [pixelProduct, setPixelProduct] = useState<Tables<"products"> | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "pending_review">("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(p => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!search) return true;
      return p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
    });
  }, [products, search, statusFilter]);

  const activeCount = products.filter(p => p.status === "active").length;
  const pendingCount = products.filter(p => p.status === "pending_review").length;
  const inactiveCount = products.filter(p => p.status === "inactive").length;

  const confirmDelete = async () => {
    if (!user || !deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("products").delete().eq("id", deleteTarget).eq("user_id", user.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (error) { toast.error("Erro ao excluir produto"); return; }
    toast.success("Produto removido"); loadProducts();
  };

  const getCheckoutLink = (url: string) => {
    const slug = url.split("/").pop()!;
    return `${window.location.origin}/pay/${slug}`;
  };

  const copyCheckout = (p: Tables<"products">) => {
    if (p.checkout_url) {
      navigator.clipboard.writeText(getCheckoutLink(p.checkout_url));
      setCopiedId(p.id);
      toast.success("Link copiado!");
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const statusLabel = (s: string) => s === "active" ? "Ativo" : s === "inactive" ? "Inativo" : "Em revisão";
  const statusColor = (s: string) => s === "active"
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
    : s === "inactive"
    ? "bg-red-500/10 text-red-500 border-red-500/20"
    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";

  const tabs = [
    { label: "Todos", value: "all" as const, count: products.length },
    { label: "Ativos", value: "active" as const, count: activeCount },
    { label: "Em revisão", value: "pending_review" as const, count: pendingCount },
    { label: "Inativos", value: "inactive" as const, count: inactiveCount },
  ];

  const kpis = [
    { icon: ShoppingBag, label: "Total", value: products.length, color: "text-primary" },
    { icon: TrendingUp, label: "Ativos", value: activeCount, color: "text-emerald-500" },
    { icon: Clock, label: "Revisão", value: pendingCount, color: "text-amber-500" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-28 md:pb-16">
      {/* ── Header ── */}
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight font-display">Meus Produtos</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Gerencie seu catálogo de produtos digitais
          </p>
        </div>
        <button
          onClick={() => navigate("/vendas/produtos/novo/editar")}
          className="h-10 px-5 rounded-xl text-[13px] font-bold flex items-center gap-2 bg-primary text-primary-foreground hover:brightness-110 active:scale-[0.98] transition-all shadow-sm shadow-primary/20"
        >
          <Plus className="h-4 w-4" /> Novo produto
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-border/50 bg-card p-4 flex items-center gap-3">
            <div className={cn("h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center", kpi.color)}>
              <kpi.icon className="h-[18px] w-[18px]" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground font-numbers tabular-nums tracking-tight leading-none">{kpi.value}</p>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="flex items-center gap-1 bg-muted/30 rounded-xl p-1">
          {tabs.map(t => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={cn(
                "px-3.5 py-1.5 text-[12px] font-semibold rounded-lg transition-all duration-200",
                statusFilter === t.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className={cn(
                  "ml-1 text-[10px] tabular-nums",
                  statusFilter === t.value ? "text-primary" : "text-muted-foreground/40"
                )}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="sm:ml-auto relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto…"
            className="h-9 w-full rounded-xl border border-border/50 bg-muted/20 pl-9 pr-8 text-[13px] placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground/40" />
            </button>
          )}
        </div>
      </div>

      {/* ── Product List ── */}
      {filtered.length === 0 ? (
        <div className="py-24 flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-muted/30 flex items-center justify-center">
            <Package className="h-7 w-7 text-muted-foreground/20" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground mb-1">
              {search || statusFilter !== "all" ? "Nenhum resultado encontrado" : "Nenhum produto criado"}
            </p>
            <p className="text-xs text-muted-foreground">
              {search || statusFilter !== "all" ? "Tente ajustar seus filtros" : "Crie seu primeiro produto digital"}
            </p>
          </div>
          {!search && statusFilter === "all" && (
            <button
              onClick={() => navigate("/vendas/produtos/novo/editar")}
              className="mt-1 h-9 px-4 rounded-xl text-[13px] font-semibold flex items-center gap-1.5 bg-primary text-primary-foreground hover:brightness-110 transition-all"
            >
              <Plus className="h-4 w-4" /> Criar produto
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
              className="group relative rounded-xl border border-border/50 bg-card hover:bg-accent/30 transition-colors duration-150 cursor-pointer"
              onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
            >

              <div className="flex items-center gap-4 px-4 py-3">
                {/* Thumbnail */}
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="h-10 w-10 rounded-lg object-cover ring-1 ring-border/30 shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                    <Package className="h-4 w-4 text-muted-foreground/30" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-foreground truncate">
                      {p.name}
                    </p>
                    <span className={cn(
                      "shrink-0 hidden sm:inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border",
                      statusColor(p.status)
                    )}>
                      {statusLabel(p.status)}
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-[11px] text-muted-foreground/50 truncate mt-0.5 max-w-[320px] hidden sm:block">{p.description}</p>
                  )}
                </div>

                {/* Price */}
                <div className="hidden sm:block text-right mr-2">
                  <span className="text-[15px] font-black text-foreground font-numbers tabular-nums tracking-tight">{fmt(Number(p.price))}</span>
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  {p.checkout_url && (
                    <button
                      onClick={() => copyCheckout(p)}
                      className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200",
                        "text-muted-foreground/30 hover:text-primary hover:bg-primary/5",
                        "sm:opacity-0 sm:group-hover:opacity-100"
                      )}
                      title="Copiar link"
                    >
                      <AnimatePresence mode="wait">
                        {copiedId === p.id ? (
                          <motion.span key="ok" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          </motion.span>
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </AnimatePresence>
                    </button>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200",
                        "text-muted-foreground/30 hover:text-foreground hover:bg-muted/50",
                        "sm:opacity-0 sm:group-hover:opacity-100"
                      )}>
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={4} className="w-48 rounded-xl p-1 border border-border/60 bg-popover shadow-lg">
                      <DropdownMenuItem onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)} className="gap-2 text-[13px] cursor-pointer rounded-lg px-2.5 py-2 font-medium">
                        <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)} className="gap-2 text-[13px] cursor-pointer rounded-lg px-2.5 py-2 font-medium">
                        <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                        Checkout Builder
                      </DropdownMenuItem>
                      {p.checkout_url && (
                        <DropdownMenuItem onClick={() => window.open(getCheckoutLink(p.checkout_url!), "_blank")} className="gap-2 text-[13px] cursor-pointer rounded-lg px-2.5 py-2 font-medium">
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          Ver checkout
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setPixelProduct(p)} className="gap-2 text-[13px] cursor-pointer rounded-lg px-2.5 py-2 font-medium">
                        <Crosshair className="h-3.5 w-3.5 text-muted-foreground" />
                        Pixels
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/vendas/conteudo/${p.id}/builder`)} className="gap-2 text-[13px] cursor-pointer rounded-lg px-2.5 py-2 font-medium">
                        <Star className="h-3.5 w-3.5 text-muted-foreground" />
                        Área de Membros
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1" />
                      <DropdownMenuItem onClick={() => setDeleteTarget(p.id)} className="gap-2 text-[13px] text-destructive cursor-pointer rounded-lg px-2.5 py-2 font-medium focus:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Mobile meta row */}
              <div className="flex items-center justify-between px-5 pb-3.5 pt-0 sm:hidden">
                <div className="flex items-center gap-3">
                  <span className="text-[14px] font-black text-foreground font-numbers tabular-nums">{fmt(Number(p.price))}</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-md text-[10px] font-semibold border",
                    statusColor(p.status)
                  )}>
                    {statusLabel(p.status)}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {pixelProduct && <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={(v) => { if (!v) setPixelProduct(null); }} />}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black text-lg">Excluir produto</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Tem certeza? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2">
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {deleting ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
