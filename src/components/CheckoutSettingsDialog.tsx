import { useState, useRef, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Palette, Timer, ShieldCheck, CreditCard, QrCode, FileText, MapPin, Mail, X, Upload, Package, Plus, Trash2, Users, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DialogHead, FieldLabel, FormSection, GroupBox, ToggleRow, dialogShell, tabListClass, tabTriggerClass } from "@/components/seller-ui/form";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
 product: Tables<"products">;
 open: boolean;
 onOpenChange: (v: boolean) => void;
 onSaved: () => void;
}

export default function CheckoutSettingsDialog({ product, open, onOpenChange, onSaved }: Props) {
 const { user } = useAuth();
 const [saving, setSaving] = useState(false);

 const [buttonColor, setButtonColor] = useState(product.checkout_button_color || "#10b981");
 const [timerEnabled, setTimerEnabled] = useState(product.checkout_timer_enabled ?? true);
 const [timerMinutes, setTimerMinutes] = useState(String(product.checkout_timer_minutes ?? 15));
 const [socialProof, setSocialProof] = useState(product.checkout_social_proof ?? false);
 const [guaranteeEnabled, setGuaranteeEnabled] = useState(product.checkout_guarantee_enabled ?? true);
 const [pixEnabled, setPixEnabled] = useState(product.checkout_pix_enabled ?? true);
 const [boletoEnabled, setBoletoEnabled] = useState(product.checkout_boleto_enabled ?? false);
 const [creditCardEnabled, setCreditCardEnabled] = useState(product.checkout_credit_card_enabled ?? true);
 const [allowedMethods, setAllowedMethods] = useState({ pix: true, boleto: false, card: true });
 const [addressRequired, setAddressRequired] = useState(product.checkout_address_required ?? false);
 const [emailConfirm, setEmailConfirm] = useState(product.checkout_email_confirm ?? true);

 const [bannerDesktopPreview, setBannerDesktopPreview] = useState(product.checkout_banner_desktop_url || "");
 const [bannerMobilePreview, setBannerMobilePreview] = useState(product.checkout_banner_mobile_url || "");
 const [bannerDesktopFile, setBannerDesktopFile] = useState<File | null>(null);
 const [bannerMobileFile, setBannerMobileFile] = useState<File | null>(null);
 const desktopRef = useRef<HTMLInputElement>(null);
 const mobileRef = useRef<HTMLInputElement>(null);

 // Order bumps
 const [allProducts, setAllProducts] = useState<Tables<"products">[]>([]);
 const [orderBumps, setOrderBumps] = useState<{ id: string; bump_product_id: string }[]>([]);
 const [selectedBumpProduct, setSelectedBumpProduct] = useState("");

 useEffect(() => {
 if (!user?.id || !open) return;
 // Load all products except current
 supabase.from("products").select("*").eq("user_id", user.id).eq("status", "active").neq("id", product.id)
 .then(({ data }) => { if (data) setAllProducts(data); });
 // Load existing order bumps
 supabase.from("order_bumps").select("id, bump_product_id").eq("product_id", product.id)
 .then(({ data }) => { if (data) setOrderBumps(data); });
 supabase.from("profiles").select("pix_enabled, boleto_enabled, credit_card_enabled").eq("user_id", user.id).maybeSingle()
 .then(({ data }) => {
  if (!data) return;
  setAllowedMethods({ pix: data.pix_enabled, boleto: data.boleto_enabled, card: data.credit_card_enabled });
  if (!data.pix_enabled) setPixEnabled(false);
  if (!data.boleto_enabled) setBoletoEnabled(false);
  if (!data.credit_card_enabled) setCreditCardEnabled(false);
 });
 }, [user?.id, open, product.id]);

  const uploadBanner = async (file: File, type: string): Promise<string | null> => {
    const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
    if (!ALLOWED.includes(file.type)) { toast.error("Use JPG, PNG ou WebP"); return null; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Banner: máximo 5MB"); return null; }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${user!.id}/${product.id}-${type}.${ext}`;
    const { error } = await supabase.storage.from("checkout-banners").upload(path, file, { upsert: true });
    if (error) { toast.error("Erro ao enviar banner"); return null; }
    const { data } = supabase.storage.from("checkout-banners").getPublicUrl(path);
    return data.publicUrl;
  };

 const handleSave = async () => {
 setSaving(true);
 try {
 let desktopUrl = bannerDesktopPreview;
 let mobileUrl = bannerMobilePreview;
 if (bannerDesktopFile) {
 const url = await uploadBanner(bannerDesktopFile, "desktop");
 if (!url) return; // não salva um link temporário (blob:) se o envio falhou
 desktopUrl = url;
 }
 if (bannerMobileFile) {
 const url = await uploadBanner(bannerMobileFile, "mobile");
 if (!url) return;
 mobileUrl = url;
 }

 const { error } = await supabase.from("products").update({
 checkout_button_color: buttonColor,
 checkout_timer_enabled: timerEnabled,
 checkout_timer_minutes: parseInt(timerMinutes) || 15,
 checkout_banner_desktop_url: desktopUrl || null,
 checkout_banner_mobile_url: mobileUrl || null,
 checkout_social_proof: socialProof,
 checkout_guarantee_enabled: guaranteeEnabled,
 checkout_pix_enabled: pixEnabled,
 checkout_boleto_enabled: boletoEnabled,
 checkout_credit_card_enabled: creditCardEnabled,
 checkout_address_required: addressRequired,
 checkout_email_confirm: emailConfirm,
 }).eq("id", product.id).eq("user_id", user!.id);

 if (error) { toast.error("Não foi possível salvar o checkout"); return; }
 toast.success("Checkout salvo");
 onSaved();
 onOpenChange(false);
 } finally { setSaving(false); }
 };

 const handleFile = (e: React.ChangeEvent<HTMLInputElement>, type: "desktop" | "mobile") => {
 const file = e.target.files?.[0];
 if (!file) return;
 const ALLOWED_BANNER_TYPES = ["image/jpeg", "image/png", "image/webp"];
 if (!ALLOWED_BANNER_TYPES.includes(file.type)) { toast.error("Formato inválido. Use JPG, PNG ou WebP"); return; }
 if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB"); return; }
 if (type === "desktop") {
 setBannerDesktopFile(file);
 setBannerDesktopPreview(URL.createObjectURL(file));
 } else {
 setBannerMobileFile(file);
 setBannerMobilePreview(URL.createObjectURL(file));
 }
 };

 const addBump = async () => {
 if (!selectedBumpProduct) return;
 if (orderBumps.some(b => b.bump_product_id === selectedBumpProduct)) {
 toast.error("Esse produto já está vinculado"); return;
 }
 const { data, error } = await supabase.from("order_bumps").insert({
 product_id: product.id,
 bump_product_id: selectedBumpProduct,
 sort_order: orderBumps.length,
 }).select("id, bump_product_id").maybeSingle();
 if (error || !data) { toast.error("Não foi possível vincular o produto"); return; }
 setOrderBumps(prev => [...prev, data]);
 setSelectedBumpProduct("");
 toast.success("Order bump vinculado");
 };

 const removeBump = async (id: string) => {
 await supabase.from("order_bumps").delete().eq("id", id).eq("product_id", product.id);
 setOrderBumps(prev => prev.filter(b => b.id !== id));
 toast.success("Order bump removido");
 };

 const availableForBump = allProducts.filter(p => !orderBumps.some(b => b.bump_product_id === p.id));

  const bumpExtra = orderBumps.reduce((sum, b) => {
    const p = allProducts.find(ap => ap.id === b.bump_product_id);
    return sum + Number(p?.price || 0);
  }, 0);
  const noMethodAllowed = !allowedMethods.pix && !allowedMethods.boleto && !allowedMethods.card;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogShell, "flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-[720px] flex-col")}>
        <DialogHead icon={<Palette className="h-5 w-5" strokeWidth={2.2} />} title="Personalizar checkout" subtitle={product.name || "Produto sem nome"} />

        <Tabs defaultValue="visual" className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-border px-5 py-3 sm:px-8">
            <TabsList className={tabListClass}>
              <TabsTrigger value="visual" className={tabTriggerClass}><Palette className="h-4 w-4" /> Visual</TabsTrigger>
              <TabsTrigger value="payment" className={tabTriggerClass}><CreditCard className="h-4 w-4" /> Pagamento</TabsTrigger>
              <TabsTrigger value="form" className={tabTriggerClass}><Mail className="h-4 w-4" /> Formulário</TabsTrigger>
              <TabsTrigger value="bumps" className={tabTriggerClass}><Package className="h-4 w-4" /> Order bumps</TabsTrigger>
            </TabsList>
          </div>

          <div className="h-[min(480px,calc(92dvh-16rem))] shrink-0 overflow-y-auto px-5 py-6 sm:px-8">
            {/* VISUAL */}
            <TabsContent value="visual" className="mt-0 space-y-8">
              <FormSection title="Botão de compra" subtitle="Escolha a cor que combina com a sua página de vendas.">
                <div className="space-y-4 rounded-[16px] border border-border bg-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-full border border-border" title="Escolher cor">
                      <span className="sr-only">Escolher a cor do botão</span>
                      <input type="color" value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] cursor-pointer border-0 bg-transparent p-0" />
                    </label>
                    <Input value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} aria-label="Código da cor" spellCheck={false} className="vp-field min-w-0 flex-1 font-mono sm:max-w-[170px]" />
                    <span className="inline-flex h-12 items-center justify-center rounded-full px-8 text-[15px] font-bold text-white shadow-sm" style={{ backgroundColor: buttonColor }}>Comprar agora</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Cores sugeridas">
                    {BUTTON_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setButtonColor(c)}
                        aria-label={`Usar a cor ${c}`}
                        aria-pressed={buttonColor.toLowerCase() === c}
                        className={cn("h-8 w-8 rounded-full border border-black/10 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card", buttonColor.toLowerCase() === c && "ring-2 ring-primary ring-offset-2 ring-offset-card")}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </FormSection>

              <FormSection title="Banners" subtitle="Imagem no topo do checkout. JPG, PNG ou WebP, até 5 MB.">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <BannerSlot label="Computador" preview={bannerDesktopPreview} inputRef={desktopRef} onSelect={() => desktopRef.current?.click()} onClear={() => { setBannerDesktopFile(null); setBannerDesktopPreview(""); }} onChange={(e) => handleFile(e, "desktop")} />
                  <BannerSlot label="Celular" preview={bannerMobilePreview} inputRef={mobileRef} onSelect={() => mobileRef.current?.click()} onClear={() => { setBannerMobileFile(null); setBannerMobilePreview(""); }} onChange={(e) => handleFile(e, "mobile")} />
                </div>
              </FormSection>

              <FormSection title="Gatilhos de conversão" subtitle="Elementos que ajudam o cliente a decidir.">
                <GroupBox>
                  <ToggleRow tone="warning" icon={<Timer className="h-[18px] w-[18px]" />} title="Timer de urgência" description="Contagem regressiva no topo da página">
                    <div className="flex items-center gap-2.5">
                      {timerEnabled && (
                        <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                          <span className="sr-only">Minutos do timer</span>
                          <Input type="number" min="1" max="60" value={timerMinutes} onChange={(e) => setTimerMinutes(e.target.value)} className="vp-field !h-10 !w-[72px] text-center font-bold tabular-nums" />
                          min
                        </label>
                      )}
                      <Switch checked={timerEnabled} onCheckedChange={setTimerEnabled} aria-label="Timer de urgência" />
                    </div>
                  </ToggleRow>
                  <ToggleRow icon={<Users className="h-[18px] w-[18px]" />} title="Prova social" description="Mostra quantas pessoas já compraram">
                    <Switch checked={socialProof} onCheckedChange={setSocialProof} aria-label="Prova social" />
                  </ToggleRow>
                  <ToggleRow icon={<ShieldCheck className="h-[18px] w-[18px]" />} title="Garantia de 7 dias" description="Selo de devolução garantida">
                    <Switch checked={guaranteeEnabled} onCheckedChange={setGuaranteeEnabled} aria-label="Garantia de 7 dias" />
                  </ToggleRow>
                </GroupBox>
              </FormSection>
            </TabsContent>

            {/* PAGAMENTO */}
            <TabsContent value="payment" className="mt-0 space-y-4">
              <FormSection title="Formas de pagamento" subtitle="O que o cliente pode usar para pagar este produto.">
                {noMethodAllowed ? (
                  <div className="rounded-[16px] border border-dashed border-border bg-muted/30 px-5 py-8 text-center">
                    <p className="text-[15px] font-bold text-foreground">Nenhuma forma de pagamento liberada</p>
                    <p className="mx-auto mt-1 max-w-[340px] text-[13.5px] leading-snug text-muted-foreground">As formas de pagamento são liberadas na sua conta. Fale com o suporte para ativar.</p>
                  </div>
                ) : (
                  <GroupBox>
                    {allowedMethods.pix && (
                      <ToggleRow icon={<QrCode className="h-[18px] w-[18px]" />} title="Pix" description="Aprovação imediata">
                        <Switch checked={pixEnabled} onCheckedChange={setPixEnabled} aria-label="Pix" />
                      </ToggleRow>
                    )}
                    {allowedMethods.boleto && (
                      <ToggleRow tone="warning" icon={<FileText className="h-[18px] w-[18px]" />} title="Boleto bancário" description="Compensação em 1 a 3 dias úteis">
                        <Switch checked={boletoEnabled} onCheckedChange={setBoletoEnabled} aria-label="Boleto bancário" />
                      </ToggleRow>
                    )}
                    {allowedMethods.card && (
                      <ToggleRow icon={<CreditCard className="h-[18px] w-[18px]" />} title="Cartão de crédito" description="Parcelamento em até 12x">
                        <Switch checked={creditCardEnabled} onCheckedChange={setCreditCardEnabled} aria-label="Cartão de crédito" />
                      </ToggleRow>
                    )}
                  </GroupBox>
                )}
                <p className="px-1 text-[13px] text-muted-foreground">Mantenha ao menos uma forma de pagamento ativa.</p>
              </FormSection>
            </TabsContent>

            {/* FORMULÁRIO */}
            <TabsContent value="form" className="mt-0 space-y-4">
              <FormSection title="Dados do cliente" subtitle="Escolha o que pedir na hora da compra. Menos campos costumam vender mais.">
                <GroupBox>
                  <ToggleRow icon={<MapPin className="h-[18px] w-[18px]" />} title="Endereço de entrega" description="CEP com preenchimento automático">
                    <Switch checked={addressRequired} onCheckedChange={setAddressRequired} aria-label="Endereço de entrega" />
                  </ToggleRow>
                  <ToggleRow icon={<Mail className="h-[18px] w-[18px]" />} title="Confirmação de e-mail" description="O cliente digita o e-mail duas vezes">
                    <Switch checked={emailConfirm} onCheckedChange={setEmailConfirm} aria-label="Confirmação de e-mail" />
                  </ToggleRow>
                </GroupBox>
              </FormSection>
            </TabsContent>

            {/* ORDER BUMPS */}
            <TabsContent value="bumps" className="mt-0 space-y-6">
              <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] divide-x divide-border overflow-hidden rounded-[16px] border border-border bg-muted/40">
                <BumpStat label="Ofertas" value={String(orderBumps.length)} />
                <BumpStat label="Extra por venda" value={formatCurrency(bumpExtra)} green />
                <BumpStat label="Disponíveis" value={String(availableForBump.length)} />
              </div>

              {orderBumps.length > 0 ? (
                <GroupBox>
                  {orderBumps.map((bump, idx) => {
                    const prod = allProducts.find(p => p.id === bump.bump_product_id);
                    return (
                      <div key={bump.id} className="flex items-center gap-3.5 px-4 py-3">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[13px] font-bold tabular-nums text-muted-foreground">{idx + 1}</span>
                        {prod?.image_url ? (
                          <img src={prod.image_url} alt="" className="h-12 w-12 shrink-0 rounded-[12px] border border-border object-cover" />
                        ) : (
                          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] border border-border bg-accent text-accent-foreground"><Package className="h-5 w-5" /></span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14.5px] font-semibold leading-tight text-foreground">{prod?.name || "Produto"}</p>
                          <p className="mt-0.5 text-[13.5px] font-medium tabular-nums text-muted-foreground">{formatCurrency(Number(prod?.price || 0))}</p>
                        </div>
                        <button type="button" onClick={() => removeBump(bump.id)} aria-label={`Desvincular ${prod?.name || "produto"}`} title="Desvincular" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                          <Trash2 className="h-[18px] w-[18px]" />
                        </button>
                      </div>
                    );
                  })}
                </GroupBox>
              ) : availableForBump.length > 0 ? (
                <div className="rounded-[16px] border border-dashed border-border bg-muted/30 px-5 py-8 text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground"><Package className="h-5 w-5" /></span>
                  <p className="mt-3 text-[15px] font-bold text-foreground">Nenhuma oferta vinculada</p>
                  <p className="mt-0.5 text-[13.5px] text-muted-foreground">Escolha um produto abaixo para oferecer junto com este.</p>
                </div>
              ) : null}

              {availableForBump.length > 0 && (
                <div>
                  <FieldLabel hint="A oferta aparece antes do cliente concluir o pagamento.">Vincular produto</FieldLabel>
                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <Select value={selectedBumpProduct} onValueChange={setSelectedBumpProduct}>
                      <SelectTrigger className="h-12 min-w-0 flex-1 vp-r16 border-border bg-background text-[15px] data-[placeholder]:font-normal data-[placeholder]:text-muted-foreground" aria-label="Produto para vincular">
                        <SelectValue placeholder="Escolha um dos seus produtos" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableForBump.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="font-medium">{p.name}</span>
                            <span className="ml-2 tabular-nums text-muted-foreground">{formatCurrency(Number(p.price))}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button type="button" onClick={addBump} disabled={!selectedBumpProduct} className="vp-cta !h-12 sm:min-w-[140px]">
                      <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
                      Vincular
                    </button>
                  </div>
                </div>
              )}

              {allProducts.length === 0 && orderBumps.length === 0 && (
                <div className="rounded-[16px] border border-dashed border-border bg-muted/30 px-5 py-8 text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground"><Package className="h-5 w-5" /></span>
                  <p className="mt-3 text-[15px] font-bold text-foreground">Você ainda não tem outro produto ativo</p>
                  <p className="mx-auto mt-0.5 max-w-[320px] text-[13.5px] leading-snug text-muted-foreground">Ative outro produto para poder oferecê-lo como order bump neste checkout.</p>
                  <a href="/vendas/produtos" className="vp-ghost mt-5 !h-10 px-4 text-[13.5px]"><Plus className="h-4 w-4" />Ir para Produtos</a>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <div className="border-t border-border bg-muted/40 px-5 py-4 sm:px-8">
          <button type="button" onClick={handleSave} disabled={saving} className="vp-cta !h-12 w-full">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Salvando…</> : "Salvar checkout"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Auxiliares de layout ─── */

const BUTTON_PRESETS = ["#10b981", "#2563eb", "#f97316", "#8b5cf6", "#e11d48", "#111827"];

function BumpStat({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="min-w-0 px-3 py-3.5 sm:px-4">
      <p className="text-[12.5px] leading-tight text-muted-foreground sm:text-[13px]">{label}</p>
      <p className={cn("mt-1 truncate font-heading text-[17px] font-extrabold leading-tight tracking-[-0.03em] tabular-nums sm:text-[21px]", green ? "vp-green-ink" : "text-foreground")}>{value}</p>
    </div>
  );
}

function BannerSlot({
  label, preview, inputRef, onSelect, onClear, onChange,
}: {
  label: string;
  preview: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onSelect: () => void;
  onClear: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-[13.5px] font-semibold text-foreground">{label}</p>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} className="hidden" />
      {preview ? (
        <div className="relative aspect-[16/9] overflow-hidden rounded-[16px] border border-border bg-muted">
          <img src={preview} alt={`Banner para ${label.toLowerCase()}`} className="h-full w-full object-cover" />
          <button type="button" onClick={onClear} aria-label={`Remover banner de ${label.toLowerCase()}`} className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-card/95 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-destructive hover:text-destructive-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={onSelect} className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 vp-r16 border border-dashed border-border bg-muted/30 text-[13.5px] font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-card text-foreground shadow-sm"><Upload className="h-[18px] w-[18px]" /></span>
          Enviar imagem
        </button>
      )}
    </div>
  );
}
