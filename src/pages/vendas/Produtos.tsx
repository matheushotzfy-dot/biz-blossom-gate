import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useQueryData";
import {
  Package, Plus, Trash2, Eye, MoreVertical,
  Copy, CheckCircle2, Zap, TrendingUp, Layers,
  Link2, BarChart3, Crosshair, Settings2, Palette, Star,
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
  const statusColor = (s: string) => s === "active" ? "bg-success/10 text-success" : s === "inactive" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning";
  const statusDot = (s: string) => s === "active" ? "bg-success" : s === "inactive" ? "bg-destructive" : "bg-warning";

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
          <GlassKpi label="Ticket Médio" value={`R$ ${(totalValue / (products.length || 1)).toFixed(0)}`} icon={TrendingUp} tone="info" delay={2} />
          <GlassKpi label="Catálogo Total" value={`R$ ${totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} icon={BarChart3} tone="warning" delay={3} />
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.06, 0.4) }}
              className={cn(
                "group relative rounded-2xl bg-card/60 backdrop-blur-xl border border-border/40 overflow-hidden flex flex-col hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 border-l-[3px]",
                p.status === "active" ? "border-l-success" : p.status === "inactive" ? "border-l-destructive" : "border-l-warning"
              )}
            >
              {/* Image */}
              <div className="relative h-44 overflow-hidden bg-gradient-to-br from-muted/20 to-muted/5">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-14 w-14 text-muted-foreground/8" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />

                <div className="absolute top-3 right-3">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold backdrop-blur-md shadow-sm border border-border/20 bg-card/80", statusColor(p.status))}>
                    <span className={cn("h-2 w-2 rounded-full animate-pulse shadow-[0_0_6px_currentColor]", statusDot(p.status))} />
                    {statusLabel(p.status)}
                  </span>
                </div>

                <div className="absolute bottom-3 left-3">
                  <span className="inline-flex items-center gap-1 rounded-xl bg-card/90 backdrop-blur-md border border-border/20 px-3 py-1.5 text-base font-display font-black text-primary shadow-lg">
                    R$ {Number(p.price).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 flex flex-1 flex-col">
                <h3 className="text-base font-bold text-foreground leading-snug line-clamp-1 mb-1">{p.name}</h3>
                {p.description
                  ? <p className="text-xs text-muted-foreground/60 line-clamp-2 mb-3 leading-relaxed">{p.description}</p>
                  : <p className="text-xs text-muted-foreground/25 italic mb-3">Sem descrição</p>
                }

                {/* Checkout link */}
                {p.checkout_url && (
                  <button onClick={() => copyCheckout(p)} className="flex items-center gap-2 rounded-xl bg-muted/15 border border-border/20 px-3 py-2 mb-3 hover:bg-primary/5 hover:border-primary/20 transition-all duration-200 w-full group/link">
                    <Link2 className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                    <span className="text-[10px] text-muted-foreground/50 font-mono truncate flex-1 text-left group-hover/link:text-primary/70 transition-colors">{getCheckoutLink(p.checkout_url)}</span>
                    {copiedId === p.id
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                      : <Copy className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 group-hover/link:text-primary transition-colors" />
                    }
                  </button>
                )}

                {/* Actions row */}
                <div className="flex items-center gap-1.5 mt-auto pt-1">
                  <Button
                    variant="ghost" size="sm"
                    className="gap-1.5 rounded-lg text-[11px] h-8 font-semibold text-primary bg-primary/5 hover:bg-primary/10 transition-colors flex-1"
                    onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)}
                  >
                    <Palette className="h-3 w-3" /> Builder
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="gap-1.5 rounded-lg text-[11px] h-8 font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex-1"
                    onClick={() => navigate(`/vendas/produtos/${p.id}/editar`)}
                  >
                    <Settings2 className="h-3 w-3" /> Configurar
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="rounded-lg h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="top" className="w-52">
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
              </div>
            </motion.div>
          ))}

          {/* Add ghost card */}
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(products.length * 0.06, 0.4) }}
            onClick={() => navigate("/vendas/produtos/novo/editar")}
            className="rounded-2xl border-2 border-dashed border-border/20 hover:border-primary/30 hover:bg-primary/[0.02] flex flex-col items-center justify-center gap-3 min-h-[320px] transition-all duration-300 group/add"
          >
            <div className="h-14 w-14 rounded-2xl bg-primary/5 group-hover/add:bg-primary/10 flex items-center justify-center transition-colors">
              <Plus className="h-6 w-6 text-primary/40 group-hover/add:text-primary transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-muted-foreground/50 group-hover/add:text-foreground transition-colors">Novo Produto</p>
              <p className="text-[11px] text-muted-foreground/30">Clique para adicionar</p>
            </div>
          </motion.button>
        </div>
      )}

      {pixelProduct && <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={(v) => { if (!v) setPixelProduct(null); }} />}
    </PageShell>
  );
}
