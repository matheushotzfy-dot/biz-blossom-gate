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

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  active:         { label: "Ativo",   bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  inactive:       { label: "Inativo", bg: "bg-muted/20",       text: "text-muted-foreground/60", dot: "bg-muted-foreground/40" },
  pending_review: { label: "Revisão", bg: "bg-amber-500/10",   text: "text-amber-400",  dot: "bg-amber-400" },
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
    { label: "Em revisão", value: "pending_review", count: pendingCount },
    { label: "Inativos", value: "inactive" },
  ];

  const s = (p: Tables<"products">) => STATUS_CFG[p.status] || STATUS_CFG.inactive;

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-28 md:pb-16">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-[17px] font-bold text-foreground tracking-[-0.04em]">Produtos</h1>
          <span className="text-[12px] font-semibold text-muted-foreground/40 tabular-nums">{products.length}</span>
        </div>
        <button
          onClick={() => navigate("/vendas/produtos/novo/editar")}
          className="h-8 px-3.5 rounded-lg text-[12px] font-bold flex items-center gap-1.5 bg-primary text-primary-foreground shadow-sm shadow-primary/25 hover:brightness-110 active:scale-[0.97] transition-all"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Novo Produto
        </button>
      </div>

      {/* ── Tabs + Search ── */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center relative">
          {tabs.map(t => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={cn(
                "relative px-3 pb-2.5 text-[12px] font-semibold transition-colors",
                statusFilter === t.value ? "text-foreground" : "text-muted-foreground/35 hover:text-muted-foreground/60"
              )}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className="ml-1 text-[10px] tabular-nums opacity-50">{t.count}</span>
              )}
              {statusFilter === t.value && (
                <motion.div
                  layoutId="prod-tab"
                  className="absolute bottom-0 left-1.5 right-1.5 h-[2px] rounded-full bg-primary"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}
                />
              )}
            </button>
          ))}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-border/30" />
        </div>

        <div className="relative w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/25" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="h-8 w-full rounded-lg border border-border/40 bg-card/60 pl-7.5 pr-7 text-[12px] placeholder:text-muted-foreground/25 focus:outline-none focus:ring-1 focus:ring-primary/25 transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3 w-3 text-muted-foreground/30 hover:text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* ── Products ── */}
      {filtered.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-2.5">
          <div className="h-11 w-11 rounded-xl bg-muted/20 border border-border/30 flex items-center justify-center">
            <Package className="h-5 w-5 text-muted-foreground/20" />
          </div>
          <p className="text-[13px] font-semibold text-foreground">
            {search || statusFilter !== "all" ? "Nenhum resultado" : "Nenhum produto"}
          </p>
          <p className="text-[12px] text-muted-foreground/40">
            {search || statusFilter !== "all" ? "Ajuste seus filtros" : "Crie seu primeiro produto"}
          </p>
          {!search && statusFilter === "all" && (
            <button
              onClick={() => navigate("/vendas/produtos/novo/editar")}
              className="mt-1 h-8 px-3.5 rounded-lg text-[12px] font-bold flex items-center gap-1.5 bg-primary text-primary-foreground shadow-sm shadow-primary/25 hover:brightness-110 transition-all"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Criar produto
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((p) => {
            const st = s(p);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
                className="group flex items-center gap-3 px-3.5 py-3 rounded-xl border border-border/30 bg-card/50 cursor-pointer hover:bg-card hover:border-border/50 hover:shadow-sm transition-all duration-200"
              >
                {/* Thumbnail */}
                <div className="shrink-0">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt=""
                      className="h-[48px] w-[48px] rounded-lg object-cover ring-1 ring-inset ring-foreground/[0.08]"
                    />
                  ) : (
                    <div className="h-[48px] w-[48px] rounded-lg bg-muted/20 ring-1 ring-inset ring-foreground/[0.04] flex items-center justify-center">
                      <Package className="h-4.5 w-4.5 text-muted-foreground/20" />
                    </div>
                  )}
                </div>

                {/* Name + desc */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate leading-tight tracking-[-0.01em]">
                    {p.name}
                  </p>
                  {p.description && (
                    <p className="text-[11px] text-muted-foreground/35 truncate mt-0.5 max-w-[280px]">{p.description}</p>
                  )}
                </div>

                {/* Price — mono style */}
                <div className="hidden sm:block shrink-0 text-right mr-1">
                  <span className="text-[13px] font-bold text-foreground tabular-nums tracking-tight font-mono">
                    {fmt(Number(p.price))}
                  </span>
                </div>

                {/* Status pill */}
                <div className="hidden sm:block shrink-0">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.05em]",
                    st.bg, st.text
                  )}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
                    {st.label}
                  </span>
                </div>

                {/* Actions */}
                <div className="shrink-0" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/20 hover:text-foreground hover:bg-muted/20 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-150">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={4} className="w-48 rounded-xl p-1.5 border-border/40 shadow-xl shadow-foreground/5">
                      <DropdownMenuItem onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)} className="gap-2 text-[12px] cursor-pointer rounded-lg px-2.5 py-2">
                        <Settings2 className="h-3.5 w-3.5 text-muted-foreground/40" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)} className="gap-2 text-[12px] cursor-pointer rounded-lg px-2.5 py-2">
                        <Palette className="h-3.5 w-3.5 text-muted-foreground/40" /> Checkout Builder
                      </DropdownMenuItem>
                      {p.checkout_url && (
                        <>
                          <DropdownMenuItem onClick={() => copyCheckout(p)} className="gap-2 text-[12px] cursor-pointer rounded-lg px-2.5 py-2">
                            {copiedId === p.id
                              ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Copiado!</>
                              : <><Copy className="h-3.5 w-3.5 text-muted-foreground/40" /> Copiar link</>}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.open(getCheckoutLink(p.checkout_url!), "_blank")} className="gap-2 text-[12px] cursor-pointer rounded-lg px-2.5 py-2">
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40" /> Ver checkout
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem onClick={() => setPixelProduct(p)} className="gap-2 text-[12px] cursor-pointer rounded-lg px-2.5 py-2">
                        <Crosshair className="h-3.5 w-3.5 text-muted-foreground/40" /> Pixels
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/vendas/conteudo/${p.id}/builder`)} className="gap-2 text-[12px] cursor-pointer rounded-lg px-2.5 py-2">
                        <Star className="h-3.5 w-3.5 text-muted-foreground/40" /> Área de Membros
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1" />
                      <DropdownMenuItem onClick={() => setDeleteTarget(p.id)} className="gap-2 text-[12px] text-destructive cursor-pointer rounded-lg px-2.5 py-2 focus:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Mobile price+status */}
                <div className="flex items-center gap-2 sm:hidden">
                  <span className="text-[12px] font-bold text-foreground tabular-nums font-mono">{fmt(Number(p.price))}</span>
                  <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
                </div>
              </motion.div>
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
