import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Package, Plus, Trash2, Eye, MoreVertical,
  Copy, CheckCircle2, Link2, Settings2, Palette, Star,
  ExternalLink, Search, X, Crosshair, Loader2,
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
  const statusDot = (s: string) => s === "active" ? "bg-emerald-500" : s === "inactive" ? "bg-red-400" : "bg-amber-400";

  const tabs = [
    { label: "Todos", value: "all" as const, count: products.length },
    { label: "Ativos", value: "active" as const, count: activeCount },
    { label: "Em revisão", value: "pending_review" as const, count: pendingCount },
    { label: "Inativos", value: "inactive" as const, count: inactiveCount },
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-28 md:pb-16">
      {/* ── Header ── */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Produtos</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">{products.length} produto{products.length !== 1 && "s"} cadastrado{products.length !== 1 && "s"}</p>
        </div>
        <button
          onClick={() => navigate("/vendas/produtos/novo/editar")}
          className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> Novo produto
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        {/* Tabs */}
        <div className="flex items-center gap-0.5 border-b border-border/40 sm:border-0">
          {tabs.map(t => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={cn(
                "px-3 py-2 text-[13px] font-medium transition-colors relative",
                statusFilter === t.value
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className={cn(
                  "ml-1.5 text-[11px] tabular-nums",
                  statusFilter === t.value ? "text-primary font-semibold" : "text-muted-foreground/50"
                )}>{t.count}</span>
              )}
              {statusFilter === t.value && (
                <motion.div layoutId="prod-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="sm:ml-auto relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-8 text-[13px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-shadow"
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
        <div className="py-20 flex flex-col items-center gap-3">
          <Package className="h-10 w-10 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">
            {search || statusFilter !== "all" ? "Nenhum resultado" : "Nenhum produto criado"}
          </p>
          {!search && statusFilter === "all" && (
            <button
              onClick={() => navigate("/vendas/produtos/novo/editar")}
              className="mt-2 h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" /> Criar primeiro produto
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[1fr_120px_100px_110px_40px] items-center px-5 py-2.5 border-b border-border/50 bg-muted/30">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Produto</span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Preço</span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Status</span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Checkout</span>
            <span />
          </div>

          {/* Rows */}
          <div className="divide-y divide-border/40">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="group grid grid-cols-1 sm:grid-cols-[1fr_120px_100px_110px_40px] items-center px-5 py-3.5 hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
              >
                {/* Product info */}
                <div className="flex items-center gap-3 min-w-0">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                      <Package className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground truncate">{p.name}</p>
                    {p.description && (
                      <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5 max-w-[260px]">{p.description}</p>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div className="hidden sm:block">
                  <span className="text-[13px] font-semibold text-foreground tabular-nums">{fmt(Number(p.price))}</span>
                </div>

                {/* Status */}
                <div className="hidden sm:flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", statusDot(p.status))} />
                  <span className="text-[12px] text-muted-foreground">{statusLabel(p.status)}</span>
                </div>

                {/* Checkout link */}
                <div className="hidden sm:block" onClick={e => e.stopPropagation()}>
                  {p.checkout_url ? (
                    <button
                      onClick={() => copyCheckout(p)}
                      className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline font-medium"
                    >
                      <AnimatePresence mode="wait">
                        {copiedId === p.id ? (
                          <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          </motion.span>
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </AnimatePresence>
                      Copiar link
                    </button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground/40">—</span>
                  )}
                </div>

                {/* Actions */}
                <div className="hidden sm:flex justify-end" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-muted/40 transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-lg">
                      <DropdownMenuItem onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)} className="gap-2 text-[12px] cursor-pointer">
                        <Settings2 className="h-3.5 w-3.5" /> Editar produto
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)} className="gap-2 text-[12px] cursor-pointer">
                        <Palette className="h-3.5 w-3.5" /> Checkout Builder
                      </DropdownMenuItem>
                      {p.checkout_url && (
                        <DropdownMenuItem onClick={() => window.open(getCheckoutLink(p.checkout_url!), "_blank")} className="gap-2 text-[12px] cursor-pointer">
                          <ExternalLink className="h-3.5 w-3.5" /> Ver checkout
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setPixelProduct(p)} className="gap-2 text-[12px] cursor-pointer">
                        <Crosshair className="h-3.5 w-3.5" /> Pixels
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/vendas/conteudo/${p.id}/builder`)} className="gap-2 text-[12px] cursor-pointer">
                        <Star className="h-3.5 w-3.5" /> Área de Membros
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setDeleteTarget(p.id)} className="gap-2 text-[12px] text-destructive cursor-pointer">
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Mobile meta */}
                <div className="flex items-center justify-between mt-2 sm:hidden">
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-semibold text-foreground tabular-nums">{fmt(Number(p.price))}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(p.status))} />
                      <span className="text-[11px] text-muted-foreground">{statusLabel(p.status)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    {p.checkout_url && (
                      <button onClick={() => copyCheckout(p)} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-primary">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/40">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-lg">
                        <DropdownMenuItem onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)} className="gap-2 text-[12px] cursor-pointer">
                          <Settings2 className="h-3.5 w-3.5" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)} className="gap-2 text-[12px] cursor-pointer">
                          <Palette className="h-3.5 w-3.5" /> Builder
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleteTarget(p.id)} className="gap-2 text-[12px] text-destructive cursor-pointer">
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pixelProduct && <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={(v) => { if (!v) setPixelProduct(null); }} />}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="rounded-xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold text-lg">Excluir produto</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Tem certeza? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="rounded-lg">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2">
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {deleting ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
