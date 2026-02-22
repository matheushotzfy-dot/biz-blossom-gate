import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Ticket, Plus, Trash2, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function Cupons() {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", discount_type: "percentage", discount_value: "", max_uses: "" });

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    if (data) setCoupons(data);
  };

  useEffect(() => { load(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("coupons").insert({
      user_id: user.id,
      code: form.code.toUpperCase(),
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value) || 0,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
    });
    if (error) { toast.error("Erro ao criar cupom"); return; }
    toast.success("Cupom criado!");
    setOpen(false);
    setForm({ code: "", discount_type: "percentage", discount_value: "", max_uses: "" });
    load();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("coupons").update({ is_active: !current }).eq("id", id);
    load();
  };

  const deleteCoupon = async (id: string) => {
    await supabase.from("coupons").delete().eq("id", id);
    toast.success("Cupom removido");
    load();
  };

  return (
    <div className="space-y-6 dark">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Ticket className="h-6 w-6 text-primary" /> Cupons de Desconto
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Crie e gerencie cupons promocionais</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground gap-2"><Plus className="h-4 w-4" /> Novo Cupom</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Novo Cupom</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label>Código</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="DESCONTO10" required className="mt-1 uppercase" />
              </div>
              <div>
                <Label>Tipo de desconto</Label>
                <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                    <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor do desconto</Label>
                <Input type="number" step="0.01" min="0" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} required className="mt-1" />
              </div>
              <div>
                <Label>Máximo de usos (opcional)</Label>
                <Input type="number" min="1" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="Ilimitado" className="mt-1" />
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground">Criar Cupom</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {coupons.length === 0 ? (
          <div className="col-span-full bg-card rounded-xl border border-border p-12 text-center">
            <Ticket className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum cupom criado</p>
          </div>
        ) : (
          coupons.map((c) => (
            <div key={c.id} className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-lg font-bold text-primary">{c.code}</span>
                <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c.id, c.is_active)} />
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Desconto</span>
                  <span className="font-semibold">
                    {c.discount_type === "percentage" ? `${Number(c.discount_value)}%` : `R$ ${Number(c.discount_value).toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Usos</span>
                  <span className="font-semibold">{c.current_uses}{c.max_uses ? `/${c.max_uses}` : ""}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border/50">
                <Button variant="ghost" size="sm" className="text-destructive w-full gap-1" onClick={() => deleteCoupon(c.id)}>
                  <Trash2 className="h-3 w-3" /> Remover
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
