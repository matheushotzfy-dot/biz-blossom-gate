/**
 * Pixel Settings Dialog — Ultra-Premium Enterprise v2
 * Full conversion pixel management with immersive visual design.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Crosshair, Plus, Trash2, Radio, Settings2, Zap,
  ChevronDown, ChevronUp, Eye, Shield, Sparkles,
  Activity, Globe, Target, BarChart3, Signal, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const EVENT_COLORS: Record<string, string> = {
  PageView: "text-info",
  ViewContent: "text-info",
  InitiateCheckout: "text-warning",
  AddToCart: "text-warning",
  AddPaymentInfo: "text-primary",
  Purchase: "text-success",
  Lead: "text-primary",
  CompleteRegistration: "text-success",
  GenerateLead: "text-primary",
  BoletoGenerated: "text-warning",
  PixGenerated: "text-success",
};

const PLATFORMS: { id: Platform; label: string; color: string; bgColor: string; ringColor: string; icon: typeof Globe; fields: string[] }[] = [
  { id: "facebook", label: "Facebook", color: "text-[hsl(220,80%,55%)]", bgColor: "bg-[hsl(220,80%,55%)]/10", ringColor: "ring-[hsl(220,80%,55%)]/20", icon: Globe, fields: ["pixel_id", "api_token", "domain"] },
  { id: "google_ads", label: "Google Ads", color: "text-warning", bgColor: "bg-warning/10", ringColor: "ring-warning/20", icon: Target, fields: ["pixel_id", "api_token"] },
  { id: "google_analytics", label: "Analytics", color: "text-[hsl(25,90%,55%)]", bgColor: "bg-[hsl(25,90%,55%)]/10", ringColor: "ring-[hsl(25,90%,55%)]/20", icon: BarChart3, fields: ["pixel_id"] },
  { id: "tiktok", label: "TikTok", color: "text-[hsl(340,70%,60%)]", bgColor: "bg-[hsl(340,70%,60%)]/10", ringColor: "ring-[hsl(340,70%,60%)]/20", icon: Activity, fields: ["pixel_id", "api_token"] },
  { id: "kwai", label: "Kwai", color: "text-[hsl(25,85%,55%)]", bgColor: "bg-[hsl(25,85%,55%)]/10", ringColor: "ring-[hsl(25,85%,55%)]/20", icon: Signal, fields: ["pixel_id", "api_token"] },
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
  const totalPixels = pixels.length;

  const addPixel = async () => {
    if (!newPixelId.trim()) { toast.error("Pixel ID é obrigatório"); return; }
    const events = newEventMode === "all" ? ALL_EVENTS : newSelectedEvents;
    if (events.length === 0) { toast.error("Selecione pelo menos um evento"); return; }
    const { error } = await supabase.from("product_pixels").insert({
      product_id: product.id,
      user_id: user!.id,
      platform: activePlatform,
      pixel_id: newPixelId.trim(),
      api_token: newApiToken.trim() || null,
      domain: newDomain.trim() || null,
      events,
      fire_on_pix_qr: false,
      fire_on_boleto: false,
      pix_conversion_value: 100,
      boleto_conversion_value: 100,
      disable_bump_events: false,
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
    const updated = current.includes(event)
      ? current.filter(e => e !== event)
      : [...current, event];
    updatePixelSettings(pixelId, { events: updated } as any);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl border-border/30 bg-card/98 backdrop-blur-2xl gap-0 shadow-2xl">
        {/* ═══ Header ═══ */}
        <div className="relative px-6 pt-6 pb-5 border-b border-border/15 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-info/[0.03]" />
          <div className="pointer-events-none absolute -top-20 -right-20 w-40 h-40 rounded-full bg-primary/[0.06] blur-[80px]" />
          <DialogHeader className="relative">
            <DialogTitle className="font-display text-lg font-black flex items-center gap-3.5 tracking-[-0.02em]">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/15 flex items-center justify-center shadow-lg shadow-primary/10">
                <Crosshair className="h-5 w-5 text-primary" />
              </div>
              <div>
                Pixels de Conversão
                <p className="text-[11px] text-muted-foreground/50 font-display font-medium mt-0.5 tracking-normal">
                  {product.name}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Stats bar */}
          <div className="relative flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/8 ring-1 ring-border/10">
              <Layers className="h-3 w-3 text-primary/50" />
              <span className="text-[10px] font-display font-bold text-muted-foreground/50">
                <span className="text-foreground font-numbers">{totalPixels}</span> pixel{totalPixels !== 1 ? "s" : ""} configurado{totalPixels !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/8 ring-1 ring-border/10">
              <Shield className="h-3 w-3 text-success/50" />
              <span className="text-[10px] font-display font-bold text-muted-foreground/50">
                <span className="text-success font-numbers">{pixels.filter(p => p.is_active).length}</span> ativo{pixels.filter(p => p.is_active).length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        {/* ═══ Platform Tabs ═══ */}
        <div className="px-6 pt-4 pb-1">
          <div className="flex gap-1 p-1 rounded-xl bg-muted/10 ring-1 ring-border/10">
            {PLATFORMS.map(p => {
              const isActive = activePlatform === p.id;
              const count = pixels.filter(px => px.platform === p.id).length;
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePlatform(p.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-[11px] font-display font-bold transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] relative",
                    isActive
                      ? "bg-card shadow-sm ring-1 ring-border/20 text-foreground"
                      : "text-muted-foreground/40 hover:text-muted-foreground/60 hover:bg-muted/10"
                  )}
                >
                  {isActive && (
                    <motion.div layoutId="pixel-tab-accent" className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-primary" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                  )}
                  <p.icon className={cn("h-3.5 w-3.5", isActive ? p.color : "")} />
                  <span className="hidden sm:inline">{p.label}</span>
                  {count > 0 && (
                    <span className={cn(
                      "text-[8px] px-1.5 py-0.5 rounded-md font-numbers font-black min-w-[18px] text-center",
                      isActive ? "bg-primary/10 text-primary" : "bg-muted/10 text-muted-foreground/30"
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ Scrollable Content ═══ */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* Existing Pixels */}
          {platformPixels.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease }}
              className="py-12 text-center relative"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/8 ring-1 ring-border/10 mb-4 relative">
                <Radio className="h-7 w-7 text-muted-foreground/15" />
                <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-muted/15 ring-1 ring-border/10 flex items-center justify-center">
                  <Plus className="h-2.5 w-2.5 text-muted-foreground/30" />
                </div>
              </div>
              <p className="text-[13px] font-display font-bold text-muted-foreground/40">Nenhum pixel {platform.label}</p>
              <p className="text-[11px] text-muted-foreground/25 mt-1 max-w-[260px] mx-auto">Adicione um pixel abaixo para rastrear conversões deste produto</p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {platformPixels.map((px, i) => {
                  const isExpanded = expandedPixel === px.id;
                  const activeEvents = (px.events || []).length;
                  return (
                    <motion.div
                      key={px.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.3, delay: i * 0.05, ease }}
                      className={cn(
                        "rounded-2xl border transition-all duration-300 overflow-hidden relative group/pixel",
                        isExpanded
                          ? "border-primary/20 bg-card/90 shadow-lg shadow-primary/5 ring-1 ring-primary/10"
                          : "border-border/15 bg-card/50 hover:border-border/25 hover:bg-card/60 ring-1 ring-border/5"
                      )}
                    >
                      {/* Accent bar */}
                      <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-[3px] rounded-full transition-all",
                        px.is_active ? "bg-success shadow-sm shadow-success/20" : "bg-muted-foreground/15"
                      )} />

                      {/* Pixel Header */}
                      <div
                        className="flex items-center gap-3.5 px-5 py-4 cursor-pointer"
                        onClick={() => setExpandedPixel(isExpanded ? null : px.id)}
                      >
                        <div className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ring-1 transition-all",
                          px.is_active
                            ? cn(platform.bgColor, platform.ringColor)
                            : "bg-muted/10 ring-border/15"
                        )}>
                          <platform.icon className={cn("h-4 w-4", px.is_active ? platform.color : "text-muted-foreground/30")} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-mono text-[12px] font-bold text-foreground truncate">{px.pixel_id}</p>
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-display font-black uppercase tracking-[0.1em]",
                              px.is_active
                                ? "bg-success/10 text-success ring-1 ring-success/15"
                                : "bg-muted/10 text-muted-foreground/40 ring-1 ring-border/10"
                            )}>
                              <span className={cn("h-1 w-1 rounded-full", px.is_active ? "bg-success animate-pulse" : "bg-muted-foreground/30")} />
                              {px.is_active ? "Ativo" : "Inativo"}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground/40 mt-0.5 font-display">
                            {activeEvents} evento{activeEvents !== 1 ? "s" : ""}
                            {px.fire_on_pix_qr && " · PIX QR"}
                            {px.fire_on_boleto && " · Boleto"}
                            {px.api_token && " · API Token"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={px.is_active}
                            onCheckedChange={v => { updatePixelSettings(px.id, { is_active: v }); }}
                            onClick={e => e.stopPropagation()}
                          />
                          <button
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-destructive/30 hover:text-destructive hover:bg-destructive/8 transition-all active:scale-95 opacity-0 group-hover/pixel:opacity-100"
                            onClick={e => { e.stopPropagation(); removePixel(px.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <div className={cn(
                            "h-7 w-7 rounded-lg flex items-center justify-center transition-all ring-1 ring-border/10",
                            isExpanded ? "bg-primary/8 text-primary" : "bg-muted/5 text-muted-foreground/25"
                          )}>
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Config */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5 space-y-5 border-t border-border/10 pt-4">
                              {/* Events Grid */}
                              <div>
                                <p className="text-[9px] font-display font-black uppercase tracking-[0.18em] text-muted-foreground/40 mb-3 flex items-center gap-1.5">
                                  <Zap className="h-3 w-3 text-primary/40" /> Eventos Rastreados
                                </p>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                                  {ALL_EVENTS.map(event => {
                                    const active = (px.events || []).includes(event);
                                    const color = EVENT_COLORS[event] || "text-primary";
                                    return (
                                      <button
                                        key={event}
                                        type="button"
                                        onClick={() => togglePixelEvent(px.id, event)}
                                        className={cn(
                                          "px-2 py-2 rounded-xl text-[9px] font-display font-bold transition-all duration-200 text-center relative overflow-hidden",
                                          active
                                            ? "bg-primary/8 ring-1 ring-primary/15 text-foreground shadow-sm"
                                            : "bg-muted/5 ring-1 ring-border/10 text-muted-foreground/30 hover:bg-muted/10 hover:text-muted-foreground/50"
                                        )}
                                      >
                                        {active && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full bg-primary/50" />}
                                        {event}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Purchase Trigger Settings */}
                              <div>
                                <p className="text-[9px] font-display font-black uppercase tracking-[0.18em] text-muted-foreground/40 mb-3 flex items-center gap-1.5">
                                  <Settings2 className="h-3 w-3 text-warning/40" /> Gatilho de Conversão
                                </p>
                                <div className="space-y-2">
                                  <TriggerCard
                                    label="Disparar Purchase ao gerar QR Code PIX"
                                    desc={px.fire_on_pix_qr ? "Purchase dispara na geração do QR Code" : "Purchase dispara na confirmação do pagamento"}
                                    checked={px.fire_on_pix_qr}
                                    onChange={v => updatePixelSettings(px.id, { fire_on_pix_qr: v })}
                                    showSlider={px.fire_on_pix_qr}
                                    sliderValue={px.pix_conversion_value}
                                    onSliderChange={v => updatePixelSettings(px.id, { pix_conversion_value: v })}
                                    accentColor="text-success"
                                  />
                                  <TriggerCard
                                    label="Disparar Purchase ao gerar Boleto"
                                    desc={px.fire_on_boleto ? "Purchase dispara na geração do boleto" : "Purchase dispara no pagamento do boleto"}
                                    checked={px.fire_on_boleto}
                                    onChange={v => updatePixelSettings(px.id, { fire_on_boleto: v })}
                                    showSlider={px.fire_on_boleto}
                                    sliderValue={px.boleto_conversion_value}
                                    onSliderChange={v => updatePixelSettings(px.id, { boleto_conversion_value: v })}
                                    accentColor="text-warning"
                                  />
                                  <TriggerCard
                                    label="Desativar eventos de Order Bumps"
                                    desc="Não dispara eventos para produtos adicionais"
                                    checked={px.disable_bump_events}
                                    onChange={v => updatePixelSettings(px.id, { disable_bump_events: v })}
                                    accentColor="text-muted-foreground"
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

          {/* ═══ Add New Pixel ═══ */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1, ease }}
            className="rounded-2xl border border-dashed border-border/20 bg-card/30 p-5 space-y-4 relative overflow-hidden hover:border-primary/15 transition-all duration-500 group/add"
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.01] to-transparent group-hover/add:from-primary/[0.03] transition-all duration-700" />

            <div className="relative flex items-center gap-2.5">
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center ring-1", platform.bgColor, platform.ringColor)}>
                <Plus className={cn("h-3.5 w-3.5", platform.color)} />
              </div>
              <p className="text-[12px] font-display font-bold text-foreground">
                Adicionar Pixel {platform.label}
              </p>
            </div>

            <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/40">Pixel ID</Label>
                <Input value={newPixelId} onChange={e => setNewPixelId(e.target.value)} placeholder="Ex: 123456789" className="h-10 text-xs rounded-xl bg-card/60 border-border/20" />
              </div>
              {platform.fields.includes("api_token") && (
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/40">API Token</Label>
                  <Input value={newApiToken} onChange={e => setNewApiToken(e.target.value)} placeholder="Token de conversão" className="h-10 text-xs rounded-xl bg-card/60 border-border/20" />
                </div>
              )}
              {platform.fields.includes("domain") && (
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-display font-black uppercase tracking-[0.15em] text-muted-foreground/40">Domínio</Label>
                  <Input value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="seusite.com" className="h-10 text-xs rounded-xl bg-card/60 border-border/20" />
                </div>
              )}
            </div>

            {/* Event Mode */}
            <div className="relative space-y-2.5">
              <Label className="text-[9px] font-display font-black uppercase tracking-[0.18em] text-muted-foreground/40">Eventos</Label>
              <div className="flex gap-2">
                {[
                  { mode: "all" as const, label: "Todos os eventos", icon: Sparkles },
                  { mode: "custom" as const, label: "Personalizado", icon: Settings2 },
                ].map(opt => (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => { setNewEventMode(opt.mode); if (opt.mode === "all") setNewSelectedEvents([...ALL_EVENTS]); }}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[11px] font-display font-bold transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] relative overflow-hidden",
                      newEventMode === opt.mode
                        ? "border-primary/20 bg-primary/8 text-primary shadow-sm ring-1 ring-primary/10"
                        : "border-border/15 bg-muted/5 text-muted-foreground/40 hover:bg-muted/10 hover:text-muted-foreground/60 ring-1 ring-border/5"
                    )}
                  >
                    {newEventMode === opt.mode && <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-primary/40" />}
                    <opt.icon className="h-3 w-3" />
                    {opt.label}
                  </button>
                ))}
              </div>

              <AnimatePresence>
                {newEventMode === "custom" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 rounded-xl border border-border/15 p-3 bg-card/40 ring-1 ring-border/5">
                      {ALL_EVENTS.map(event => (
                        <label key={event} className={cn(
                          "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] cursor-pointer transition-all",
                          newSelectedEvents.includes(event)
                            ? "bg-primary/5 text-foreground"
                            : "hover:bg-muted/10 text-muted-foreground/40"
                        )}>
                          <Checkbox
                            checked={newSelectedEvents.includes(event)}
                            onCheckedChange={() => toggleNewEvent(event)}
                          />
                          <span className="font-display font-bold">{event}</span>
                        </label>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative flex items-center justify-between pt-2">
              <p className="text-[10px] text-muted-foreground/30 font-display font-medium">
                {platformPixels.length} / 50 pixels
              </p>
              <Button
                onClick={addPixel}
                size="sm"
                className="gap-2 rounded-xl font-display font-bold shadow-lg shadow-primary/15 h-10 px-6 text-[11px]"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar Pixel
              </Button>
            </div>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Trigger Card ─── */
function TriggerCard({ label, desc, checked, onChange, showSlider, sliderValue, onSliderChange, accentColor }: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
  showSlider?: boolean; sliderValue?: number; onSliderChange?: (v: number) => void; accentColor?: string;
}) {
  return (
    <div className={cn(
      "flex items-start justify-between gap-3 p-3.5 rounded-xl border transition-all duration-200 relative overflow-hidden",
      checked ? "border-primary/15 bg-primary/[0.03] ring-1 ring-primary/8" : "border-border/15 bg-muted/5 ring-1 ring-border/5"
    )}>
      {checked && <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-primary/40" />}
      <div className="flex-1 min-w-0 pl-1">
        <p className="text-[11px] font-display font-bold text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground/40 mt-0.5">{desc}</p>
        {showSlider && sliderValue !== undefined && onSliderChange && (
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-[9px] text-muted-foreground/40 font-display font-bold">Valor:</span>
            <Input
              type="number" min={0} max={100}
              value={sliderValue}
              onChange={e => onSliderChange(Number(e.target.value))}
              className="w-16 h-7 text-[11px] text-center rounded-lg bg-card/80 border-border/20"
              onClick={e => e.stopPropagation()}
            />
            <span className="text-[9px] text-muted-foreground/40 font-numbers font-bold">%</span>
          </div>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
