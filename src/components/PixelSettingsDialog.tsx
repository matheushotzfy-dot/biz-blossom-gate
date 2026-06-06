/**
 * Pixel Settings Dialog — Billion-Dollar SaaS v5
 * Clean, sharp, 100% solid. No glow, no blur, no glassmorphism.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Crosshair, Plus, Trash2, Radio, Settings2, Zap,
  ChevronDown, Sparkles, Signal, Layers,
  Power, X, CircleCheck, Hash, Key, Globe2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  product: Tables<"products">;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Platform = "facebook" | "google_ads" | "google_analytics" | "tiktok" | "kwai";

interface Pixel {
  id: string;
  platform: Platform;
  pixel_id: string;
  api_token: string;
  domain: string;
  fire_on_pix_qr: boolean;
  fire_on_boleto: boolean;
  pix_conversion_value: number;
  boleto_conversion_value: number;
  disable_bump_events: boolean;
  is_active: boolean;
  events: string[];
}

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
function AnalyticsLogo({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="14" width="4" height="8" rx="1" fill="#F9AB00"/>
      <rect x="10" y="9" width="4" height="13" rx="1" fill="#E37400"/>
      <rect x="17" y="4" width="4" height="18" rx="1" fill="#F9AB00"/>
    </svg>
  );
}

const PLATFORMS: { id: Platform; label: string; short: string; brandColor: string; LogoComp: React.FC<{className?: string; style?: React.CSSProperties}>; fields: string[] }[] = [
  { id: "facebook",         label: "Facebook Pixel",   short: "Facebook",   brandColor: "#1877F2", LogoComp: FacebookLogo,  fields: ["pixel_id", "api_token", "domain"] },
  { id: "google_ads",       label: "Google Ads",       short: "Google Ads", brandColor: "#4285F4", LogoComp: GoogleLogo,    fields: ["pixel_id", "api_token"] },
  { id: "google_analytics", label: "Google Analytics", short: "GA4",        brandColor: "#E37400", LogoComp: AnalyticsLogo, fields: ["pixel_id"] },
  { id: "tiktok",           label: "TikTok Pixel",     short: "TikTok",     brandColor: "#FF004F", LogoComp: TikTokLogo,    fields: ["pixel_id", "api_token"] },
  { id: "kwai",             label: "Kwai Pixel",       short: "Kwai",       brandColor: "#FF6B2C", LogoComp: KwaiLogo,      fields: ["pixel_id", "api_token"] },
];

const ease = [0.16, 1, 0.3, 1] as const;

export default function PixelSettingsDialog({ product, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [activePlatform, setActivePlatform] = useState<Platform>("facebook");
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedPixel, setExpandedPixel] = useState<string | null>(null);

  const [newPixelId, setNewPixelId] = useState("");
  const [newApiToken, setNewApiToken] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newEventMode, setNewEventMode] = useState<"all" | "custom">("all");
  const [newSelectedEvents, setNewSelectedEvents] = useState<string[]>([...ALL_EVENTS]);

  useEffect(() => {
    if (!open || !user) return;
    loadPixels();
  }, [open, user, product.id]);

  const loadPixels = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("product_pixels")
      .select("*")
      .eq("product_id", product.id)
      .eq("user_id", user!.id);
    if (data) setPixels(data.map((d: any) => ({
      ...d,
      events: Array.isArray(d.events) ? d.events : ALL_EVENTS,
    })));
    setLoading(false);
  };

  const platformPixels = pixels.filter(p => p.platform === activePlatform);
  const platform = PLATFORMS.find(p => p.id === activePlatform)!;

  const addPixel = async () => {
    if (!newPixelId.trim()) { toast.error("Pixel ID é obrigatório"); return; }
    const events = newEventMode === "all" ? ALL_EVENTS : newSelectedEvents;
    if (events.length === 0) { toast.error("Selecione pelo menos um evento"); return; }
    const { error } = await supabase.from("product_pixels").insert({
      product_id: product.id, user_id: user!.id, platform: activePlatform,
      pixel_id: newPixelId.trim(), api_token: newApiToken.trim() || null,
      domain: newDomain.trim() || null, events,
      fire_on_pix_qr: false, fire_on_boleto: false,
      pix_conversion_value: 100, boleto_conversion_value: 100, disable_bump_events: false,
    });
    if (error) { toast.error("Erro ao adicionar pixel"); return; }
    toast.success("Pixel adicionado!");
    setNewPixelId(""); setNewApiToken(""); setNewDomain("");
    setNewEventMode("all"); setNewSelectedEvents([...ALL_EVENTS]);
    loadPixels();
  };

  const removePixel = async (id: string) => {
    await supabase.from("product_pixels").delete().eq("id", id).eq("user_id", user!.id);
    setPixels(prev => prev.filter(p => p.id !== id));
    toast.success("Pixel removido");
  };

  const updatePixelSettings = async (pixelId: string, updates: Partial<Pixel>) => {
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
    updatePixelSettings(pixelId, { events: updated } as any);
  };

  const totalActive = pixels.filter(p => p.is_active).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[960px] max-h-[92vh] overflow-hidden flex flex-col p-0 rounded-xl border border-border bg-card gap-0">
        {/* ═══ HEADER ═══ */}
        <div className="relative border-b border-border bg-gradient-to-b from-muted/30 to-card px-8 pt-6 pb-0">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-5 right-5 h-8 w-8 rounded-md border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-4">
            <div className="relative h-12 w-12 rounded-lg border border-border bg-card flex items-center justify-center shrink-0">
              <Crosshair className="h-5 w-5 text-primary" strokeWidth={2.2} />
              <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-card bg-success" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-display text-[9.5px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Tracking / Conversão
                </span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                <span className="font-display text-[9.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70 truncate">
                  {product.name}
                </span>
              </div>
              <h2 className="mt-1 text-[22px] font-display font-black tracking-[-0.03em] text-foreground leading-tight">
                Pixels & Conversão
              </h2>
              <p className="mt-1 text-[12.5px] text-muted-foreground leading-snug max-w-[560px]">
                Conecte pixels de rastreamento e configure gatilhos de conversão por produto.
              </p>
            </div>

            {/* Compact KPI strip */}
            <div className="hidden md:flex items-stretch border border-border rounded-lg overflow-hidden bg-card shrink-0">
              <KpiCell label="Total" value={pixels.length} />
              <KpiCell label="Ativos" value={totalActive} accent="success" />
              <KpiCell label={platform.short} value={platformPixels.length} accent="primary" />
            </div>
          </div>

          {/* ═══ PLATFORM TABS ═══ */}
          <div className="mt-5 -mx-8 px-8 border-t border-border/70">
            <div className="flex gap-0 overflow-x-auto">
              {PLATFORMS.map(p => {
                const isActive = activePlatform === p.id;
                const count = pixels.filter(px => px.platform === p.id).length;
                const activeCount = pixels.filter(px => px.platform === p.id && px.is_active).length;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActivePlatform(p.id)}
                    className={cn(
                      "relative group flex items-center gap-2.5 px-4 py-3 text-[12px] font-display font-bold transition-colors whitespace-nowrap",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground/70 hover:text-foreground"
                    )}
                  >
                    <p.LogoComp
                      className={cn("h-[15px] w-[15px] shrink-0 transition-opacity", isActive ? "" : "opacity-50 group-hover:opacity-90")}
                      style={isActive ? { color: p.brandColor } : {}}
                    />
                    <span>{p.short}</span>
                    {count > 0 && (
                      <span
                        className={cn(
                          "inline-flex items-center justify-center min-w-[22px] h-[18px] px-1.5 rounded-[4px] text-[9.5px] font-numbers font-black tabular-nums border",
                          isActive
                            ? activeCount > 0
                              ? "bg-success/10 border-success/30 text-success"
                              : "bg-muted border-border text-foreground"
                            : "bg-muted/40 border-border/60 text-muted-foreground"
                        )}
                      >
                        {count}
                      </span>
                    )}
                    {isActive && (
                      <span
                        className="absolute bottom-0 left-2 right-2 h-[2px]"
                        style={{ backgroundColor: p.brandColor }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>


        {/* ═══ CONTENT ═══ */}
        <div className="flex-1 overflow-y-auto bg-background/40">
          <div className="px-7 py-6 space-y-6">

            {/* Section title — existing pixels */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-display font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Pixels Configurados
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            </div>

            {/* Existing pixels */}
            {loading ? (
              <div className="space-y-2">
                {[0, 1].map(i => (
                  <div key={i} className="h-[68px] rounded-md border border-border bg-card animate-pulse" />
                ))}
              </div>
            ) : platformPixels.length === 0 ? (
              <div className="border border-dashed border-border rounded-md py-10 text-center bg-card">
                <div className="mx-auto h-10 w-10 rounded-md border border-border bg-background flex items-center justify-center mb-3">
                  <Radio className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-[13px] font-display font-bold text-foreground">Nenhum pixel {platform.short}</p>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-[320px] mx-auto leading-relaxed">
                  Adicione um novo pixel abaixo para começar a rastrear conversões.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {platformPixels.map((px) => {
                    const isExpanded = expandedPixel === px.id;
                    const activeEvents = (px.events || []).length;
                    return (
                      <motion.div
                        key={px.id}
                        layout="position"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.22, ease }}
                        className={cn(
                          "rounded-md border bg-card overflow-hidden",
                          isExpanded ? "border-primary/40" : "border-border hover:border-border/80"
                        )}
                      >
                        {/* Row header */}
                        <div className="flex items-center gap-3 px-4 py-3">
                          {/* Brand badge */}
                          <div
                            className="h-9 w-9 rounded-md border border-border flex items-center justify-center shrink-0 bg-background"
                          >
                            <platform.LogoComp
                              className="h-4 w-4"
                              style={{ color: px.is_active ? platform.brandColor : "hsl(var(--muted-foreground))" }}
                            />
                          </div>

                          {/* ID + meta */}
                          <button
                            onClick={() => setExpandedPixel(isExpanded ? null : px.id)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <p className="font-mono text-[12px] font-bold text-foreground truncate">{px.pixel_id}</p>
                              <StatusDot active={px.is_active} />
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground font-display">
                              <span className="tabular-nums">{activeEvents} evento{activeEvents !== 1 ? "s" : ""}</span>
                              {px.api_token && <><Dot /><span>API Token</span></>}
                              {px.fire_on_pix_qr && <><Dot /><span>PIX QR</span></>}
                              {px.fire_on_boleto && <><Dot /><span>Boleto</span></>}
                            </div>
                          </button>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            <Switch
                              checked={px.is_active}
                              onCheckedChange={v => updatePixelSettings(px.id, { is_active: v })}
                            />
                            <button
                              className="h-8 w-8 rounded-md border border-transparent hover:border-destructive/30 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                              onClick={() => removePixel(px.id)}
                              aria-label="Remover pixel"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setExpandedPixel(isExpanded ? null : px.id)}
                              className={cn(
                                "h-8 w-8 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all",
                                isExpanded && "rotate-180 bg-muted/40 text-foreground"
                              )}
                              aria-label="Expandir"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Expanded panel */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease }}
                              className="overflow-hidden"
                            >
                              <div className="border-t border-border px-4 py-4 space-y-5 bg-background/40">
                                {/* Events */}
                                <div>
                                  <SectionLabel icon={Zap}>Eventos Rastreados</SectionLabel>
                                  <div className="flex flex-wrap gap-1.5">
                                    {ALL_EVENTS.map(event => {
                                      const active = (px.events || []).includes(event);
                                      return (
                                        <button
                                          key={event}
                                          type="button"
                                          onClick={() => togglePixelEvent(px.id, event)}
                                          className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10.5px] font-display font-bold transition-colors border",
                                            active
                                              ? "bg-primary/10 border-primary/30 text-primary"
                                              : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                                          )}
                                        >
                                          {active && <CircleCheck className="h-3 w-3" />}
                                          {event}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Triggers */}
                                <div>
                                  <SectionLabel icon={Settings2}>Gatilhos de Conversão</SectionLabel>
                                  <div className="space-y-2">
                                    <TriggerCard
                                      label="Disparar Purchase ao gerar QR Code PIX"
                                      desc={px.fire_on_pix_qr ? "Purchase dispara na geração do QR Code" : "Purchase dispara apenas após confirmação do pagamento"}
                                      checked={px.fire_on_pix_qr}
                                      onChange={v => updatePixelSettings(px.id, { fire_on_pix_qr: v })}
                                      showSlider={px.fire_on_pix_qr}
                                      sliderValue={px.pix_conversion_value}
                                      onSliderChange={v => updatePixelSettings(px.id, { pix_conversion_value: v })}
                                    />
                                    <TriggerCard
                                      label="Disparar Purchase ao gerar Boleto"
                                      desc={px.fire_on_boleto ? "Purchase dispara na geração do boleto" : "Purchase dispara apenas no pagamento confirmado"}
                                      checked={px.fire_on_boleto}
                                      onChange={v => updatePixelSettings(px.id, { fire_on_boleto: v })}
                                      showSlider={px.fire_on_boleto}
                                      sliderValue={px.boleto_conversion_value}
                                      onSliderChange={v => updatePixelSettings(px.id, { boleto_conversion_value: v })}
                                    />
                                    <TriggerCard
                                      label="Desativar eventos de Order Bumps"
                                      desc="Não dispara eventos de conversão para produtos adicionais"
                                      checked={px.disable_bump_events}
                                      onChange={v => updatePixelSettings(px.id, { disable_bump_events: v })}
                                    />
                                  </div>
                                </div>
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

            {/* Section title — add new */}
            <div className="flex items-center gap-2 pt-2">
              <span className="text-[10px] font-display font-black uppercase tracking-[0.18em] text-muted-foreground">
                Adicionar Novo Pixel
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            {/* ADD NEW PIXEL */}
            <div className="rounded-md border border-border bg-card overflow-hidden">
              {/* Brand strip */}
              <div className="flex items-center gap-3 border-b border-border px-5 py-3.5 bg-background/60">
                <div className="h-9 w-9 rounded-md border border-border bg-background flex items-center justify-center">
                  <platform.LogoComp className="h-4 w-4" style={{ color: platform.brandColor }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-display font-bold text-foreground leading-tight">
                    {platform.label}
                  </p>
                  <p className="text-[10.5px] text-muted-foreground font-display mt-0.5">
                    Preencha as credenciais e selecione os eventos que deseja rastrear.
                  </p>
                </div>
              </div>

              <div className="px-5 py-5 space-y-5">
                {/* Fields */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Pixel ID" icon={Hash}>
                    <Input
                      value={newPixelId}
                      onChange={e => setNewPixelId(e.target.value)}
                      placeholder="Ex: 123456789012345"
                      className="h-10 rounded-md border-border bg-background text-[12.5px] font-mono focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40"
                    />
                  </Field>
                  {platform.fields.includes("api_token") && (
                    <Field label="API Token" icon={Key}>
                      <Input
                        value={newApiToken}
                        onChange={e => setNewApiToken(e.target.value)}
                        placeholder="Token de conversão"
                        className="h-10 rounded-md border-border bg-background text-[12.5px] font-mono focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40"
                      />
                    </Field>
                  )}
                </div>
                {platform.fields.includes("domain") && (
                  <Field label="Domínio" icon={Globe2}>
                    <Input
                      value={newDomain}
                      onChange={e => setNewDomain(e.target.value)}
                      placeholder="seusite.com"
                      className="h-10 rounded-md border-border bg-background text-[12.5px] font-mono focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-primary/40"
                    />
                  </Field>
                )}

                {/* Events selector */}
                <div>
                  <Label className="text-[10px] font-display font-black uppercase tracking-[0.16em] text-muted-foreground mb-2 block">
                    Eventos
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { mode: "all" as const, label: "Todos os eventos", icon: Sparkles, desc: "Recomendado" },
                      { mode: "custom" as const, label: "Personalizado", icon: Settings2, desc: "Selecione manualmente" },
                    ].map(opt => (
                      <button
                        key={opt.mode}
                        type="button"
                        onClick={() => { setNewEventMode(opt.mode); if (opt.mode === "all") setNewSelectedEvents([...ALL_EVENTS]); }}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-left transition-colors border",
                          newEventMode === opt.mode
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                        )}
                      >
                        <opt.icon className="h-3.5 w-3.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[11.5px] font-display font-bold leading-tight">{opt.label}</p>
                          <p className={cn(
                            "text-[9.5px] font-display mt-0.5 leading-tight",
                            newEventMode === opt.mode ? "text-primary/70" : "text-muted-foreground/70"
                          )}>{opt.desc}</p>
                        </div>
                      </button>
                    ))}
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
                        <div className="mt-2.5 flex flex-wrap gap-1.5 p-3 rounded-md border border-border bg-background">
                          {ALL_EVENTS.map(event => {
                            const sel = newSelectedEvents.includes(event);
                            return (
                              <button
                                key={event}
                                type="button"
                                onClick={() => toggleNewEvent(event)}
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10.5px] font-display font-bold transition-colors border",
                                  sel
                                    ? "bg-primary/10 border-primary/30 text-primary"
                                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                                )}
                              >
                                {sel && <CircleCheck className="h-3 w-3" />}
                                {event}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <p className="text-[10.5px] text-muted-foreground font-display">
                    <span className="font-numbers font-bold text-foreground tabular-nums">{platformPixels.length}</span>
                    <span className="mx-1 text-muted-foreground/60">/</span>
                    <span className="font-numbers tabular-nums">50</span> pixels nesta plataforma
                  </p>
                  <Button
                    onClick={addPixel}
                    className="h-10 gap-2 rounded-md px-5 text-[12px] font-display font-bold"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar Pixel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Subcomponents ─── */

function StatCell({
  icon: Icon, label, value, accent, border,
}: { icon: any; label: string; value: number; accent?: "success" | "primary"; border?: boolean }) {
  const color =
    accent === "success" ? "text-success" :
    accent === "primary" ? "text-primary" :
    "text-foreground";
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3", border && "border-x border-border")}>
      <div className="h-7 w-7 rounded-md border border-border bg-card flex items-center justify-center shrink-0">
        <Icon className={cn("h-3.5 w-3.5", color)} strokeWidth={2.2} />
      </div>
      <div className="min-w-0">
        <p className="text-[9.5px] font-display font-black uppercase tracking-[0.14em] text-muted-foreground leading-none">
          {label}
        </p>
        <p className={cn("mt-1 text-[16px] font-numbers font-black tabular-nums leading-none", color)}>
          {value}
        </p>
      </div>
    </div>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-display font-black uppercase tracking-[0.1em] border",
        active
          ? "bg-success/10 border-success/30 text-success"
          : "bg-muted/40 border-border text-muted-foreground"
      )}
    >
      <span className={cn("h-1 w-1 rounded-full", active ? "bg-success" : "bg-muted-foreground")} />
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

function Dot() {
  return <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/60" />;
}

function SectionLabel({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-display font-black uppercase tracking-[0.16em] text-muted-foreground mb-2.5 flex items-center gap-1.5">
      <Icon className="h-3 w-3" /> {children}
    </p>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: any; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] font-display font-black uppercase tracking-[0.14em] text-muted-foreground mb-1.5 flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {label}
      </Label>
      {children}
    </div>
  );
}

function TriggerCard({
  label, desc, checked, onChange, showSlider, sliderValue, onSliderChange,
}: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
  showSlider?: boolean; sliderValue?: number; onSliderChange?: (v: number) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 p-3.5 rounded-md transition-colors border",
        checked ? "bg-primary/5 border-primary/30" : "bg-card border-border"
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-display font-bold text-foreground leading-tight">{label}</p>
        <p className="text-[10.5px] text-muted-foreground mt-1 leading-relaxed font-display">{desc}</p>
        {showSlider && sliderValue !== undefined && onSliderChange && (
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-[10px] text-muted-foreground font-display font-bold uppercase tracking-[0.12em]">
              Valor:
            </span>
            <Input
              type="number" min={0} max={100} value={sliderValue}
              onChange={e => onSliderChange(Number(e.target.value))}
              className="w-16 h-7 text-[11px] text-center rounded-md bg-background border-border font-numbers tabular-nums"
              onClick={e => e.stopPropagation()}
            />
            <span className="text-[10px] text-muted-foreground font-numbers font-bold">%</span>
          </div>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
