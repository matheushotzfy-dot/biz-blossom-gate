import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link2, Copy, ExternalLink, Plus, TrendingUp, Eye, Trash2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageShell, Panel, PageTitle, EmptyState } from "@/components/PageShell";

type PayLink = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
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

const fmt = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export default function LinkPagamento() {
  const { user } = useAuth();
  const [links, setLinks] = useState<PayLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", amount: "", slug: "", accept_pix: true, accept_card: false, accept_boleto: false });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.from("payment_links").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar links");
    setLinks((data as PayLink[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const totalRevenue = links.reduce((s, l) => s + Number(l.total_revenue || 0), 0);
  const totalClicks = links.reduce((s, l) => s + (l.clicks || 0), 0);
  const totalUses = links.reduce((s, l) => s + (l.current_uses || 0), 0);

  const linkUrl = (slug: string) => `${window.location.origin}/pay/${slug}`;

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(linkUrl(slug));
    toast.success("Link copiado!");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amount = Number(String(form.amount).replace(",", "."));
    if (!amount || amount <= 0) { toast.error("Valor inválido"); return; }
    if (!form.title.trim()) { toast.error("Título obrigatório"); return; }
    const baseSlug = form.slug.trim() ? slugify(form.slug) : slugify(form.title);
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

    const { error } = await supabase.from("payment_links").insert({
      user_id: user.id,
      slug,
      title: form.title.trim().slice(0, 120),
      description: form.description.trim().slice(0, 500) || null,
      amount,
      accept_pix: form.accept_pix,
      accept_card: form.accept_card,
      accept_boleto: form.accept_boleto,
    } as never);
    if (error) { toast.error(error.message || "Erro ao criar link"); return; }
    toast.success("Link criado!");
    setOpen(false);
    setForm({ title: "", description: "", amount: "", slug: "", accept_pix: true, accept_card: false, accept_boleto: false });
    load();
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

  return (
    <PageShell>
      <PageTitle icon={<Link2 className="h-6 w-6" />} title="Links de Pagamento" subtitle="Gere links avulsos para receber via PIX, cartão ou boleto" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Receita Total", value: fmt(totalRevenue), icon: TrendingUp, color: "text-emerald-500" },
          { label: "Cliques", value: totalClicks.toLocaleString("pt-BR"), icon: Eye, color: "text-blue-500" },
          { label: "Conversões", value: totalUses.toLocaleString("pt-BR"), icon: Link2, color: "text-primary" },
          { label: "Links Ativos", value: links.filter(l => l.is_active).length, icon: Power, color: "text-amber-500" },
        ].map(k => (
          <Panel key={k.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-2xl bg-muted/50 flex items-center justify-center ${k.color}`}><k.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{k.label}</p>
                <p className="text-lg font-black tabular-nums">{String(k.value)}</p>
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <h2 className="font-display font-bold text-base">Meus Links</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl gradient-primary text-primary-foreground font-bold"><Plus className="h-4 w-4" /> Novo Link</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo Link de Pagamento</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <div>
                <Label>Título</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Consultoria Premium" required maxLength={120} className="mt-1.5" />
              </div>
              <div>
                <Label>Descrição (opcional)</Label>
                <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Breve descrição" maxLength={500} className="mt-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor (R$)</Label>
                  <Input type="text" inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="197,00" required className="mt-1.5" />
                </div>
                <div>
                  <Label>Slug (opcional)</Label>
                  <Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="black-friday" className="mt-1.5" />
                </div>
              </div>
              <div className="space-y-2 rounded-xl border border-border/60 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Métodos de pagamento</p>
                {[
                  { key: "accept_pix" as const, label: "PIX" },
                  { key: "accept_card" as const, label: "Cartão de Crédito" },
                  { key: "accept_boleto" as const, label: "Boleto" },
                ].map(m => (
                  <div key={m.key} className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{m.label}</span>
                    <Switch checked={form[m.key]} onCheckedChange={v => setForm({ ...form, [m.key]: v })} />
                  </div>
                ))}
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground font-bold h-11 rounded-xl">Criar Link</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Panel><p className="text-sm text-muted-foreground text-center py-8">Carregando...</p></Panel>
      ) : links.length === 0 ? (
        <Panel><EmptyState icon={<Link2 className="h-7 w-7" />} title="Nenhum link criado" subtitle="Gere seu primeiro link de pagamento para começar a receber" /></Panel>
      ) : (
        <div className="space-y-3">
          {links.map(l => (
            <Panel key={l.id} className="p-4">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Link2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold truncate">{l.title}</h3>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${l.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                        {l.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <p className="text-[12px] text-muted-foreground mt-0.5">
                      {fmt(l.amount)} · {l.clicks} cliques · {l.current_uses} vendas
                    </p>
                    <p className="text-[11px] font-mono text-primary/80 truncate mt-1">{linkUrl(l.slug)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right pr-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Receita</p>
                    <p className="font-black text-emerald-500 tabular-nums">{fmt(l.total_revenue)}</p>
                  </div>
                  <Switch checked={l.is_active} onCheckedChange={() => toggleActive(l.id, l.is_active)} />
                  <Button size="icon" variant="ghost" onClick={() => copyLink(l.slug)} className="rounded-xl"><Copy className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => window.open(linkUrl(l.slug), "_blank")} className="rounded-xl"><ExternalLink className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(l.id)} className="rounded-xl text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </PageShell>
  );
}
