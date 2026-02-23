import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Package, Plus, Edit, Trash2, ExternalLink, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
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

  const loadProducts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setProducts(data);
  };

  useEffect(() => { loadProducts(); }, [user]);

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) {
      toast.error("Erro ao enviar imagem");
      return null;
    }
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
    if (imageFile) {
      imageUrl = await uploadImage(imageFile);
    }

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
        const { error } = await supabase.from("products").insert({
          name: form.name,
          description: form.description,
          price,
          user_id: user.id,
          checkout_url: checkoutUrl,
          image_url: imageUrl,
        });
        if (error) { toast.error("Erro ao criar produto"); return; }
        toast.success("Produto criado!");
      }
      resetForm();
      loadProducts();
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setOpen(false);
    setEditId(null);
    setForm({ name: "", description: "", price: "" });
    setImageFile(null);
    setImagePreview(null);
  };

  const handleEdit = (p: Tables<"products">) => {
    setEditId(p.id);
    setForm({ name: p.name, description: p.description || "", price: String(p.price) });
    setImagePreview(p.image_url || null);
    setImageFile(null);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover"); return; }
    toast.success("Produto removido");
    loadProducts();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  return (
    <div className="space-y-6 dark">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> Produtos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Cadastre e gerencie seus produtos</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground gap-2"><Plus className="h-4 w-4" /> Novo Produto</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editId ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Image upload */}
              <div>
                <Label>Imagem do produto</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {imagePreview ? (
                  <div className="relative mt-2 rounded-xl overflow-hidden border border-border">
                    <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover" />
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(null); }}
                      className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 w-full h-32 rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ImagePlus className="h-8 w-8" />
                    <span className="text-xs font-medium">Clique para adicionar imagem</span>
                  </button>
                )}
              </div>
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>
              <div>
                <Label>Preço (R$)</Label>
                <Input type="number" step="0.01" min="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={uploading}>
                {uploading ? "Enviando..." : editId ? "Salvar" : "Criar Produto"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.length === 0 ? (
          <div className="col-span-full bg-card rounded-xl border border-border p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum produto cadastrado</p>
          </div>
        ) : (
          products.map((p) => (
            <div key={p.id} className="stat-card flex flex-col">
              {p.image_url && (
                <img src={p.image_url} alt={p.name} className="w-full h-36 object-cover rounded-xl mb-3" />
              )}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-2xl font-bold text-primary mt-1">R$ {Number(p.price).toFixed(2)}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              {p.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{p.description}</p>}
              {p.checkout_url && (
                <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  <span className="font-mono truncate">{p.checkout_url}</span>
                </p>
              )}
              <div className="flex gap-2 mt-auto pt-3 border-t border-border/50">
                <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => handleEdit(p)}>
                  <Edit className="h-3 w-3" /> Editar
                </Button>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive gap-1" onClick={() => handleDelete(p.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
