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
      if (editId) {
        const updateData: Record<string, unknown> = { name: form.name, description: form.description, price, status: form.status, page_url: form.page_url || null };
        if (imageUrl) updateData.image_url = imageUrl;
        const { error } = await supabase.from("products").update(updateData).eq("id", editId).eq("user_id", user.id);
        if (error) { toast.error("Erro ao atualizar"); return; }
        toast.success("Produto atualizado!");
      } else {
        const slug = crypto.randomUUID().slice(0, 8);
        const checkoutUrl = `${window.location.origin}/pay/${slug}`;
        const { error } = await supabase.from("products").insert({ name: form.name, description: form.description, price, user_id: user.id, checkout_url: checkoutUrl, image_url: imageUrl, status: form.status, page_url: form.page_url || null });
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
    setImagePreview(p.image_url || null); setImageFile(null); setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("products").delete().eq("id", id).eq("user_id", user.id);
    if (error) { toast.error("Erro"); return; }
    toast.success("Removido"); loadProducts();
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

      {/* Create/Edit Sheet — Wide with advanced features */}
      <Sheet open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(v); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto border-border/40">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-3 text-lg">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-lg shadow-primary/10">
                {editId ? <Edit className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-primary" />}
              </div>
              {editId ? "Configurar Produto" : "Novo Produto"}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Image */}
            <div>
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] mb-2.5 block">Imagem do Produto</Label>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} className="hidden" />
              {imagePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-border/30 group/img shadow-lg">
                  <img src={imagePreview} alt="Preview" className="w-full h-44 object-cover" />
                  <div className="absolute inset-0 bg-background/70 backdrop-blur-sm opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="h-10 w-10 rounded-xl bg-card border border-border/30 flex items-center justify-center text-foreground hover:bg-muted shadow-lg transition-colors">
                      <ImagePlus className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }} className="h-10 w-10 rounded-xl bg-card border border-border/30 flex items-center justify-center text-destructive hover:bg-muted shadow-lg transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-32 rounded-xl border-2 border-dashed border-border/30 hover:border-primary/30 hover:bg-primary/[0.02] flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-all duration-200">
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-[11px] font-semibold">Adicionar imagem</span>
                  <span className="text-[10px] text-muted-foreground/40">JPEG, PNG, WebP até 5MB</span>
                </button>
              )}
            </div>

            {/* Name + Price */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Curso de Marketing" className="mt-1.5 h-11 rounded-xl" required maxLength={200} />
              </div>
              <div>
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Preço
                </Label>
                <Input type="number" step="0.01" min="1.00" max="99999.99" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="97.00" className="mt-1.5 h-11 rounded-xl" required />
              </div>
            </div>

            {/* Description */}
            <div>
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Descreva seu produto..." className="mt-1.5 rounded-xl" maxLength={2000} />
            </div>

            {/* Page URL + Status */}
            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-3">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> Página de Vendas
                </Label>
                <Input value={form.page_url} onChange={(e) => setForm({ ...form, page_url: e.target.value })} placeholder="https://..." className="mt-1.5 h-11 rounded-xl" type="url" />
              </div>
              <div className="col-span-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Status
                </Label>
                <div className="mt-1.5 flex items-center gap-3 h-11 px-3 rounded-xl border border-border/40 bg-card/50">
                  <Switch checked={form.status === "active"} onCheckedChange={(v) => setForm({ ...form, status: v ? "active" : "inactive" })} />
                  <span className={cn("text-xs font-semibold", form.status === "active" ? "text-primary" : "text-muted-foreground")}>
                    {form.status === "active" ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
            </div>

            {/* ─── ADVANCED FEATURES ─── */}
            <div className="border-t border-border/20 pt-4 mt-2">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.18em] mb-3 flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-primary" /> Funcionalidades Avançadas
              </p>
            </div>

            {/* Upsell */}
            <SheetSection icon={ArrowUpRight} title="Upsell / Order Bump" color="warning">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">Oferecer produto complementar no checkout</p>
                <Switch checked={upsellEnabled} onCheckedChange={setUpsellEnabled} />
              </div>
              {upsellEnabled && (
                <div className="rounded-lg bg-warning/5 border border-warning/10 p-3 mt-1">
                  <p className="text-[10px] text-warning font-medium">Configure os Order Bumps no Checkout Builder do produto.</p>
                  {editId && (
                    <Button type="button" variant="ghost" size="sm" className="mt-2 h-7 text-[10px] text-warning hover:text-warning gap-1.5" onClick={() => { resetForm(); navigate(`/vendas/produtos/${editId}/checkout-builder`); }}>
                      <Palette className="h-3 w-3" /> Abrir Builder
                    </Button>
                  )}
                </div>
              )}
            </SheetSection>

            {/* Affiliates */}
            <SheetSection icon={Users} title="Programa de Afiliados" color="success">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">Permitir afiliados venderem seu produto</p>
                <Switch checked={affiliateEnabled} onCheckedChange={setAffiliateEnabled} />
              </div>
              {affiliateEnabled && (
                <div className="space-y-2.5 mt-1">
                  <div>
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Comissão do Afiliado (%)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input type="number" min="1" max="80" value={affiliateCommission} onChange={(e) => setAffiliateCommission(e.target.value)} className="h-9 rounded-lg w-24" />
                      <span className="text-xs text-muted-foreground">% por venda</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-success/5 border border-success/10 p-2.5">
                    <p className="text-[10px] text-success/80">Afiliados receberão <strong>{affiliateCommission}%</strong> de cada venda aprovada. O restante será creditado no seu saldo.</p>
                  </div>
                </div>
              )}
            </SheetSection>

            {/* Co-Production */}
            <SheetSection icon={Handshake} title="Co-Produção" color="info">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">Dividir receita com um co-produtor</p>
                <Switch checked={coProductionEnabled} onCheckedChange={setCoProductionEnabled} />
              </div>
              {coProductionEnabled && (
                <div className="space-y-2.5 mt-1">
                  <div>
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Split de Receita (%)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input type="number" min="1" max="99" value={coProductionSplit} onChange={(e) => setCoProductionSplit(e.target.value)} className="h-9 rounded-lg w-24" />
                      <span className="text-xs text-muted-foreground">% para o co-produtor</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-info/5 border border-info/10 p-2.5">
                    <p className="text-[10px] text-info/80">Você receberá <strong>{100 - Number(coProductionSplit || 0)}%</strong> e o co-produtor <strong>{coProductionSplit}%</strong> automaticamente.</p>
                  </div>
                </div>
              )}
            </SheetSection>

            {/* Warranty */}
            <SheetSection icon={Shield} title="Garantia" color="primary">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Prazo de Garantia</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input type="number" min="0" max="365" value={warrantyDays} onChange={(e) => setWarrantyDays(e.target.value)} className="h-9 rounded-lg w-20" />
                    <span className="text-xs text-muted-foreground">dias</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Selo de garantia</p>
                  <p className={cn("text-xs font-bold", Number(warrantyDays) > 0 ? "text-primary" : "text-muted-foreground/40")}>
                    {Number(warrantyDays) > 0 ? `${warrantyDays} dias` : "Desativada"}
                  </p>
                </div>
              </div>
            </SheetSection>

            {/* Access & Delivery */}
            <SheetSection icon={Clock} title="Acesso & Entrega" color="info">
              <div className="space-y-3">
                <div>
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Tipo de Entrega</Label>
                  <div className="flex gap-2">
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
                          "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-semibold transition-all",
                          deliveryType === opt.value ? "bg-primary/10 border-primary/20 text-primary" : "border-border/30 text-muted-foreground hover:border-primary/20"
                        )}
                      >
                        <opt.icon className="h-3 w-3" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Expiração do Acesso</Label>
                  <div className="flex gap-2">
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
                          "flex-1 px-3 py-2 rounded-lg border text-[11px] font-semibold transition-all",
                          accessExpiry === opt.value ? "bg-primary/10 border-primary/20 text-primary" : "border-border/30 text-muted-foreground hover:border-primary/20"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SheetSection>

            {/* Max Sales + Member Area */}
            <SheetSection icon={Lock} title="Escassez & Área de Membros" color="warning">
              <div className="space-y-3">
                <div>
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Limite de Vendas</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input type="number" min="0" value={maxSales} onChange={(e) => setMaxSales(e.target.value)} placeholder="Ilimitado" className="h-9 rounded-lg w-28" />
                    <span className="text-xs text-muted-foreground">{maxSales ? `máx. ${maxSales} vendas` : "Sem limite"}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <p className="text-[11px] text-foreground font-medium">Área de Membros</p>
                    <p className="text-[10px] text-muted-foreground">Vincular a curso/conteúdo exclusivo</p>
                  </div>
                  <Switch checked={memberAreaEnabled} onCheckedChange={setMemberAreaEnabled} />
                </div>
              </div>
            </SheetSection>

            {/* Submit */}
            <div className="pt-2 pb-4">
              <Button type="submit" className="w-full h-12 rounded-xl font-bold text-sm shadow-lg shadow-primary/20" disabled={uploading}>
                {uploading ? "Enviando..." : editId ? "Salvar Alterações" : "Criar Produto"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {pixelProduct && <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={(v) => { if (!v) setPixelProduct(null); }} />}
    </PageShell>
  );
}
