import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts, useInvalidateAll } from "@/hooks/useQueryData";
import { Package, Plus, Edit, Trash2, ExternalLink, ImagePlus, X, Crosshair, Eye, MoreVertical, Copy, CheckCircle2, DollarSign, Tag, Sparkles, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PageShell, PageTitle } from "@/components/PageShell";
import PixelSettingsDialog from "@/components/PixelSettingsDialog";
import type { Tables } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.08 } } },
  item: { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 30 } } },
};

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

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <PageTitle icon={<Package className="h-6 w-6" />} title="Meus Produtos" subtitle="Crie, gerencie e configure seus infoprodutos" />
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl text-sm font-bold bg-primary/20 text-primary border border-primary/30 h-11 px-6 hover:bg-primary/30 hover:shadow-[0_0_30px_hsl(var(--primary)/0.3)] transition-all duration-300">
              <Plus className="h-4 w-4" /> Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl rounded-2xl ring-1 ring-white/[0.06] bg-[#141418]/95 backdrop-blur-3xl shadow-2xl shadow-black/60">
            <DialogHeader>
              <DialogTitle className="font-display text-xl flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
                  {editId ? <Edit className="h-5 w-5 text-primary" /> : <Sparkles className="h-5 w-5 text-primary" />}
                </div>
                {editId ? "Editar Produto" : "Criar Novo Produto"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 mt-3">
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Imagem do produto</Label>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} className="hidden" />
                {imagePreview ? (
                  <div className="relative rounded-2xl overflow-hidden ring-1 ring-white/[0.06] group">
                    <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover" />
                    <div className="absolute inset-0 bg-[#040405]/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="h-10 w-10 rounded-xl bg-primary/20 backdrop-blur flex items-center justify-center text-primary hover:bg-primary/30 transition-colors ring-1 ring-primary/20"><ImagePlus className="h-5 w-5" /></button>
                      <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }} className="h-10 w-10 rounded-xl bg-destructive/20 backdrop-blur flex items-center justify-center text-destructive hover:bg-destructive/30 transition-colors ring-1 ring-destructive/20"><X className="h-5 w-5" /></button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-40 rounded-2xl border-2 border-dashed border-white/[0.06] hover:border-primary/30 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-primary transition-all hover:bg-primary/[0.02] group">
                    <div className="h-14 w-14 rounded-2xl bg-white/[0.03] group-hover:bg-primary/10 flex items-center justify-center transition-colors ring-1 ring-white/[0.06]"><ImagePlus className="h-7 w-7" /></div>
                    <div className="text-center">
                      <span className="text-xs font-bold block">Clique para adicionar imagem</span>
                      <span className="text-[10px] text-muted-foreground/60">JPEG, PNG, WebP até 5MB</span>
                    </div>
                  </button>
                )}
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nome do produto</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Curso de Marketing Digital" className="mt-1.5 h-11 rounded-xl border-white/[0.08] bg-white/[0.02]" required maxLength={200} />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Descreva seu produto..." className="mt-1.5 rounded-xl border-white/[0.08] bg-white/[0.02]" maxLength={2000} />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><ExternalLink className="h-3 w-3" /> URL da Página de Vendas</Label>
                <Input value={form.page_url} onChange={(e) => setForm({ ...form, page_url: e.target.value })} placeholder="https://suapagina.com/produto" className="mt-1.5 h-11 rounded-xl border-white/[0.08] bg-white/[0.02]" type="url" />
                <p className="text-[10px] text-muted-foreground/60 mt-1">Link da página onde o produto é divulgado (compliance)</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><DollarSign className="h-3 w-3" /> Preço (R$)</Label>
                  <Input type="number" step="0.01" min="1.00" max="99999.99" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="97.00" className="mt-1.5 h-11 rounded-xl border-white/[0.08] bg-white/[0.02]" required />
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Tag className="h-3 w-3" /> Status</Label>
                  <div className="mt-1.5 flex items-center gap-3 h-11 px-3 rounded-xl ring-1 ring-white/[0.08] bg-white/[0.02]">
                    <Switch checked={form.status === "active"} onCheckedChange={(v) => setForm({ ...form, status: v ? "active" : "inactive" })} />
                    <span className={`text-xs font-bold ${form.status === "active" ? "text-primary" : "text-muted-foreground"}`}>{form.status === "active" ? "Ativo" : "Inativo"}</span>
                  </div>
                </div>
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground h-12 rounded-xl font-bold text-sm shadow-lg shadow-primary/15 hover:shadow-xl hover:shadow-primary/25 transition-all" disabled={uploading}>
                {uploading ? "Enviando..." : editId ? "Salvar alterações" : "🚀 Criar produto"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl ring-1 ring-white/[0.05] bg-white/[0.01] backdrop-blur-3xl p-16 flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center mb-4"><Package className="h-8 w-8 text-primary" /></div>
          <h3 className="text-lg font-display font-bold text-foreground mb-2">Nenhum produto criado</h3>
          <p className="text-sm text-muted-foreground/50 max-w-sm">Crie seu primeiro infoproduto para começar a vender.</p>
        </div>
      ) : (
        <motion.div variants={stagger.container} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5 mt-1">
          {products.map((p) => (
            <motion.div key={p.id} variants={stagger.item} className="group relative rounded-2xl ring-1 ring-white/[0.05] bg-white/[0.01] backdrop-blur-3xl overflow-hidden flex flex-col hover:ring-white/[0.1] transition-all duration-300">
              {/* Image + floating badge */}
              <div className="relative h-48 overflow-hidden">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white/[0.02]"><Package className="h-12 w-12 text-muted-foreground/15" /></div>
                )}
                {/* Gradient fade into card */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#040405] pointer-events-none" />
                {/* Floating status badge */}
                <div className="absolute top-3 right-3">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold backdrop-blur-md",
                    p.status === "active" && "bg-emerald-500/[0.12] text-emerald-400 ring-1 ring-emerald-500/20",
                    p.status === "inactive" && "bg-red-500/[0.12] text-red-400 ring-1 ring-red-500/20",
                    p.status === "pending_review" && "bg-amber-500/[0.12] text-amber-400 ring-1 ring-amber-500/20",
                  )}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", p.status === "active" ? "bg-emerald-400" : p.status === "inactive" ? "bg-red-400" : "bg-amber-400")} />
                    {p.status === "active" ? "Ativo" : p.status === "inactive" ? "Inativo" : "Em revisão"}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 flex flex-1 flex-col relative">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <h3 className="text-base font-display font-bold text-foreground leading-snug line-clamp-2">{p.name}</h3>
                  <p className="text-xl font-display font-black text-primary whitespace-nowrap drop-shadow-[0_0_8px_hsl(var(--primary)/0.3)]">R$ {Number(p.price).toFixed(2)}</p>
                </div>
                {p.description ? <p className="text-[12px] text-muted-foreground/50 line-clamp-2 mb-4 leading-relaxed">{p.description}</p> : <p className="text-[12px] text-muted-foreground/30 mb-4">Sem descrição.</p>}

                {/* Copy link pill */}
                {p.checkout_url && (
                  <button onClick={() => copyCheckout(p)} className="flex items-center gap-2 rounded-full bg-white/[0.04] ring-1 ring-white/[0.06] px-3 py-2 mb-4 hover:bg-white/[0.07] hover:ring-white/[0.1] transition-all duration-200 group/copy w-full">
                    <span className="text-[10px] text-muted-foreground/40 font-mono truncate flex-1 text-left">{getCheckoutLink(p.checkout_url)}</span>
                    <span className="shrink-0">
                      {copiedId === p.id ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 transition-all" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground/40 group-hover/copy:text-primary transition-colors" />
                      )}
                    </span>
                  </button>
                )}

                {/* macOS-style action dock */}
                <div className="flex items-center gap-1.5 mt-auto pt-2 opacity-50 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 ease-out">
                  <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-[11px] h-8 font-semibold text-muted-foreground hover:text-primary hover:bg-primary/[0.06] ring-1 ring-transparent hover:ring-primary/20 transition-all" onClick={() => handleEdit(p)}><Edit className="h-3 w-3" /> Editar</Button>
                  <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-[11px] h-8 font-semibold text-muted-foreground hover:text-primary hover:bg-primary/[0.06] ring-1 ring-transparent hover:ring-primary/20 transition-all" onClick={() => setPixelProduct(p)}><Crosshair className="h-3 w-3" /> Pixels</Button>
                  <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-[11px] h-8 font-semibold text-muted-foreground hover:text-primary hover:bg-primary/[0.06] ring-1 ring-transparent hover:ring-primary/20 transition-all" onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`)}><Palette className="h-3 w-3" /> Builder</Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="rounded-lg h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/[0.06] ring-1 ring-transparent hover:ring-primary/20 transition-all ml-auto"><MoreVertical className="h-3.5 w-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="top" className="rounded-xl p-1.5 min-w-[160px] bg-[#141418]/95 backdrop-blur-3xl ring-1 ring-white/[0.08] border-0">
                      {p.checkout_url && <DropdownMenuItem onClick={() => window.open(getCheckoutLink(p.checkout_url!), "_blank")} className="gap-2 rounded-lg cursor-pointer"><Eye className="h-3.5 w-3.5" /> Ver checkout</DropdownMenuItem>}
                      <DropdownMenuItem onClick={() => handleDelete(p.id)} className="gap-2 rounded-lg cursor-pointer text-destructive focus:text-destructive"><Trash2 className="h-3.5 w-3.5" /> Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
      {pixelProduct && <PixelSettingsDialog product={pixelProduct} open={!!pixelProduct} onOpenChange={(v) => { if (!v) setPixelProduct(null); }} />}
    </PageShell>
  );
}
