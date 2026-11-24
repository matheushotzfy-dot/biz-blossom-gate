/**
 * Pixels e rastreamento do produto.
 * Duas colunas no desktop (plataformas à esquerda, pixels à direita); no celular as plataformas viram uma faixa no topo.
 * Visual do painel do seller (pílulas, cantos grandes, verde da marca); a lógica de pixels não mudou.
 */
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Crosshair, Plus, Trash2, Radio, Settings2,
  ChevronDown, Sparkles, Check, BookOpen, ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogHead, FieldHint, FieldLabel, FormSection, GroupBox, ChoiceChip, dialogShell } from "@/components/seller-ui/form";
import { StatusPill } from "@/components/seller-ui/tx";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  product: Tables<"products">;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Platform = "facebook" | "google_ads" | "tiktok" | "kwai";

interface Pixel {
  id: string;
  platform: Platform;
  pixel_id: string;
  api_token_masked: string | null;
  has_api_token: boolean;
  domain: string;
  fire_on_pix_qr: boolean;
  fire_on_boleto: boolean;
  pix_conversion_value: number;
  boleto_conversion_value: number;
  disable_bump_events: boolean;
  is_active: boolean;
  events: string[];
}

type PixelUpdate = Partial<Omit<Pixel, "has_api_token" | "api_token_masked">> & { api_token?: string | null };

const ALL_EVENTS = [
  "PageView", "ViewContent", "InitiateCheckout", "AddToCart",
  "AddPaymentInfo", "Purchase", "Lead", "CompleteRegistration",
  "GenerateLead", "BoletoGenerated", "PixGenerated",
];

/* ─── Platform SVG Logos (official) ─── */
function FacebookLogo({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}
function GoogleLogo({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
function TikTokLogo({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34A6.34 6.34 0 009.49 21.64a6.34 6.34 0 006.34-6.34V9.42a8.16 8.16 0 004.77 1.53V7.5a4.83 4.83 0 01-1.01-.81z"/>
    </svg>
  );
}
function KwaiLogo({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 3.42-2.06 4.51.5.65.86 1.36 1.08 2.14.3 1.08.22 2.15-.22 3.1a4.5 4.5 0 01-2.33 2.2c-.65.28-1.34.35-2.03.24-.9-.14-1.64-.6-2.23-1.26-.72-.82-1.12-1.83-1.13-2.93 0-.38.06-.76.16-1.13.24-.82.7-1.52 1.3-2.08-.42-.38-.78-.8-1.06-1.28-.55-.94-.74-1.97-.58-3.05.12-.8.46-1.5.96-2.1.67-.8 1.55-1.28 2.6-1.43.78-.11 1.54-.01 2.26.3.93.4 1.62 1.08 2.08 1.98.32.63.47 1.3.43 1.99a5.7 5.7 0 01-.23.8z"/>
    </svg>
  );
}

type PlatformMeta = {
  id: Platform;
  label: string;
  short: string;
  tagline: string;
  brandColor: string;
  LogoComp: React.FC<{className?: string; style?: React.CSSProperties}>;
  fields: string[];
  docsUrl: string;
  idHint: string;
};

const PLATFORMS: PlatformMeta[] = [
  { id: "facebook",   label: "Facebook / Meta Pixel", short: "Facebook",   tagline: "Meta Conversions API + Browser Pixel",  brandColor: "#1877F2", LogoComp: FacebookLogo, fields: ["pixel_id", "api_token", "domain"], docsUrl: "https://www.facebook.com/business/help/952192354843755", idHint: "15 a 16 dígitos" },
  { id: "google_ads", label: "Google Ads",            short: "Google Ads", tagline: "Conversion Tracking via gtag",          brandColor: "#4285F4", LogoComp: GoogleLogo,   fields: ["pixel_id", "api_token"],           docsUrl: "https://support.google.com/google-ads/answer/6095821", idHint: "AW-123456789 / 123456789" },
  { id: "tiktok",     label: "TikTok Pixel",          short: "TikTok",     tagline: "TikTok Events API + Pixel SDK",         brandColor: "#FF004F", LogoComp: TikTokLogo,   fields: ["pixel_id", "api_token"],           docsUrl: "https://ads.tiktok.com/help/article/get-started-pixel", idHint: "20 caracteres alfanuméricos" },
  { id: "kwai",       label: "Kwai for Business",     short: "Kwai",       tagline: "Kwai Pixel SDK",                        brandColor: "#FF6B2C", LogoComp: KwaiLogo,     fields: ["pixel_id", "api_token"],           docsUrl: "https://ads.kwai.com/", idHint: "ID fornecido pelo Kwai Ads" },
];

const ease = [0.16, 1, 0.3, 1] as const;

const orb = "grid shrink-0 place-items-center rounded-full";
const iconBtn = "grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function PixelSettingsDialog({ product, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [activePlatform, setActivePlatform] = useState<Platform>("facebook");
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedPixel, setExpandedPixel] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [newPixelId, setNewPixelId] = useState("");
  const [newApiToken, setNewApiToken] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newEventMode, setNewEventMode] = useState<"all" | "custom">("all");
  const [newSelectedEvents, setNewSelectedEvents] = useState<string[]>([...ALL_EVENTS]);

  useEffect(() => {
    if (!open || !user) return;
    loadPixels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, product.id]);

  const loadPixels = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("product_pixels_safe")
      .select("*")
      .eq("product_id", product.id)
      .eq("user_id", user!.id);
    if (data) setPixels(data.map((d) => ({
      ...(d as unknown as Pixel),
      events: Array.isArray(d.events) ? (d.events as string[]) : ALL_EVENTS,
    })));
    setLoading(false);
  };

  const platformPixels = pixels.filter(p => p.platform === activePlatform);
  const platform = PLATFORMS.find(p => p.id === activePlatform)!;

  const platformStats = useMemo(() => {
    const m: Record<Platform, { total: number; active: number }> = {
      facebook: { total: 0, active: 0 },
      google_ads: { total: 0, active: 0 },
      tiktok: { total: 0, active: 0 },
      kwai: { total: 0, active: 0 },
    };
    pixels.forEach(p => {
      if (m[p.platform]) {
        m[p.platform].total++;
        if (p.is_active) m[p.platform].active++;
      }
    });
    return m;
  }, [pixels]);

  const addPixel = async () => {
    if (!newPixelId.trim()) { toast.error("Informe o ID do pixel"); return; }
    const events = newEventMode === "all" ? ALL_EVENTS : newSelectedEvents;
    if (events.length === 0) { toast.error("Escolha pelo menos um evento"); return; }
    const { error } = await supabase.from("product_pixels").insert({
      product_id: product.id, user_id: user!.id, platform: activePlatform,
      pixel_id: newPixelId.trim(), api_token: newApiToken.trim() || null,
      domain: newDomain.trim() || null, events,
      fire_on_pix_qr: false, fire_on_boleto: false,
      pix_conversion_value: 100, boleto_conversion_value: 100, disable_bump_events: false,
    });
    if (error) { toast.error("Não foi possível adicionar o pixel"); return; }
    toast.success(`Pixel do ${platform.short} adicionado`);
    setNewPixelId(""); setNewApiToken(""); setNewDomain("");
    setNewEventMode("all"); setNewSelectedEvents([...ALL_EVENTS]);
    loadPixels();
  };

  const removePixel = async (id: string) => {
    await supabase.from("product_pixels").delete().eq("id", id).eq("user_id", user!.id);
    setPixels(prev => prev.filter(p => p.id !== id));
    setRemovingId(null);
    toast.success("Pixel removido");
  };

  const updatePixelSettings = async (pixelId: string, updates: PixelUpdate) => {
    await supabase.from("product_pixels").update(updates).eq("id", pixelId).eq("user_id", user!.id);
    setPixels(prev => prev.map(p => p.id === pixelId ? { ...p, ...updates } : p));
  };

  const toggleNewEvent = (event: string) => {
    setNewSelectedEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
  };

  const togglePixelEvent = (pixelId: string, event: string) => {
    const pixel = pixels.find(p => p.id === pixelId);
    if (!pixel) return;
    const current = pixel.events || [];
    const updated = current.includes(event) ? current.filter(e => e !== event) : [...current, event];
    updatePixelSettings(pixelId, { events: updated });
  };

  const totalActive = pixels.filter(p => p.is_active).length;
  const pluralize = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogShell, "flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-[1040px] flex-col")}>
        <DialogHead
          icon={<Crosshair className="h-5 w-5" strokeWidth={2.2} />}
          title="Pixels e rastreamento"
          subtitle={product.name || "Produto sem nome"}
          aside={
            <div className="flex items-center gap-7">
              <HeadStat value={pixels.length} label={pixels.length === 1 ? "pixel" : "pixels"} />
              <HeadStat value={totalActive} label={totalActive === 1 ? "ativo" : "ativos"} green />
            </div>
          }
        />

        <div className="flex h-[min(700px,calc(92dvh-7.5rem))] shrink-0 flex-col md:flex-row">
          {/* Plataformas */}
          <nav
            aria-label="Plataformas de anúncio"
            className="scrollbar-none flex shrink-0 gap-1.5 overflow-x-auto border-b border-border px-4 py-3 md:w-[240px] md:flex-col md:overflow-y-auto md:border-b-0 md:border-r md:p-4"
          >
            {PLATFORMS.map(p => {
              const isActive = activePlatform === p.id;
              const stats = platformStats[p.id];
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => { setActivePlatform(p.id); setExpandedPixel(null); setRemovingId(null); }}
                  className={cn(
                    "flex shrink-0 items-center gap-3 vp-r16 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:w-full",
                    isActive ? "bg-accent ring-1 ring-primary/30" : "hover:bg-muted",
                  )}
                >
                  <span className={cn(orb, "h-10 w-10 border border-border bg-card")}>
                    <p.LogoComp className="h-[18px] w-[18px]" style={{ color: isActive ? p.brandColor : "hsl(var(--muted-foreground))" }} />
                  </span>
                  <span className="min-w-0 pr-1">
                    <span className={cn("block truncate text-[14.5px] font-bold leading-tight", isActive ? "text-accent-foreground" : "text-foreground")}>{p.short}</span>
                    <span className="mt-0.5 block whitespace-nowrap text-[12.5px] text-muted-foreground">
                      {stats.total === 0 ? "Nenhum pixel" : stats.active > 0 ? `${pluralize(stats.active, "ativo", "ativos")} de ${stats.total}` : pluralize(stats.total, "pixel pausado", "pixels pausados")}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Pixels da plataforma */}
          <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-6 sm:px-8">
            <div className="flex items-center gap-4">
              <span className={cn(orb, "h-14 w-14 border border-border bg-card")}>
                <platform.LogoComp className="h-6 w-6" style={{ color: platform.brandColor }} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-heading text-[20px] font-extrabold leading-tight tracking-[-0.03em] text-foreground">{platform.label}</h3>
                <p className="mt-0.5 text-[13.5px] text-muted-foreground">{platform.tagline}</p>
              </div>
              <div className="hidden shrink-0 sm:block">
                <a href={platform.docsUrl} target="_blank" rel="noopener noreferrer" className="vp-ghost !h-10 px-4 text-[13.5px]">
                  <BookOpen className="h-4 w-4" />
                  Guia
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              </div>
            </div>

            <FormSection
              title="Pixels configurados"
              subtitle={`Cada pixel dispara os eventos escolhidos quando alguém passa pelo checkout deste produto.`}
              aside={<span className="rounded-full bg-muted px-3 py-1 text-[13px] font-bold tabular-nums text-muted-foreground">{platformPixels.length}</span>}
            >
              {loading ? (
                <div className="space-y-2.5" aria-busy="true" aria-label="Carregando pixels">
                  {[0, 1].map(i => <div key={i} className="vp-skel h-[72px] rounded-[16px]" />)}
                </div>
              ) : platformPixels.length === 0 ? (
                <div className="flex items-center gap-4 rounded-[16px] border border-dashed border-border bg-muted/30 px-5 py-6">
                  <span className={cn(orb, "h-12 w-12 bg-accent text-accent-foreground")}><Radio className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-foreground">Nenhum pixel do {platform.short} neste produto</p>
                    <p className="mt-0.5 text-[13.5px] leading-snug text-muted-foreground">Preencha o formulário logo abaixo para começar a enviar conversões.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <AnimatePresence initial={false}>
                    {platformPixels.map((px) => {
                      const isExpanded = expandedPixel === px.id;
                      const confirming = removingId === px.id;
                      const activeEvents = (px.events || []).length;
                      return (
                        <motion.div
                          key={px.id}
                          layout="position"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.22, ease }}
                          className={cn("overflow-hidden rounded-[16px] border bg-card", isExpanded ? "border-primary/45" : "border-border")}
                        >
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 sm:flex-nowrap">
                            <span className={cn(orb, "h-11 w-11 bg-muted")}>
                              <platform.LogoComp className="h-5 w-5" style={{ color: px.is_active ? platform.brandColor : "hsl(var(--muted-foreground))" }} />
                            </span>

                            <button
                              type="button"
                              onClick={() => setExpandedPixel(isExpanded ? null : px.id)}
                              aria-expanded={isExpanded}
                              className="min-w-0 basis-[calc(100%-3.5rem)] rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-1 sm:basis-auto"
                            >
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="truncate font-mono text-[14px] font-bold text-foreground">{px.pixel_id}</span>
                                <StatusPill label={px.is_active ? "Ativo" : "Pausado"} tone={px.is_active ? "ok" : "idle"} />
                              </span>
                              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
                                <span className="tabular-nums">{pluralize(activeEvents, "evento", "eventos")}</span>
                                {px.has_api_token && <span>Token protegido</span>}
                                {px.fire_on_pix_qr && <span className="font-semibold vp-green-ink">Compra no QR Code Pix</span>}
                                {px.fire_on_boleto && <span className="font-semibold vp-green-ink">Compra no boleto</span>}
                              </span>
                            </button>

                            {confirming ? (
                              <div className="flex w-full items-center justify-end gap-2 sm:w-auto" role="group" aria-label="Confirmar remoção do pixel">
                                <span className="mr-1 text-[13.5px] font-semibold text-foreground">Remover este pixel?</span>
                                <button type="button" className="vp-ghost !h-10 px-4 text-[13.5px]" onClick={() => setRemovingId(null)}>Manter</button>
                                <button type="button" className="vp-cta vp-cta-danger !h-10 px-4 text-[13.5px]" onClick={() => removePixel(px.id)}>Remover</button>
                              </div>
                            ) : (
                              <div className="flex w-full items-center justify-end gap-1 sm:w-auto">
                                <Switch
                                  checked={px.is_active}
                                  onCheckedChange={v => updatePixelSettings(px.id, { is_active: v })}
                                  aria-label={px.is_active ? "Pausar pixel" : "Ativar pixel"}
                                  className="mr-1"
                                />
                                <button type="button" className={cn(iconBtn, "hover:!bg-destructive/10 hover:!text-destructive")} onClick={() => setRemovingId(px.id)} aria-label="Remover pixel" title="Remover pixel">
                                  <Trash2 className="h-[18px] w-[18px]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExpandedPixel(isExpanded ? null : px.id)}
                                  className={iconBtn}
                                  aria-label={isExpanded ? "Recolher ajustes" : "Abrir ajustes"}
                                  title={isExpanded ? "Recolher ajustes" : "Abrir ajustes"}
                                >
                                  <ChevronDown className={cn("h-[18px] w-[18px] transition-transform duration-200", isExpanded && "rotate-180")} />
                                </button>
                              </div>
                            )}
                          </div>

                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22, ease }}
                                className="overflow-hidden"
                              >
                                <div className="space-y-6 border-t border-border bg-muted/30 px-4 py-5 sm:px-5">
                                  <FormSection title="Eventos enviados" subtitle="Toque para ligar ou desligar cada evento deste pixel.">
                                    <div className="flex flex-wrap gap-2">
                                      {ALL_EVENTS.map(event => {
                                        const active = (px.events || []).includes(event);
                                        return (
                                          <ChoiceChip key={event} active={active} onClick={() => togglePixelEvent(px.id, event)} className={active ? "!bg-accent !text-accent-foreground !border-primary/40" : "bg-card"}>
                                            {active && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                                            {event}
                                          </ChoiceChip>
                                        );
                                      })}
                                    </div>
                                  </FormSection>

                                  <FormSection title="Quando disparar a compra" subtitle="Por padrão a compra só é enviada depois que o pagamento é confirmado.">
                                    <GroupBox>
                                      <TriggerRow
                                        label="Ao gerar o QR Code Pix"
                                        desc={px.fire_on_pix_qr ? "A compra é enviada assim que o QR Code é gerado" : "A compra só é enviada depois da confirmação do Pix"}
                                        checked={px.fire_on_pix_qr}
                                        onChange={v => updatePixelSettings(px.id, { fire_on_pix_qr: v })}
                                        valueLabel="Valor enviado"
                                        showValue={px.fire_on_pix_qr}
                                        value={px.pix_conversion_value}
                                        onValueChange={v => updatePixelSettings(px.id, { pix_conversion_value: v })}
                                      />
                                      <TriggerRow
                                        label="Ao gerar o boleto"
                                        desc={px.fire_on_boleto ? "A compra é enviada assim que o boleto é gerado" : "A compra só é enviada depois do pagamento do boleto"}
                                        checked={px.fire_on_boleto}
                                        onChange={v => updatePixelSettings(px.id, { fire_on_boleto: v })}
                                        valueLabel="Valor enviado"
                                        showValue={px.fire_on_boleto}
                                        value={px.boleto_conversion_value}
                                        onValueChange={v => updatePixelSettings(px.id, { boleto_conversion_value: v })}
                                      />
                                      <TriggerRow
                                        label="Ignorar order bumps"
                                        desc="Ofertas adicionais não geram eventos de conversão"
                                        checked={px.disable_bump_events}
                                        onChange={v => updatePixelSettings(px.id, { disable_bump_events: v })}
                                      />
                                    </GroupBox>
                                  </FormSection>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </FormSection>

            <FormSection
              title={`Adicionar pixel do ${platform.short}`}
              subtitle="O navegador e o servidor enviam o mesmo ID de evento, então a plataforma não conta a mesma venda duas vezes."
            >
              <div className="space-y-5 rounded-[16px] border border-border bg-card p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <FieldLabel htmlFor="px-id">ID do pixel</FieldLabel>
                    <Input id="px-id" value={newPixelId} onChange={e => setNewPixelId(e.target.value)} placeholder="Ex.: 123456789012345" autoComplete="off" spellCheck={false} className="vp-field font-mono" />
                    <FieldHint>{platform.idHint}</FieldHint>
                  </div>
                  {platform.fields.includes("api_token") && (
                    <div className="min-w-0">
                      <FieldLabel htmlFor="px-token">Token de acesso</FieldLabel>
                      <Input id="px-token" value={newApiToken} onChange={e => setNewApiToken(e.target.value)} placeholder="Cole o token de conversão" autoComplete="off" spellCheck={false} className="vp-field font-mono" />
                      <FieldHint>Necessário para enviar eventos pelo servidor (Conversions API).</FieldHint>
                    </div>
                  )}
                </div>
                {platform.fields.includes("domain") && (
                  <div>
                    <FieldLabel htmlFor="px-domain">Domínio verificado</FieldLabel>
                    <Input id="px-domain" value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="seusite.com" autoComplete="off" spellCheck={false} className="vp-field font-mono" />
                    <FieldHint>Recomendado para medir conversões em iPhones com iOS 14 ou mais novo.</FieldHint>
                  </div>
                )}

                <div>
                  <FieldLabel>Eventos que este pixel envia</FieldLabel>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {[
                      { mode: "all" as const, label: "Todos os eventos", icon: Sparkles, desc: "Recomendado para a maioria dos casos" },
                      { mode: "custom" as const, label: "Escolher eventos", icon: Settings2, desc: "Você marca um por um" },
                    ].map(opt => {
                      const on = newEventMode === opt.mode;
                      return (
                        <button
                          key={opt.mode}
                          type="button"
                          aria-pressed={on}
                          onClick={() => { setNewEventMode(opt.mode); if (opt.mode === "all") setNewSelectedEvents([...ALL_EVENTS]); }}
                          className={cn(
                            "flex items-center gap-3 vp-r16 border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            on ? "border-primary/50 bg-accent" : "border-border bg-background hover:bg-muted",
                          )}
                        >
                          <span className={cn(orb, "h-10 w-10", on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}><opt.icon className="h-[18px] w-[18px]" /></span>
                          <span className="min-w-0">
                            <span className={cn("block text-[14.5px] font-bold leading-tight", on ? "text-accent-foreground" : "text-foreground")}>{opt.label}</span>
                            <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{opt.desc}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <AnimatePresence initial={false}>
                    {newEventMode === "custom" && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 flex flex-wrap gap-2 rounded-[16px] border border-border bg-background p-3.5">
                          {ALL_EVENTS.map(event => {
                            const sel = newSelectedEvents.includes(event);
                            return (
                              <ChoiceChip key={event} active={sel} onClick={() => toggleNewEvent(event)} className={sel ? "!bg-accent !text-accent-foreground !border-primary/40" : "bg-card"}>
                                {sel && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                                {event}
                              </ChoiceChip>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[13.5px] text-muted-foreground">
                    <span className="font-bold tabular-nums text-foreground">{platformPixels.length}</span> de <span className="tabular-nums">50</span> pixels usados no {platform.short}
                  </p>
                  <button type="button" onClick={addPixel} className="vp-cta w-full sm:w-auto">
                    <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
                    Adicionar pixel
                  </button>
                </div>
              </div>
            </FormSection>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Subcomponentes ─── */

function HeadStat({ value, label, green }: { value: number; label: string; green?: boolean }) {
  return (
    <div className="text-right">
      <p className={cn("font-heading text-[26px] font-extrabold leading-none tracking-[-0.04em] tabular-nums", green ? "vp-green-ink" : "text-foreground")}>{value}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{label}</p>
    </div>
  );
}

function TriggerRow({
  label, desc, checked, onChange, showValue, value, onValueChange, valueLabel,
}: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
  showValue?: boolean; value?: number; onValueChange?: (v: number) => void; valueLabel?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-semibold leading-tight text-foreground">{label}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{desc}</p>
        {showValue && value !== undefined && onValueChange && (
          <label className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
            {valueLabel}
            <Input
              type="number" min={0} max={100} value={value}
              onChange={e => onValueChange(Number(e.target.value))}
              onClick={e => e.stopPropagation()}
              className="vp-field !h-10 !w-20 text-center font-bold tabular-nums"
            />
            % do preço
          </label>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} className="mt-0.5" />
    </div>
  );
}
