import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Crosshair, Plus, Trash2, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
}

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

  // New pixel form
  const [newPixelId, setNewPixelId] = useState("");
  const [newApiToken, setNewApiToken] = useState("");
  const [newDomain, setNewDomain] = useState("");

  // Global settings per platform
  const [fireOnPix, setFireOnPix] = useState(false);
  const [fireOnBoleto, setFireOnBoleto] = useState(false);
  const [pixValue, setPixValue] = useState(100);
  const [boletoValue, setBoletoValue] = useState(100);
  const [disableBumpEvents, setDisableBumpEvents] = useState(false);

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
    if (data) setPixels(data as any);
    setLoading(false);
  };

  const platformPixels = pixels.filter(p => p.platform === activePlatform);

  const addPixel = async () => {
    if (!newPixelId.trim()) { toast.error("Pixel ID é obrigatório"); return; }
    const { error } = await supabase.from("product_pixels").insert({
      product_id: product.id,
      user_id: user!.id,
      platform: activePlatform,
      pixel_id: newPixelId.trim(),
      api_token: newApiToken.trim() || null,
      domain: newDomain.trim() || null,
      fire_on_pix_qr: fireOnPix,
      fire_on_boleto: fireOnBoleto,
      pix_conversion_value: pixValue,
      boleto_conversion_value: boletoValue,
      disable_bump_events: disableBumpEvents,
    });
    if (error) { toast.error("Erro ao adicionar pixel"); return; }
    toast.success("Pixel adicionado!");
    setNewPixelId(""); setNewApiToken(""); setNewDomain("");
    loadPixels();
  };

  const removePixel = async (id: string) => {
    await supabase.from("product_pixels").delete().eq("id", id);
    setPixels(prev => prev.filter(p => p.id !== id));
    toast.success("Pixel removido");
  };

  const updatePixelSettings = async (pixelId: string, updates: Partial<Pixel>) => {
    await supabase.from("product_pixels").update(updates).eq("id", pixelId);
    setPixels(prev => prev.map(p => p.id === pixelId ? { ...p, ...updates } : p));
  };

  const currentPlatform = PLATFORMS.find(p => p.id === activePlatform)!;

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
                  <div key={px.id} className="grid grid-cols-3 gap-4 p-3 border-t border-border items-center text-xs">
                    <span className="font-mono truncate">{px.pixel_id}</span>
                    <span className="font-mono truncate text-muted-foreground">{px.api_token || "—"}</span>
                    <div className="flex items-center justify-between">
                      <span className="font-mono truncate text-muted-foreground">{px.domain || "—"}</span>
                      <Button variant="ghost" size="sm" onClick={() => removePixel(px.id)} className="text-destructive h-7 w-7 p-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add new pixel */}
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
                <Button onClick={addPixel} size="sm" className="gap-1 rounded-xl">
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">{platformPixels.length} / 50</p>

              {/* Event settings */}
              <div className="space-y-4 pt-4 border-t border-border">
                {platformPixels.map(px => (
                  <div key={px.id} className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl border border-border">
                      <div>
                        <p className="text-sm font-medium">Disparar evento "Purchase" ao gerar um pix?</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Valor de conversão personalizado para pix</p>
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
                        <p className="text-sm font-medium">Disparar evento "Purchase" ao gerar um boleto?</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Valor de conversão personalizado para boleto</p>
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
