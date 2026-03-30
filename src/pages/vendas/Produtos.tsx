import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Package, Plus, Trash2, Eye, MoreVertical,
  Copy, CheckCircle2, Zap, TrendingUp, Layers,
  Link2, BarChart3, Crosshair, Settings2, Palette, Star,
  ExternalLink, ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState, GlassKpi } from "@/components/PageShell";
import PixelSettingsDialog from "@/components/PixelSettingsDialog";
import type { Tables } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

export default function Produtos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: products = [], refetch: loadProducts } = useProducts();
  const [pixelProduct, setPixelProduct] = useState<Tables<"products"> | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeProducts = products.filter(p => p.status === "active").length;
  const totalValue = products.reduce((a, p) => a + Number(p.price), 0);

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (!window.confirm("Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("products").delete().eq("id", id).eq("user_id", user.id);
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
  const statusColor = (s: string) =>
    s === "active" ? "text-success bg-success/10 border-success/20" :
    s === "inactive" ? "text-destructive bg-destructive/10 border-destructive/20" :
    "text-warning bg-warning/10 border-warning/20";
  const statusDot = (s: string) => s === "active" ? "bg-success" : s === "inactive" ? "bg-destructive" : "bg-warning";

  const fmtPrice = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <PageShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <PageTitle icon={<Package className="h-6 w-6" />} title="Meus Produtos" subtitle="Gerencie seu catálogo de infoprodutos" />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <Button onClick={() => navigate("/vendas/produtos/novo/editar")} className="gap-2 rounded-xl text-sm font-semibold h-10 px-5 shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" /> Novo Produto
          </Button>
        </motion.div>
      </div>

      {/* KPI Cards */}
      {products.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <GlassKpi label="Produtos" value={String(products.length)} icon={Layers} tone="primary" delay={0} />
          <GlassKpi label="Ativos" value={String(activeProducts)} icon={Zap} tone="success" delay={1} />
          <GlassKpi label="Ticket Médio" value={fmtPrice(totalValue / (products.length || 1))} icon={TrendingUp} tone="info" delay={2} />
          <GlassKpi label="Catálogo Total" value={fmtPrice(totalValue)} icon={BarChart3} tone="warning" delay={3} />
        </div>
      )}

      {products.length === 0 ? (
        <EmptyState
          icon={<Package className="h-7 w-7" />}
          title="Nenhum produto criado"
          subtitle="Crie seu primeiro infoproduto para começar a vender."
          action={
            <Button onClick={() => navigate("/vendas/produtos/novo/editar")} size="sm" className="gap-2 rounded-xl shadow-lg shadow-primary/20">
              <Plus className="h-3.5 w-3.5" /> Criar Produto
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {products.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.06, 0.4), ease: [0.16, 1, 0.3, 1] }}
              className="group relative rounded-2xl bg-card/80 backdrop-blur-xl border border-border/30 overflow-hidden flex flex-col hover:border-primary/25 hover:shadow-2xl hover:shadow-primary/[0.06] transition-all duration-300 active:scale-[0.985]"
            >
              {/* Image area */}
              <div className="relative h-48 overflow-hidden bg-gradient-to-br from-muted/30 to-muted/5">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/[0.03] to-muted/10">
                    <div className="h-16 w-16 rounded-2xl bg-muted/20 flex items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground/15" />
                    </div>
                  </div>
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent opacity-80" />

                {/* Status badge - top right */}
                <div className="absolute top-3 right-3 z-10">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold backdrop-blur-xl border shadow-lg",
                    statusColor(p.status)
                  )}>
                    <span className={cn("h-1.5 w-1.5 rounded-full shadow-[0_0_6px_currentColor]", statusDot(p.status))} />
                    {statusLabel(p.status)}
                  </span>
                </div>

                {/* Dropdown - top left */}
                <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-8 w-8 rounded-xl bg-card/80 backdrop-blur-xl border border-border/30 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors shadow-lg">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="bottom" className="w-52">
                      {p.checkout_url && (
                        <DropdownMenuItem onClick={() => window.open(getCheckoutLink(p.checkout_url!), "_blank")} className="gap-2 cursor-pointer text-xs">
                          <Eye className="h-3.5 w-3.5" /> Ver Checkout
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => copyCheckout(p)} className="gap-2 cursor-pointer text-xs">
                        <Copy className="h-3.5 w-3.5" /> Copiar Link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPixelProduct(p)} className="gap-2 cursor-pointer text-xs">
                        <Crosshair className="h-3.5 w-3.5" /> Configurar Pixels
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.info("Área de membros disponível no Conteúdo")} className="gap-2 cursor-pointer text-xs">
                        <Star className="h-3.5 w-3.5" /> Área de Membros
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleDelete(p.id)} className="gap-2 cursor-pointer text-destructive focus:text-destructive text-xs">
                        <Trash2 className="h-3.5 w-3.5" /> Excluir Produto
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Price tag - bottom right, floating */}
                <div className="absolute bottom-3 right-3 z-10">
                  <span className="inline-flex items-center gap-1 rounded-xl bg-card/90 backdrop-blur-xl border border-border/30 px-3 py-1.5 shadow-xl">
                    <span className="text-[10px] text-muted-foreground/60 font-semibold">R$</span>
                    <span className="text-lg font-display font-black tracking-tight text-primary">{Number(p.price).toFixed(2)}</span>
                  </span>
                </div>
              </div>

              {/* Content body */}
              <div className="p-5 flex flex-1 flex-col gap-3">
                {/* Title & description */}
                <div className="space-y-1">
                  <h3 className="text-[15px] font-display font-black text-foreground leading-snug tracking-[-0.02em] line-clamp-1">
                    {p.name}
                  </h3>
                  {p.description
                    ? <p className="text-xs text-muted-foreground/50 line-clamp-2 leading-relaxed">{p.description}</p>
                    : <p className="text-xs text-muted-foreground/20 italic">Sem descrição adicionada</p>
                  }
                </div>

                {/* Checkout link row */}
                {p.checkout_url && (
                  <button
                    onClick={() => copyCheckout(p)}
                    className="flex items-center gap-2.5 rounded-xl bg-muted/10 border border-border/20 px-3 py-2.5 hover:bg-primary/[0.04] hover:border-primary/20 transition-all duration-200 w-full group/link"
                  >
                    <div className="h-6 w-6 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                      <Link2 className="h-3 w-3 text-primary/60 group-hover/link:text-primary transition-colors" />
                    </div>
                    <span className="text-[10px] text-muted-foreground/40 font-mono truncate flex-1 text-left group-hover/link:text-primary/60 transition-colors">
                      {getCheckoutLink(p.checkout_url)}
                    </span>
                    {copiedId === p.id
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                      : <Copy className="h-3 w-3 text-muted-foreground/25 shrink-0 group-hover/link:text-primary/50 transition-colors" />
                    }
                  </button>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1 border-t border-border/10">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 rounded-xl text-[11px] h-9 font-bold flex-1 bg-primary/[0.06] text-primary hover:bg-primary/[0.12] border border-primary/10 hover:border-primary/20 transition-all duration-200"
                    onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
                  >
                    <Settings2 className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 rounded-xl text-[11px] h-9 font-bold flex-1 bg-muted/10 text-muted-foreground hover:text-foreground hover:bg-muted/20 border border-border/10 hover:border-border/30 transition-all duration-200"
                    onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)}
                  >
                    <Palette className="h-3.5 w-3.5" /> Builder
                  </Button>
                  {p.checkout_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl h-9 w-9 p-0 text-muted-foreground/40 hover:text-primary hover:bg-primary/[0.06] border border-border/10 hover:border-primary/15 transition-all duration-200"
                      onClick={() => window.open(getCheckoutLink(p.checkout_url!), "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {/* Add new product ghost card */}
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(products.length * 0.06, 0.4), ease: [0.16, 1, 0.3, 1] }}
            onClick={() => navigate("/vendas/produtos/novo/editar")}
            className="rounded-2xl border-2 border-dashed border-border/15 hover:border-primary/25 hover:bg-primary/[0.02] flex flex-col items-center justify-center gap-4 min-h-[360px] transition-all duration-300 group/add active:scale-[0.985]"
          >
            <div className="h-16 w-16 rounded-2xl bg-primary/[0.04] group-hover/add:bg-primary/[0.08] border border-primary/10 group-hover/add:border-primary/20 flex items-center justify-center transition-all duration-300">
              <Plus className="h-7 w-7 text-primary/30 group-hover/add:text-primary/60 transition-colors duration-300" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-display font-bold text-muted-foreground/40 group-hover/add:text-foreground/70 transition-colors">Novo Produto</p>
              <p className="text-[11px] text-muted-foreground/25 group-hover/add:text-muted-foreground/40 transition-colors">Clique para adicionar</p>
            </div>
          </motion.button>
        </div>
      )}

      {pixelProduct && <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={(v) => { if (!v) setPixelProduct(null); }} />}
    </PageShell>
  );
}
