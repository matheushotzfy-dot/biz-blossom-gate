import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts, useInvalidateAll } from "@/hooks/useQueryData";
import { Package, Plus, Edit, Trash2, ExternalLink, ImagePlus, X, Crosshair, Eye, MoreVertical, Copy, CheckCircle2, DollarSign, Tag, Palette, Sparkles, ShoppingCart, TrendingUp, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState } from "@/components/PageShell";
import PixelSettingsDialog from "@/components/PixelSettingsDialog";
import type { Tables } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/* ─── Mini KPI ─── */
function ProductKpi({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative group rounded-2xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-4 overflow-hidden"
    >
      {/* Ambient glow */}
      <div className={cn("absolute -top-6 -right-6 h-16 w-16 rounded-full blur-[30px] opacity-0 group-hover:opacity-100 transition-opacity duration-500", color)} />
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.14em]">{label}</span>
        <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", color.replace("bg-", "bg-") + "/10")}>
          <Icon className={cn("h-3 w-3", color.replace("bg-", "text-"))} />
        </div>
      </div>
      <p className="text-xl font-black text-foreground tracking-tight">{value}</p>
    </motion.div>
  );
}

export default function Produtos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: products = [], refetch: loadProducts } = useProducts();
  const invalidateAll = useInvalidateAll();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", status: "active", page_url: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pixelProduct, setPixelProduct] = useState<Tables<"products"> | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const resetForm = () => { setOpen(false); setEditId(null); setForm({ name: "", description: "", price: "", status: "active", page_url: "" }); setImageFile(null); setImagePreview(null); };
  const handleEdit = (p: Tables<"products">) => { setEditId(p.id); setForm({ name: p.name, description: p.description || "", price: String(p.price), status: p.status, page_url: (p as any).page_url || "" }); setImagePreview(p.image_url || null); setImageFile(null); setOpen(true); };

  const handleDelete = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("products").delete().eq("id", id).eq("user_id", user.id);
    if (error) { toast.error("Erro"); return; }
    toast.success("Removido"); loadProducts();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast.error("Formato inválido. Use JPEG, PNG, WebP ou GIF"); return; }
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
        <PageTitle icon={<Package className="h-6 w-6" />} title="Meus Produtos" subtitle="Crie, gerencie e configure seus infoprodutos" />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <Button onClick={() => setOpen(true)} className="gap-2 rounded-xl text-sm font-semibold h-10 px-5 shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" /> Novo Produto
          </Button>
        </motion.div>
      </div>

      {/* KPI Cards */}
      {products.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ProductKpi label="Total Produtos" value={String(products.length)} icon={Layers} color="bg-primary" />
          <ProductKpi label="Ativos" value={String(activeProducts)} icon={Sparkles} color="bg-success" />
          <ProductKpi label="Valor Médio" value={`R$ ${(totalValue / (products.length || 1)).toFixed(0)}`} icon={TrendingUp} color="bg-warning" />
          <ProductKpi label="Catálogo" value={`R$ ${totalValue.toFixed(0)}`} icon={ShoppingCart} color="bg-info" />
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
              className="group relative rounded-2xl bg-card/50 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] overflow-hidden flex flex-col hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
            >
              {/* Hover gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              {/* Image */}
              <div className="relative h-40 overflow-hidden bg-gradient-to-br from-muted/30 to-muted/10">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/5 rounded-full blur-xl scale-150" />
                      <Package className="h-12 w-12 text-muted-foreground/10 relative" />
                    </div>
                  </div>
                )}
                {/* Gradient overlay on image */}
                <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent" />
                
                {/* Status badge */}
                <div className="absolute top-3 right-3">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold backdrop-blur-md shadow-sm", statusColor(p.status))}>
                    <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", statusDot(p.status))} />
                    {statusLabel(p.status)}
                  </span>
                </div>
                
                {/* Price floating badge */}
                <div className="absolute bottom-3 left-3">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-card/90 backdrop-blur-md border border-border/30 px-3 py-1.5 text-[15px] font-black text-primary shadow-lg">
                    R$ {Number(p.price).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 flex flex-1 flex-col relative z-10">
                <h3 className="text-[15px] font-bold text-foreground leading-snug line-clamp-1 mb-1">{p.name}</h3>
                {p.description
                  ? <p className="text-[12px] text-muted-foreground/60 line-clamp-2 mb-3 leading-relaxed">{p.description}</p>
                  : <p className="text-[12px] text-muted-foreground/30 italic mb-3">Sem descrição</p>
                }

                {/* Checkout link pill */}
                {p.checkout_url && (
                  <button onClick={() => copyCheckout(p)} className="flex items-center gap-2 rounded-xl bg-muted/20 dark:bg-foreground/[0.03] border border-border/20 dark:border-foreground/[0.04] px-3 py-2 mb-3 hover:bg-primary/5 hover:border-primary/20 transition-all duration-200 w-full group/link">
                    <span className="text-[10px] text-muted-foreground/50 font-mono truncate flex-1 text-left group-hover/link:text-primary/70 transition-colors">{getCheckoutLink(p.checkout_url)}</span>
                    {copiedId === p.id
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                      : <Copy className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 group-hover/link:text-primary transition-colors" />
                    }
                  </button>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 mt-auto pt-1">
                  <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-[11px] h-8 font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors" onClick={() => handleEdit(p)}>
                    <Edit className="h-3 w-3" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-[11px] h-8 font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors" onClick={() => setPixelProduct(p)}>
                    <Crosshair className="h-3 w-3" /> Pixels
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-[11px] h-8 font-medium text-primary bg-primary/5 hover:bg-primary/10 transition-colors" onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)}>
                    <Palette className="h-3 w-3" /> Builder
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="rounded-lg h-8 w-8 p-0 text-muted-foreground hover:text-foreground ml-auto">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="top">
                      {p.checkout_url && (
                        <DropdownMenuItem onClick={() => window.open(getCheckoutLink(p.checkout_url!), "_blank")} className="gap-2 cursor-pointer text-[12px]">
                          <Eye className="h-3.5 w-3.5" /> Ver checkout
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleDelete(p.id)} className="gap-2 cursor-pointer text-destructive focus:text-destructive text-[12px]">
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </motion.div>
          ))}

          {/* "Add new" ghost card */}
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(products.length * 0.06, 0.4) }}
            onClick={() => setOpen(true)}
            className="rounded-2xl border-2 border-dashed border-border/30 dark:border-foreground/[0.06] hover:border-primary/30 hover:bg-primary/[0.02] flex flex-col items-center justify-center gap-3 min-h-[280px] transition-all duration-300 group/add"
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

      {/* Create/Edit Sheet */}
      <Sheet open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(v); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto border-border/40">
          <SheetHeader className="mb-5">
            <SheetTitle className="flex items-center gap-3 text-lg">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-lg shadow-primary/10">
                {editId ? <Edit className="h-4.5 w-4.5 text-primary" /> : <Plus className="h-4.5 w-4.5 text-primary" />}
              </div>
              {editId ? "Editar Produto" : "Novo Produto"}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Image */}
            <div>
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] mb-2.5 block">Imagem do produto</Label>
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
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-36 rounded-xl border-2 border-dashed border-border/30 hover:border-primary/30 hover:bg-primary/[0.02] flex flex-col items-center justify-center gap-2.5 text-muted-foreground hover:text-primary transition-all duration-200">
                  <div className="h-12 w-12 rounded-xl bg-muted/20 flex items-center justify-center">
                    <ImagePlus className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-semibold">Clique para adicionar imagem</span>
                  <span className="text-[10px] text-muted-foreground/40">JPEG, PNG, WebP até 5MB</span>
                </button>
              )}
            </div>

            {/* Name */}
            <div>
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Nome do produto</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Curso de Marketing Digital" className="mt-1.5 h-11 rounded-xl" required maxLength={200} />
            </div>

            {/* Description */}
            <div>
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Descreva seu produto..." className="mt-1.5 rounded-xl" maxLength={2000} />
            </div>

            {/* Page URL */}
            <div>
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] flex items-center gap-1.5">
                <ExternalLink className="h-3 w-3" /> URL da Página de Vendas
              </Label>
              <Input value={form.page_url} onChange={(e) => setForm({ ...form, page_url: e.target.value })} placeholder="https://suapagina.com/produto" className="mt-1.5 h-11 rounded-xl" type="url" />
              <p className="text-[10px] text-muted-foreground/40 mt-1.5">Link da página onde o produto é divulgado</p>
            </div>

            {/* Price + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] flex items-center gap-1.5">
                  <DollarSign className="h-3 w-3" /> Preço (R$)
                </Label>
                <Input type="number" step="0.01" min="1.00" max="99999.99" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="97.00" className="mt-1.5 h-11 rounded-xl" required />
              </div>
              <div>
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] flex items-center gap-1.5">
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

            {/* Submit */}
            <Button type="submit" className="w-full h-11 rounded-xl font-semibold text-sm shadow-lg shadow-primary/20" disabled={uploading}>
              {uploading ? "Enviando..." : editId ? "Salvar alterações" : "Criar produto"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {pixelProduct && <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={(v) => { if (!v) setPixelProduct(null); }} />}
    </PageShell>
  );
}
