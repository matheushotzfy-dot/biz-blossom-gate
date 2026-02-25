import { useState, useEffect } from "react";
import { Puzzle, ExternalLink, X, Check } from "lucide-react";
import { PageShell, PageTitle } from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

const UTMIFY_EVENTS = [
  "Purchase",
  "InitiateCheckout",
  "PageView",
  "AddToCart",
  "ViewContent",
  "Lead",
  "CompleteRegistration",
  "AddPaymentInfo",
  "GenerateLead",
  "BoletoGenerated",
  "PixGenerated",
  "Refund",
  "Chargeback",
];

const apps = [
  { name: "UTMify", desc: "Rastreamento UTM avançado", color: "text-blue-500", bg: "from-blue-600/15 to-blue-600/5", integrated: true },
  { name: "Notazz", desc: "Emissão automática de notas fiscais", color: "text-cyan-400", bg: "from-cyan-500/15 to-cyan-500/5", integrated: false },
  { name: "TheMembers", desc: "Plataforma de área de membros", color: "text-white", bg: "from-white/10 to-white/5", integrated: false },
  { name: "ActiveCampaign", desc: "Automação de e-mail marketing", color: "text-blue-400", bg: "from-blue-500/15 to-blue-500/5", integrated: false },
  { name: "Spedy", desc: "Logística e envios automatizados", color: "text-pink-400", bg: "from-pink-500/15 to-pink-500/5", integrated: false },
  { name: "Astron Members", desc: "Área de membros premium", color: "text-red-400", bg: "from-red-500/15 to-red-500/5", integrated: false },
  { name: "MemberKit", desc: "Gestão completa de membros", color: "text-emerald-400", bg: "from-emerald-500/15 to-emerald-500/5", integrated: false },
  { name: "SMSFunnel", desc: "Automação de SMS marketing", color: "text-violet-400", bg: "from-violet-500/15 to-violet-500/5", integrated: false },
  { name: "Voxuy", desc: "Chatbot e automação WhatsApp", color: "text-sky-400", bg: "from-sky-500/15 to-sky-500/5", integrated: false },
  { name: "Cademi", desc: "Plataforma de cursos online", color: "text-rose-400", bg: "from-rose-500/15 to-rose-500/5", integrated: false },
  { name: "Webhooks", desc: "Integre com qualquer sistema", color: "text-slate-400", bg: "from-slate-500/15 to-slate-500/5", integrated: false },
  { name: "Zapier", desc: "Conecte +5000 aplicativos", color: "text-orange-400", bg: "from-orange-500/15 to-orange-500/5", integrated: false },
];

export default function Apps() {
  const { user } = useAuth();
  const [utmifyOpen, setUtmifyOpen] = useState(false);
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [utmName, setUtmName] = useState("");
  const [utmProductId, setUtmProductId] = useState("");
  const [utmToken, setUtmToken] = useState("");
  const [utmEventMode, setUtmEventMode] = useState<"all" | "custom">("all");
  const [utmSelectedEvents, setUtmSelectedEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("products").select("*").eq("user_id", user.id).then(({ data }) => {
      if (data) setProducts(data);
    });
  }, [user?.id]);

  const handleUtmifySave = async () => {
    if (!user?.id || !utmProductId || !utmToken) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    const events = utmEventMode === "all" ? UTMIFY_EVENTS : utmSelectedEvents;
    const { error } = await supabase.from("product_pixels").insert({
      user_id: user.id,
      product_id: utmProductId,
      platform: "utmify",
      pixel_id: utmToken,
      api_token: utmToken,
      events: events,
      is_active: true,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar integração", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "UTMify integrada com sucesso! 🎯" });
      setUtmifyOpen(false);
      setUtmName("");
      setUtmProductId("");
      setUtmToken("");
      setUtmEventMode("all");
      setUtmSelectedEvents([]);
    }
  };

  const toggleEvent = (event: string) => {
    setUtmSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  return (
    <PageShell>
      <PageTitle icon={<Puzzle className="h-6 w-6" />} title="Apps" subtitle="Integre aplicativos ao seu ecossistema" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {apps.map(app => (
          <button
            key={app.name}
            onClick={() => {
              if (app.name === "UTMify") setUtmifyOpen(true);
            }}
            className={`group relative overflow-hidden bg-gradient-to-br ${app.bg} border border-white/[0.06] dark:border-white/[0.06] rounded-2xl p-6 text-left transition-all hover:scale-[1.02] hover:border-white/[0.12] dark:hover:border-white/[0.12]`}
          >
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
              {app.integrated ? (
                <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary" />
                </div>
              ) : (
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            {app.integrated && (
              <div className="absolute top-3 left-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/25 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Integrado
                </span>
              </div>
            )}
            <h3 className={`text-sm font-black ${app.color} ${app.integrated ? "mt-5" : ""}`}>{app.name}</h3>
            <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">{app.desc}</p>
            <div className="mt-3 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">
              {app.integrated ? "Clique para configurar" : "Em breve"}
            </div>
          </button>
        ))}
      </div>

      {/* UTMify Integration Dialog */}
      <Dialog open={utmifyOpen} onOpenChange={setUtmifyOpen}>
        <DialogContent className="max-w-lg rounded-2xl border-primary/15">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl font-display font-black">
              <div className="h-10 w-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                <span className="text-lg font-black text-blue-500">U</span>
              </div>
              Integrar UTMify
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nome da integração</Label>
              <Input
                placeholder="Ex: UTM Principal"
                value={utmName}
                onChange={(e) => setUtmName(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Produto para integração *</Label>
              <Select value={utmProductId} onValueChange={setUtmProductId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Token da UTMify *</Label>
              <Input
                placeholder="Cole seu token da UTMify aqui"
                value={utmToken}
                onChange={(e) => setUtmToken(e.target.value)}
                className="rounded-xl font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Encontre em UTMify → Configurações → API → Token</p>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Eventos para disparar</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setUtmEventMode("all")}
                  className={`flex-1 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all ${
                    utmEventMode === "all"
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  Todos os eventos
                </button>
                <button
                  onClick={() => setUtmEventMode("custom")}
                  className={`flex-1 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all ${
                    utmEventMode === "custom"
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  Personalizado
                </button>
              </div>

              {utmEventMode === "custom" && (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-xl border border-border/60 p-3 bg-muted/20">
                  {UTMIFY_EVENTS.map((event) => (
                    <label
                      key={event}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <Checkbox
                        checked={utmSelectedEvents.includes(event)}
                        onCheckedChange={() => toggleEvent(event)}
                      />
                      <span className="font-medium text-foreground">{event}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={handleUtmifySave}
              disabled={saving || !utmProductId || !utmToken}
              className="w-full h-11 rounded-xl font-bold"
            >
              {saving ? "Salvando..." : "Salvar Integração"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
