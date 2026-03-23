import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts, useInvalidateAll } from "@/hooks/useQueryData";
import {
  Package, Plus, Edit, Trash2, ExternalLink, ImagePlus, X, Crosshair, Eye, MoreVertical,
  Copy, CheckCircle2, DollarSign, Tag, Palette, Sparkles, ShoppingCart, TrendingUp, Layers,
  Users, Share2, ArrowUpRight, Shield, Clock, Zap, Link2, Gift, Lock, Globe, BarChart3,
  Percent, UserPlus, Handshake, Repeat, Timer, FileCheck, Star, Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState } from "@/components/PageShell";
import PixelSettingsDialog from "@/components/PixelSettingsDialog";
import type { Tables } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/* ─── Feature Pill ─── */
function FeaturePill({ icon: Icon, label, active, onClick, color = "primary" }: {
  icon: React.ComponentType<{ className?: string }>; label: string; active?: boolean; onClick?: () => void; color?: string;
}) {
  const colorMap: Record<string, { active: string; inactive: string }> = {
    primary: { active: "bg-primary/10 text-primary border-primary/20", inactive: "bg-muted/10 text-muted-foreground border-border/30 hover:border-primary/20 hover:text-primary" },
    success: { active: "bg-success/10 text-success border-success/20", inactive: "bg-muted/10 text-muted-foreground border-border/30 hover:border-success/20 hover:text-success" },
    warning: { active: "bg-warning/10 text-warning border-warning/20", inactive: "bg-muted/10 text-muted-foreground border-border/30 hover:border-warning/20 hover:text-warning" },
    info: { active: "bg-info/10 text-info border-info/20", inactive: "bg-muted/10 text-muted-foreground border-border/30 hover:border-info/20 hover:text-info" },
  };
  const c = colorMap[color] || colorMap.primary;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold transition-all duration-200", active ? c.active : c.inactive)}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

/* ─── Section in Sheet ─── */
function SheetSection({ icon: Icon, title, children, color = "primary" }: {
  icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode; color?: string;
}) {
  const colorMap: Record<string, string> = { primary: "bg-primary/10 text-primary", success: "bg-success/10 text-success", warning: "bg-warning/10 text-warning", info: "bg-info/10 text-info" };
  return (
    <div className="rounded-xl border border-border/30 p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", colorMap[color] || colorMap.primary)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs font-bold text-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function Produtos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: products = [], refetch: loadProducts } = useProducts();
  const invalidateAll = useInvalidateAll();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", status: "pending_review", page_url: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pixelProduct, setPixelProduct] = useState<Tables<"products"> | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Feature toggles (UI state for sheet)
  const [upsellEnabled, setUpsellEnabled] = useState(false);
  const [affiliateEnabled, setAffiliateEnabled] = useState(false);
  const [affiliateCommission, setAffiliateCommission] = useState("30");
  const [coProductionEnabled, setCoProductionEnabled] = useState(false);
  const [coProductionSplit, setCoProductionSplit] = useState("50");
  const [warrantyDays, setWarrantyDays] = useState("7");
  const [accessExpiry, setAccessExpiry] = useState("lifetime");
  const [maxSales, setMaxSales] = useState("");
  const [deliveryType, setDeliveryType] = useState("digital");
  const [memberAreaEnabled, setMemberAreaEnabled] = useState(false);

  const activeProducts = products.filter(p => p.status === "active").length;
  const totalValue = products.reduce((a, p) => a + Number(p.price), 0);

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast.error("Formato inválido. Use JPEG, PNG, WebP ou GIF"); return null; }
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) { toast.error("Erro ao enviar imagem"); return null; }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 1) { toast.error("Preço mínimo é R$ 1,00"); return; }
    if (price > 99999.99) { toast.error("Preço máximo é R$ 99.999,99"); return; }
    setUploading(true);
    let imageUrl: string | null = null;
    if (imageFile) imageUrl = await uploadImage(imageFile);
    try {
      const affiliateData = {
        affiliate_enabled: affiliateEnabled,
        affiliate_commission: Number(affiliateCommission) || 30,
        co_production_enabled: coProductionEnabled,
        co_producer_email: coProductionEnabled ? (form as any).co_producer_email || null : null,
        co_production_split: Number(coProductionSplit) || 50,
      };
      if (editId) {
        const updateData: Record<string, unknown> = { name: form.name, description: form.description, price, status: form.status, page_url: form.page_url || null, ...affiliateData };
        if (imageUrl) updateData.image_url = imageUrl;
        const { error } = await supabase.from("products").update(updateData).eq("id", editId).eq("user_id", user.id);
        if (error) { toast.error("Erro ao atualizar"); return; }
        toast.success("Produto atualizado!");
      } else {
        const slug = crypto.randomUUID().slice(0, 8);
        const checkoutUrl = `${window.location.origin}/pay/${slug}`;
        const { error } = await supabase.from("products").insert({ name: form.name, description: form.description, price, user_id: user.id, checkout_url: checkoutUrl, image_url: imageUrl, status: form.status, page_url: form.page_url || null, ...affiliateData } as any);
        if (error) { toast.error("Erro ao criar produto"); return; }
        toast.success("Produto criado!");
      }
      resetForm(); loadProducts();
    } finally { setUploading(false); }
  };

  const resetForm = () => {
    setOpen(false); setEditId(null);
    setForm({ name: "", description: "", price: "", status: "pending_review", page_url: "" });
    setImageFile(null); setImagePreview(null);
    setUpsellEnabled(false); setAffiliateEnabled(false); setCoProductionEnabled(false);
    setAffiliateCommission("30"); setCoProductionSplit("50"); setWarrantyDays("7");
    setAccessExpiry("lifetime"); setMaxSales(""); setDeliveryType("digital"); setMemberAreaEnabled(false);
  };

  const handleEdit = (p: Tables<"products">) => {
    setEditId(p.id);
    setForm({ name: p.name, description: p.description || "", price: String(p.price), status: p.status, page_url: p.page_url || "" });
    setImagePreview(p.image_url || null); setImageFile(null);
    // Load affiliate/co-production settings from product
    setAffiliateEnabled((p as any).affiliate_enabled || false);
    setAffiliateCommission(String((p as any).affiliate_commission || 30));
    setCoProductionEnabled((p as any).co_production_enabled || false);
    setCoProductionSplit(String((p as any).co_production_split || 50));
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (!window.confirm("Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("products").delete().eq("id", id).eq("user_id", user.id);
    if (error) { toast.error("Erro ao excluir produto"); return; }
    toast.success("Produto removido"); loadProducts();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast.error("Formato inválido"); return; }
    if (file.size > MAX_FILE_SIZE) { toast.error("Máximo 5MB"); return; }
    setImageFile(file); setImagePreview(URL.createObjectURL(file));
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
          <Button onClick={() => setOpen(true)} className="gap-2 rounded-xl text-sm font-semibold h-10 px-5 shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" /> Novo Produto
          </Button>
        </motion.div>
      </div>

      {/* KPI Cards */}
      {products.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Produtos", value: String(products.length), icon: Layers, tone: "primary" },
            { label: "Ativos", value: String(activeProducts), icon: Zap, tone: "success" },
            { label: "Ticket Médio", value: `R$ ${(totalValue / (products.length || 1)).toFixed(0)}`, icon: TrendingUp, tone: "info" },
            { label: "Catálogo Total", value: `R$ ${totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`, icon: BarChart3, tone: "warning" },
          ].map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group relative rounded-2xl bg-card/60 backdrop-blur-xl border border-border/40 p-4 md:p-5 overflow-hidden hover:border-primary/20 transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">{kpi.label}</span>
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center",
                  kpi.tone === "primary" ? "bg-primary/10" : kpi.tone === "success" ? "bg-success/10" : kpi.tone === "info" ? "bg-info/10" : "bg-warning/10"
                )}>
                  <kpi.icon className={cn("h-3.5 w-3.5",
                    kpi.tone === "primary" ? "text-primary" : kpi.tone === "success" ? "text-success" : kpi.tone === "info" ? "text-info" : "text-warning"
                  )} />
                </div>
              </div>
              <p className="text-xl md:text-2xl font-display font-black text-foreground tracking-tight">{kpi.value}</p>
            </motion.div>
          ))}
        </div>
      )}

      {products.length === 0 ? (
        <EmptyState
          icon={<Package className="h-7 w-7" />}
          title="Nenhum produto criado"
          subtitle="Crie seu primeiro infoproduto para começar a vender."
          action={
            <Button onClick={() => setOpen(true)} size="sm" className="gap-2 rounded-xl shadow-lg shadow-primary/20">
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
              className="group relative rounded-2xl bg-card/60 backdrop-blur-xl border border-border/40 overflow-hidden flex flex-col hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
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

                {/* Status */}
                <div className="absolute top-3 right-3">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold backdrop-blur-md shadow-sm", statusColor(p.status))}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(p.status))} />
                    {statusLabel(p.status)}
                  </span>
                </div>

                {/* Price */}
                <div className="absolute bottom-3 left-3">
                  <span className="inline-flex items-center gap-1 rounded-xl bg-card/90 backdrop-blur-md border border-border/20 px-3 py-1.5 text-base font-display font-black text-primary shadow-lg">
                    R$ {Number(p.price).toFixed(2)}
                  </span>
                </div>

                {/* Quick actions overlay */}
                <div className="absolute top-3 left-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button onClick={() => handleEdit(p)} className="h-7 w-7 rounded-lg bg-card/90 backdrop-blur-md border border-border/20 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors shadow-sm">
                    <Edit className="h-3 w-3" />
                  </button>
                  <button onClick={() => setPixelProduct(p)} className="h-7 w-7 rounded-lg bg-card/90 backdrop-blur-md border border-border/20 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors shadow-sm">
                    <Crosshair className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 flex flex-1 flex-col">
                <h3 className="text-base font-bold text-foreground leading-snug line-clamp-1 mb-1">{p.name}</h3>
                {p.description
                  ? <p className="text-xs text-muted-foreground/60 line-clamp-2 mb-3 leading-relaxed">{p.description}</p>
                  : <p className="text-xs text-muted-foreground/25 italic mb-3">Sem descrição</p>
                }

                {/* Feature badges */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/5 text-[9px] font-semibold text-primary/60">
                    <Shield className="h-2.5 w-2.5" /> Garantia 7d
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-info/5 text-[9px] font-semibold text-info/60">
                    <Globe className="h-2.5 w-2.5" /> Digital
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-success/5 text-[9px] font-semibold text-success/60">
                    <Zap className="h-2.5 w-2.5" /> Entrega Imediata
                  </span>
                </div>

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
                    onClick={() => handleEdit(p)}
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
            onClick={() => setOpen(true)}
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

      {/* Create/Edit Sheet — Premium Enterprise Design */}
      <Sheet open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(v); }}>
        <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto border-border/20 bg-background/95 backdrop-blur-2xl p-0">
          {/* Hero Header */}
          <div className="sticky top-0 z-10 bg-gradient-to-b from-background via-background to-background/0 px-6 pt-6 pb-4">
            <SheetHeader className="mb-0">
              <SheetTitle className="flex items-center gap-4 text-lg">
                <div className="relative">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-xl shadow-primary/10 border border-primary/10">
                    {editId ? <Edit className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-primary/80 border-2 border-background flex items-center justify-center">
                    <Sparkles className="h-2 w-2 text-primary-foreground" />
                  </div>
                </div>
                <div>
                  <span className="block text-base font-bold">{editId ? "Configurar Produto" : "Novo Produto"}</span>
                  <span className="block text-[11px] text-muted-foreground/60 font-normal">
                    {editId ? "Edite as informações e funcionalidades" : "Preencha os dados para criar seu produto"}
                  </span>
                </div>
              </SheetTitle>
            </SheetHeader>
            <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent mt-4" />
          </div>

          <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">
            {/* ── ESSENTIALS SECTION ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-primary" />
                <span className="text-[10px] font-black text-muted-foreground/70 uppercase tracking-[0.2em]">Informações Essenciais</span>
              </div>

              {/* Image Upload — Premium Card */}
              <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm overflow-hidden">
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} className="hidden" />
                {imagePreview ? (
                  <div className="relative group/img">
                    <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm opacity-0 group-hover/img:opacity-100 transition-all duration-300 flex items-center justify-center gap-3">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="h-11 w-11 rounded-xl bg-card/90 border border-border/30 flex items-center justify-center text-foreground hover:bg-primary/10 hover:border-primary/20 shadow-xl transition-all duration-200 active:scale-95">
                        <ImagePlus className="h-4.5 w-4.5" />
                      </button>
                      <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }} className="h-11 w-11 rounded-xl bg-card/90 border border-border/30 flex items-center justify-center text-destructive hover:bg-destructive/10 hover:border-destructive/20 shadow-xl transition-all duration-200 active:scale-95">
                        <X className="h-4.5 w-4.5" />
                      </button>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-foreground/70 bg-card/60 backdrop-blur-md rounded-lg px-2.5 py-1 border border-border/10">
                        <CheckCircle2 className="h-3 w-3 text-primary" /> Imagem carregada
                      </span>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-40 flex flex-col items-center justify-center gap-3 text-muted-foreground/40 hover:text-primary/60 transition-all duration-300 group/upload hover:bg-primary/[0.02]">
                    <div className="h-14 w-14 rounded-2xl bg-muted/10 group-hover/upload:bg-primary/10 flex items-center justify-center transition-all duration-300 group-hover/upload:scale-105 border border-border/10 group-hover/upload:border-primary/20">
                      <ImagePlus className="h-6 w-6" />
                    </div>
                    <div className="text-center">
                      <span className="block text-xs font-semibold">Adicionar imagem</span>
                      <span className="block text-[10px] text-muted-foreground/30 mt-0.5">JPEG, PNG, WebP ou GIF — até 5MB</span>
                    </div>
                  </button>
                )}
              </div>

              {/* Name + Price — Glass cards */}
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-3 space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.14em] flex items-center gap-1.5">
                    <Package className="h-3 w-3" /> Nome do Produto
                  </Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Curso de Marketing Digital" className="h-11 rounded-xl bg-card/40 border-border/20 focus:border-primary/30" required maxLength={200} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.14em] flex items-center gap-1.5">
                    <DollarSign className="h-3 w-3" /> Preço (R$)
                  </Label>
                  <Input type="number" step="0.01" min="1.00" max="99999.99" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="97.00" className="h-11 rounded-xl bg-card/40 border-border/20 focus:border-primary/30 font-semibold" required />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.14em]">Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Descreva brevemente seu produto..." className="rounded-xl bg-card/40 border-border/20 focus:border-primary/30 resize-none" maxLength={2000} />
              </div>

              {/* Page URL + Status */}
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-3 space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.14em] flex items-center gap-1.5">
                    <ExternalLink className="h-3 w-3" /> Página de Vendas
                  </Label>
                  <Input value={form.page_url} onChange={(e) => setForm({ ...form, page_url: e.target.value })} placeholder="https://..." className="h-11 rounded-xl bg-card/40 border-border/20 focus:border-primary/30" type="url" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.14em] flex items-center gap-1.5">
                    <Tag className="h-3 w-3" /> Status
                  </Label>
                  <div className={cn(
                    "flex items-center gap-2.5 h-11 px-3.5 rounded-xl border transition-all duration-200",
                    form.status === "active"
                      ? "bg-primary/5 border-primary/15"
                      : "bg-card/40 border-border/20"
                  )}>
                    <Switch checked={form.status === "active"} onCheckedChange={(v) => setForm({ ...form, status: v ? "active" : "inactive" })} />
                    <span className={cn("text-xs font-bold tracking-wide", form.status === "active" ? "text-primary" : "text-muted-foreground/50")}>
                      {form.status === "active" ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── DIVIDER ── */}
            <div className="relative py-1">
              <div className="h-px bg-gradient-to-r from-transparent via-border/30 to-transparent" />
              <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 top-1/2 bg-background px-3 flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-primary/60" />
                <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.25em]">Avançado</span>
                <Sparkles className="h-3 w-3 text-primary/60" />
              </div>
            </div>

            {/* ── ADVANCED FEATURES ── */}
            <div className="space-y-3">

              {/* Upsell / Order Bump */}
              <div className={cn(
                "group rounded-2xl border p-4 transition-all duration-300",
                upsellEnabled
                  ? "bg-warning/[0.03] border-warning/15 shadow-sm shadow-warning/5"
                  : "bg-card/20 border-border/15 hover:border-border/30"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-300",
                      upsellEnabled ? "bg-warning/10 shadow-sm shadow-warning/10" : "bg-muted/10"
                    )}>
                      <ArrowUpRight className={cn("h-4 w-4 transition-colors", upsellEnabled ? "text-warning" : "text-muted-foreground/40")} />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-foreground">Order Bump</p>
                      <p className="text-[10px] text-muted-foreground/50">Ofertas complementares no checkout</p>
                    </div>
                  </div>
                  <Switch checked={upsellEnabled} onCheckedChange={setUpsellEnabled} />
                </div>
                {upsellEnabled && (
                  <div className="mt-3 rounded-xl bg-warning/5 border border-warning/10 p-3 flex items-start gap-2.5">
                    <Palette className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-warning/80 font-medium">Configure os Order Bumps diretamente no Checkout Builder.</p>
                      {editId && (
                        <Button type="button" variant="ghost" size="sm" className="mt-1.5 h-7 text-[10px] text-warning hover:text-warning gap-1.5 px-2 -ml-2" onClick={() => { resetForm(); navigate(`/vendas/produtos/${editId}/checkout-builder`); }}>
                          <ArrowUpRight className="h-3 w-3" /> Abrir Builder
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Affiliates */}
              <div className={cn(
                "group rounded-2xl border p-4 transition-all duration-300",
                affiliateEnabled
                  ? "bg-success/[0.03] border-success/15 shadow-sm shadow-success/5"
                  : "bg-card/20 border-border/15 hover:border-border/30"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-300",
                      affiliateEnabled ? "bg-success/10 shadow-sm shadow-success/10" : "bg-muted/10"
                    )}>
                      <Users className={cn("h-4 w-4 transition-colors", affiliateEnabled ? "text-success" : "text-muted-foreground/40")} />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-foreground">Programa de Afiliados</p>
                      <p className="text-[10px] text-muted-foreground/50">Permita outros venderem por você</p>
                    </div>
                  </div>
                  <Switch checked={affiliateEnabled} onCheckedChange={setAffiliateEnabled} />
                </div>
                {affiliateEnabled && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Comissão</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Input type="number" min="1" max="80" value={affiliateCommission} onChange={(e) => setAffiliateCommission(e.target.value)} className="h-9 rounded-xl w-20 bg-card/40 border-border/20 text-center font-bold" />
                          <span className="text-[11px] text-muted-foreground/50">% por venda</span>
                        </div>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
                        <span className="text-sm font-black text-success">{affiliateCommission}%</span>
                      </div>
                    </div>
                    <div className="rounded-xl bg-success/5 border border-success/10 p-2.5">
                      <p className="text-[10px] text-success/70">Afiliados receberão <strong className="text-success">{affiliateCommission}%</strong> de cada venda. Você fica com <strong className="text-success">{100 - Number(affiliateCommission || 0)}%</strong>.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Co-Production */}
              <div className={cn(
                "group rounded-2xl border p-4 transition-all duration-300",
                coProductionEnabled
                  ? "bg-info/[0.03] border-info/15 shadow-sm shadow-info/5"
                  : "bg-card/20 border-border/15 hover:border-border/30"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-300",
                      coProductionEnabled ? "bg-info/10 shadow-sm shadow-info/10" : "bg-muted/10"
                    )}>
                      <Handshake className={cn("h-4 w-4 transition-colors", coProductionEnabled ? "text-info" : "text-muted-foreground/40")} />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-foreground">Co-Produção</p>
                      <p className="text-[10px] text-muted-foreground/50">Divida a receita com parceiros</p>
                    </div>
                  </div>
                  <Switch checked={coProductionEnabled} onCheckedChange={setCoProductionEnabled} />
                </div>
                {coProductionEnabled && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Split de Receita</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Input type="number" min="1" max="99" value={coProductionSplit} onChange={(e) => setCoProductionSplit(e.target.value)} className="h-9 rounded-xl w-20 bg-card/40 border-border/20 text-center font-bold" />
                          <span className="text-[11px] text-muted-foreground/50">% para o co-produtor</span>
                        </div>
                      </div>
                    </div>
                    {/* Visual split bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-primary">Você: {100 - Number(coProductionSplit || 0)}%</span>
                        <span className="text-info">Parceiro: {coProductionSplit}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/20 overflow-hidden flex">
                        <div className="bg-primary/60 rounded-l-full transition-all duration-500" style={{ width: `${100 - Number(coProductionSplit || 0)}%` }} />
                        <div className="bg-info/60 rounded-r-full transition-all duration-500" style={{ width: `${Number(coProductionSplit || 0)}%` }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Warranty */}
              <div className="rounded-2xl border bg-card/20 border-border/15 hover:border-border/30 p-4 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-300",
                      Number(warrantyDays) > 0 ? "bg-primary/10 shadow-sm shadow-primary/10" : "bg-muted/10"
                    )}>
                      <Shield className={cn("h-4 w-4 transition-colors", Number(warrantyDays) > 0 ? "text-primary" : "text-muted-foreground/40")} />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-foreground">Garantia</p>
                      <p className="text-[10px] text-muted-foreground/50">Selo de confiança no checkout</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" min="0" max="365" value={warrantyDays} onChange={(e) => setWarrantyDays(e.target.value)} className="h-9 rounded-xl w-16 bg-card/40 border-border/20 text-center text-sm font-bold" />
                    <span className="text-[10px] text-muted-foreground/40 font-medium">dias</span>
                  </div>
                </div>
              </div>

              {/* Access & Delivery */}
              <div className="rounded-2xl border bg-card/20 border-border/15 hover:border-border/30 p-4 space-y-4 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-info/10 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-info" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-foreground">Acesso & Entrega</p>
                    <p className="text-[10px] text-muted-foreground/50">Tipo de produto e prazo de acesso</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider mb-2 block">Tipo de Entrega</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: "digital", label: "Digital", icon: Globe },
                        { value: "physical", label: "Físico", icon: Package },
                        { value: "hybrid", label: "Híbrido", icon: Repeat },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setDeliveryType(opt.value)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-[11px] font-semibold transition-all duration-200 active:scale-[0.98]",
                            deliveryType === opt.value
                              ? "bg-primary/10 border-primary/20 text-primary shadow-sm shadow-primary/5"
                              : "border-border/15 text-muted-foreground/50 hover:border-border/30 hover:text-foreground bg-card/20"
                          )}
                        >
                          <opt.icon className="h-4 w-4" />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider mb-2 block">Expiração do Acesso</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: "lifetime", label: "Vitalício" },
                        { value: "1year", label: "1 Ano" },
                        { value: "6months", label: "6 Meses" },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setAccessExpiry(opt.value)}
                          className={cn(
                            "px-3 py-2.5 rounded-xl border text-[11px] font-semibold transition-all duration-200 active:scale-[0.98]",
                            accessExpiry === opt.value
                              ? "bg-primary/10 border-primary/20 text-primary shadow-sm shadow-primary/5"
                              : "border-border/15 text-muted-foreground/50 hover:border-border/30 hover:text-foreground bg-card/20"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Scarcity & Member Area */}
              <div className="rounded-2xl border bg-card/20 border-border/15 hover:border-border/30 p-4 space-y-4 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-warning/10 flex items-center justify-center">
                    <Lock className="h-4 w-4 text-warning" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-foreground">Escassez & Membros</p>
                    <p className="text-[10px] text-muted-foreground/50">Limite de vendas e área exclusiva</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider">Limite de Vendas</Label>
                    <div className="flex items-center gap-2.5 mt-1.5">
                      <Input type="number" min="0" value={maxSales} onChange={(e) => setMaxSales(e.target.value)} placeholder="∞" className="h-9 rounded-xl w-24 bg-card/40 border-border/20 text-center font-bold" />
                      <span className={cn("text-[11px] font-medium", maxSales ? "text-warning/70" : "text-muted-foreground/30")}>
                        {maxSales ? `máx. ${maxSales} vendas` : "Sem limite (ilimitado)"}
                      </span>
                    </div>
                  </div>
                  <div className="h-px bg-border/10" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Star className={cn("h-4 w-4 transition-colors", memberAreaEnabled ? "text-warning" : "text-muted-foreground/30")} />
                      <div>
                        <p className="text-[12px] font-bold text-foreground">Área de Membros</p>
                        <p className="text-[10px] text-muted-foreground/40">Vincular a conteúdo exclusivo</p>
                      </div>
                    </div>
                    <Switch checked={memberAreaEnabled} onCheckedChange={setMemberAreaEnabled} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── SUBMIT BUTTON ── */}
            <div className="pt-3 pb-2">
              <Button type="submit" className="w-full h-12 rounded-2xl font-bold text-sm shadow-xl shadow-primary/15 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 active:scale-[0.98] transition-all duration-200" disabled={uploading}>
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                    Enviando...
                  </span>
                ) : editId ? (
                  <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Salvar Alterações</span>
                ) : (
                  <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> Criar Produto</span>
                )}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {pixelProduct && <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={(v) => { if (!v) setPixelProduct(null); }} />}
    </PageShell>
  );
}
