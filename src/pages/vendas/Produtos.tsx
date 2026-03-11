import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts, useInvalidateAll } from "@/hooks/useQueryData";
import { Package, Plus, Edit, Trash2, ExternalLink, ImagePlus, X, Crosshair, Eye, MoreVertical, Copy, CheckCircle2, DollarSign, Tag, Palette } from "lucide-react";
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <PageTitle icon={<Package className="h-6 w-6" />} title="Meus Produtos" subtitle="Crie, gerencie e configure seus infoprodutos" />
        <Button onClick={() => setOpen(true)} className="gap-2 rounded-lg text-sm font-semibold h-9 px-4">
          <Plus className="h-4 w-4" /> Novo Produto
        </Button>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={<Package className="h-7 w-7" />}
          title="Nenhum produto criado"
          subtitle="Crie seu primeiro infoproduto para começar a vender."
          action={
            <Button onClick={() => setOpen(true)} size="sm" className="gap-2 rounded-lg">
              <Plus className="h-3.5 w-3.5" /> Criar Produto
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {products.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.05, 0.3) }}
              className="group rounded-xl border border-border bg-card overflow-hidden flex flex-col hover:border-primary/20 transition-colors"
            >
              {/* Image */}
              <div className="relative h-36 overflow-hidden bg-muted/30">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-10 w-10 text-muted-foreground/20" />
                  </div>
                )}
                {/* Status badge */}
                <div className="absolute top-2.5 right-2.5">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold", statusColor(p.status))}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(p.status))} />
                    {statusLabel(p.status)}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-[14px] font-semibold text-foreground leading-snug line-clamp-1">{p.name}</h3>
                  <p className="text-[15px] font-bold text-primary whitespace-nowrap">R$ {Number(p.price).toFixed(2)}</p>
                </div>
                {p.description
                  ? <p className="text-[12px] text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{p.description}</p>
                  : <p className="text-[12px] text-muted-foreground/50 mb-3">Sem descrição</p>
                }

                {/* Copy link */}
                {p.checkout_url && (
                  <button onClick={() => copyCheckout(p)} className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border px-3 py-1.5 mb-3 hover:bg-muted transition-colors w-full">
                    <span className="text-[10px] text-muted-foreground font-mono truncate flex-1 text-left">{getCheckoutLink(p.checkout_url)}</span>
                    {copiedId === p.id
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                      : <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    }
                  </button>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 mt-auto pt-1">
                  <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-[11px] h-8 font-medium text-muted-foreground hover:text-foreground" onClick={() => handleEdit(p)}>
                    <Edit className="h-3 w-3" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-[11px] h-8 font-medium text-muted-foreground hover:text-foreground" onClick={() => setPixelProduct(p)}>
                    <Crosshair className="h-3 w-3" /> Pixels
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-[11px] h-8 font-medium text-muted-foreground hover:text-foreground" onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)}>
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
        </div>
      )}

      {/* Create/Edit Sheet */}
      <Sheet open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(v); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-5">
            <SheetTitle className="flex items-center gap-3 text-lg">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                {editId ? <Edit className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-primary" />}
              </div>
              {editId ? "Editar Produto" : "Novo Produto"}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Image */}
            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Imagem</Label>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} className="hidden" />
              {imagePreview ? (
                <div className="relative rounded-lg overflow-hidden border border-border group/img">
                  <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover" />
                  <div className="absolute inset-0 bg-background/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="h-9 w-9 rounded-lg bg-card border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors">
                      <ImagePlus className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }} className="h-9 w-9 rounded-lg bg-card border border-border flex items-center justify-center text-destructive hover:bg-muted transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-32 rounded-lg border-2 border-dashed border-border hover:border-primary/40 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-[11px] font-medium">Clique para adicionar</span>
                  <span className="text-[10px] text-muted-foreground">JPEG, PNG, WebP até 5MB</span>
                </button>
              )}
            </div>

            {/* Name */}
            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Nome do produto</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Curso de Marketing Digital" className="mt-1.5 h-10 rounded-lg" required maxLength={200} />
            </div>

            {/* Description */}
            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Descreva seu produto..." className="mt-1.5 rounded-lg" maxLength={2000} />
            </div>

            {/* Page URL */}
            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ExternalLink className="h-3 w-3" /> URL da Página de Vendas
              </Label>
              <Input value={form.page_url} onChange={(e) => setForm({ ...form, page_url: e.target.value })} placeholder="https://suapagina.com/produto" className="mt-1.5 h-10 rounded-lg" type="url" />
              <p className="text-[10px] text-muted-foreground mt-1">Link da página onde o produto é divulgado</p>
            </div>

            {/* Price + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="h-3 w-3" /> Preço (R$)
                </Label>
                <Input type="number" step="0.01" min="1.00" max="99999.99" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="97.00" className="mt-1.5 h-10 rounded-lg" required />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="h-3 w-3" /> Status
                </Label>
                <div className="mt-1.5 flex items-center gap-3 h-10 px-3 rounded-lg border border-border bg-card">
                  <Switch checked={form.status === "active"} onCheckedChange={(v) => setForm({ ...form, status: v ? "active" : "inactive" })} />
                  <span className={cn("text-xs font-medium", form.status === "active" ? "text-primary" : "text-muted-foreground")}>
                    {form.status === "active" ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
            </div>

            {/* Submit */}
            <Button type="submit" className="w-full h-10 rounded-lg font-semibold text-sm" disabled={uploading}>
              {uploading ? "Enviando..." : editId ? "Salvar alterações" : "Criar produto"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {pixelProduct && <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={(v) => { if (!v) setPixelProduct(null); }} />}
    </PageShell>
  );
}
