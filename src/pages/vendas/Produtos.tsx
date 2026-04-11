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

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const STATUS_CFG: Record<string, { label: string; color: string; ping: string }> = {
  active:         { label: "Ativo",   color: "text-emerald-400", ping: "bg-emerald-400" },
  inactive:       { label: "Inativo", color: "text-muted-foreground/50", ping: "bg-muted-foreground/40" },
  pending_review: { label: "Revisão", color: "text-amber-400",  ping: "bg-amber-400" },
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

  const getCheckoutLink = (url: string) => `${window.location.origin}/pay/${url.split("/").pop()!}`;

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
    { label: "Revisão", value: "pending_review", count: pendingCount },
    { label: "Inativos", value: "inactive" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-28 md:pb-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[15px] font-semibold text-foreground tracking-[-0.02em]">Produtos</h1>
        <button
          onClick={() => navigate("/vendas/produtos/novo/editar")}
          className="h-[30px] px-3 rounded-md text-[11px] font-semibold flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all"
        >
          <Plus className="h-3 w-3" strokeWidth={2.5} /> Novo Produto
        </button>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center relative">
          {tabs.map(t => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={cn(
                "relative px-2.5 pb-2 text-[11px] font-medium transition-colors",
                statusFilter === t.value ? "text-foreground" : "text-muted-foreground/30 hover:text-muted-foreground/50"
              )}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className="ml-1 text-[10px] tabular-nums opacity-40">{t.count}</span>
              )}
              {statusFilter === t.value && (
                <motion.div
                  layoutId="prod-tab"
                  className="absolute bottom-0 left-1 right-1 h-[1.5px] rounded-full bg-primary"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
            </button>
          ))}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-border/20" />
        </div>

        <div className="relative w-44">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/20" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="h-[30px] w-full rounded-md border border-border/30 bg-card/40 pl-7 pr-6 text-[11px] placeholder:text-muted-foreground/20 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3 w-3 text-muted-foreground/25" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-2">
          <Package className="h-6 w-6 text-muted-foreground/15" />
          <p className="text-[12px] font-medium text-foreground">
            {search || statusFilter !== "all" ? "Nenhum resultado" : "Nenhum produto"}
          </p>
          <p className="text-[11px] text-muted-foreground/30">
            {search || statusFilter !== "all" ? "Ajuste seus filtros" : "Crie seu primeiro produto"}
          </p>
          {!search && statusFilter === "all" && (
            <button
              onClick={() => navigate("/vendas/produtos/novo/editar")}
              className="mt-1.5 h-[30px] px-3 rounded-md text-[11px] font-semibold flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
            >
              <Plus className="h-3 w-3" strokeWidth={2.5} /> Criar produto
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border/25 overflow-hidden">
          {/* Header row */}
          <div className="hidden sm:grid grid-cols-[1fr_100px_80px_36px] items-center px-3 h-8 border-b border-border/20 text-[10px] font-semibold text-muted-foreground/30 uppercase tracking-[0.08em]">
            <span>Produto</span>
            <span className="text-right">Preço</span>
            <span className="text-center">Status</span>
            <span />
          </div>

          {filtered.map((p, i) => {
            const st = STATUS_CFG[p.status] || STATUS_CFG.inactive;
            return (
              <div
                key={p.id}
                onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
                className={cn(
                  "group grid sm:grid-cols-[1fr_100px_80px_36px] items-center px-3 py-3 cursor-pointer hover:bg-muted/[0.04] transition-colors duration-150",
                  i !== filtered.length - 1 && "border-b border-border/15"
                )}
              >
                {/* Product */}
                <div className="flex items-center gap-3 min-w-0">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="h-9 w-9 rounded-md object-cover ring-1 ring-inset ring-foreground/[0.06] shrink-0" />
                  ) : (
                    <div className="h-9 w-9 rounded-md bg-muted/15 ring-1 ring-inset ring-foreground/[0.03] flex items-center justify-center shrink-0">
                      <Package className="h-3.5 w-3.5 text-muted-foreground/15" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate leading-tight">{p.name}</p>
                    {p.description && (
                      <p className="text-[11px] text-muted-foreground/30 truncate mt-px max-w-[260px]">{p.description}</p>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div className="hidden sm:block text-right">
                  <span className="text-[13px] font-medium text-foreground tabular-nums tracking-tight font-mono">{fmt(Number(p.price))}</span>
                </div>

                {/* Status with ping dot */}
                <div className="hidden sm:flex justify-center">
                  <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", st.color)}>
                    <span className="relative flex h-1.5 w-1.5">
                      {p.status === "active" && (
                        <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-50", st.ping)} />
                      )}
                      <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", st.ping)} />
                    </span>
                    {st.label}
                  </span>
                </div>

                {/* Actions */}
                <div className="hidden sm:flex justify-end" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground/15 hover:text-foreground/60 opacity-0 group-hover:opacity-100 transition-all duration-150">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={4} className="w-40 rounded-lg p-1 border-border/30 shadow-lg">
                      <DropdownMenuItem onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)} className="gap-2 text-[11px] cursor-pointer rounded-md px-2 py-1.5">
                        <Settings2 className="h-3 w-3 text-muted-foreground/40" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)} className="gap-2 text-[11px] cursor-pointer rounded-md px-2 py-1.5">
                        <Palette className="h-3 w-3 text-muted-foreground/40" /> Checkout
                      </DropdownMenuItem>
                      {p.checkout_url && (
                        <>
                          <DropdownMenuItem onClick={() => copyCheckout(p)} className="gap-2 text-[11px] cursor-pointer rounded-md px-2 py-1.5">
                            {copiedId === p.id
                              ? <><CheckCircle2 className="h-3 w-3 text-emerald-400" /> Copiado!</>
                              : <><Copy className="h-3 w-3 text-muted-foreground/40" /> Copiar link</>}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.open(getCheckoutLink(p.checkout_url!), "_blank")} className="gap-2 text-[11px] cursor-pointer rounded-md px-2 py-1.5">
                            <ExternalLink className="h-3 w-3 text-muted-foreground/40" /> Abrir
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem onClick={() => setPixelProduct(p)} className="gap-2 text-[11px] cursor-pointer rounded-md px-2 py-1.5">
                        <Crosshair className="h-3 w-3 text-muted-foreground/40" /> Pixels
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/vendas/conteudo/${p.id}/builder`)} className="gap-2 text-[11px] cursor-pointer rounded-md px-2 py-1.5">
                        <Star className="h-3 w-3 text-muted-foreground/40" /> Membros
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setDeleteTarget(p.id)} className="gap-2 text-[11px] text-destructive cursor-pointer rounded-md px-2 py-1.5 focus:text-destructive">
                        <Trash2 className="h-3 w-3" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Mobile row */}
                <div className="flex items-center justify-between pt-1.5 sm:hidden col-span-full" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[12px] font-medium text-foreground tabular-nums font-mono">{fmt(Number(p.price))}</span>
                    <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium", st.color)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", st.ping)} />
                      {st.label}
                    </span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground/30">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={4} className="w-40 rounded-lg p-1 border-border/30 shadow-lg">
                      <DropdownMenuItem onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)} className="gap-2 text-[11px] cursor-pointer rounded-md px-2 py-1.5">
                        <Settings2 className="h-3 w-3 text-muted-foreground/40" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPixelProduct(p)} className="gap-2 text-[11px] cursor-pointer rounded-md px-2 py-1.5">
                        <Crosshair className="h-3 w-3 text-muted-foreground/40" /> Pixels
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setDeleteTarget(p.id)} className="gap-2 text-[11px] text-destructive cursor-pointer rounded-md px-2 py-1.5 focus:text-destructive">
                        <Trash2 className="h-3 w-3" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pixelProduct && <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={(v) => { if (!v) setPixelProduct(null); }} />}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="rounded-xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Excluir produto</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px]">Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription>
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
