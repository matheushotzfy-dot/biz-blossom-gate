/**
 * Checkout — Configuração e personalização de checkouts + Cupons
 * @module Checkout
 * @version 3.1.0
 * @author msDev's — Engenharia de Software
 * @description Gerenciamento centralizado de checkout com cupons vinculados a produtos,
 *   exibição de valor total de descontos e toggle de ativação por produto.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  ExternalLink, Copy, Eye, Settings, Package, CheckCircle, Palette,
  Link2, Plus, Trash2, Ticket, DollarSign, TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageShell, Panel, GlowPanel, PageTitle, SectionHeader, EmptyState } from "@/components/PageShell";
import CheckoutSettingsDialog from "@/components/CheckoutSettingsDialog";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

/* ─── Helpers — msDev's ─── */
const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function Checkout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [settingsProduct, setSettingsProduct] = useState<Tables<"products"> | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponForm, setCouponForm] = useState({
    code: "", discount_type: "percentage", discount_value: "", max_uses: "", product_id: "",
  });

  /* ─── Data loader — msDev's ─── */
  const load = async () => {
    if (!user?.id) return;
    const [prodRes, coupRes] = await Promise.all([
      supabase.from("products").select("*").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: false }),
      supabase.from("coupons").select("*").order("created_at", { ascending: false }),
    ]);
    if (prodRes.data) setProducts(prodRes.data);
    if (coupRes.data) setCoupons(coupRes.data);
  };

  useEffect(() => { load(); }, [user?.id]);

  const getSlug = (url: string) => url.split("/").pop()!;
  const getLocalLink = (url: string) => `${window.location.origin}/pay/${getSlug(url)}`;

  const copyLink = (id: string, url: string) => {
    navigator.clipboard.writeText(getLocalLink(url));
    toast.success("Link copiado!");
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  const openCheckout = (url: string) => window.open(getLocalLink(url), "_blank");

  const getPaymentMethods = (p: Tables<"products">) => {
    const methods: string[] = [];
    if (p.checkout_pix_enabled) methods.push("PIX");
    if (p.checkout_boleto_enabled) methods.push("Boleto");
    if (p.checkout_credit_card_enabled) methods.push("Cartão");
    return methods;
  };

  /* ─── Cupons CRUD — msDev's ─── */
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const insertData: any = {
      user_id: user.id,
      code: couponForm.code.toUpperCase(),
      discount_type: couponForm.discount_type,
      discount_value: parseFloat(couponForm.discount_value) || 0,
      max_uses: couponForm.max_uses ? parseInt(couponForm.max_uses) : null,
    };
    if (couponForm.product_id && couponForm.product_id !== "all") {
      insertData.product_id = couponForm.product_id;
    }
    const { error } = await supabase.from("coupons").insert(insertData);
    if (error) { toast.error("Erro ao criar cupom"); return; }
    toast.success("Cupom criado!");
    setCouponOpen(false);
    setCouponForm({ code: "", discount_type: "percentage", discount_value: "", max_uses: "", product_id: "" });
    load();
  };

  const toggleCouponActive = async (id: string, current: boolean) => {
    await supabase.from("coupons").update({ is_active: !current }).eq("id", id);
    load();
  };

  const deleteCoupon = async (id: string) => {
    await supabase.from("coupons").delete().eq("id", id);
    toast.success("Cupom removido");
    load();
  };

  /* ─── Helpers de nome de produto — msDev's ─── */
  const getProductName = (productId: string | null) => {
    if (!productId) return "Todos os produtos";
    const p = products.find((prod) => prod.id === productId);
    return p?.name || "Produto removido";
  };

  const getProductCouponCount = (productId: string) => {
    return coupons.filter((c) => c.product_id === productId && c.is_active).length;
  };

  return (
    <PageShell>
      <PageTitle icon={<Palette className="h-6 w-6" />} title="Checkout" subtitle="Personalize checkouts e gerencie cupons promocionais" />

      {products.length === 0 ? (
        <Panel className="p-10 flex flex-col items-center text-center">
          <EmptyState icon={<Package className="h-7 w-7" />} title="Nenhum produto ativo" subtitle="Crie um produto para configurar seu checkout" />
          <Button className="mt-4 gap-2 rounded-xl gradient-primary text-primary-foreground font-bold shadow-lg shadow-primary/20" onClick={() => navigate("/vendas/produtos")}>
            <Plus className="h-4 w-4" /> Criar Produto
          </Button>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((p, i) => {
            const productCoupons = getProductCouponCount(p.id);
            return (
              <div
                key={p.id}
                className="panel-enterprise overflow-hidden group animate-fade-in flex flex-col"
                style={{ animationDelay: `${Math.min(i, 5) * 60}ms` } as React.CSSProperties}
              >
                {/* Image */}
                <div className="relative h-44 bg-muted/30 overflow-hidden">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted/20">
                      <Package className="h-12 w-12 text-muted-foreground/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 flex-wrap">
                    {getPaymentMethods(p).map((m) => (
                      <span key={m} className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-card/80 backdrop-blur-sm border border-border/30 text-muted-foreground/80 uppercase tracking-wider">{m}</span>
                    ))}
                    {p.checkout_timer_enabled && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-warning/20 backdrop-blur-sm border border-warning/20 text-warning">Timer</span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="font-display font-bold text-[14px] text-foreground leading-snug line-clamp-2">{p.name}</h4>
                    <p className="text-lg font-display font-black text-primary whitespace-nowrap">
                      R$ {Number(p.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  {p.description && (
                    <p className="text-[12px] text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{p.description}</p>
                  )}

                  {p.checkout_url && (
                    <div className="flex items-center gap-2 rounded-lg bg-muted/30 border border-border/40 px-3 py-2 mb-3">
                      <Link2 className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                      <span className="text-[10px] text-muted-foreground/50 font-mono truncate flex-1">{getLocalLink(p.checkout_url!)}</span>
                      <button onClick={() => copyLink(p.id, p.checkout_url!)} className="text-primary hover:text-primary/80 transition-colors shrink-0">
                        {copiedId === p.id ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  )}

                  {productCoupons > 0 && (
                    <div className="mb-3">
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-warning/10 border border-warning/15 text-warning">
                        <Ticket className="h-3 w-3 inline mr-1" />{productCoupons} cupom{productCoupons > 1 ? "s" : ""} ativo{productCoupons > 1 ? "s" : ""}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 mt-auto pt-2">
                    <Button
                      size="sm"
                      className="gap-1.5 rounded-lg text-[11px] font-bold gradient-primary text-primary-foreground shadow-lg shadow-primary/20 h-8 hover:shadow-xl transition-all"
                      onClick={() => setSettingsProduct(p)}
                    >
                      <Settings className="h-3 w-3" /> Personalizar
                    </Button>
                    {p.checkout_url && (
                      <Button variant="outline" size="sm" className="gap-1 rounded-lg text-[11px] h-8 font-semibold hover:border-primary/20 hover:bg-primary/[0.03]" onClick={() => openCheckout(p.checkout_url!)}>
                        <Eye className="h-3 w-3" /> Abrir
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── CUPONS SECTION — msDev's ─── */}
      <div className="pt-2">
        <SectionHeader
          icon={<Ticket className="h-4.5 w-4.5" />}
          title="Cupons Promocionais"
          subtitle="Ofereça descontos nos seus checkouts"
          action={
            <Dialog open={couponOpen} onOpenChange={setCouponOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 rounded-xl text-[13px] font-bold gradient-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl transition-all">
                  <Plus className="h-4 w-4" /> Novo Cupom
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md rounded-2xl border-border/60 bg-card/95 backdrop-blur-xl p-0 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] to-transparent rounded-2xl pointer-events-none" />
                <div className="relative px-6 pt-6 pb-4 border-b border-border/20">
                  <DialogHeader>
                    <DialogTitle className="font-display text-lg flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
                        <Ticket className="h-4 w-4 text-primary-foreground" />
                      </div>
                      Novo Cupom
                    </DialogTitle>
                  </DialogHeader>
                </div>
                <form onSubmit={handleCreateCoupon} className="space-y-4 p-6 relative">
                  <div>
                    <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.15em] font-bold">Código</Label>
                    <Input value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })} placeholder="DESCONTO10" required className="uppercase mt-1.5 rounded-xl h-11" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.15em] font-bold">Produto</Label>
                    <Select value={couponForm.product_id || "all"} onValueChange={(v) => setCouponForm({ ...couponForm, product_id: v })}>
                      <SelectTrigger className="mt-1.5 rounded-xl h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os produtos</SelectItem>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.15em] font-bold">Tipo de Desconto</Label>
                    <Select value={couponForm.discount_type} onValueChange={(v) => setCouponForm({ ...couponForm, discount_type: v })}>
                      <SelectTrigger className="mt-1.5 rounded-xl h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                        <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.15em] font-bold">Valor</Label>
                      <Input type="number" step="0.01" value={couponForm.discount_value} onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })} required className="mt-1.5 rounded-xl h-11" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.15em] font-bold">Max. usos</Label>
                      <Input type="number" value={couponForm.max_uses} onChange={(e) => setCouponForm({ ...couponForm, max_uses: e.target.value })} placeholder="∞" className="mt-1.5 rounded-xl h-11" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full gradient-primary text-primary-foreground font-bold h-12 rounded-xl shadow-xl shadow-primary/15 text-sm">
                    <Ticket className="h-4 w-4 mr-2" /> Criar Cupom
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          }
        />
      </div>

      {coupons.length === 0 ? (
        <Panel>
          <EmptyState icon={<Ticket className="h-7 w-7" />} title="Nenhum cupom criado" subtitle="Crie cupons para oferecer descontos nos seus checkouts" />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {coupons.map((c, i) => (
            <GlowPanel key={c.id} glow="warning" className="p-4 animate-fade-in" style={{ animationDelay: `${i * 40}ms` } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-lg font-black text-primary tracking-wider">{c.code}</span>
                <Switch checked={c.is_active} onCheckedChange={() => toggleCouponActive(c.id, c.is_active)} />
              </div>
              {/* Produto vinculado — msDev's */}
              <div className="mb-3 p-2.5 rounded-lg bg-muted/20 border border-border/20">
                <div className="flex items-center gap-2">
                  <Package className="h-3 w-3 text-muted-foreground/50" />
                  <span className="text-[11px] text-muted-foreground/70 font-medium truncate">{getProductName(c.product_id)}</span>
                </div>
              </div>
              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground/60">Desconto</span>
                  <span className="font-display font-bold text-foreground">{c.discount_type === "percentage" ? `${Number(c.discount_value)}%` : fmt(Number(c.discount_value))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground/60">Usos</span>
                  <span className="font-bold text-foreground">{c.current_uses}{c.max_uses ? `/${c.max_uses}` : " / ∞"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground/60 flex items-center gap-1">
                    <TrendingDown className="h-3 w-3" /> Total descontos
                  </span>
                  <span className="font-display font-bold text-warning">{fmt(Number(c.total_discount_amount || 0))}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border/30">
                <Button variant="ghost" size="sm" className="text-destructive/70 w-full gap-1 hover:text-destructive hover:bg-destructive/5 rounded-xl" onClick={() => deleteCoupon(c.id)}>
                  <Trash2 className="h-3 w-3" /> Remover
                </Button>
              </div>
            </GlowPanel>
          ))}
        </div>
      )}

      {/* How to use — msDev's */}
      <Panel className="border-primary/10 bg-gradient-to-br from-primary/[0.02] to-transparent">
        <h3 className="font-display font-bold mb-4 text-foreground text-[14px]">Como usar</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px] text-muted-foreground/70">
          {[
            { n: "1", text: <>Cadastre um produto em <strong className="text-foreground/70">Produtos</strong>.</> },
            { n: "2", text: <>Clique em <strong className="text-foreground/70">Personalizar</strong> para configurar cores, timer, banners e meios de pagamento.</> },
            { n: "3", text: "Compartilhe o link do checkout com seus clientes." },
            { n: "4", text: <>Acompanhe vendas no <strong className="text-foreground/70">Dashboard</strong>.</> },
          ].map((step) => (
            <div key={step.n} className="flex items-start gap-3">
              <span className="h-7 w-7 rounded-lg gradient-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-primary/20">{step.n}</span>
              <p className="pt-1">{step.text}</p>
            </div>
          ))}
        </div>
      </Panel>

      {settingsProduct && (
        <CheckoutSettingsDialog
          product={settingsProduct}
          open={!!settingsProduct}
          onOpenChange={(v) => { if (!v) setSettingsProduct(null); }}
          onSaved={load}
        />
      )}
    </PageShell>
  );
}
