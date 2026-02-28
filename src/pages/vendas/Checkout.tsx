import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ExternalLink, Copy, Eye, Settings, Package, CheckCircle, Palette, Link2, Plus, Trash2, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageShell, Panel, PageTitle } from "@/components/PageShell";
import CheckoutSettingsDialog from "@/components/CheckoutSettingsDialog";
import type { Tables } from "@/integrations/supabase/types";

export default function Checkout() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [settingsProduct, setSettingsProduct] = useState<Tables<"products"> | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Coupons state
  const [coupons, setCoupons] = useState<any[]>([]);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponForm, setCouponForm] = useState({ code: "", discount_type: "percentage", discount_value: "", max_uses: "" });

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

  const copyLink = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  const getSlug = (url: string) => url.split("/").pop()!;
  const openCheckout = (url: string) => window.open(`/pay/${getSlug(url)}`, "_blank");

  const getPaymentMethods = (p: Tables<"products">) => {
    const methods: string[] = [];
    if (p.checkout_pix_enabled) methods.push("PIX");
    if (p.checkout_boleto_enabled) methods.push("Boleto");
    if (p.checkout_credit_card_enabled) methods.push("Cartão");
    return methods;
  };

  // Coupon handlers
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("coupons").insert({
      user_id: user.id,
      code: couponForm.code.toUpperCase(),
      discount_type: couponForm.discount_type,
      discount_value: parseFloat(couponForm.discount_value) || 0,
      max_uses: couponForm.max_uses ? parseInt(couponForm.max_uses) : null,
    });
    if (error) { toast.error("Erro ao criar cupom"); return; }
    toast.success("Cupom criado!");
    setCouponOpen(false);
    setCouponForm({ code: "", discount_type: "percentage", discount_value: "", max_uses: "" });
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

  return (
    <PageShell>
      <PageTitle icon={<Palette className="h-6 w-6" />} title="Checkout" subtitle="Personalize checkouts e gerencie cupons promocionais" />

      {/* Products list */}
      {products.length === 0 ? (
        <div className="py-20 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Package className="h-7 w-7 text-muted-foreground/30" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Nenhum produto ativo</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Crie um produto para configurar seu checkout</p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((p, i) => (
            <Panel
              key={p.id}
              className="overflow-hidden animate-fade-in"
              style={{ animationDelay: `${Math.min(i, 5) * 60}ms` } as React.CSSProperties}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-14 w-14 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Package className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-[14px] text-foreground truncate">{p.name}</h4>
                    <p className="text-primary font-extrabold text-[16px]">
                      R$ {Number(p.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {getPaymentMethods(p).map((m) => (
                        <span key={m} className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{m}</span>
                      ))}
                      {p.checkout_timer_enabled && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-warning/10 text-warning">Timer</span>
                      )}
                      {p.checkout_guarantee_enabled && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-success/10 text-success">Garantia</span>
                      )}
                    </div>
                  </div>
                </div>

                {p.checkout_url && (
                  <div className="hidden lg:flex items-center gap-2 rounded-lg bg-muted/30 border border-border/60 px-3 py-2 max-w-xs">
                    <button onClick={() => copyLink(p.id, p.checkout_url!)} className="text-muted-foreground hover:text-primary transition-colors shrink-0" title="Copiar link">
                      <Link2 className="h-3 w-3" />
                    </button>
                    <span className="text-[10px] text-muted-foreground font-mono truncate">{p.checkout_url}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5 rounded-xl text-[12px] font-bold gradient-primary text-primary-foreground shadow-sm shadow-primary/15 h-9"
                    onClick={() => setSettingsProduct(p)}
                  >
                    <Settings className="h-3.5 w-3.5" /> Personalizar
                  </Button>
                  {p.checkout_url && (
                    <>
                      <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-[12px] h-9" onClick={() => openCheckout(p.checkout_url!)}>
                        <Eye className="h-3.5 w-3.5" /> Abrir
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 rounded-xl text-[12px] h-9"
                        onClick={() => copyLink(p.id, p.checkout_url!)}
                      >
                        {copiedId === p.id ? (
                          <><CheckCircle className="h-3.5 w-3.5 text-success" /> Copiado</>
                        ) : (
                          <><Copy className="h-3.5 w-3.5" /> Copiar</>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {/* ─── CUPONS SECTION ─── */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
            <Ticket className="h-4 w-4 text-warning" />
          </div>
          <div>
            <h2 className="text-[15px] font-display font-bold text-foreground">Cupons Promocionais</h2>
            <p className="text-[11px] text-muted-foreground">Ofereça descontos nos seus checkouts</p>
          </div>
        </div>
        <Dialog open={couponOpen} onOpenChange={setCouponOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl text-[13px] font-bold gradient-primary text-primary-foreground">
              <Plus className="h-4 w-4" /> Novo Cupom
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader><DialogTitle className="font-display">Novo Cupom</DialogTitle></DialogHeader>
            <form onSubmit={handleCreateCoupon} className="space-y-4 mt-2">
              <div>
                <Label className="text-sm font-semibold">Código</Label>
                <Input value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })} placeholder="DESCONTO10" required className="uppercase mt-1.5" />
              </div>
              <div>
                <Label className="text-sm font-semibold">Tipo de Desconto</Label>
                <Select value={couponForm.discount_type} onValueChange={(v) => setCouponForm({ ...couponForm, discount_type: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                    <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold">Valor</Label>
                  <Input type="number" step="0.01" value={couponForm.discount_value} onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })} required className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Max. usos</Label>
                  <Input type="number" value={couponForm.max_uses} onChange={(e) => setCouponForm({ ...couponForm, max_uses: e.target.value })} placeholder="Ilimitado" className="mt-1.5" />
                </div>
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground font-bold h-11 rounded-xl">Criar Cupom</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {coupons.length === 0 ? (
        <Panel>
          <div className="text-center py-8">
            <Ticket className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Nenhum cupom criado</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">Crie cupons para oferecer descontos nos seus checkouts</p>
          </div>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {coupons.map((c) => (
            <Panel key={c.id}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-lg font-bold text-primary">{c.code}</span>
                <Switch checked={c.is_active} onCheckedChange={() => toggleCouponActive(c.id, c.is_active)} />
              </div>
              <div className="space-y-1.5 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Desconto</span>
                  <span className="font-bold text-foreground">{c.discount_type === "percentage" ? `${Number(c.discount_value)}%` : `R$ ${Number(c.discount_value).toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Usos</span>
                  <span className="font-bold text-foreground">{c.current_uses}{c.max_uses ? `/${c.max_uses}` : ""}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <Button variant="ghost" size="sm" className="text-destructive w-full gap-1 hover:text-destructive hover:bg-destructive/5" onClick={() => deleteCoupon(c.id)}>
                  <Trash2 className="h-3 w-3" /> Remover
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {/* How to use */}
      <Panel>
        <h3 className="font-bold mb-3 text-foreground text-[14px]">Como usar</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px] text-muted-foreground">
          {[
            { n: "1", text: <>Cadastre um produto em <strong className="text-foreground/70">Produtos</strong>.</> },
            { n: "2", text: <>Clique em <strong className="text-foreground/70">Personalizar</strong> para configurar cores, timer, banners e meios de pagamento.</> },
            { n: "3", text: "Compartilhe o link do checkout com seus clientes." },
            { n: "4", text: <>Acompanhe vendas no <strong className="text-foreground/70">Dashboard</strong>.</> },
          ].map((step) => (
            <div key={step.n} className="flex items-start gap-2.5">
              <span className="h-6 w-6 rounded-lg bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{step.n}</span>
              <p>{step.text}</p>
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
