import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Package, Plus, Trash2, MoreHorizontal,
  Copy, CheckCircle2, Settings2, Palette, Star,
  ExternalLink, Search, X, Crosshair, Loader2,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import PixelSettingsDialog from "@/components/PixelSettingsDialog";
import type { Tables } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const STATUS_MAP: Record<string, { label: string; dot: string }> = {
  active: { label: "Ativo", dot: "bg-emerald-500" },
  inactive: { label: "Inativo", dot: "bg-muted-foreground/30" },
  pending_review: { label: "Revisão", dot: "bg-amber-500" },
};

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

  const tabs: { label: string; value: typeof statusFilter; count?: number }[] = [
    { label: "Todos", value: "all", count: products.length },
    { label: "Ativos", value: "active", count: activeCount },
    { label: "Em revisão", value: "pending_review", count: pendingCount },
    { label: "Inativos", value: "inactive" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-28 md:pb-16">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground tracking-[-0.03em]">Produtos</h1>
          <Badge variant="secondary" className="rounded-md text-[11px] font-medium px-2 py-0.5 bg-muted/60 text-muted-foreground border-none">
            {products.length}
          </Badge>
        </div>
        <button
          onClick={() => navigate("/vendas/produtos/novo/editar")}
          className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 active:scale-[0.97] transition-all duration-200"
        >
          <Plus className="h-4 w-4" /> Novo Produto
        </button>
      </div>

      {/* ── Tabs + Search ── */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
        <div className="flex items-center gap-1 relative">
          {tabs.map(t => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={cn(
                "relative px-3.5 pb-3 pt-1 text-[13px] font-medium transition-colors",
                statusFilter === t.value
                  ? "text-foreground"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              )}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className={cn(
                  "ml-1.5 text-[11px] tabular-nums",
                  statusFilter === t.value ? "text-foreground/60" : "text-muted-foreground/30"
                )}>{t.count}</span>
              )}
              {statusFilter === t.value && (
                <motion.div
                  layoutId="products-tab-indicator"
                  className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full bg-primary"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
            </button>
          ))}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-border/40" />
        </div>

        <div className="sm:ml-auto relative w-full sm:w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto…"
            className="h-9 w-full rounded-lg border border-border/50 bg-card pl-9 pr-8 text-[13px] placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 active:scale-90">
              <X className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div className="py-24 flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-muted/30 border border-border/40 flex items-center justify-center">
            <Package className="h-5 w-5 text-muted-foreground/25" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {search || statusFilter !== "all" ? "Nenhum resultado" : "Nenhum produto"}
            </p>
            <p className="text-[13px] text-muted-foreground/50 mt-1">
              {search || statusFilter !== "all" ? "Tente ajustar seus filtros" : "Crie seu primeiro produto digital"}
            </p>
          </div>
          {!search && statusFilter === "all" && (
            <button
              onClick={() => navigate("/vendas/produtos/novo/editar")}
              className="mt-2 h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              <Plus className="h-4 w-4" /> Criar produto
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-[3px]">
          {/* Table header — desktop */}
          <div className="hidden sm:grid grid-cols-[1fr_110px_90px_44px] items-center px-4 h-10 rounded-lg bg-muted/20 text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-[0.08em]">
            <span>Produto</span>
            <span className="text-right">Preço</span>
            <span className="text-center">Status</span>
            <span />
          </div>

          {filtered.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="group grid sm:grid-cols-[1fr_110px_90px_44px] items-center px-4 cursor-pointer rounded-lg border border-transparent hover:border-border/40 hover:bg-card/80 transition-all duration-200"
              onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
            >
              {/* Product info */}
              <div className="flex items-center gap-3.5 py-3.5 min-w-0">
                <div className="relative shrink-0">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt=""
                      className="h-10 w-10 rounded-lg object-cover ring-1 ring-inset ring-foreground/[0.06] transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-muted/40 ring-1 ring-inset ring-foreground/[0.04] flex items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground/25" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate leading-tight tracking-[-0.01em]">{p.name}</p>
                  {p.description && (
                    <p className="text-[11px] text-muted-foreground/40 truncate mt-0.5 max-w-[320px]">{p.description}</p>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="hidden sm:block text-right">
                <span className="text-[13px] font-semibold text-foreground tabular-nums">{fmt(Number(p.price))}</span>
              </div>

              {/* Status */}
              <div className="hidden sm:flex justify-center">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/60">
                  <span className={cn("h-[6px] w-[6px] rounded-full", STATUS_MAP[p.status]?.dot || "bg-muted-foreground/30")} />
                  {STATUS_MAP[p.status]?.label || p.status}
                </span>
              </div>

              {/* Actions */}
              <div className="hidden sm:flex justify-end" onClick={e => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/20 hover:text-foreground hover:bg-muted/30 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={4} className="w-48 rounded-xl p-1.5 border-border/50 shadow-xl shadow-foreground/5">
                    <DropdownMenuItem onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)} className="gap-2.5 text-[13px] cursor-pointer rounded-lg px-2.5 py-2">
                      <Settings2 className="h-3.5 w-3.5 text-muted-foreground/50" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)} className="gap-2.5 text-[13px] cursor-pointer rounded-lg px-2.5 py-2">
                      <Palette className="h-3.5 w-3.5 text-muted-foreground/50" /> Checkout Builder
                    </DropdownMenuItem>
                    {p.checkout_url && (
                      <>
                        <DropdownMenuItem onClick={() => copyCheckout(p)} className="gap-2.5 text-[13px] cursor-pointer rounded-lg px-2.5 py-2">
                          {copiedId === p.id
                            ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Copiado!</>
                            : <><Copy className="h-3.5 w-3.5 text-muted-foreground/50" /> Copiar link</>
                          }
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(getCheckoutLink(p.checkout_url!), "_blank")} className="gap-2.5 text-[13px] cursor-pointer rounded-lg px-2.5 py-2">
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50" /> Ver checkout
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem onClick={() => setPixelProduct(p)} className="gap-2.5 text-[13px] cursor-pointer rounded-lg px-2.5 py-2">
                      <Crosshair className="h-3.5 w-3.5 text-muted-foreground/50" /> Pixels
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/vendas/conteudo/${p.id}/builder`)} className="gap-2.5 text-[13px] cursor-pointer rounded-lg px-2.5 py-2">
                      <Star className="h-3.5 w-3.5 text-muted-foreground/50" /> Área de Membros
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem onClick={() => setDeleteTarget(p.id)} className="gap-2.5 text-[13px] text-destructive cursor-pointer rounded-lg px-2.5 py-2 focus:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Mobile bottom row */}
              <div className="flex items-center justify-between pb-3 sm:hidden col-span-full" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-semibold text-foreground tabular-nums">{fmt(Number(p.price))}</span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
                    <span className={cn("h-[6px] w-[6px] rounded-full", STATUS_MAP[p.status]?.dot || "bg-muted-foreground/30")} />
                    {STATUS_MAP[p.status]?.label || p.status}
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/40">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={4} className="w-48 rounded-xl p-1.5 border-border/50 shadow-xl">
                    <DropdownMenuItem onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)} className="gap-2.5 text-[13px] cursor-pointer rounded-lg px-2.5 py-2">
                      <Settings2 className="h-3.5 w-3.5 text-muted-foreground/50" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)} className="gap-2.5 text-[13px] cursor-pointer rounded-lg px-2.5 py-2">
                      <Palette className="h-3.5 w-3.5 text-muted-foreground/50" /> Checkout Builder
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPixelProduct(p)} className="gap-2.5 text-[13px] cursor-pointer rounded-lg px-2.5 py-2">
                      <Crosshair className="h-3.5 w-3.5 text-muted-foreground/50" /> Pixels
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem onClick={() => setDeleteTarget(p.id)} className="gap-2.5 text-[13px] text-destructive cursor-pointer rounded-lg px-2.5 py-2 focus:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {pixelProduct && <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={(v) => { if (!v) setPixelProduct(null); }} />}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="rounded-xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Excluir produto</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px]">
              Tem certeza? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="rounded-lg text-[13px] h-9">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="rounded-lg h-9 text-[13px] bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5">
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {deleting ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
