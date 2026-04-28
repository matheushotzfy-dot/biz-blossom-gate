/**
 * Cupons — Gestão de cupons de desconto
 * @module Cupons
 * @version 5.0.0 — Operational Table Redesign
 */

import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts, useCoupons } from "@/hooks/useQueryData";
import {
  Ticket, Search, Plus, Trash2, Percent, TrendingDown, Calendar,
  Zap, Copy, Tag, Sparkles, Power, Infinity as InfinityIcon, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { EmptyState, Panel } from "@/components/PageShell";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type Coupon = Tables<"coupons">;
type StatusFilter = "all" | "active" | "inactive" | "expired";

const isExpired = (c: Coupon) => !!c.expires_at && new Date(c.expires_at) < new Date();
const isExhausted = (c: Coupon) => !!c.max_uses && c.current_uses >= c.max_uses;

function CouponStatusPill({ coupon }: { coupon: Coupon }) {
  const expired = isExpired(coupon);
  const exhausted = isExhausted(coupon);

  let cfg: { label: string; dot: string; pill: string };
  if (expired) cfg = { label: "Expirado", dot: "bg-destructive", pill: "bg-destructive/10 text-destructive border-destructive/20" };
  else if (exhausted) cfg = { label: "Esgotado", dot: "bg-warning", pill: "bg-warning/10 text-warning border-warning/20" };
  else if (coupon.is_active) cfg = { label: "Ativo", dot: "bg-success", pill: "bg-success/10 text-success border-success/20" };
  else cfg = { label: "Pausado", dot: "bg-muted-foreground", pill: "bg-muted/15 text-muted-foreground border-border/30" };

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold border tabular-nums", cfg.pill)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

export default function Cupons() {
  const { user } = useAuth();
  const { data: products = [] } = useProducts();
  const { data: coupons = [], refetch } = useCoupons();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [openCreate, setOpenCreate] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    code: "",
    product_id: "",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: "",
    max_uses: "",
    expires_at: "",
    apply_to_bumps: false,
  });

  const activeProducts = products.filter(p => p.status === "active");
  const activeCoupons = coupons.filter(c => c.is_active && !isExpired(c) && !isExhausted(c));
  const totalUses = coupons.reduce((a, c) => a + c.current_uses, 0);
  const totalDiscount = coupons.reduce((a, c) => a + c.total_discount_amount, 0);

  const filtered = useMemo(() => {
    return coupons.filter(c => {
      if (search && !c.code.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter === "active") return c.is_active && !isExpired(c) && !isExhausted(c);
      if (statusFilter === "inactive") return !c.is_active;
      if (statusFilter === "expired") return isExpired(c) || isExhausted(c);
      return true;
    });
  }, [coupons, search, statusFilter]);

  const getProductName = (pid: string | null) => {
    if (!pid) return "Todos os produtos";
    return products.find(p => p.id === pid)?.name || "—";
  };

  const resetForm = () => {
    setForm({ code: "", product_id: "", discount_type: "percentage", discount_value: "", max_uses: "", expires_at: "", apply_to_bumps: false });
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
    setOpenCreate(false);
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Excluir este cupom permanentemente?")) return;
    setDeleting(id);
    await supabase.from("coupons").delete().eq("id", id);
    toast.success("Cupom removido.");
    setDeleting(null);
    refetch();
  };

  const handleToggle = async (coupon: Coupon) => {
    await supabase.from("coupons").update({ is_active: !coupon.is_active }).eq("id", coupon.id);
    refetch();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  const previewValue = form.discount_value ? Number(form.discount_value) : 0;

  return (
    <PageShell>
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageTitle icon={<Tag className="h-6 w-6" />} title="Cupons" subtitle="Crie e gerencie estratégias de desconto comercial" />
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl text-sm font-display font-bold h-10 px-5 shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4" /> Novo Cupom
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg rounded-2xl border border-border/40 bg-card/95 backdrop-blur-xl p-0 overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-border/20">
              <DialogHeader>
                <DialogTitle className="font-display text-lg flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/15">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  Criar Novo Cupom
                </DialogTitle>
              </DialogHeader>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Step 1: Identification */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-md bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center">1</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">Identificação</span>
                </div>
                <div>
                  <Label className="text-[10.5px] font-bold text-muted-foreground/60 uppercase tracking-wider">Código do Cupom</Label>
                  <Input
                    placeholder="EX: BLACKFRIDAY10"
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, "") }))}
                    className="mt-1.5 h-11 rounded-xl font-mono text-sm font-bold tracking-wider"
                  />
                  <p className="text-[10px] text-muted-foreground/50 mt-1.5">Apenas letras e números, sem espaços</p>
                </div>
              </div>

              {/* Step 2: Discount */}
              <div className="space-y-4 pt-4 border-t border-border/20">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-md bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center">2</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">Valor do Desconto</span>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <div>
                    <Label className="text-[10.5px] font-bold text-muted-foreground/60 uppercase tracking-wider">Valor</Label>
                    <Input
                      type="number"
                      placeholder="10"
                      value={form.discount_value}
                      onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                      className="mt-1.5 h-11 rounded-xl tabular-nums font-display font-bold text-base"
                    />
                  </div>
                  <div>
                    <Label className="text-[10.5px] font-bold text-muted-foreground/60 uppercase tracking-wider">Tipo</Label>
                    <Select value={form.discount_type} onValueChange={v => setForm(f => ({ ...f, discount_type: v as "percentage" | "fixed" }))}>
                      <SelectTrigger className="mt-1.5 h-11 w-24 rounded-xl font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">% Off</SelectItem>
                        <SelectItem value="fixed">R$ Off</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {previewValue > 0 && (
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground/70">Cliente recebe</span>
                    <span className="text-[15px] font-display font-black text-primary tabular-nums">
                      {form.discount_type === "percentage" ? `${previewValue}% OFF` : `${fmt(previewValue)} OFF`}
                    </span>
                  </div>
                )}
              </div>

              {/* Step 3: Restrictions */}
              <div className="space-y-4 pt-4 border-t border-border/20">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-md bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center">3</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">Restrições <span className="text-muted-foreground/30 font-medium normal-case tracking-normal">(opcional)</span></span>
                </div>

                <div>
                  <Label className="text-[10.5px] font-bold text-muted-foreground/60 uppercase tracking-wider">Aplicar em</Label>
                  <Select value={form.product_id || "all"} onValueChange={v => setForm(f => ({ ...f, product_id: v === "all" ? "" : v }))}>
                    <SelectTrigger className="mt-1.5 h-11 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os produtos</SelectItem>
                      {activeProducts.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10.5px] font-bold text-muted-foreground/60 uppercase tracking-wider">Limite de Usos</Label>
                    <Input
                      type="number"
                      placeholder="Ilimitado"
                      value={form.max_uses}
                      onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                      className="mt-1.5 h-11 rounded-xl tabular-nums"
                    />
                  </div>
                  <div>
                    <Label className="text-[10.5px] font-bold text-muted-foreground/60 uppercase tracking-wider">Expira em</Label>
                    <Input
                      type="date"
                      value={form.expires_at}
                      onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                      className="mt-1.5 h-11 rounded-xl text-[12px]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/5 border border-border/20">
                  <div>
                    <p className="text-[12px] font-bold text-foreground">Aplicar aos Order Bumps</p>
                    <p className="text-[10.5px] text-muted-foreground/50 mt-0.5">Estende o desconto para ofertas adicionais</p>
                  </div>
                  <Switch checked={form.apply_to_bumps} onCheckedChange={v => setForm(f => ({ ...f, apply_to_bumps: v }))} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 px-6 py-4 border-t border-border/20 bg-muted/5">
              <Button variant="outline" className="flex-1 rounded-xl h-10 font-display font-bold" onClick={() => { resetForm(); setOpenCreate(false); }}>
                Cancelar
              </Button>
              <Button
                className="flex-1 rounded-xl h-10 font-display font-bold shadow-lg shadow-primary/20"
                onClick={handleCreate}
                disabled={saving || !form.code.trim() || !form.discount_value}
              >
                {saving ? "Salvando..." : "Criar Cupom"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ─── KPIs ─── */}
      <KpiRibbon
        cols={4}
        items={[
          { label: "Total de cupons", value: String(coupons.length), sub: `${coupons.length} ${coupons.length === 1 ? "cupom criado" : "cupons criados"} no total`, tone: "neutral", footer: "todos status" },
          { label: "Cupons ativos", value: String(activeCoupons.length), sub: `${activeCoupons.length} prontos para uso · ${coupons.filter(c => !c.is_active).length} pausados`, tone: "success", progress: coupons.length > 0 ? (activeCoupons.length / coupons.length) * 100 : 0 },
          { label: "Utilizações totais", value: String(totalUses), sub: `${totalUses} ${totalUses === 1 ? "vez resgatado" : "vezes resgatados"} no checkout`, tone: "info", footer: "soma de usos" },
          { label: "Desconto concedido", value: fmt(totalDiscount), sub: totalDiscount > 0 ? "valor total já aplicado em vendas" : "nenhum desconto aplicado ainda", tone: totalDiscount > 0 ? "warning" : "muted", footer: "histórico" },
        ]}
      />

      {/* ─── Coupon Table ─── */}
      <Panel className="p-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 py-3 border-b border-border/30 bg-muted/5">
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/15 border border-border/30 w-fit">
            {([
              { id: "all", label: "Todos", count: coupons.length },
              { id: "active", label: "Ativos", count: activeCoupons.length },
              { id: "inactive", label: "Pausados", count: coupons.filter(c => !c.is_active).length },
              { id: "expired", label: "Expirados", count: coupons.filter(c => isExpired(c) || isExhausted(c)).length },
            ] as { id: StatusFilter; label: string; count: number }[]).map(t => {
              const isActive = statusFilter === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setStatusFilter(t.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-display font-bold transition-colors",
                    isActive ? "bg-card text-foreground border border-border/40 shadow-sm"
                             : "text-muted-foreground/50 hover:text-muted-foreground/80"
                  )}
                >
                  <span>{t.label}</span>
                  <span className={cn(
                    "text-[9.5px] font-black px-1 rounded tabular-nums",
                    isActive ? "bg-primary/10 text-primary" : "bg-muted/20 text-muted-foreground/40"
                  )}>{t.count}</span>
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar código..."
              className="h-8 pl-8 pr-3 text-[11.5px] rounded-md w-full lg:w-64 bg-card/50 border-border/40 font-mono"
            />
          </div>
        </div>

        {/* Column headers */}
        {filtered.length > 0 && (
          <div className="hidden md:grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto_auto] items-center gap-4 px-4 py-2.5 border-b border-border/30 bg-muted/10">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">Cupom</span>
            <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">Produto</span>
            <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50 text-right">Desconto</span>
            <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50 text-right">Uso</span>
            <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">Validade</span>
            <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">Status</span>
            <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50 w-[72px] text-right">Ações</span>
          </div>
        )}

        {/* Rows */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Ticket className="h-7 w-7" />}
            title={coupons.length === 0 ? "Nenhum cupom ainda" : "Nenhum resultado"}
            subtitle={coupons.length === 0 ? "Crie seu primeiro cupom para começar a oferecer descontos" : "Tente ajustar a busca ou os filtros"}
            action={coupons.length === 0 ? (
              <Button onClick={() => setOpenCreate(true)} className="gap-2 rounded-xl font-display font-bold shadow-lg shadow-primary/20">
                <Plus className="h-4 w-4" /> Criar Primeiro Cupom
              </Button>
            ) : undefined}
          />
        ) : (
          <div>
            {filtered.map(c => {
              const expired = isExpired(c);
              const exhausted = isExhausted(c);
              const usagePct = c.max_uses ? Math.min(100, (c.current_uses / c.max_uses) * 100) : 0;
              return (
                <div
                  key={c.id}
                  className="group grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto_auto] items-center gap-3 md:gap-4 px-4 py-3 border-b border-border/20 last:border-b-0 hover:bg-muted/5 transition-colors"
                >
                  {/* Code */}
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => copyCode(c.code)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/15 hover:bg-primary/15 transition-colors group/code"
                      title="Copiar código"
                    >
                      <span className="font-mono text-[12px] font-black text-primary tracking-wider">{c.code}</span>
                      <Copy className="h-3 w-3 text-primary/40 group-hover/code:text-primary/80 transition-colors" />
                    </button>
                  </div>

                  {/* Product */}
                  <div className="min-w-0">
                    <p className={cn("text-[12px] truncate", c.product_id ? "text-foreground font-medium" : "text-muted-foreground/60 italic")}>
                      {getProductName(c.product_id)}
                    </p>
                  </div>

                  {/* Discount */}
                  <div className="text-right">
                    <p className="text-[14px] font-display font-black text-foreground tabular-nums leading-none">
                      {c.discount_type === "percentage" ? `${Number(c.discount_value)}%` : fmt(Number(c.discount_value))}
                    </p>
                    <p className="text-[9.5px] text-muted-foreground/40 uppercase tracking-wider font-bold mt-0.5">
                      {c.discount_type === "percentage" ? "percentual" : "fixo"}
                    </p>
                  </div>

                  {/* Usage */}
                  <div className="min-w-0 text-right">
                    <p className="text-[12px] font-display font-bold text-foreground tabular-nums leading-none">
                      {c.current_uses}
                      {c.max_uses && <span className="text-muted-foreground/40"> / {c.max_uses}</span>}
                    </p>
                    {c.max_uses ? (
                      <div className="mt-1.5 h-1 rounded-full bg-muted/15 overflow-hidden ml-auto w-16">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            exhausted ? "bg-warning" : usagePct > 75 ? "bg-warning/70" : "bg-success"
                          )}
                          style={{ width: `${usagePct}%` }}
                        />
                      </div>
                    ) : (
                      <p className="text-[9.5px] text-muted-foreground/40 uppercase tracking-wider font-bold mt-0.5 inline-flex items-center gap-1 justify-end">
                        <InfinityIcon className="h-2.5 w-2.5" /> ilimitado
                      </p>
                    )}
                  </div>

                  {/* Validity */}
                  <div className="min-w-0">
                    {c.expires_at ? (
                      <div className={cn("inline-flex items-center gap-1", expired && "text-destructive")}>
                        <Calendar className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                        <span className="text-[11px] tabular-nums font-medium">
                          {new Date(c.expires_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" })}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground/50 font-medium">
                        <InfinityIcon className="h-3 w-3" /> sem prazo
                      </span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="shrink-0">
                    <CouponStatusPill coupon={c} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0 justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-7 w-7 rounded-md transition-colors",
                        c.is_active ? "text-success hover:text-success hover:bg-success/10" : "text-muted-foreground/40 hover:text-foreground hover:bg-muted/10"
                      )}
                      onClick={() => handleToggle(c)}
                      disabled={expired}
                      title={c.is_active ? "Pausar" : "Ativar"}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(c.id)}
                      disabled={deleting === c.id}
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/30 bg-muted/5">
            <span className="text-[10.5px] text-muted-foreground/50 font-medium tabular-nums">
              Mostrando <strong className="text-foreground/80">{filtered.length}</strong> de <strong className="text-foreground/80">{coupons.length}</strong> cupons
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
              <AlertCircle className="h-3 w-3" />
              Cupons expirados não podem ser ativados
            </div>
          </div>
        )}
      </Panel>
    </PageShell>
  );
}
