import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Link2, Copy, ExternalLink, Plus, TrendingUp, Eye, Trash2, Power,
  Image as ImageIcon, X, Loader2, Check, ShoppingBag, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";
import { Seo } from "@/components/Seo";
import { HDShell, HDHeader, HDStat, HDStatGrid, HDCard } from "@/components/hd/HDPage";

type PayLink = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  amount: number;
  clicks: number;
  current_uses: number;
  total_revenue: number;
  is_active: boolean;
  accept_pix: boolean;
  accept_card: boolean;
  accept_boleto: boolean;
  created_at: string;
};

const fmt = formatCurrency;

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export default function LinkPagamento() {
  const { user } = useAuth();
  const [links, setLinks] = useState<PayLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", amount: "", slug: "",
    accept_pix: true, accept_card: false, accept_boleto: false,
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [allowedMethods, setAllowedMethods] = useState({ accept_pix: true, accept_card: true, accept_boleto: false });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.from("payment_links").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar links");
    setLinks((data as unknown as PayLink[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (user?.id) supabase.from("profiles").select("pix_enabled, credit_card_enabled, boleto_enabled").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      const allowed = { accept_pix: data.pix_enabled, accept_card: data.credit_card_enabled, accept_boleto: data.boleto_enabled };
      setAllowedMethods(allowed);
      setForm(current => ({ ...current, accept_pix: current.accept_pix && allowed.accept_pix, accept_card: current.accept_card && allowed.accept_card, accept_boleto: current.accept_boleto && allowed.accept_boleto }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const totals = useMemo(() => ({
    revenue: links.reduce((s, l) => s + Number(l.total_revenue || 0), 0),
    clicks: links.reduce((s, l) => s + (l.clicks || 0), 0),
    uses: links.reduce((s, l) => s + (l.current_uses || 0), 0),
    active: links.filter(l => l.is_active).length,
  }), [links]);

  const conversion = totals.clicks > 0 ? (totals.uses / totals.clicks) * 100 : 0;

  const linkUrl = (slug: string) => `${window.location.origin}/pl/${slug}`;

  const copyLink = (l: PayLink) => {
    navigator.clipboard.writeText(linkUrl(l.slug));
    setCopiedId(l.id);
    toast.success("Link copiado");
    setTimeout(() => setCopiedId(c => (c === l.id ? null : c)), 1800);
  };

  const resetForm = () => {
    setForm({ title: "", description: "", amount: "", slug: "", accept_pix: allowedMethods.accept_pix, accept_card: false, accept_boleto: false });
    setCoverFile(null);
    setCoverPreview(null);
  };

  const onPickFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Arquivo deve ser imagem"); return; }
    if (f.size > 4 * 1024 * 1024) { toast.error("Imagem até 4MB"); return; }
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  };

  const uploadCover = async (uid: string): Promise<string | null> => {
    if (!coverFile) return null;
    const ext = coverFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("payment-link-covers").upload(path, coverFile, {
      contentType: coverFile.type, upsert: false,
    });
    if (error) { toast.error("Falha ao enviar capa"); return null; }
    const { data } = supabase.storage.from("payment-link-covers").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amount = Number(String(form.amount).replace(",", "."));
    if (!amount || amount <= 0) { toast.error("Valor inválido"); return; }
    if (!form.title.trim()) { toast.error("Título obrigatório"); return; }
    if (!form.accept_pix && !form.accept_card && !form.accept_boleto) { toast.error("Ative ao menos um método liberado"); return; }

    setUploading(true);
    try {
      const baseSlug = form.slug.trim() ? slugify(form.slug) : slugify(form.title);
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      const cover_url = await uploadCover(user.id);

      const { error } = await supabase.from("payment_links").insert({
        user_id: user.id,
        slug,
        title: form.title.trim().slice(0, 120),
        description: form.description.trim().slice(0, 500) || null,
        cover_url,
        amount,
        accept_pix: form.accept_pix,
        accept_card: form.accept_card,
        accept_boleto: form.accept_boleto,
      } as never);
      if (error) { toast.error(error.message || "Erro ao criar link"); return; }
      toast.success("Link criado");
      setOpen(false);
      resetForm();
      load();
    } finally { setUploading(false); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    if (!user) return;
    await supabase.from("payment_links").update({ is_active: !current }).eq("id", id).eq("user_id", user.id);
    load();
  };

  const remove = async (id: string) => {
    if (!user) return;
    if (!confirm("Remover este link?")) return;
    await supabase.from("payment_links").delete().eq("id", id).eq("user_id", user.id);
    toast.success("Link removido");
    load();
  };

  const createDialog = (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button className="h-10 gap-2 rounded-xl px-4 font-semibold">
          <Plus className="h-4 w-4" /> Criar novo link
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto rounded-[12px]">
        <DialogHeader><DialogTitle className="font-display tracking-[-0.02em]">Novo link de pagamento</DialogTitle></DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4 pt-2">
          <div>
            <Label className="text-[13px] font-medium text-muted-foreground">Capa (opcional)</Label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] || null)} />
            {coverPreview ? (
              <div className="relative mt-1.5 aspect-[16/9] overflow-hidden rounded-xl border border-border/60">
                <img src={coverPreview} alt="Pré-visualização da capa" className="h-full w-full object-cover" />
                <button type="button" onClick={() => { setCoverFile(null); setCoverPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background/90 transition-colors hover:bg-destructive hover:text-destructive-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="mt-1.5 flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/30">
                <ImageIcon className="h-6 w-6" strokeWidth={1.5} />
                <span className="text-[13px] font-medium">Adicionar imagem de capa</span>
                <span className="text-[11px] text-muted-foreground/60">JPG, PNG · até 4MB</span>
              </button>
            )}
          </div>

          <div>
            <Label className="text-[13px] font-medium text-muted-foreground">Título</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Consultoria Premium" required maxLength={120} className="mt-1.5 h-11 rounded-xl" />
          </div>
          <div>
            <Label className="text-[13px] font-medium text-muted-foreground">Descrição (opcional)</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Detalhes do produto, o que está incluído, prazos..." rows={4} maxLength={500}
              className="mt-1.5 resize-none rounded-xl" />
            <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground/60">{form.description.length}/500</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[13px] font-medium text-muted-foreground">Valor (R$)</Label>
              <Input type="text" inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="197,00" required className="mt-1.5 h-11 rounded-xl tabular-nums" />
            </div>
            <div>
              <Label className="text-[13px] font-medium text-muted-foreground">Slug (opcional)</Label>
              <Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="black-friday" className="mt-1.5 h-11 rounded-xl" />
            </div>
          </div>
          <div className="rounded-xl border border-border/60 p-3">
            <p className="mb-2 text-[13px] font-medium text-muted-foreground">Métodos de pagamento</p>
            <div className="divide-y divide-border/40">
              {[
                { key: "accept_pix" as const, label: "PIX" },
                { key: "accept_card" as const, label: "Cartão de crédito" },
                { key: "accept_boleto" as const, label: "Boleto" },
               ].map(m => {
                const allowed = allowedMethods[m.key];
                return (
                <div key={m.key} className="flex items-center justify-between py-2.5">
                   <span className="text-[14px] font-medium">{m.label}{!allowed && <span className="ml-2 text-[10px] text-muted-foreground">Bloqueado pelo admin</span>}</span>
                   <Switch disabled={!allowed} checked={allowed && form[m.key]} onCheckedChange={v => setForm({ ...form, [m.key]: v })} />
                </div>
                );
               })}
            </div>
          </div>
          <Button type="submit" disabled={uploading} className="h-11 w-full rounded-xl font-semibold">
            {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando...</> : "Criar link"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <HDShell>
      <Seo title="Links de Pagamento | Venxpay" description="Crie links de pagamento avulsos e receba via PIX, cartão ou boleto." path="/vendas/link-pagamento" noindex />

      <HDHeader
        eyebrow="Checkout"
        title="Links de Pagamento"
        subtitle="Cobranças avulsas, direto na sua conta — seguro, rápido e sem complicações."
        actions={createDialog}
      />

      <HDStatGrid>
        <HDStat label="Receita gerada" value={fmt(totals.revenue)} sub="Total aprovado nos links" icon={TrendingUp} />
        <HDStat label="Cliques" value={totals.clicks.toLocaleString("pt-BR")} sub="Visitas nos seus links" icon={Eye} />
        <HDStat label="Conversões" value={totals.uses.toLocaleString("pt-BR")} sub={`${conversion.toFixed(1)}% de conversão`} icon={ShoppingBag} />
        <HDStat label="Links ativos" value={`${totals.active}/${links.length}`} sub="Disponíveis para pagamento" icon={Power} />
      </HDStatGrid>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <HDCard
          title="Meus links"
          description="Pagamentos rápidos, direto na sua conta."
        >
          {loading ? (
            <div className="px-6 py-16 text-center text-[13px] text-muted-foreground">Carregando...</div>
          ) : links.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Link2 className="mx-auto h-10 w-10 text-foreground/10" strokeWidth={1.5} />
              <p className="mt-4 font-display text-[16px] font-bold tracking-[-0.02em]">Nada por aqui ainda</p>
              <p className="mx-auto mt-1.5 max-w-xs text-[13px] text-muted-foreground/60">
                Crie seu primeiro link e comece a receber em minutos.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {links.map(l => (
                <li key={l.id} className="group px-4 py-4 transition-colors hover:bg-muted/20 sm:px-6">
                  <div className="flex items-start gap-4">
                    {l.cover_url ? (
                      <img src={l.cover_url} alt={l.title} className="h-14 w-14 shrink-0 rounded-xl border border-border/50 object-cover sm:h-16 sm:w-16" />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-muted/30 sm:h-16 sm:w-16">
                        <Link2 className="h-5 w-5 text-foreground/20" strokeWidth={1.5} />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="truncate font-display text-[15px] font-bold tracking-[-0.02em]">{l.title}</h4>
                            <span className={cn(
 "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                              l.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                            )}>
                              {l.is_active ? "Ativo" : "Pausado"}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground/60">
                            {fmt(l.amount)} · {l.clicks} cliques · {l.current_uses} vendas
                          </p>
                        </div>
                        <div className="hidden shrink-0 text-right sm:block">
                          <p className="text-[12px] text-muted-foreground/60">Receita</p>
                          <p className="font-display text-[17px] font-bold tabular-nums tracking-[-0.02em]">{fmt(l.total_revenue)}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyLink(l)}
                          className="flex min-w-0 max-w-full flex-1 items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2 text-left transition-colors hover:border-border hover:bg-muted/40"
                          title="Copiar link"
                        >
                          {copiedId === l.id
                            ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                            : <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
                          <span className="truncate font-mono text-[12px] text-muted-foreground">{linkUrl(l.slug)}</span>
                        </button>
                        <div className="flex items-center gap-1">
                          <Switch checked={l.is_active} onCheckedChange={() => toggleActive(l.id, l.is_active)} />
                          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl" title="Abrir link"
                            onClick={() => window.open(linkUrl(l.slug), "_blank", "noopener,noreferrer")}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl text-destructive hover:bg-destructive/10" title="Remover"
                            onClick={() => remove(l.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <p className="mt-2 text-[12.5px] tabular-nums text-muted-foreground/60 sm:hidden">
                        Receita: <span className="font-semibold text-foreground">{fmt(l.total_revenue)}</span>
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </HDCard>

        <div className="space-y-4">
          <HDCard title="Sobre os links" description="Como funciona">
            <div className="space-y-3 px-6 py-5">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Crie links de pagamento personalizados para seus produtos e serviços de forma rápida e prática.
                Compartilhe com seus clientes para facilitar o pagamento.
              </p>
              <ul className="space-y-2.5 pt-1">
                {[
 "Gerencie seus links direto na plataforma.",
 "Configure valores e imagens personalizadas.",
 "Acompanhe o desempenho de cada link.",
                ].map(t => (
                  <li key={t} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.5} />
                    <span className="text-[13px] text-muted-foreground">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </HDCard>

          <HDCard title="Vendas recentes" description="Últimas conversões pelos links">
            {links.filter(l => l.current_uses > 0).length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Info className="mx-auto h-8 w-8 text-foreground/10" strokeWidth={1.5} />
                <p className="mt-3 text-[13px] text-muted-foreground/60">Nenhuma venda por link ainda.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {links.filter(l => l.current_uses > 0).slice(0, 5).map(l => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-6 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold">{l.title}</p>
                      <p className="text-[12px] text-muted-foreground/60">{l.current_uses} vendas</p>
                    </div>
                    <p className="shrink-0 font-display text-[14px] font-bold tabular-nums">{fmt(l.total_revenue)}</p>
                  </li>
                ))}
              </ul>
            )}
          </HDCard>
        </div>
      </div>
    </HDShell>
  );
}
