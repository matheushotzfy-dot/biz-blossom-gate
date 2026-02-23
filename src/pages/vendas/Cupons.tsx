import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Ticket, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageShell, Panel, PageTitle } from "@/components/PageShell";

export default function Cupons() {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", discount_type: "percentage", discount_value: "", max_uses: "" });

  const load = async () => { if (!user) return; const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false }); if (data) setCoupons(data); };
  useEffect(() => { load(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); if (!user) return;
    const { error } = await supabase.from("coupons").insert({ user_id: user.id, code: form.code.toUpperCase(), discount_type: form.discount_type, discount_value: parseFloat(form.discount_value) || 0, max_uses: form.max_uses ? parseInt(form.max_uses) : null });
    if (error) { toast.error("Erro"); return; }
    toast.success("Cupom criado!"); setOpen(false); setForm({ code: "", discount_type: "percentage", discount_value: "", max_uses: "" }); load();
  };
  const toggleActive = async (id: string, current: boolean) => { await supabase.from("coupons").update({ is_active: !current }).eq("id", id); load(); };
  const deleteCoupon = async (id: string) => { await supabase.from("coupons").delete().eq("id", id); toast.success("Removido"); load(); };

  return (
    <PageShell>
      <div className="flex items-center justify-between">
        <PageTitle icon={<Ticket className="h-6 w-6" />} title="Cupons" subtitle="Crie e gerencie cupons promocionais" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2 rounded-xl text-[13px] font-bold" style={{ background: "linear-gradient(135deg, #00FFA3, #00D48B)", color: "#080c18" }}><Plus className="h-4 w-4" /> Novo Cupom</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Novo Cupom</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><Label>Código</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="DESCONTO10" required className="uppercase" /></div>
              <div><Label>Tipo</Label><Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentage">Porcentagem (%)</SelectItem><SelectItem value="fixed">Valor fixo (R$)</SelectItem></SelectContent></Select></div>
              <div><Label>Valor</Label><Input type="number" step="0.01" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} required /></div>
              <div><Label>Max. usos</Label><Input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="Ilimitado" /></div>
              <Button type="submit" className="w-full" style={{ background: "linear-gradient(135deg, #00FFA3, #00D48B)", color: "#080c18" }}>Criar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {coupons.length === 0 ? (
          <div className="col-span-full text-center py-12 text-white/20"><Ticket className="h-12 w-12 mx-auto mb-3 opacity-30" /><p className="text-[13px]">Nenhum cupom</p></div>
        ) : coupons.map((c) => (
          <Panel key={c.id}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-lg font-bold" style={{ color: "#00FFA3" }}>{c.code}</span>
              <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c.id, c.is_active)} />
            </div>
            <div className="space-y-1.5 text-[13px]">
              <div className="flex justify-between"><span className="text-white/30">Desconto</span><span className="font-bold text-white">{c.discount_type === "percentage" ? `${Number(c.discount_value)}%` : `R$ ${Number(c.discount_value).toFixed(2)}`}</span></div>
              <div className="flex justify-between"><span className="text-white/30">Usos</span><span className="font-bold text-white">{c.current_uses}{c.max_uses ? `/${c.max_uses}` : ""}</span></div>
            </div>
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <Button variant="ghost" size="sm" className="text-red-400 w-full gap-1 hover:text-red-300 hover:bg-red-500/5" onClick={() => deleteCoupon(c.id)}><Trash2 className="h-3 w-3" /> Remover</Button>
            </div>
          </Panel>
        ))}
      </div>
    </PageShell>
  );
}
