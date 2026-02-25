import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Package, Plus, Edit, Trash2, ExternalLink, ImagePlus, X, Settings, Crosshair, Eye, MoreVertical, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { PageShell, PageTitle } from "@/components/PageShell";
import CheckoutSettingsDialog from "@/components/CheckoutSettingsDialog";
import PixelSettingsDialog from "@/components/PixelSettingsDialog";
import type { Tables } from "@/integrations/supabase/types";

export default function Produtos() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settingsProduct, setSettingsProduct] = useState<Tables<"products"> | null>(null);
  const [pixelProduct, setPixelProduct] = useState<Tables<"products"> | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    loadProducts();
  }, [user?.id]);

  const loadProducts = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("products").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setProducts(data);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
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
    if (isNaN(price) || price <= 0) { toast.error("Preço inválido"); return; }
    setUploading(true);
    let imageUrl: string | null = null;
    if (imageFile) imageUrl = await uploadImage(imageFile);
    try {
      if (editId) {
        const updateData: Record<string, unknown> = { name: form.name, description: form.description, price };
        if (imageUrl) updateData.image_url = imageUrl;
        const { error } = await supabase.from("products").update(updateData).eq("id", editId);
        if (error) { toast.error("Erro ao atualizar"); return; }
        toast.success("Produto atualizado!");
      } else {
        const slug = crypto.randomUUID().slice(0, 8);
        const checkoutUrl = `${window.location.origin}/pay/${slug}`;
        const { error } = await supabase.from("products").insert({ name: form.name, description: form.description, price, user_id: user.id, checkout_url: checkoutUrl, image_url: imageUrl });
        if (error) { toast.error("Erro ao criar produto"); return; }
        toast.success("Produto criado!");
      }
      resetForm(); loadProducts();
    } finally { setUploading(false); }
  };

  const resetForm = () => { setOpen(false); setEditId(null); setForm({ name: "", description: "", price: "" }); setImageFile(null); setImagePreview(null); };
  const handleEdit = (p: Tables<"products">) => { setEditId(p.id); setForm({ name: p.name, description: p.description || "", price: String(p.price) }); setImagePreview(p.image_url || null); setImageFile(null); setOpen(true); };
  const handleDelete = async (id: string) => { const { error } = await supabase.from("products").delete().eq("id", id); if (error) { toast.error("Erro"); return; } toast.success("Removido"); loadProducts(); };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB"); return; } setImageFile(file); setImagePreview(URL.createObjectURL(file)); };

  const copyCheckout = (p: Tables<"products">) => {
    if (p.checkout_url) {
      navigator.clipboard.writeText(p.checkout_url);
      setCopiedId(p.id);
      toast.success("Link copiado!");
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <PageTitle icon={<Package className="h-6 w-6" />} title="Meus Produtos" subtitle="Crie, gerencie e configure seus infoprodutos" />
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl text-sm font-bold gradient-primary text-primary-foreground h-11 px-6 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
              <Plus className="h-4 w-4" /> Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg rounded-2xl">
            <DialogHeader><DialogTitle className="font-display text-lg">{editId ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 mt-2">
              <div>
                <Label className="text-sm font-semibold">Imagem do produto</Label>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                {imagePreview ? (
                  <div className="relative mt-2 rounded-xl overflow-hidden border border-border group">
                    <img src={imagePreview} alt="Preview" className="w-full h-44 object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }} className="h-10 w-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 w-full h-36 rounded-xl border-2 border-dashed border-border hover:border-primary/40 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-all hover:bg-primary/[0.02]">
                    <ImagePlus className="h-8 w-8" /><span className="text-xs font-semibold">Clique para adicionar imagem</span>
                  </button>
                )}
              </div>
              <div><Label className="text-sm font-semibold">Nome do produto</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Curso de Marketing Digital" className="mt-1.5 h-11" required /></div>
              <div><Label className="text-sm font-semibold">Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Descreva seu produto..." className="mt-1.5" /></div>
              <div><Label className="text-sm font-semibold">Preço (R$)</Label><Input type="number" step="0.01" min="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="97.00" className="mt-1.5 h-11" required /></div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground h-11 rounded-xl font-bold shadow-md shadow-primary/15" disabled={uploading}>
                {uploading ? "Enviando..." : editId ? "Salvar alterações" : "Criar produto"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Products grid */}
      {products.length === 0 ? (
        <div className="panel-enterprise p-16 flex flex-col items-center text-center animate-fade-in">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-display font-bold text-foreground mb-2">Nenhum produto criado</h3>
          <p className="text-sm text-muted-foreground max-w-sm">Crie seu primeiro infoproduto para começar a vender. Configure checkout, preço e área de membros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((p, i) => (
            <div key={p.id} className={`panel-enterprise overflow-hidden group animate-fade-in stagger-${Math.min(i + 1, 6)}`}>
              {/* Image */}
              <div className="relative h-44 bg-muted/30 overflow-hidden">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted/20">
                    <Package className="h-12 w-12 text-muted-foreground/20" />
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <StatusBadge status={p.status} />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent pointer-events-none" />
              </div>

              {/* Content */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-base font-display font-bold text-foreground leading-snug">{p.name}</h3>
                  <p className="text-xl font-display font-black text-primary whitespace-nowrap">R$ {Number(p.price).toFixed(2)}</p>
                </div>

                {p.description && (
                  <p className="text-[12px] text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{p.description}</p>
                )}

                {/* Checkout link */}
                {p.checkout_url && (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/30 border border-border/60 px-3 py-2 mb-4">
                    <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-[11px] text-muted-foreground font-mono truncate flex-1">{p.checkout_url}</span>
                    <button onClick={() => copyCheckout(p)} className="text-primary hover:text-primary/80 transition-colors">
                      {copiedId === p.id ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5 rounded-lg text-[12px] h-9 font-semibold hover:border-primary/20 hover:bg-primary/[0.03] transition-all" onClick={() => handleEdit(p)}>
                    <Edit className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-lg text-[12px] h-9 font-semibold hover:border-primary/20 hover:bg-primary/[0.03] transition-all" onClick={() => setSettingsProduct(p)}>
                    <Settings className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Checkout</span>
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="rounded-lg h-9 w-9 p-0 hover:border-primary/20 hover:bg-primary/[0.03] transition-all">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl p-1.5 min-w-[160px]">
                      <DropdownMenuItem onClick={() => setPixelProduct(p)} className="gap-2 rounded-lg cursor-pointer">
                        <Crosshair className="h-3.5 w-3.5" /> Pixels
                      </DropdownMenuItem>
                      {p.checkout_url && (
                        <DropdownMenuItem onClick={() => window.open(p.checkout_url!, "_blank")} className="gap-2 rounded-lg cursor-pointer">
                          <Eye className="h-3.5 w-3.5" /> Ver checkout
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleDelete(p.id)} className="gap-2 rounded-lg cursor-pointer text-destructive focus:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {settingsProduct && (
        <CheckoutSettingsDialog
          product={settingsProduct}
          open={!!settingsProduct}
          onOpenChange={(v) => { if (!v) setSettingsProduct(null); }}
          onSaved={loadProducts}
        />
      )}
      {pixelProduct && (
        <PixelSettingsDialog
          product={pixelProduct}
          open={!!pixelProduct}
          onOpenChange={(v) => { if (!v) setPixelProduct(null); }}
        />
      )}
    </PageShell>
  );
}
