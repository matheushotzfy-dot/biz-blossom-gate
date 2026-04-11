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
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground tracking-[-0.02em]">Produtos</h1>
          <p className="text-[13px] text-muted-foreground/70 mt-0.5">
            {products.length} produto{products.length !== 1 && "s"} · {activeCount} ativo{activeCount !== 1 && "s"}
          </p>
        </div>
        <button
          onClick={() => navigate("/vendas/produtos/novo/editar")}
          className="h-8 px-3.5 rounded-lg text-[13px] font-medium flex items-center gap-1.5 bg-foreground text-background hover:bg-foreground/90 active:bg-foreground/80 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Novo produto
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex items-center border-b border-border/50">
          {tabs.map(t => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={cn(
                "px-3 pb-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors",
                statusFilter === t.value
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className="ml-1.5 text-[11px] tabular-nums text-muted-foreground/50">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="sm:ml-auto relative w-full sm:w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="h-8 w-full rounded-lg border border-border/60 bg-background pl-8 pr-7 text-[13px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/30 transition-shadow"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3 w-3 text-muted-foreground/40 hover:text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <Package className="h-8 w-8 text-muted-foreground/20" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {search || statusFilter !== "all" ? "Nenhum resultado" : "Nenhum produto"}
            </p>
            <p className="text-[13px] text-muted-foreground/60 mt-0.5">
              {search || statusFilter !== "all" ? "Tente ajustar seus filtros" : "Crie seu primeiro produto digital"}
            </p>
          </div>
          {!search && statusFilter === "all" && (
            <button
              onClick={() => navigate("/vendas/produtos/novo/editar")}
              className="mt-1 h-8 px-3.5 rounded-lg text-[13px] font-medium flex items-center gap-1.5 bg-foreground text-background hover:bg-foreground/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Criar produto
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 overflow-hidden">
          {/* Table header — desktop */}
          <div className="hidden sm:grid grid-cols-[1fr_100px_80px_40px] items-center px-4 h-9 bg-muted/30 border-b border-border/40 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
            <span>Produto</span>
            <span className="text-right">Preço</span>
            <span className="text-center">Status</span>
            <span />
          </div>

          {filtered.map((p, i) => (
            <div
              key={p.id}
              className={cn(
                "group grid sm:grid-cols-[1fr_100px_80px_40px] items-center px-4 cursor-pointer transition-colors hover:bg-muted/20",
                i !== filtered.length - 1 && "border-b border-border/30"
              )}
              onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
            >
              {/* Product info */}
              <div className="flex items-center gap-3 py-3 min-w-0">
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="h-9 w-9 rounded-md object-cover shrink-0" />
                ) : (
                  <div className="h-9 w-9 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                    <Package className="h-4 w-4 text-muted-foreground/30" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate leading-tight">{p.name}</p>
                  {p.description && (
                    <p className="text-[11px] text-muted-foreground/50 truncate mt-px max-w-[300px]">{p.description}</p>
                  )}
                </div>
              </div>

              {/* Price — mobile inline, desktop column */}
              <div className="hidden sm:block text-right">
                <span className="text-[13px] font-medium text-foreground font-numbers tabular-nums">{fmt(Number(p.price))}</span>
              </div>

              {/* Status */}
              <div className="hidden sm:flex justify-center">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_MAP[p.status]?.dot || "bg-muted-foreground/30")} />
                  {STATUS_MAP[p.status]?.label || p.status}
                </span>
              </div>

              {/* Actions */}
              <div className="hidden sm:flex justify-end" onClick={e => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/30 hover:text-foreground hover:bg-muted/40 opacity-0 group-hover:opacity-100 transition-all">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={4} className="w-44 rounded-lg p-1 border-border/60 shadow-lg">
                    <DropdownMenuItem onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)} className="gap-2 text-[13px] cursor-pointer rounded-md px-2 py-1.5">
                      <Settings2 className="h-3.5 w-3.5 text-muted-foreground/60" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)} className="gap-2 text-[13px] cursor-pointer rounded-md px-2 py-1.5">
                      <Palette className="h-3.5 w-3.5 text-muted-foreground/60" /> Checkout Builder
                    </DropdownMenuItem>
                    {p.checkout_url && (
                      <>
                        <DropdownMenuItem onClick={() => copyCheckout(p)} className="gap-2 text-[13px] cursor-pointer rounded-md px-2 py-1.5">
                          {copiedId === p.id
                            ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Copiado!</>
                            : <><Copy className="h-3.5 w-3.5 text-muted-foreground/60" /> Copiar link</>
                          }
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(getCheckoutLink(p.checkout_url!), "_blank")} className="gap-2 text-[13px] cursor-pointer rounded-md px-2 py-1.5">
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60" /> Ver checkout
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem onClick={() => setPixelProduct(p)} className="gap-2 text-[13px] cursor-pointer rounded-md px-2 py-1.5">
                      <Crosshair className="h-3.5 w-3.5 text-muted-foreground/60" /> Pixels
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/vendas/conteudo/${p.id}/builder`)} className="gap-2 text-[13px] cursor-pointer rounded-md px-2 py-1.5">
                      <Star className="h-3.5 w-3.5 text-muted-foreground/60" /> Área de Membros
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setDeleteTarget(p.id)} className="gap-2 text-[13px] text-destructive cursor-pointer rounded-md px-2 py-1.5 focus:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Mobile bottom row */}
              <div className="flex items-center justify-between pb-3 sm:hidden col-span-full" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-medium text-foreground font-numbers tabular-nums">{fmt(Number(p.price))}</span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_MAP[p.status]?.dot || "bg-muted-foreground/30")} />
                    {STATUS_MAP[p.status]?.label || p.status}
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/40">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={4} className="w-44 rounded-lg p-1 border-border/60 shadow-lg">
                    <DropdownMenuItem onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)} className="gap-2 text-[13px] cursor-pointer rounded-md px-2 py-1.5">
                      <Settings2 className="h-3.5 w-3.5 text-muted-foreground/60" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)} className="gap-2 text-[13px] cursor-pointer rounded-md px-2 py-1.5">
                      <Palette className="h-3.5 w-3.5 text-muted-foreground/60" /> Checkout Builder
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPixelProduct(p)} className="gap-2 text-[13px] cursor-pointer rounded-md px-2 py-1.5">
                      <Crosshair className="h-3.5 w-3.5 text-muted-foreground/60" /> Pixels
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setDeleteTarget(p.id)} className="gap-2 text-[13px] text-destructive cursor-pointer rounded-md px-2 py-1.5 focus:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {pixelProduct && <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={(v) => { if (!v) setPixelProduct(null); }} />}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="rounded-lg max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Excluir produto</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px]">
              Tem certeza? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="rounded-lg text-[13px] h-8">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="rounded-lg h-8 text-[13px] bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5">
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {deleting ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
