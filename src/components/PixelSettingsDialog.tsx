/**
 * Pixel Settings Dialog — Cinematic Enterprise v3
 * Premium conversion pixel management with immersive dark UI.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Crosshair, Plus, Trash2, Radio, Settings2, Zap,
  ChevronDown, ChevronUp, Shield, Sparkles,
  Activity, Globe, Target, BarChart3, Signal, Layers,
  Power, Eye, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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

const PLATFORMS: { id: Platform; label: string; color: string; bg: string; ring: string; icon: typeof Globe; fields: string[] }[] = [
  { id: "facebook", label: "Facebook", color: "text-[hsl(220,80%,55%)]", bg: "bg-[hsl(220,80%,55%)]/12", ring: "ring-[hsl(220,80%,55%)]/20", icon: Globe, fields: ["pixel_id", "api_token", "domain"] },
  { id: "google_ads", label: "Google Ads", color: "text-warning", bg: "bg-warning/12", ring: "ring-warning/20", icon: Target, fields: ["pixel_id", "api_token"] },
  { id: "google_analytics", label: "Analytics", color: "text-[hsl(25,90%,55%)]", bg: "bg-[hsl(25,90%,55%)]/12", ring: "ring-[hsl(25,90%,55%)]/20", icon: BarChart3, fields: ["pixel_id"] },
  { id: "tiktok", label: "TikTok", color: "text-[hsl(340,70%,60%)]", bg: "bg-[hsl(340,70%,60%)]/12", ring: "ring-[hsl(340,70%,60%)]/20", icon: Activity, fields: ["pixel_id", "api_token"] },
  { id: "kwai", label: "Kwai", color: "text-[hsl(25,85%,55%)]", bg: "bg-[hsl(25,85%,55%)]/12", ring: "ring-[hsl(25,85%,55%)]/20", icon: Signal, fields: ["pixel_id", "api_token"] },
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] max-h-[92vh] overflow-hidden flex flex-col p-0 rounded-3xl border-border/15 bg-card backdrop-blur-3xl gap-0 shadow-[0_32px_100px_hsl(var(--foreground)/0.15)]">
        {/* ═══ HEADER ═══ */}
        <div className="relative px-7 pt-7 pb-5 overflow-hidden">
          {/* Ambient glow */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent" />
          <div className="pointer-events-none absolute -top-32 -right-32 w-64 h-64 rounded-full bg-primary/[0.08] blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-info/[0.04] blur-[80px]" />

          {/* Close */}
          <button onClick={() => onOpenChange(false)}
            className="absolute top-5 right-5 z-10 h-8 w-8 rounded-xl bg-muted/10 ring-1 ring-border/10 flex items-center justify-center text-muted-foreground/30 hover:text-foreground hover:bg-muted/20 transition-all">
            <X className="h-3.5 w-3.5" />
          </button>

          {/* Title */}
          <div className="relative flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/15 flex items-center justify-center shadow-lg shadow-primary/10">
              <Crosshair className="h-5.5 w-5.5 text-primary" />
            </div>
            <div>
              <h2 className="text-[18px] font-display font-black tracking-[-0.03em] text-foreground">Pixels de Conversão</h2>
              <p className="text-[11px] text-muted-foreground/40 font-display font-medium mt-0.5">{product.name}</p>
            </div>
          </div>

          {/* Stats pills */}
          <div className="relative flex items-center gap-3 mt-5">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-muted/6 ring-1 ring-border/8">
              <Layers className="h-3 w-3 text-primary/40" />
              <span className="text-[10px] font-display font-bold text-muted-foreground/40">
                <span className="text-primary font-numbers">{pixels.length}</span> pixel{pixels.length !== 1 ? "s" : ""} configurado{pixels.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-success/5 ring-1 ring-success/10">
              <Power className="h-3 w-3 text-success/50" />
              <span className="text-[10px] font-display font-bold text-muted-foreground/40">
                <span className="text-success font-numbers">{pixels.filter(p => p.is_active).length}</span> ativo{pixels.filter(p => p.is_active).length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        {/* ═══ PLATFORM TABS ═══ */}
        <div className="px-7 pb-3">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {PLATFORMS.map(p => {
              const isActive = activePlatform === p.id;
              const count = pixels.filter(px => px.platform === p.id).length;
              return (
                <button key={p.id} onClick={() => setActivePlatform(p.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-display font-bold transition-all duration-300 whitespace-nowrap shrink-0 relative",
                    isActive
                      ? "bg-primary/10 text-primary ring-1 ring-primary/15 shadow-md shadow-primary/5"
                      : "text-muted-foreground/30 hover:text-muted-foreground/50 hover:bg-muted/6"
                  )}>
                  <p.icon className={cn("h-3.5 w-3.5", isActive ? p.color : "")} />
                  {p.label}
                  {count > 0 && (
                    <span className={cn(
                      "text-[8px] px-1.5 py-0.5 rounded-lg font-numbers font-black min-w-[18px] text-center",
                      isActive ? "bg-primary/15 text-primary" : "bg-muted/8 text-muted-foreground/25"
                    )}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-3 h-px bg-gradient-to-r from-transparent via-border/15 to-transparent" />
        </div>

        {/* ═══ CONTENT ═══ */}
        <div className="flex-1 overflow-y-auto px-7 pb-7 space-y-5">

          {/* Existing pixels */}
          {platformPixels.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease }}
              className="py-14 text-center">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-muted/6 ring-1 ring-border/8 flex items-center justify-center mb-4 relative">
                <Radio className="h-7 w-7 text-muted-foreground/12" />
              </div>
              <p className="text-[13px] font-display font-bold text-muted-foreground/30">Nenhum pixel {platform.label}</p>
              <p className="text-[11px] text-muted-foreground/20 mt-1.5 max-w-[280px] mx-auto leading-relaxed">
                Adicione um pixel abaixo para rastrear conversões deste produto
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {platformPixels.map((px, i) => {
                  const isExpanded = expandedPixel === px.id;
                  const activeEvents = (px.events || []).length;
                  return (
                    <motion.div key={px.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.3, delay: i * 0.04, ease }}
                      className={cn(
                        "rounded-2xl transition-all duration-300 overflow-hidden relative group/px",
                        isExpanded
                          ? "bg-card ring-1 ring-primary/15 shadow-xl shadow-primary/5"
                          : "bg-muted/4 ring-1 ring-border/10 hover:ring-border/20 hover:bg-muted/6"
                      )}>
                      {/* Accent */}
                      <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-[3px] rounded-full transition-all",
                        px.is_active ? "bg-success shadow-sm shadow-success/30" : "bg-muted-foreground/10"
                      )} />

                      {/* Header */}
                      <div className="flex items-center gap-3.5 px-5 py-4 cursor-pointer" onClick={() => setExpandedPixel(isExpanded ? null : px.id)}>
                        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ring-1 transition-all",
                          px.is_active ? cn(platform.bg, platform.ring) : "bg-muted/8 ring-border/10")}>
                          <platform.icon className={cn("h-4 w-4", px.is_active ? platform.color : "text-muted-foreground/20")} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5">
                            <p className="font-mono text-[12px] font-bold text-foreground/80 truncate">{px.pixel_id}</p>
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-display font-black uppercase tracking-[0.1em]",
                              px.is_active
                                ? "bg-success/8 text-success ring-1 ring-success/12"
                                : "bg-muted/6 text-muted-foreground/30 ring-1 ring-border/8"
                            )}>
                              <span className={cn("h-1 w-1 rounded-full", px.is_active ? "bg-success animate-pulse" : "bg-muted-foreground/20")} />
                              {px.is_active ? "Ativo" : "Inativo"}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground/30 mt-0.5 font-display">
                            {activeEvents} evento{activeEvents !== 1 ? "s" : ""}
                            {px.fire_on_pix_qr && " · PIX QR"}{px.fire_on_boleto && " · Boleto"}{px.api_token && " · API Token"}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch checked={px.is_active} onCheckedChange={v => updatePixelSettings(px.id, { is_active: v })} onClick={e => e.stopPropagation()} />
                          <button className="h-8 w-8 rounded-xl flex items-center justify-center text-destructive/20 hover:text-destructive hover:bg-destructive/8 transition-all opacity-0 group-hover/px:opacity-100"
                            onClick={e => { e.stopPropagation(); removePixel(px.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center transition-all ring-1 ring-border/8",
                            isExpanded ? "bg-primary/8 text-primary rotate-180" : "bg-muted/4 text-muted-foreground/20")}>
                            <ChevronDown className="h-3.5 w-3.5 transition-transform" />
                          </div>
                        </div>
                      </div>

                      {/* Expanded */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease }} className="overflow-hidden">
                            <div className="px-5 pb-5 space-y-5 border-t border-border/8 pt-4">
                              {/* Events */}
                              <div>
                                <p className="text-[9px] font-display font-black uppercase tracking-[0.18em] text-muted-foreground/30 mb-3 flex items-center gap-1.5">
                                  <Zap className="h-3 w-3 text-primary/30" /> Eventos Rastreados
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {ALL_EVENTS.map(event => {
                                    const active = (px.events || []).includes(event);
                                    return (
                                      <button key={event} type="button" onClick={() => togglePixelEvent(px.id, event)}
                                        className={cn(
                                          "px-3 py-1.5 rounded-lg text-[10px] font-display font-bold transition-all duration-200",
                                          active
                                            ? "bg-primary/10 ring-1 ring-primary/15 text-primary"
                                            : "bg-muted/4 ring-1 ring-border/6 text-muted-foreground/20 hover:text-muted-foreground/40 hover:bg-muted/8"
                                        )}>
                                        {event}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              {/* Triggers */}
                              <div>
                                <p className="text-[9px] font-display font-black uppercase tracking-[0.18em] text-muted-foreground/30 mb-3 flex items-center gap-1.5">
                                  <Settings2 className="h-3 w-3 text-warning/30" /> Gatilho de Conversão
                                </p>
                                <div className="space-y-2">
                                  <TriggerCard label="Disparar Purchase ao gerar QR Code PIX"
                                    desc={px.fire_on_pix_qr ? "Purchase dispara na geração do QR Code" : "Purchase dispara na confirmação"}
                                    checked={px.fire_on_pix_qr} onChange={v => updatePixelSettings(px.id, { fire_on_pix_qr: v })}
                                    showSlider={px.fire_on_pix_qr} sliderValue={px.pix_conversion_value}
                                    onSliderChange={v => updatePixelSettings(px.id, { pix_conversion_value: v })} />
                                  <TriggerCard label="Disparar Purchase ao gerar Boleto"
                                    desc={px.fire_on_boleto ? "Purchase dispara na geração do boleto" : "Purchase dispara no pagamento"}
                                    checked={px.fire_on_boleto} onChange={v => updatePixelSettings(px.id, { fire_on_boleto: v })}
                                    showSlider={px.fire_on_boleto} sliderValue={px.boleto_conversion_value}
                                    onSliderChange={v => updatePixelSettings(px.id, { boleto_conversion_value: v })} />
                                  <TriggerCard label="Desativar eventos de Order Bumps"
                                    desc="Não dispara eventos para produtos adicionais"
                                    checked={px.disable_bump_events} onChange={v => updatePixelSettings(px.id, { disable_bump_events: v })} />
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

          {/* ═══ ADD NEW PIXEL ═══ */}
          <div className="rounded-2xl ring-1 ring-border/10 bg-muted/3 overflow-hidden">
            {/* Section header */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-4">
              <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center ring-1", platform.bg, platform.ring)}>
                <Plus className={cn("h-4 w-4", platform.color)} />
              </div>
              <p className="text-[13px] font-display font-bold text-foreground/80">Adicionar Pixel {platform.label}</p>
            </div>

            <div className="px-5 pb-5 space-y-4">
              {/* Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[9px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/30 mb-1.5 block">Pixel ID</Label>
                  <Input value={newPixelId} onChange={e => setNewPixelId(e.target.value)}
                    placeholder="Ex: 123456789" className="h-11 text-[12px] rounded-xl bg-background/50 border-border/12 focus:border-primary/30 focus:ring-2 focus:ring-primary/8 font-mono" />
                </div>
                {platform.fields.includes("api_token") && (
                  <div>
                    <Label className="text-[9px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/30 mb-1.5 block">API Token</Label>
                    <Input value={newApiToken} onChange={e => setNewApiToken(e.target.value)}
                      placeholder="Token de conversão" className="h-11 text-[12px] rounded-xl bg-background/50 border-border/12 focus:border-primary/30 focus:ring-2 focus:ring-primary/8 font-mono" />
                  </div>
                )}
              </div>
              {platform.fields.includes("domain") && (
                <div>
                  <Label className="text-[9px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/30 mb-1.5 block">Domínio</Label>
                  <Input value={newDomain} onChange={e => setNewDomain(e.target.value)}
                    placeholder="seusite.com" className="h-11 text-[12px] rounded-xl bg-background/50 border-border/12 focus:border-primary/30 focus:ring-2 focus:ring-primary/8 font-mono" />
                </div>
              )}

              {/* Events */}
              <div>
                <Label className="text-[9px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/30 mb-2.5 block">Eventos</Label>
                <div className="flex gap-2">
                  {[
                    { mode: "all" as const, label: "Todos os eventos", icon: Sparkles },
                    { mode: "custom" as const, label: "Personalizado", icon: Settings2 },
                  ].map(opt => (
                    <button key={opt.mode} type="button"
                      onClick={() => { setNewEventMode(opt.mode); if (opt.mode === "all") setNewSelectedEvents([...ALL_EVENTS]); }}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-[11px] font-display font-bold transition-all duration-300",
                        newEventMode === opt.mode
                          ? "bg-primary/10 text-primary ring-1 ring-primary/15 shadow-sm"
                          : "bg-muted/4 text-muted-foreground/25 ring-1 ring-border/6 hover:bg-muted/8 hover:text-muted-foreground/40"
                      )}>
                      <opt.icon className="h-3.5 w-3.5" />
                      {opt.label}
                    </button>
                  ))}
                </div>

                <AnimatePresence>
                  {newEventMode === "custom" && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease }} className="overflow-hidden">
                      <div className="flex flex-wrap gap-1.5 mt-3 p-3 rounded-xl bg-background/40 ring-1 ring-border/8">
                        {ALL_EVENTS.map(event => (
                          <button key={event} type="button" onClick={() => toggleNewEvent(event)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-[10px] font-display font-bold transition-all",
                              newSelectedEvents.includes(event)
                                ? "bg-primary/10 text-primary ring-1 ring-primary/12"
                                : "bg-muted/4 text-muted-foreground/20 ring-1 ring-border/6 hover:text-muted-foreground/40"
                            )}>
                            {event}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] text-muted-foreground/20 font-display font-medium">
                  <span className="font-numbers">{platformPixels.length}</span> / 50 pixels
                </p>
                <Button onClick={addPixel} className="gap-2 rounded-xl font-display font-bold shadow-lg shadow-primary/15 h-11 px-7 text-[11px]">
                  <Plus className="h-3.5 w-3.5" /> Adicionar Pixel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Trigger Card ─── */
function TriggerCard({ label, desc, checked, onChange, showSlider, sliderValue, onSliderChange }: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
  showSlider?: boolean; sliderValue?: number; onSliderChange?: (v: number) => void;
}) {
  return (
    <div className={cn(
      "flex items-start justify-between gap-3 p-4 rounded-xl transition-all duration-200 relative overflow-hidden",
      checked ? "bg-primary/[0.04] ring-1 ring-primary/10" : "bg-muted/3 ring-1 ring-border/6"
    )}>
      {checked && <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-primary/30" />}
      <div className="flex-1 min-w-0 pl-1">
        <p className="text-[11px] font-display font-bold text-foreground/80">{label}</p>
        <p className="text-[10px] text-muted-foreground/30 mt-0.5 leading-relaxed">{desc}</p>
        {showSlider && sliderValue !== undefined && onSliderChange && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[9px] text-muted-foreground/30 font-display font-bold">Valor:</span>
            <Input type="number" min={0} max={100} value={sliderValue}
              onChange={e => onSliderChange(Number(e.target.value))}
              className="w-16 h-7 text-[11px] text-center rounded-lg bg-background/50 border-border/15 font-numbers"
              onClick={e => e.stopPropagation()} />
            <span className="text-[9px] text-muted-foreground/30 font-numbers font-bold">%</span>
          </div>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
