import { useState, useEffect } from "react";
import { Puzzle, Check, Trash2, Plus, Power, PowerOff, Settings2, Link2 } from "lucide-react";
import { PageShell, PageTitle, GlowPanel, SectionHeader } from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";

/* ─── App Definitions ─── */
interface AppDef {
  id: string;
  name: string;
  desc: string;
  color: string;
  bg: string;
  icon: string;
  fields: AppField[];
  events: string[];
  helpUrl?: string;
  helpText?: string;
}

interface AppField {
  key: string;
  label: string;
  placeholder: string;
  type: "api_key" | "api_url" | "webhook_url";
  required: boolean;
  help?: string;
}

const COMMON_EVENTS = [
  "Purchase", "InitiateCheckout", "PageView", "Lead",
  "PixGenerated", "BoletoGenerated", "Refund", "Chargeback",
];

const APPS: AppDef[] = [
  {
    id: "utmify", name: "UTMify", desc: "Rastreamento UTM avançado",
    color: "text-blue-500", bg: "from-blue-600/15 to-blue-600/5", icon: "U",
    fields: [
      { key: "api_key", label: "Token da UTMify", placeholder: "Cole seu token aqui", type: "api_key", required: true, help: "UTMify → Configurações → API → Token" },
    ],
    events: ["Purchase", "InitiateCheckout", "PageView", "AddToCart", "ViewContent", "Lead", "CompleteRegistration", "AddPaymentInfo", "GenerateLead", "BoletoGenerated", "PixGenerated", "Refund", "Chargeback"],
  },
  {
    id: "notazz", name: "Notazz", desc: "Emissão automática de notas fiscais",
    color: "text-cyan-400", bg: "from-cyan-500/15 to-cyan-500/5", icon: "N",
    fields: [
      { key: "api_key", label: "API Key da Notazz", placeholder: "Cole sua API key", type: "api_key", required: true, help: "Notazz → Configurações → Integrações → API Key" },
    ],
    events: ["Purchase", "Refund"],
    helpText: "A Notazz será notificada automaticamente quando uma venda for confirmada para emissão de NF-e.",
  },
  {
    id: "themembers", name: "TheMembers", desc: "Plataforma de área de membros",
    color: "text-white", bg: "from-white/10 to-white/5", icon: "T",
    fields: [
      { key: "api_key", label: "API Key TheMembers", placeholder: "Cole sua API key", type: "api_key", required: true, help: "TheMembers → Integrações → API → Chave de API" },
      { key: "api_url", label: "URL da API (opcional)", placeholder: "https://api.themembers.com.br", type: "api_url", required: false },
    ],
    events: ["Purchase", "Refund", "Chargeback"],
    helpText: "Libera/revoga acesso automático na área de membros ao confirmar pagamento ou estorno.",
  },
  {
    id: "activecampaign", name: "ActiveCampaign", desc: "Automação de e-mail marketing",
    color: "text-blue-400", bg: "from-blue-500/15 to-blue-500/5", icon: "A",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "Cole sua API key", type: "api_key", required: true, help: "ActiveCampaign → Settings → Developer → API Key" },
      { key: "api_url", label: "URL da conta", placeholder: "https://suaconta.api-us1.com", type: "api_url", required: true, help: "ActiveCampaign → Settings → Developer → URL" },
    ],
    events: ["Purchase", "Lead", "InitiateCheckout", "Refund", "Chargeback"],
    helpText: "Adiciona contatos e aplica tags automaticamente com base nos eventos selecionados.",
  },
  {
    id: "spedy", name: "Spedy", desc: "Logística e envios automatizados",
    color: "text-pink-400", bg: "from-pink-500/15 to-pink-500/5", icon: "S",
    fields: [
      { key: "api_key", label: "Token da Spedy", placeholder: "Cole seu token", type: "api_key", required: true, help: "Spedy → Configurações → API → Token de Integração" },
    ],
    events: ["Purchase"],
    helpText: "Cria automaticamente pedidos de envio quando uma compra é confirmada.",
  },
  {
    id: "astron", name: "Astron Members", desc: "Área de membros premium",
    color: "text-red-400", bg: "from-red-500/15 to-red-500/5", icon: "★",
    fields: [
      { key: "api_key", label: "API Key Astron", placeholder: "Cole sua API key", type: "api_key", required: true, help: "Astron → Configurações → Integrações → API Key" },
    ],
    events: ["Purchase", "Refund", "Chargeback"],
    helpText: "Libera/revoga acesso do aluno automaticamente na plataforma Astron Members.",
  },
  {
    id: "memberkit", name: "MemberKit", desc: "Gestão completa de membros",
    color: "text-emerald-400", bg: "from-emerald-500/15 to-emerald-500/5", icon: "M",
    fields: [
      { key: "api_key", label: "API Key MemberKit", placeholder: "Cole sua API key", type: "api_key", required: true, help: "MemberKit → Configurações → API → Chave da API" },
    ],
    events: ["Purchase", "Refund", "Chargeback"],
    helpText: "Gerencia acesso dos membros automaticamente com base nas transações.",
  },
  {
    id: "smsfunnel", name: "SMSFunnel", desc: "Automação de SMS marketing",
    color: "text-violet-400", bg: "from-violet-500/15 to-violet-500/5", icon: "✉",
    fields: [
      { key: "api_key", label: "Token SMSFunnel", placeholder: "Cole seu token", type: "api_key", required: true, help: "SMSFunnel → Configurações → API → Token" },
    ],
    events: ["Purchase", "Lead", "InitiateCheckout", "PixGenerated", "BoletoGenerated", "Refund"],
    helpText: "Dispara mensagens SMS automáticas com base nos eventos de checkout.",
  },
  {
    id: "voxuy", name: "Voxuy", desc: "Chatbot e automação WhatsApp",
    color: "text-sky-400", bg: "from-sky-500/15 to-sky-500/5", icon: "V",
    fields: [
      { key: "api_key", label: "API Key Voxuy", placeholder: "Cole sua API key", type: "api_key", required: true, help: "Voxuy → Configurações → API → Chave de Integração" },
    ],
    events: ["Purchase", "Lead", "InitiateCheckout", "PixGenerated", "Refund", "Chargeback"],
    helpText: "Envia mensagens automáticas via WhatsApp usando a Voxuy.",
  },
  {
    id: "cademi", name: "Cademi", desc: "Plataforma de cursos online",
    color: "text-rose-400", bg: "from-rose-500/15 to-rose-500/5", icon: "C",
    fields: [
      { key: "api_key", label: "API Key Cademi", placeholder: "Cole sua API key", type: "api_key", required: true, help: "Cademi → Integrações → API → Chave de API" },
    ],
    events: ["Purchase", "Refund", "Chargeback"],
    helpText: "Libera/revoga acesso dos alunos automaticamente na plataforma Cademi.",
  },
  {
    id: "webhooks", name: "Webhooks", desc: "Integre com qualquer sistema",
    color: "text-slate-400", bg: "from-slate-500/15 to-slate-500/5", icon: "⚡",
    fields: [],
    events: [],
    helpText: "Gerencie webhooks customizados na aba dedicada.",
  },
  {
    id: "zapier", name: "Zapier", desc: "Conecte +5000 aplicativos",
    color: "text-orange-400", bg: "from-orange-500/15 to-orange-500/5", icon: "Z",
    fields: [
      { key: "webhook_url", label: "Webhook URL do Zapier", placeholder: "https://hooks.zapier.com/hooks/catch/...", type: "webhook_url", required: true, help: "Zapier → Criar Zap → Trigger: Webhooks by Zapier → Catch Hook → Copie a URL" },
    ],
    events: ["Purchase", "Lead", "InitiateCheckout", "PixGenerated", "BoletoGenerated", "Refund", "Chargeback"],
    helpText: "Conecte sua conta Zapier via webhook para automatizar +5000 apps.",
  },
];

/* ─── Integration type from DB ─── */
interface AppIntegration {
  id: string;
  user_id: string;
  app_name: string;
  product_id: string | null;
  api_key: string | null;
  api_url: string | null;
  webhook_url: string | null;
  events: string[];
  is_active: boolean;
  config: Record<string, unknown>;
  created_at: string;
}

export default function Apps() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [integrations, setIntegrations] = useState<AppIntegration[]>([]);
  const [dialogApp, setDialogApp] = useState<AppDef | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formProductId, setFormProductId] = useState("");
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const [formEventMode, setFormEventMode] = useState<"all" | "custom">("all");
  const [formSelectedEvents, setFormSelectedEvents] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    loadData();
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) return;
    const [prodRes, intRes] = await Promise.all([
      supabase.from("products").select("*").eq("user_id", user.id),
      supabase.from("app_integrations").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    if (prodRes.data) setProducts(prodRes.data);
    if (intRes.data) setIntegrations(intRes.data as unknown as AppIntegration[]);
  };

  const openDialog = (app: AppDef, existing?: AppIntegration) => {
    if (app.id === "webhooks") {
      navigate("/vendas/webhooks");
      return;
    }
    setDialogApp(app);
    if (existing) {
      setEditId(existing.id);
      setFormProductId(existing.product_id || "");
      const fields: Record<string, string> = {};
      if (existing.api_key) fields["api_key"] = existing.api_key;
      if (existing.api_url) fields["api_url"] = existing.api_url;
      if (existing.webhook_url) fields["webhook_url"] = existing.webhook_url;
      setFormFields(fields);
      const evts = existing.events || [];
      if (evts.length === app.events.length) {
        setFormEventMode("all");
      } else {
        setFormEventMode("custom");
        setFormSelectedEvents(evts);
      }
    } else {
      setEditId(null);
      setFormProductId("");
      setFormFields({});
      setFormEventMode("all");
      setFormSelectedEvents([]);
    }
  };

  const closeDialog = () => {
    setDialogApp(null);
    setEditId(null);
  };

  const handleSave = async () => {
    if (!user?.id || !dialogApp) return;
    const requiredFields = dialogApp.fields.filter(f => f.required);
    for (const f of requiredFields) {
      if (!formFields[f.key]?.trim()) {
        toast.error(`Preencha: ${f.label}`);
        return;
      }
    }
    if (!formProductId && dialogApp.events.length > 0) {
      toast.error("Selecione um produto");
      return;
    }

    setSaving(true);
    const events = formEventMode === "all" ? dialogApp.events : formSelectedEvents;
    const payload = {
      user_id: user.id,
      app_name: dialogApp.id,
      product_id: formProductId || null,
      api_key: formFields["api_key"] || null,
      api_url: formFields["api_url"] || null,
      webhook_url: formFields["webhook_url"] || null,
      events,
      is_active: true,
      config: {},
    };

    let error;
    if (editId) {
      const { error: e } = await supabase.from("app_integrations").update(payload).eq("id", editId);
      error = e;
    } else {
      // Also save to product_pixels for UTMify (backward compat)
      if (dialogApp.id === "utmify" && formFields["api_key"]) {
        await supabase.from("product_pixels").insert({
          user_id: user.id,
          product_id: formProductId,
          platform: "utmify",
          pixel_id: formFields["api_key"],
          api_token: formFields["api_key"],
          events,
          is_active: true,
        });
      }
      const { error: e } = await supabase.from("app_integrations").insert(payload);
      error = e;
    }

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar integração");
    } else {
      toast.success(`${dialogApp.name} ${editId ? "atualizada" : "integrada"} com sucesso! 🎯`);
      closeDialog();
      loadData();
    }
  };

  const toggleActive = async (int_: AppIntegration) => {
    await supabase.from("app_integrations").update({ is_active: !int_.is_active }).eq("id", int_.id);
    loadData();
  };

  const deleteIntegration = async (id: string) => {
    await supabase.from("app_integrations").delete().eq("id", id);
    toast.success("Integração removida");
    loadData();
  };

  const toggleEvent = (event: string) => {
    setFormSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const getAppIntegrations = (appId: string) => integrations.filter(i => i.app_name === appId);
  const hasIntegration = (appId: string) => integrations.some(i => i.app_name === appId);
  const getProductName = (id: string | null) => products.find(p => p.id === id)?.name || "—";

  return (
    <PageShell>
      <PageTitle icon={<Puzzle className="h-6 w-6" />} title="Apps" subtitle="Integre aplicativos ao seu ecossistema" />

      {/* ─── App Grid ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {APPS.map(app => {
          const active = hasIntegration(app.id);
          return (
            <button
              key={app.id}
              onClick={() => openDialog(app)}
              className={`group relative overflow-hidden bg-gradient-to-br ${app.bg} border border-border/30 rounded-2xl p-6 text-left transition-all hover:scale-[1.02] hover:border-primary/20`}
            >
              {active && (
                <div className="absolute top-3 left-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/25 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    Integrado
                  </span>
                </div>
              )}
              <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${app.bg} border border-border/20 flex items-center justify-center ${active ? "mt-4" : ""}`}>
                <span className={`text-base font-black ${app.color}`}>{app.icon}</span>
              </div>
              <h3 className={`text-sm font-black ${app.color} mt-3`}>{app.name}</h3>
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">{app.desc}</p>
              <div className="mt-3 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">
                {app.id === "webhooks" ? "Ir para Webhooks" : active ? "Gerenciar" : "Clique para integrar"}
              </div>
            </button>
          );
        })}
      </div>

      {/* ─── Active Integrations ─── */}
      {integrations.length > 0 && (
        <div className="pt-2">
          <SectionHeader
            icon={<Settings2 className="h-4.5 w-4.5" />}
            title="Integrações Ativas"
            subtitle="Gerencie suas integrações configuradas"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {integrations.map(int_ => {
              const appDef = APPS.find(a => a.id === int_.app_name);
              if (!appDef) return null;
              return (
                <GlowPanel key={int_.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${appDef.bg} flex items-center justify-center`}>
                        <span className={`text-xs font-black ${appDef.color}`}>{appDef.icon}</span>
                      </div>
                      <div>
                        <span className="font-display font-bold text-[13px] text-foreground">{appDef.name}</span>
                        <p className="text-[10px] text-muted-foreground">{getProductName(int_.product_id)}</p>
                      </div>
                    </div>
                    <Switch checked={int_.is_active} onCheckedChange={() => toggleActive(int_)} />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mb-3">
                    {(int_.events || []).slice(0, 4).map(e => (
                      <span key={e} className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-muted/40 border border-border/30 text-muted-foreground/70 uppercase tracking-wider">{e}</span>
                    ))}
                    {(int_.events || []).length > 4 && (
                      <span className="text-[8px] font-bold text-muted-foreground/50">+{(int_.events || []).length - 4}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5 rounded-xl text-[11px] h-8 border-border/50" onClick={() => openDialog(appDef, int_)}>
                      <Settings2 className="h-3 w-3" /> Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1 rounded-xl text-[11px] h-8 text-destructive/70 hover:text-destructive hover:bg-destructive/5" onClick={() => deleteIntegration(int_.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </GlowPanel>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Generic Integration Dialog ─── */}
      {dialogApp && dialogApp.id !== "webhooks" && (
        <Dialog open={!!dialogApp} onOpenChange={(v) => { if (!v) closeDialog(); }}>
          <DialogContent className="max-w-lg rounded-2xl border-border/60 bg-card/95 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl font-display font-black">
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${dialogApp.bg} flex items-center justify-center`}>
                  <span className={`text-lg font-black ${dialogApp.color}`}>{dialogApp.icon}</span>
                </div>
                {editId ? `Editar ${dialogApp.name}` : `Integrar ${dialogApp.name}`}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 mt-2">
              {dialogApp.helpText && (
                <div className="rounded-xl bg-muted/30 border border-border/40 p-3">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{dialogApp.helpText}</p>
                </div>
              )}

              {/* Product selection */}
              {dialogApp.events.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Produto *</Label>
                  <Select value={formProductId} onValueChange={setFormProductId}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Dynamic fields */}
              {dialogApp.fields.map(field => (
                <div key={field.key} className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    {field.label} {field.required && "*"}
                  </Label>
                  <Input
                    placeholder={field.placeholder}
                    value={formFields[field.key] || ""}
                    onChange={(e) => setFormFields({ ...formFields, [field.key]: e.target.value })}
                    className="rounded-xl font-mono text-xs"
                  />
                  {field.help && (
                    <p className="text-[10px] text-muted-foreground/60">{field.help}</p>
                  )}
                </div>
              ))}

              {/* Events */}
              {dialogApp.events.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Eventos</Label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFormEventMode("all")}
                      className={`flex-1 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all ${
                        formEventMode === "all"
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      Todos os eventos
                    </button>
                    <button
                      onClick={() => setFormEventMode("custom")}
                      className={`flex-1 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all ${
                        formEventMode === "custom"
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      Personalizado
                    </button>
                  </div>

                  {formEventMode === "custom" && (
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-xl border border-border/60 p-3 bg-muted/20">
                      {dialogApp.events.map((event) => (
                        <label
                          key={event}
                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/40 transition-colors"
                        >
                          <Checkbox
                            checked={formSelectedEvents.includes(event)}
                            onCheckedChange={() => toggleEvent(event)}
                          />
                          <span className="font-medium text-foreground">{event}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full h-11 rounded-xl font-bold gradient-primary text-primary-foreground shadow-lg shadow-primary/15"
              >
                {saving ? "Salvando..." : editId ? "Salvar Alterações" : "Ativar Integração"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </PageShell>
  );
}
