import { useState } from "react";
import { Eye, ShoppingBag, Clock, Palette, TrendingUp, Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function ProofPopup() {
  const [enabled, setEnabled] = useState(true);
  const [interval, setInterval] = useState(15);
  const [duration, setDuration] = useState(5);
  const [position, setPosition] = useState("bottom-left");
  const [showAvatar, setShowAvatar] = useState(true);
  const [showCity, setShowCity] = useState(true);

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 p-4 md:p-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Impressões", value: "12.4K", icon: Eye, color: "text-primary" },
          { label: "Influenciadas", value: "1.2K", icon: ShoppingBag, color: "text-emerald-500" },
          { label: "Taxa de Impacto", value: "9.7%", icon: TrendingUp, color: "text-amber-500" },
          { label: "Status", value: enabled ? "Ativo" : "Inativo", icon: Settings2, color: "text-primary" },
        ].map(kpi => (
          <Card key={kpi.label} className="border-border/40 bg-card/60 backdrop-blur-xl">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/50 ${kpi.color}`}>
                <kpi.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">{kpi.label}</p>
                <p className="text-lg font-black">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-border/40 bg-card/60 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm font-bold">
              <span className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /> Configurações</span>
              <Switch checked={enabled} onCheckedChange={(v) => { setEnabled(v); toast.success(v ? "Popup ativado!" : "Popup desativado!"); }} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-[12px] font-semibold">Intervalo entre popups</Label>
                <span className="text-[12px] font-bold text-primary">{interval}s</span>
              </div>
              <Slider value={[interval]} onValueChange={([v]) => setInterval(v)} min={5} max={60} step={5} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-[12px] font-semibold">Duração do popup</Label>
                <span className="text-[12px] font-bold text-primary">{duration}s</span>
              </div>
              <Slider value={[duration]} onValueChange={([v]) => setDuration(v)} min={3} max={15} step={1} />
            </div>

            <div className="space-y-2">
              <Label className="text-[12px] font-semibold">Posição</Label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-left">Inferior Esquerdo</SelectItem>
                  <SelectItem value="bottom-right">Inferior Direito</SelectItem>
                  <SelectItem value="top-left">Superior Esquerdo</SelectItem>
                  <SelectItem value="top-right">Superior Direito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-muted/15 px-4 py-3">
                <span className="text-[13px] font-semibold">Mostrar avatar</span>
                <Switch checked={showAvatar} onCheckedChange={setShowAvatar} />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/15 px-4 py-3">
                <span className="text-[13px] font-semibold">Mostrar cidade</span>
                <Switch checked={showCity} onCheckedChange={setShowCity} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/60 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <Eye className="h-4 w-4 text-primary" /> Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative flex h-[350px] items-end justify-start rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 p-6">
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
                <p className="text-sm">Sua página de checkout</p>
              </div>

              {enabled && (
                <div className="relative z-10 flex items-center gap-3 rounded-2xl border border-border/50 bg-card/95 px-4 py-3 shadow-xl backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-500">
                  {showAvatar && (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                      JC
                    </div>
                  )}
                  <div>
                    <p className="text-[13px] font-bold">João C. comprou</p>
                    <p className="text-[11px] text-muted-foreground">
                      Curso Avançado de Marketing
                      {showCity && " • São Paulo, SP"}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60">há 2 minutos</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
