/**
 * Pixel Settings Dialog — Enterprise Layout
 * Configures conversion pixels per product with full event control.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Crosshair, Plus, Trash2, Radio, Settings2, Zap,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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

const PLATFORMS: { id: Platform; label: string; icon: string; fields: string[] }[] = [
  { id: "facebook", label: "Facebook", icon: "🔵", fields: ["pixel_id", "api_token", "domain"] },
  { id: "google_ads", label: "Google Ads", icon: "🟡", fields: ["pixel_id", "api_token"] },
  { id: "google_analytics", label: "Analytics", icon: "🟠", fields: ["pixel_id"] },
  { id: "tiktok", label: "TikTok", icon: "🩷", fields: ["pixel_id", "api_token"] },
  { id: "kwai", label: "Kwai", icon: "🟧", fields: ["pixel_id", "api_token"] },
];

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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl border-border/50 bg-card/95 backdrop-blur-xl gap-0">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-border/30">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.06] to-transparent rounded-t-2xl" />
          <DialogHeader className="relative">
            <DialogTitle className="font-display text-lg font-bold flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <Crosshair className="h-4.5 w-4.5 text-primary-foreground" />
              </div>
              Pixels de Conversão
            </DialogTitle>
            <p className="text-[11px] text-muted-foreground/70 mt-1 pl-[52px]">
              Produto: <span className="font-semibold text-foreground/80">{product.name}</span>
            </p>
          </DialogHeader>
        </div>

        {/* Platform Tabs */}
        <div className="px-6 pt-4 pb-0">
          <div className="flex gap-1.5 p-1 rounded-xl bg-muted/20 border border-border/30">
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => setActivePlatform(p.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-all duration-200",
                  activePlatform === p.id
                    ? "bg-card border border-border/50 text-foreground shadow-sm"
                    : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/30"
                )}
              >
                <span className="text-xs">{p.icon}</span>
                <span className="hidden sm:inline">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* Existing Pixels */}
          {platformPixels.length === 0 ? (
            <div className="py-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border/30 bg-muted/15 mb-3">
                <Radio className="h-6 w-6 text-muted-foreground/25" />
              </div>
              <p className="text-[13px] font-bold text-foreground/60">Nenhum pixel adicionado</p>
              <p className="text-[11px] text-muted-foreground/50 mt-1">Adicione um pixel abaixo para rastrear conversões</p>
            </div>
          ) : (
            <div className="space-y-3">
              {platformPixels.map(px => {
                const isExpanded = expandedPixel === px.id;
                const activeEvents = (px.events || []).length;
                return (
                  <div
                    key={px.id}
                    className={cn(
                      "rounded-2xl border transition-all duration-300 overflow-hidden",
                      isExpanded
                        ? "border-primary/30 bg-card/80 shadow-[0_4px_20px_hsl(var(--primary)/0.08)]"
                        : "border-border/40 bg-card/40 hover:border-border/60"
                    )}
                  >
                    {/* Pixel Header */}
                    <div
                      className="flex items-center gap-3 px-4 py-3.5 cursor-pointer"
                      onClick={() => setExpandedPixel(isExpanded ? null : px.id)}
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0",
                        px.is_active ? "gradient-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground/40"
                      )}>
                        {platform.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-[12px] font-bold text-foreground truncate">{px.pixel_id}</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                          {activeEvents} evento{activeEvents !== 1 ? "s" : ""} ativo{activeEvents !== 1 ? "s" : ""}
                          {px.fire_on_pix_qr && " · Purchase no PIX QR"}
                          {px.fire_on_boleto && " · Purchase no Boleto"}
                        </p>
                      </div>
                      <Switch
                        checked={px.is_active}
                        onCheckedChange={v => { updatePixelSettings(px.id, { is_active: v }); }}
                        onClick={e => e.stopPropagation()}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive/50 hover:text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={e => { e.stopPropagation(); removePixel(px.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground/40" /> : <ChevronDown className="h-4 w-4 text-muted-foreground/40" />}
                    </div>

                    {/* Expanded Config */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 border-t border-border/20 pt-4">
                        {/* Events */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 mb-2 flex items-center gap-1.5">
                            <Zap className="h-3 w-3" /> Eventos Rastreados
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {ALL_EVENTS.map(event => {
                              const active = (px.events || []).includes(event);
                              return (
                                <button
                                  key={event}
                                  type="button"
                                  onClick={() => togglePixelEvent(px.id, event)}
                                  className={cn(
                                    "px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all duration-200",
                                    active
                                      ? "bg-primary/10 border-primary/25 text-primary shadow-sm"
                                      : "bg-muted/15 border-border/30 text-muted-foreground/40 hover:bg-muted/30 hover:text-muted-foreground/60"
                                  )}
                                >
                                  {event}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Purchase Trigger Settings */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 mb-2.5 flex items-center gap-1.5">
                            <Settings2 className="h-3 w-3" /> Gatilho de Conversão (Purchase)
                          </p>
                          <div className="space-y-2">
                            {/* PIX */}
                            <div className={cn(
                              "flex items-center justify-between p-3 rounded-xl border transition-all",
                              px.fire_on_pix_qr
                                ? "border-primary/20 bg-primary/[0.04]"
                                : "border-border/30 bg-muted/10"
                            )}>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-bold text-foreground">Disparar Purchase ao gerar QR Code PIX</p>
                                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                                  {px.fire_on_pix_qr
                                    ? "Purchase será disparado quando o QR Code for gerado"
                                    : "Purchase só será disparado quando o pagamento PIX for confirmado"}
                                </p>
                                {px.fire_on_pix_qr && (
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className="text-[10px] text-muted-foreground/50">Valor de conversão:</span>
                                    <Input
                                      type="number" min={0} max={100}
                                      value={px.pix_conversion_value}
                                      onChange={e => updatePixelSettings(px.id, { pix_conversion_value: Number(e.target.value) })}
                                      className="w-16 h-7 text-[11px] text-center rounded-lg"
                                      onClick={e => e.stopPropagation()}
                                    />
                                    <span className="text-[10px] text-muted-foreground/50">%</span>
                                  </div>
                                )}
                              </div>
                              <Switch
                                checked={px.fire_on_pix_qr}
                                onCheckedChange={v => updatePixelSettings(px.id, { fire_on_pix_qr: v })}
                              />
                            </div>

                            {/* Boleto */}
                            <div className={cn(
                              "flex items-center justify-between p-3 rounded-xl border transition-all",
                              px.fire_on_boleto
                                ? "border-primary/20 bg-primary/[0.04]"
                                : "border-border/30 bg-muted/10"
                            )}>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-bold text-foreground">Disparar Purchase ao gerar Boleto</p>
                                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                                  {px.fire_on_boleto
                                    ? "Purchase será disparado quando o boleto for gerado"
                                    : "Purchase só será disparado quando o boleto for pago"}
                                </p>
                                {px.fire_on_boleto && (
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className="text-[10px] text-muted-foreground/50">Valor de conversão:</span>
                                    <Input
                                      type="number" min={0} max={100}
                                      value={px.boleto_conversion_value}
                                      onChange={e => updatePixelSettings(px.id, { boleto_conversion_value: Number(e.target.value) })}
                                      className="w-16 h-7 text-[11px] text-center rounded-lg"
                                      onClick={e => e.stopPropagation()}
                                    />
                                    <span className="text-[10px] text-muted-foreground/50">%</span>
                                  </div>
                                )}
                              </div>
                              <Switch
                                checked={px.fire_on_boleto}
                                onCheckedChange={v => updatePixelSettings(px.id, { fire_on_boleto: v })}
                              />
                            </div>

                            {/* Bump Events */}
                            <div className={cn(
                              "flex items-center justify-between p-3 rounded-xl border transition-all",
                              px.disable_bump_events
                                ? "border-warning/20 bg-warning/[0.04]"
                                : "border-border/30 bg-muted/10"
                            )}>
                              <div>
                                <p className="text-[12px] font-bold text-foreground">Desativar eventos de Order Bumps</p>
                                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                                  Não dispara eventos para produtos adicionais (bumps)
                                </p>
                              </div>
                              <Switch
                                checked={px.disable_bump_events}
                                onCheckedChange={v => updatePixelSettings(px.id, { disable_bump_events: v })}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add New Pixel */}
          <div className="rounded-2xl border border-dashed border-border/40 bg-muted/[0.06] p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 flex items-center gap-1.5">
              <Plus className="h-3 w-3" /> Adicionar Pixel {platform.label}
            </p>

            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[140px]">
                <Label className="text-[10px] text-muted-foreground/50 font-bold">Pixel ID</Label>
                <Input value={newPixelId} onChange={e => setNewPixelId(e.target.value)} placeholder="Ex: 123456789" className="h-9 text-xs rounded-xl mt-1" />
              </div>
              {platform.fields.includes("api_token") && (
                <div className="flex-1 min-w-[140px]">
                  <Label className="text-[10px] text-muted-foreground/50 font-bold">API Token</Label>
                  <Input value={newApiToken} onChange={e => setNewApiToken(e.target.value)} placeholder="Token" className="h-9 text-xs rounded-xl mt-1" />
                </div>
              )}
              {platform.fields.includes("domain") && (
                <div className="flex-1 min-w-[140px]">
                  <Label className="text-[10px] text-muted-foreground/50 font-bold">Domínio</Label>
                  <Input value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="seusite.com" className="h-9 text-xs rounded-xl mt-1" />
                </div>
              )}
            </div>

            {/* Event Mode */}
            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-[0.12em]">Eventos</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setNewEventMode("all"); setNewSelectedEvents([...ALL_EVENTS]); }}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2.5 text-[11px] font-bold transition-all duration-200",
                    newEventMode === "all"
                      ? "border-primary/30 bg-primary/10 text-primary shadow-sm"
                      : "border-border/30 bg-muted/15 text-muted-foreground/50 hover:bg-muted/30"
                  )}
                >
                  Todos os eventos
                </button>
                <button
                  type="button"
                  onClick={() => setNewEventMode("custom")}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2.5 text-[11px] font-bold transition-all duration-200",
                    newEventMode === "custom"
                      ? "border-primary/30 bg-primary/10 text-primary shadow-sm"
                      : "border-border/30 bg-muted/15 text-muted-foreground/50 hover:bg-muted/30"
                  )}
                >
                  Personalizado
                </button>
              </div>

              {newEventMode === "custom" && (
                <div className="flex flex-wrap gap-1.5 rounded-xl border border-border/30 p-3 bg-card/30">
                  {ALL_EVENTS.map(event => (
                    <label key={event} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] cursor-pointer hover:bg-muted/30 transition-colors">
                      <Checkbox
                        checked={newSelectedEvents.includes(event)}
                        onCheckedChange={() => toggleNewEvent(event)}
                      />
                      <span className="font-semibold">{event}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[10px] text-muted-foreground/40">{platformPixels.length} / 50 pixels</p>
              <Button onClick={addPixel} size="sm" className="gap-1.5 rounded-xl gradient-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 h-9 px-5 text-[11px]">
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
