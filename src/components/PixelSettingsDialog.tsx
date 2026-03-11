import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Crosshair, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
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
  "PageView",
  "ViewContent",
  "InitiateCheckout",
  "AddToCart",
  "AddPaymentInfo",
  "Purchase",
  "Lead",
  "CompleteRegistration",
  "GenerateLead",
  "BoletoGenerated",
  "PixGenerated",
];

const PLATFORMS: { id: Platform; label: string; color: string; fields: string[] }[] = [
  { id: "facebook", label: "Facebook", color: "text-blue-500", fields: ["pixel_id", "api_token", "domain"] },
  { id: "google_ads", label: "Google Ads", color: "text-yellow-500", fields: ["pixel_id", "api_token"] },
  { id: "google_analytics", label: "Google Analytics", color: "text-orange-500", fields: ["pixel_id"] },
  { id: "tiktok", label: "TikTok", color: "text-pink-500", fields: ["pixel_id", "api_token"] },
  { id: "kwai", label: "Kwai", color: "text-orange-400", fields: ["pixel_id", "api_token"] },
];

export default function PixelSettingsDialog({ product, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [activePlatform, setActivePlatform] = useState<Platform>("facebook");
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [loading, setLoading] = useState(false);

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
      events: events,
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
    await supabase.from("product_pixels").update(updates).eq("id", pixelId);
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crosshair className="h-5 w-5" /> Pixels de Conversão
          </DialogTitle>
          <p className="text-xs text-muted-foreground">Configure pixels para rastrear conversões do produto: {product.name}</p>
        </DialogHeader>

        <Tabs value={activePlatform} onValueChange={v => setActivePlatform(v as Platform)} className="mt-2">
          <TabsList className="w-full justify-start overflow-x-auto">
            {PLATFORMS.map(p => (
              <TabsTrigger key={p.id} value={p.id} className="text-xs gap-1.5">
                <span className={p.color}>●</span> {p.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {PLATFORMS.map(platform => (
            <TabsContent key={platform.id} value={platform.id} className="space-y-5 mt-4">
              {/* Existing pixels table */}
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid grid-cols-3 gap-4 p-3 bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Pixel Id</span>
                  <span>{platform.fields.includes("api_token") ? "API Access Token" : ""}</span>
                  <span>{platform.fields.includes("domain") ? "Domínio" : ""}</span>
                </div>
                {platformPixels.length === 0 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">Nenhum pixel adicionado</p>
                ) : platformPixels.map(px => (
                  <div key={px.id} className="border-t border-border">
                    <div className="grid grid-cols-3 gap-4 p-3 items-center text-xs">
                      <span className="font-mono truncate">{px.pixel_id}</span>
                      <span className="font-mono truncate text-muted-foreground">{px.api_token || "—"}</span>
                      <div className="flex items-center justify-between">
                        <span className="font-mono truncate text-muted-foreground">{px.domain || "—"}</span>
                        <Button variant="ghost" size="sm" onClick={() => removePixel(px.id)} className="text-destructive h-7 w-7 p-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {/* Per-pixel event selection */}
                    <div className="px-3 pb-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Eventos rastreados</p>
                      <div className="flex flex-wrap gap-1.5">
                        {ALL_EVENTS.map(event => {
                          const active = (px.events || []).includes(event);
                          return (
                            <button
                              key={event}
                              type="button"
                              onClick={() => togglePixelEvent(px.id, event)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                                active
                                  ? "bg-primary/10 border-primary/30 text-primary"
                                  : "bg-muted/20 border-border text-muted-foreground hover:bg-muted/40"
                              }`}
                            >
                              {event}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add new pixel */}
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[120px]">
                    <Label className="text-[10px]">Pixel ID</Label>
                    <Input value={newPixelId} onChange={e => setNewPixelId(e.target.value)} placeholder="Ex: 123456789" className="h-9 text-xs" />
                  </div>
                  {platform.fields.includes("api_token") && (
                    <div className="flex-1 min-w-[120px]">
                      <Label className="text-[10px]">API Token</Label>
                      <Input value={newApiToken} onChange={e => setNewApiToken(e.target.value)} placeholder="Token" className="h-9 text-xs" />
                    </div>
                  )}
                  {platform.fields.includes("domain") && (
                    <div className="flex-1 min-w-[120px]">
                      <Label className="text-[10px]">Domínio</Label>
                      <Input value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="seusite.com" className="h-9 text-xs" />
                    </div>
                  )}
                </div>

                {/* Event mode selection */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Eventos para disparar</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setNewEventMode("all"); setNewSelectedEvents([...ALL_EVENTS]); }}
                      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                        newEventMode === "all"
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      Todos os eventos
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewEventMode("custom")}
                      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                        newEventMode === "custom"
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      Personalizado
                    </button>
                  </div>

                  {newEventMode === "custom" && (
                    <div className="flex flex-wrap gap-1.5 rounded-xl border border-border/60 p-3 bg-muted/20">
                      {ALL_EVENTS.map(event => (
                        <label key={event} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/40 transition-colors">
                          <Checkbox
                            checked={newSelectedEvents.includes(event)}
                            onCheckedChange={() => toggleNewEvent(event)}
                          />
                          <span className="font-medium">{event}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <Button onClick={addPixel} size="sm" className="gap-1 rounded-xl">
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
                <p className="text-[10px] text-muted-foreground">{platformPixels.length} / 50</p>
              </div>

              {/* Event settings per pixel */}
              <div className="space-y-4 pt-4 border-t border-border">
                {platformPixels.map(px => (
                  <div key={px.id} className="space-y-3">
                    <p className="text-[10px] font-mono text-muted-foreground">Pixel: {px.pixel_id}</p>
                    <div className="flex items-center justify-between p-3 rounded-xl border border-border">
                      <div>
                        <p className="text-sm font-medium">Disparar "Purchase" ao gerar PIX?</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Valor de conversão personalizado</p>
                        {px.fire_on_pix_qr && (
                          <div className="flex items-center gap-1 mt-2">
                            <Input type="number" min={0} max={100} value={px.pix_conversion_value}
                              onChange={e => updatePixelSettings(px.id, { pix_conversion_value: Number(e.target.value) })}
                              className="w-20 h-8 text-xs text-center" />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        )}
                      </div>
                      <Switch checked={px.fire_on_pix_qr} onCheckedChange={v => updatePixelSettings(px.id, { fire_on_pix_qr: v })} />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl border border-border">
                      <div>
                        <p className="text-sm font-medium">Disparar "Purchase" ao gerar boleto?</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Valor de conversão personalizado</p>
                        {px.fire_on_boleto && (
                          <div className="flex items-center gap-1 mt-2">
                            <Input type="number" min={0} max={100} value={px.boleto_conversion_value}
                              onChange={e => updatePixelSettings(px.id, { boleto_conversion_value: Number(e.target.value) })}
                              className="w-20 h-8 text-xs text-center" />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        )}
                      </div>
                      <Switch checked={px.fire_on_boleto} onCheckedChange={v => updatePixelSettings(px.id, { fire_on_boleto: v })} />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl border border-border">
                      <p className="text-sm font-medium">Desativar eventos de order bumps?</p>
                      <Switch checked={px.disable_bump_events} onCheckedChange={v => updatePixelSettings(px.id, { disable_bump_events: v })} />
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
