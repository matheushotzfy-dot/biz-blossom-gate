/**
 * Checkouts — personalização da página de pagamento de cada produto + cupons
 * @module Checkout
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts, useCoupons, useInvalidateAll } from "@/hooks/useQueryData";
import {
 ExternalLink, Copy, Check, Settings, Package, Palette, Plus, Trash2, Ticket, Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import CheckoutSettingsDialog from "@/components/CheckoutSettingsDialog";
import { Money } from "@/components/home/Money";
import { PageHead } from "@/components/seller-ui/PageHead";
import { SectionTabs } from "@/components/seller-ui/SectionTabs";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { DialogHead, FieldLabel, dialogShell } from "@/components/seller-ui/form";
import type { Tables } from "@/integrations/supabase/types";
import { cn, formatCurrency } from "@/lib/utils";
import { ConfirmDialog } from "@/components/seller-ui/confirm";

const fmt = formatCurrency;
const orb = "grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function Checkout() {
 const { user } = useAuth();
 const navigate = useNavigate();
 const { data: products = [], refetch: refetchProducts } = useProducts();
 const activeProducts = products.filter(p => p.status === "active");
 const { data: coupons = [], refetch: refetchCoupons } = useCoupons();
 const invalidateAll = useInvalidateAll();
 const [settingsProduct, setSettingsProduct] = useState<Tables<"products"> | null>(null);
 const [copiedId, setCopiedId] = useState<string | null>(null);
 const [couponOpen, setCouponOpen] = useState(false);
 const [couponToDelete, setCouponToDelete] = useState<Tables<"coupons"> | null>(null);
 const [creatingCoupon, setCreatingCoupon] = useState(false);
 const [couponForm, setCouponForm] = useState({
 code: "", discount_type: "percentage", discount_value: "", max_uses: "", product_id: "",
 });

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

 /* ─── Cupons CRUD ─── */
 const handleCreateCoupon = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!user) return;

 // FIX #36: Validate discount values client-side too
 const discountValue = parseFloat(couponForm.discount_value) || 0;
 if (discountValue <= 0) { toast.error("Valor do desconto deve ser positivo"); return; }
 if (couponForm.discount_type === "percentage" && discountValue > 100) {
 toast.error("Porcentagem máxima é 100%"); return;
 }

 const insertData: Record<string, unknown> = {
 user_id: user.id,
 code: couponForm.code.toUpperCase().trim(),
 discount_type: couponForm.discount_type,
 discount_value: discountValue,
 max_uses: couponForm.max_uses ? parseInt(couponForm.max_uses) : null,
 };
 if (couponForm.product_id && couponForm.product_id !== "all") {
 insertData.product_id = couponForm.product_id;
 }
 setCreatingCoupon(true);
 const { error } = await supabase.from("coupons").insert(insertData as never);
 setCreatingCoupon(false);
 if (error) {
 if (error.code === '23505') { toast.error("Já existe um cupom com esse código"); }
 else { toast.error("Não foi possível criar o cupom"); }
 return;
 }
 toast.success("Cupom criado");
 setCouponOpen(false);
 setCouponForm({ code: "", discount_type: "percentage", discount_value: "", max_uses: "", product_id: "" });
 invalidateAll(["products", "coupons"]);
 };

 // FIX #37: Add user_id filter to coupon mutations
 const toggleCouponActive = async (id: string, current: boolean) => {
 if (!user) return;
 await supabase.from("coupons").update({ is_active: !current }).eq("id", id).eq("user_id", user.id);
 invalidateAll(["coupons"]);
 };

 // FIX #38: Add user_id filter to coupon deletion
 const deleteCoupon = async (id: string) => {
 if (!user) return;
 await supabase.from("coupons").delete().eq("id", id).eq("user_id", user.id);
 setCouponToDelete(null);
 toast.success("Cupom removido");
 invalidateAll(["coupons"]);
 };

 const getProductName = (productId: string | null) => {
 if (!productId) return "Todos os produtos";
 const p = products.find((prod) => prod.id === productId);
 return p?.name || "Produto removido";
 };

 const getProductCouponCount = (productId: string) => {
 return coupons.filter((c) => c.product_id === productId && c.is_active).length;
 };

 const methodLabel = (m: string) => (m === "PIX" ? "Pix" : m);

 return (
 <div className="vp-fade space-y-6 pb-6 md:space-y-8">
 <Seo title="Checkouts | Vemprapay" description="Personalize o checkout de cada produto e crie cupons." path="/vendas/checkout" noindex />

 <SectionTabs section="products" />
 <PageHead
 title="Checkouts"
 subtitle="Deixe a página de pagamento de cada produto com a cara da sua marca e crie cupons de desconto."
 />

 {/* Checkouts dos produtos ativos */}
 {activeProducts.length === 0 ? (
 <section className="vp-sheet" aria-label="Checkouts">
 <EmptyPanel
 icon={<Package className="h-7 w-7" />}
 title="Nenhum produto ativo"
 text="O checkout nasce junto com o produto. Ative um produto para personalizar a página de pagamento dele."
 action={<button type="button" className="vp-cta" onClick={() => navigate("/vendas/produtos")}><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Ir para Produtos</button>}
 />
 </section>
 ) : (
 <section aria-label="Checkouts" className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
 {activeProducts.map((p) => {
 const productCoupons = getProductCouponCount(p.id);
 const methods = getPaymentMethods(p);
 return (
 <article key={p.id} className="vp-sheet group flex min-w-0 flex-col overflow-hidden transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40">
 <div className="relative aspect-[16/10] w-full overflow-hidden bg-accent">
 {p.image_url ? (
 <img src={p.image_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
 ) : (
 <div className="grid h-full w-full place-items-center"><span aria-hidden className="font-heading text-[64px] font-extrabold leading-none tracking-[-0.05em] text-primary/35">{(p.name || "?").charAt(0).toUpperCase()}</span></div>
 )}
 {(methods.length > 0 || p.checkout_timer_enabled) && (
 <div className="absolute inset-x-3.5 top-3.5 flex flex-wrap items-center gap-1.5">
 {methods.map((m) => (
 <span key={m} className="rounded-full bg-card/95 px-3 py-1 text-[12.5px] font-bold text-foreground shadow-sm backdrop-blur-sm">{methodLabel(m)}</span>
 ))}
 {p.checkout_timer_enabled && <span className="rounded-full bg-warning px-3 py-1 text-[12.5px] font-bold text-white shadow-sm">Com timer</span>}
 </div>
 )}
 </div>

 <div className="flex flex-1 flex-col p-5">
 <h3 title={p.name} className="truncate font-heading text-[19px] font-extrabold leading-tight tracking-[-0.03em] text-foreground">{p.name}</h3>
 <Money value={Number(p.price)} className="mt-2 block text-[26px] font-extrabold leading-none tracking-[-0.04em] text-foreground" centsClassName="opacity-65" />
 {p.description && <p className="mt-3 line-clamp-2 text-[14px] leading-relaxed text-muted-foreground">{p.description}</p>}

 {p.checkout_url && (
 <button
 type="button"
 onClick={() => copyLink(p.id, p.checkout_url!)}
 title="Copiar link do checkout"
 className="mt-4 flex h-10 w-full items-center gap-2.5 rounded-full bg-muted/70 px-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
 >
 {copiedId === p.id ? <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.6} /> : <Copy className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />}
 <span className={cn("truncate text-[13px] font-medium", copiedId === p.id ? "text-primary" : "text-muted-foreground")}>{copiedId === p.id ? "Link copiado" : getLocalLink(p.checkout_url).replace(/^https?:\/\//, "")}</span>
 </button>
 )}

 {productCoupons > 0 && (
 <p className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-[13px] font-bold text-warning">
 <Ticket className="h-3.5 w-3.5" />{productCoupons} {productCoupons === 1 ? "cupom ativo" : "cupons ativos"}
 </p>
 )}

 <div className="mt-auto flex items-center gap-1 pt-5">
 <button type="button" className="vp-cta h-10 px-4 text-[13.5px]" onClick={() => setSettingsProduct(p)}>
 <Settings className="h-4 w-4" strokeWidth={2.3} />
 Personalizar
 </button>
 <div className="ml-auto flex items-center">
 <button type="button" onClick={() => navigate(`/vendas/produtos/${p.id}/checkout-builder`, { state: { product: p } })} className={orb} title="Checkout builder" aria-label="Checkout builder">
 <Palette className="h-[18px] w-[18px]" strokeWidth={2} />
 </button>
 {p.checkout_url && (
 <button type="button" onClick={() => openCheckout(p.checkout_url!)} className={orb} title="Abrir checkout" aria-label="Abrir checkout">
 <ExternalLink className="h-[18px] w-[18px]" strokeWidth={2} />
 </button>
 )}
 </div>
 </div>
 </div>
 </article>
 );
 })}
 </section>
 )}

 {/* Cupons */}
 <section className="vp-sheet overflow-hidden" aria-label="Cupons de desconto">
 <div className="flex flex-col gap-4 px-5 pb-5 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:pt-6">
 <div className="min-w-0">
 <h2 className="font-heading text-[22px] font-extrabold leading-tight tracking-[-0.03em] text-foreground">Cupons de desconto</h2>
 <p className="mt-0.5 text-[14px] text-muted-foreground">Dê um desconto em um produto ou em todos eles.</p>
 </div>
 {coupons.length > 0 && (
 <button type="button" className="vp-cta shrink-0" onClick={() => setCouponOpen(true)}><Ticket className="h-[18px] w-[18px]" strokeWidth={2.2} />Novo cupom</button>
 )}
 </div>

 {coupons.length === 0 ? (
 <EmptyPanel
 icon={<Ticket className="h-7 w-7" />}
 title="Nenhum cupom criado"
 text="Cupons ajudam a fechar a compra de quem está em dúvida. Crie o primeiro em poucos segundos."
 action={<button type="button" className="vp-cta" onClick={() => setCouponOpen(true)}><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Criar cupom</button>}
 />
 ) : (
 <div className="grid grid-cols-1 gap-4 border-t border-border p-5 sm:p-7 md:grid-cols-2 xl:grid-cols-3">
 {coupons.map((c) => {
 const pct = c.max_uses ? Math.min(100, (Number(c.current_uses) / Number(c.max_uses)) * 100) : 0;
 return (
 <article key={c.id} className={cn("flex min-w-0 flex-col rounded-[22px] border border-border bg-background p-5 transition-opacity", !c.is_active && "opacity-70")}>
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <p className="truncate font-mono text-[19px] font-extrabold tracking-wide text-foreground">{c.code}</p>
 <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-muted-foreground"><Package className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{getProductName(c.product_id)}</span></p>
 </div>
 <label className="flex shrink-0 items-center gap-2 text-[13px] font-semibold text-muted-foreground">
 {c.is_active ? "Ativo" : "Pausado"}
 <Switch checked={c.is_active} onCheckedChange={() => toggleCouponActive(c.id, c.is_active)} aria-label={`Cupom ${c.code} ativo`} />
 </label>
 </div>

 <p className="mt-5 font-heading text-[34px] font-extrabold leading-none tracking-[-0.04em] text-foreground vp-num">
 {c.discount_type === "percentage" ? `${Number(c.discount_value)}%` : fmt(Number(c.discount_value))}
 <span className="ml-1.5 text-[14px] font-semibold tracking-normal text-muted-foreground">de desconto</span>
 </p>

 <div className="mt-5">
 <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
 <span className="text-muted-foreground">Usos</span>
 <span className="font-bold tabular-nums text-foreground">{c.current_uses}{c.max_uses ? ` de ${c.max_uses}` : " (sem limite)"}</span>
 </div>
 {c.max_uses ? (
 <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={Number(c.max_uses)} aria-valuenow={Number(c.current_uses)} aria-label="Usos do cupom">
 <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
 </div>
 ) : null}
 </div>

 <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
 <p className="min-w-0 text-[13.5px] text-muted-foreground">Já descontou <span className="font-bold tabular-nums text-foreground">{fmt(Number(c.total_discount_amount || 0))}</span></p>
 <button type="button" onClick={() => setCouponToDelete(c)} aria-label={`Excluir cupom ${c.code}`} title="Excluir cupom" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
 <Trash2 className="h-[18px] w-[18px]" />
 </button>
 </div>
 </article>
 );
 })}
 </div>
 )}
 </section>

 {/* Como funciona */}
 <section aria-label="Como usar" className="rounded-[22px] bg-muted/50 px-5 py-6 sm:px-7">
 <h2 className="font-heading text-[18px] font-extrabold tracking-[-0.02em] text-foreground">Como usar</h2>
 <ol className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 text-[14px] text-muted-foreground md:grid-cols-2">
 {[
 <>Cadastre e ative um produto em <strong className="font-semibold text-foreground">Produtos</strong>.</>,
 <>Toque em <strong className="font-semibold text-foreground">Personalizar</strong> para ajustar cores, timer, banners e formas de pagamento.</>,
 <>Copie o link do checkout e envie para os seus clientes.</>,
 <>Crie cupons e escolha em quais produtos eles valem.</>,
 ].map((text, i) => (
 <li key={i} className="flex gap-3">
 <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground tabular-nums">{i + 1}</span>
 <span className="pt-0.5 leading-relaxed">{text}</span>
 </li>
 ))}
 </ol>
 </section>

 {/* Novo cupom */}
 <Dialog open={couponOpen} onOpenChange={(o) => { if (!creatingCoupon) setCouponOpen(o); }}>
 <DialogContent className={cn(dialogShell, "w-[calc(100vw-1rem)] max-w-[480px]")}>
 <DialogHead icon={<Ticket className="h-5 w-5" strokeWidth={2.2} />} title="Novo cupom" subtitle="Escolha o código, o desconto e onde ele vale." />
 <form onSubmit={handleCreateCoupon} className="space-y-5 px-6 py-6 sm:px-8">
 <div>
 <FieldLabel htmlFor="cp-code" hint="Seu cliente digita esse código no checkout.">Código</FieldLabel>
 <Input id="cp-code" value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })} placeholder="DESCONTO10" required maxLength={30} autoComplete="off" className="vp-field font-mono uppercase" />
 </div>
 <div>
 <FieldLabel>Vale para</FieldLabel>
 <Select value={couponForm.product_id || "all"} onValueChange={(v) => setCouponForm({ ...couponForm, product_id: v })}>
 <SelectTrigger className="h-12 vp-r16 border-border bg-background text-[15px]" aria-label="Produto do cupom"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todos os produtos</SelectItem>
 {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div>
 <FieldLabel>Tipo de desconto</FieldLabel>
 <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de desconto">
 {[{ v: "percentage", l: "Porcentagem (%)" }, { v: "fixed", l: "Valor fixo (R$)" }].map((o) => {
 const on = couponForm.discount_type === o.v;
 return (
 <button key={o.v} type="button" aria-pressed={on} onClick={() => setCouponForm({ ...couponForm, discount_type: o.v })} className={cn("h-12 vp-r16 border px-3 text-[14.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", on ? "border-primary/50 bg-accent text-accent-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground")}>{o.l}</button>
 );
 })}
 </div>
 </div>
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <div className="min-w-0">
 <FieldLabel htmlFor="cp-value">{couponForm.discount_type === "percentage" ? "Desconto (%)" : "Desconto (R$)"}</FieldLabel>
 <Input id="cp-value" type="number" step="0.01" min="0.01" max={couponForm.discount_type === "percentage" ? "100" : "99999"} value={couponForm.discount_value} onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })} required className="vp-field tabular-nums" />
 </div>
 <div className="min-w-0">
 <FieldLabel htmlFor="cp-max">Limite de usos</FieldLabel>
 <Input id="cp-max" type="number" min="1" value={couponForm.max_uses} onChange={(e) => setCouponForm({ ...couponForm, max_uses: e.target.value })} placeholder="Sem limite" className="vp-field tabular-nums" />
 </div>
 </div>
 <button type="submit" disabled={creatingCoupon} className="vp-cta !h-12 w-full">
 {creatingCoupon ? <><Loader2 className="h-4 w-4 animate-spin" />Criando…</> : <><Ticket className="h-[18px] w-[18px]" />Criar cupom</>}
 </button>
 </form>
 </DialogContent>
 </Dialog>

 {/* Excluir cupom */}
 <ConfirmDialog
   open={!!couponToDelete} onOpenChange={(o) => { if (!o) setCouponToDelete(null); }}
   title="Excluir este cupom?" confirmLabel="Excluir cupom" cancelLabel="Manter cupom"
   description={<><span className="block break-all font-mono font-bold text-foreground">{couponToDelete?.code}</span>O código deixa de funcionar no checkout. Quem já usou o cupom não é afetado.</>}
   onConfirm={() => { if (couponToDelete) deleteCoupon(couponToDelete.id); }}
 />

 {settingsProduct && (
 <CheckoutSettingsDialog product={settingsProduct} open={!!settingsProduct} onOpenChange={(v) => { if (!v) setSettingsProduct(null); }} onSaved={() => refetchProducts()} />
 )}
 </div>
 );
}
