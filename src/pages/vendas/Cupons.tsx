/**
 * Cupons — Gestão de cupons de desconto
 * @module Cupons
 * @version 3.0.0
 */

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts, useCoupons } from "@/hooks/useQueryData";
import {
  Ticket, Search, Plus, Trash2, Percent, ToggleLeft, TrendingDown, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PageShell, Panel, PageTitle, SectionHeader, EmptyState, KpiCard, DataTable } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function Cupons() {
  const { user } = useAuth();
  const { data: products = [] } = useProducts();
  const { data: coupons = [], refetch } = useCoupons();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    code: "",
    product_id: "",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: "",
    max_uses: "",
    starts_at: "",
    expires_at: "",
    apply_to_bumps: false,
  });

  const activeProducts = products.filter(p => p.status === "active");
  const activeCoupons = coupons.filter(c => c.is_active);
  const expiredCoupons = coupons.filter(c => c.expires_at && new Date(c.expires_at) < new Date());
  const totalUses = coupons.reduce((a, c) => a + c.current_uses, 0);
  const totalDiscount = coupons.reduce((a, c) => a + c.total_discount_amount, 0);

  const filtered = coupons.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.code.toLowerCase().includes(s);
  });

  const getProductName = (pid: string | null) => {
    if (!pid) return "Todos";
    return products.find(p => p.id === pid)?.name || "—";
  };

  const resetForm = () => {
    setForm({ code: "", product_id: "", discount_type: "percentage", discount_value: "", max_uses: "", starts_at: "", expires_at: "", apply_to_bumps: false });
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!user || !form.code.trim() || !form.discount_value) {
      toast.error("Preencha o código e o valor do desconto.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("coupons").insert({
      user_id: user.id,
      code: form.code.trim().toUpperCase(),
      product_id: form.product_id || null,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Cupom já existe." : "Erro ao criar cupom.");
      return;
    }
    toast.success("Cupom criado com sucesso!");
    resetForm();
    refetch();
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await supabase.from("coupons").delete().eq("id", id);
    toast.success("Cupom removido.");
    setDeleting(null);
    refetch();
  };

  const handleToggle = async (coupon: Tables<"coupons">) => {
    await supabase.from("coupons").update({ is_active: !coupon.is_active }).eq("id", coupon.id);
    refetch();
  };

  return (
    <PageShell>
      <PageTitle
        icon={<Ticket className="h-5 w-5 md:h-6 md:w-6" />}
        title="Meus Cupons"
        subtitle="Gerencie cupons de desconto para seus produtos"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Cupons" value={String(coupons.length)} sub="Criados" icon={Ticket} color="text-primary" bg="bg-primary/10" accent="bg-primary" />
        <KpiCard label="Ativos" value={String(activeCoupons.length)} sub="Em uso" icon={ToggleLeft} color="text-emerald-500" bg="bg-emerald-500/10" accent="bg-emerald-500" />
        <KpiCard label="Utilizações" value={String(totalUses)} sub="Total de usos" icon={Percent} color="text-blue-500" bg="bg-blue-500/10" accent="bg-blue-500" />
        <KpiCard label="Descontos" value={fmt(totalDiscount)} sub="Total descontado" icon={TrendingDown} color="text-amber-500" bg="bg-amber-500/10" accent="bg-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-10 rounded-xl" />
            </div>
            <Button onClick={() => setShowForm(!showForm)} size="sm" className="rounded-xl gap-1.5 lg:hidden">
              <Plus className="h-4 w-4" /> Novo Cupom
            </Button>
          </div>

          <DataTable headers={["Código", "Produtos", "Desconto", "Início", "Fim", "# Usos", "Status", ""]}>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="p-10 text-center text-muted-foreground text-xs">
                  Nenhum registro encontrado
                </td>
              </tr>
            )}
            {filtered.map(c => (
              <tr key={c.id} className="border-b border-border/30 hover:bg-muted/15 transition-colors">
                <td className="p-4 font-mono text-xs font-bold text-primary">{c.code}</td>
                <td className="p-4 text-xs text-muted-foreground">{getProductName(c.product_id)}</td>
                <td className="p-4 text-xs font-bold text-foreground">
                  {c.discount_type === "percentage" ? `${Number(c.discount_value)}%` : fmt(Number(c.discount_value))}
                </td>
                <td className="p-4 text-[11px] text-muted-foreground">
                  {c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="p-4 text-[11px] text-muted-foreground">
                  {c.expires_at ? new Date(c.expires_at).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="p-4">
                  <span className="text-xs font-bold bg-muted/30 px-2 py-0.5 rounded">{c.current_uses}{c.max_uses ? `/${c.max_uses}` : ""}</span>
                </td>
                <td className="p-4">
                  <button onClick={() => handleToggle(c)} className="cursor-pointer">
                    <StatusBadge status={c.is_active ? "active" : "inactive"} />
                  </button>
                </td>
                <td className="p-4">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)} disabled={deleting === c.id}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        </div>

        {/* Right: Add coupon form */}
        <div className={cn("lg:block", showForm ? "block" : "hidden lg:block")}>
          <Panel className="sticky top-4 space-y-5">
            <SectionHeader
              icon={<Plus className="h-4 w-4" />}
              title="Adicionar Cupom"
              subtitle="Adicione cupons para os seus produtos."
            />

            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Código</Label>
                <Input
                  placeholder="Ex: DESCONTO10"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  className="h-11 rounded-xl font-mono"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Produtos</Label>
                <Select value={form.product_id} onValueChange={v => setForm(f => ({ ...f, product_id: v === "all" ? "" : v }))}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Todos os produtos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    {activeProducts.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Desconto</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="10"
                    value={form.discount_value}
                    onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                    className="h-11 rounded-xl flex-1"
                  />
                  <Select value={form.discount_type} onValueChange={v => setForm(f => ({ ...f, discount_type: v as "percentage" | "fixed" }))}>
                    <SelectTrigger className="h-11 rounded-xl w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">%</SelectItem>
                      <SelectItem value="fixed">R$</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Limite de usos</Label>
                <Input
                  type="number"
                  placeholder="Ilimitado"
                  value={form.max_uses}
                  onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                  className="h-11 rounded-xl"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Data de início do cupom</Label>
                <div className="relative">
                  <Input
                    type="date"
                    value={form.starts_at}
                    onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))}
                    className="h-11 rounded-xl"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Data de expiração do cupom</Label>
                <div className="relative">
                  <Input
                    type="date"
                    value={form.expires_at}
                    onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                    className="h-11 rounded-xl"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground/70">Deixe sem valor para a validade ser eterna</p>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Switch
                  checked={form.apply_to_bumps}
                  onCheckedChange={v => setForm(f => ({ ...f, apply_to_bumps: v }))}
                />
                <span className="text-xs text-foreground">Aplicar desconto aos Order Bumps</span>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button variant="outline" className="flex-1 rounded-xl h-10" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button className="flex-1 rounded-xl h-10" onClick={handleCreate} disabled={saving}>
                  {saving ? "Salvando..." : "Adicionar"}
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
