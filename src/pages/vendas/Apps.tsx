import { useState } from "react";
import { Puzzle, Settings2, Trash2, Power, Zap, Check, ChevronRight, Shield, Sparkles } from "lucide-react";
import { PageShell, PageTitle, GlowPanel, SectionHeader } from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts, useAppIntegrations, useInvalidateAll } from "@/hooks/useQueryData";
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

import utmifyLogo from "@/assets/apps/utmify.png";
import notazzLogo from "@/assets/apps/notazz.svg";
import themembersLogo from "@/assets/apps/themembers.png";
import activecampaignLogo from "@/assets/apps/activecampaign.png";
import spedyLogo from "@/assets/apps/spedy.png";
import astronLogo from "@/assets/apps/astron_members.png";
import memberkitLogo from "@/assets/apps/memberkit.png";
import smsfunnelLogo from "@/assets/apps/smsfunnel.png";
import voxuyLogo from "@/assets/apps/voxuy.png";
import cademiLogo from "@/assets/apps/cademi.png";
import webhooksLogo from "@/assets/apps/webhooks.png";
import zapiLogo from "@/assets/apps/zapi.webp";

/* ─── Types ─── */
interface AppField {
  key: string; label: string; placeholder: string;
  type: "api_key" | "api_url" | "webhook_url"; required: boolean; help?: string;
}

interface AppDef {
  id: string; name: string; desc: string; logo: string;
  fields: AppField[]; events: string[]; helpText?: string;
}

const APPS: AppDef[] = [
  {
    id: "utmify", name: "UTMify", desc: "Rastreamento UTM avançado",
    logo: utmifyLogo,
    fields: [{ key: "api_key", label: "Token da UTMify", placeholder: "Cole seu token aqui", type: "api_key", required: true, help: "UTMify → Configurações → API → Token" }],
    events: ["Purchase", "InitiateCheckout", "PageView", "AddToCart", "ViewContent", "Lead", "CompleteRegistration", "AddPaymentInfo", "GenerateLead", "BoletoGenerated", "PixGenerated", "Refund", "Chargeback"],
    helpText: "Rastreia automaticamente a origem das conversões via UTM.",
  },
  {
    id: "notazz", name: "Notazz", desc: "Emissão automática de notas fiscais",
    logo: notazzLogo,
    fields: [{ key: "api_key", label: "API Key da Notazz", placeholder: "Cole sua API key", type: "api_key", required: true, help: "Notazz → Configurações → Integrações → API Key" }],
    events: ["Purchase", "Refund"],
    helpText: "Emissão automática de NF-e ao confirmar venda.",
  },
  {
    id: "themembers", name: "TheMembers", desc: "Área de membros",
    logo: themembersLogo,
    fields: [
      { key: "api_key", label: "API Key", placeholder: "Cole sua API key", type: "api_key", required: true, help: "TheMembers → Integrações → API → Chave" },
      { key: "api_url", label: "URL da API (opcional)", placeholder: "https://api.themembers.com.br", type: "api_url", required: false },
    ],
    events: ["Purchase", "Refund", "Chargeback"],
    helpText: "Libera/revoga acesso automático na área de membros.",
  },
  {
    id: "activecampaign", name: "ActiveCampaign", desc: "Automação de e-mail marketing",
    logo: activecampaignLogo,
    fields: [
      { key: "api_key", label: "API Key", placeholder: "Cole sua API key", type: "api_key", required: true, help: "Settings → Developer → API Key" },
      { key: "api_url", label: "URL da conta", placeholder: "https://suaconta.api-us1.com", type: "api_url", required: true, help: "Settings → Developer → URL" },
    ],
    events: ["Purchase", "Lead", "InitiateCheckout", "Refund", "Chargeback"],
    helpText: "Adiciona contatos e aplica tags automaticamente.",
  },
  {
    id: "spedy", name: "Spedy", desc: "Logística e envios automatizados",
    logo: spedyLogo,
    fields: [{ key: "api_key", label: "Token da Spedy", placeholder: "Cole seu token", type: "api_key", required: true, help: "Spedy → Configurações → API → Token" }],
    events: ["Purchase"],
    helpText: "Cria pedidos de envio ao confirmar compra.",
  },
  {
    id: "astron", name: "Astron Members", desc: "Área de membros premium",
    logo: astronLogo,
    fields: [{ key: "api_key", label: "API Key", placeholder: "Cole sua API key", type: "api_key", required: true, help: "Astron → Configurações → Integrações → API Key" }],
    events: ["Purchase", "Refund", "Chargeback"],
    helpText: "Libera/revoga acesso na plataforma Astron.",
  },
  {
    id: "memberkit", name: "MemberKit", desc: "Gestão completa de membros",
    logo: memberkitLogo,
    fields: [{ key: "api_key", label: "API Key", placeholder: "Cole sua API key", type: "api_key", required: true, help: "MemberKit → Configurações → API → Chave" }],
    events: ["Purchase", "Refund", "Chargeback"],
    helpText: "Gerencia acesso dos membros automaticamente.",
  },
  {
    id: "smsfunnel", name: "SMSFunnel", desc: "Automação de SMS marketing",
    logo: smsfunnelLogo,
    fields: [{ key: "api_key", label: "Token", placeholder: "Cole seu token", type: "api_key", required: true, help: "SMSFunnel → Configurações → API → Token" }],
    events: ["Purchase", "Lead", "InitiateCheckout", "PixGenerated", "BoletoGenerated", "Refund"],
    helpText: "Dispara SMS automáticos com base nos eventos.",
  },
  {
    id: "voxuy", name: "Voxuy", desc: "Chatbot e automação WhatsApp",
    logo: voxuyLogo,
    fields: [{ key: "api_key", label: "API Key", placeholder: "Cole sua API key", type: "api_key", required: true, help: "Voxuy → Configurações → API → Chave" }],
    events: ["Purchase", "Lead", "InitiateCheckout", "PixGenerated", "Refund", "Chargeback"],
    helpText: "Mensagens automáticas via WhatsApp com Voxuy.",
  },
  {
    id: "cademi", name: "Cademi", desc: "Plataforma de cursos online",
    logo: cademiLogo,
    fields: [{ key: "api_key", label: "API Key", placeholder: "Cole sua API key", type: "api_key", required: true, help: "Cademi → Integrações → API → Chave" }],
    events: ["Purchase", "Refund", "Chargeback"],
    helpText: "Libera/revoga acesso dos alunos automaticamente.",
  },
  {
    id: "zapi", name: "Z-API", desc: "WhatsApp Business via API REST",
    logo: zapiLogo,
    fields: [
      { key: "api_key", label: "Instance Token", placeholder: "Token da instância", type: "api_key", required: true, help: "Z-API → Painel → Sua Instância → Token" },
      { key: "api_url", label: "Instance ID", placeholder: "ID da instância", type: "api_url", required: true, help: "Z-API → Painel → Sua Instância → ID" },
      { key: "webhook_url", label: "Client-Token (Segurança)", placeholder: "Client-Token (opcional)", type: "webhook_url", required: false, help: "Z-API → Segurança → Token da conta" },
    ],
    events: ["Purchase", "Lead", "InitiateCheckout", "PixGenerated", "BoletoGenerated", "Refund", "Chargeback"],
    helpText: "Mensagens automáticas pelo WhatsApp via Z-API REST.",
  },
  {
    id: "webhooks", name: "Webhooks", desc: "Integre com qualquer sistema",
    logo: webhooksLogo,
    fields: [], events: [],
    helpText: "Gerencie webhooks customizados.",
  },
];

interface AppIntegration {
  id: string; user_id: string; app_name: string; product_id: string | null;
  api_key: string | null; api_url: string | null; webhook_url: string | null;
  events: string[]; is_active: boolean; config: Record<string, unknown>; created_at: string;
}

/* ─── Event Badge Colors (semantic, works in both themes) ─── */
const eventColor = (e: string) => {
  if (e === "Purchase") return "bg-success/10 text-success border-success/20 dark:bg-success/15 dark:text-success";
  if (e === "Refund" || e === "Chargeback") return "bg-destructive/10 text-destructive border-destructive/20";
  if (e.includes("Pix") || e.includes("Boleto")) return "bg-warning/10 text-warning border-warning/20";
  if (e === "Lead") return "bg-info/10 text-info border-info/20";
  return "bg-muted/60 text-muted-foreground border-border/40";
};

export default function Apps() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [integrations, setIntegrations] = useState<AppIntegration[]>([]);
  const [dialogApp, setDialogApp] = useState<AppDef | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formProductId, setFormProductId] = useState("");
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const [formEventMode, setFormEventMode] = useState<"all" | "custom">("all");
  const [formSelectedEvents, setFormSelectedEvents] = useState<string[]>([]);

  useEffect(() => { if (user?.id) loadData(); }, [user?.id]);

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
    if (app.id === "webhooks") { navigate("/vendas/webhooks"); return; }
    setDialogApp(app);
    if (existing) {
      setEditId(existing.id);
      setFormProductId(existing.product_id || "");
      const fields: Record<string, string> = {};
      if (existing.api_key) fields["api_key"] = existing.api_key;
      if (existing.api_url) fields["api_url"] = existing.api_url;
      if (existing.webhook_url) fields["webhook_url"] = existing.webhook_url;
      setFormFields(fields);
      setFormEventMode(existing.events?.length === app.events.length ? "all" : "custom");
      if (existing.events?.length !== app.events.length) setFormSelectedEvents(existing.events || []);
    } else {
      setEditId(null); setFormProductId(""); setFormFields({}); setFormEventMode("all"); setFormSelectedEvents([]);
    }
  };

  const closeDialog = () => { setDialogApp(null); setEditId(null); };

  const handleSave = async () => {
    if (!user?.id || !dialogApp) return;
    for (const f of dialogApp.fields.filter(f => f.required)) {
      if (!formFields[f.key]?.trim()) { toast.error(`Preencha: ${f.label}`); return; }
    }
    if (!formProductId && dialogApp.events.length > 0) { toast.error("Selecione um produto"); return; }
    setSaving(true);
    const events = formEventMode === "all" ? dialogApp.events : formSelectedEvents;
    const payload = {
      user_id: user.id, app_name: dialogApp.id, product_id: formProductId || null,
      api_key: formFields["api_key"] || null, api_url: formFields["api_url"] || null,
      webhook_url: formFields["webhook_url"] || null, events, is_active: true, config: {},
    };
    let error;
    if (editId) {
      const { error: e } = await supabase.from("app_integrations").update(payload).eq("id", editId);
      error = e;
    } else {
      if (dialogApp.id === "utmify" && formFields["api_key"]) {
        await supabase.from("product_pixels").insert({
          user_id: user.id, product_id: formProductId, platform: "utmify",
          pixel_id: formFields["api_key"], api_token: formFields["api_key"], events, is_active: true,
        });
      }
      const { error: e } = await supabase.from("app_integrations").insert(payload);
      error = e;
    }
    setSaving(false);
    if (error) toast.error("Erro ao salvar integração");
    else { toast.success(`${dialogApp.name} ${editId ? "atualizada" : "integrada"} com sucesso! 🎯`); closeDialog(); loadData(); }
  };

  const toggleActive = async (int_: AppIntegration) => {
    await supabase.from("app_integrations").update({ is_active: !int_.is_active }).eq("id", int_.id);
    loadData();
  };

  const deleteIntegration = async (id: string) => {
    await supabase.from("app_integrations").delete().eq("id", id);
    toast.success("Integração removida"); loadData();
  };

  const toggleEvent = (event: string) => {
    setFormSelectedEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]);
  };

  const hasIntegration = (appId: string) => integrations.some(i => i.app_name === appId);
  const getProductName = (id: string | null) => products.find(p => p.id === id)?.name || "—";

  return (
    <PageShell>
      <PageTitle icon={<Puzzle className="h-6 w-6" />} title="Apps & Integrações" subtitle="Conecte ferramentas ao seu ecossistema de vendas" />

      {/* ─── App Grid ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {APPS.map((app, idx) => {
          const active = hasIntegration(app.id);
          return (
            <button
              key={app.id}
              onClick={() => openDialog(app)}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card text-left transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5 animate-fade-in"
              style={{ animationDelay: `${idx * 40}ms`, animationFillMode: "backwards" }}
            >
              {/* Logo area - generous height with subtle bg */}
              <div className="relative h-28 flex items-center justify-center px-6 border-b border-border/40 bg-muted/30">
                <img
                  src={app.logo}
                  alt={app.name}
                  className="max-h-14 max-w-[180px] object-contain drop-shadow-sm"
                />
                {active && (
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider bg-primary/10 border border-primary/20 text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    Ativo
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-5">
                <h3 className="text-sm font-display font-bold text-foreground mb-1">{app.name}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{app.desc}</p>

                {app.events.length > 0 && (
                  <p className="text-[11px] text-muted-foreground/60 mt-3">{app.events.length} eventos disponíveis</p>
                )}

                {/* Footer CTA */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40">
                  <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                    {app.id === "webhooks" ? "Ir para Webhooks" : "Configurar agora"}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ─── Active Integrations ─── */}
      {integrations.length > 0 && (
        <div className="pt-4">
          <SectionHeader icon={<Settings2 className="h-4.5 w-4.5" />} title="Integrações Ativas" subtitle="Gerencie suas integrações configuradas" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
            {integrations.map(int_ => {
              const appDef = APPS.find(a => a.id === int_.app_name);
              if (!appDef) return null;
              return (
                <GlowPanel key={int_.id} className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-muted/40 border border-border/40 flex items-center justify-center overflow-hidden p-2">
                        <img src={appDef.logo} alt={appDef.name} className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <span className="font-display font-bold text-sm text-foreground">{appDef.name}</span>
                        <p className="text-[11px] text-muted-foreground">{getProductName(int_.product_id)}</p>
                      </div>
                    </div>
                    <Switch checked={int_.is_active} onCheckedChange={() => toggleActive(int_)} />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mb-4">
                    {(int_.events || []).slice(0, 5).map(e => (
                      <span key={e} className={`text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${eventColor(e)}`}>{e}</span>
                    ))}
                    {(int_.events || []).length > 5 && (
                      <span className="text-[9px] font-bold text-muted-foreground/50">+{(int_.events || []).length - 5}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5 rounded-xl text-[11px] h-9 border-border/50" onClick={() => openDialog(appDef, int_)}>
                      <Settings2 className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1 rounded-xl text-[11px] h-9 text-destructive/70 hover:text-destructive hover:bg-destructive/5" onClick={() => deleteIntegration(int_.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </GlowPanel>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Premium Integration Dialog ─── */}
      {dialogApp && dialogApp.id !== "webhooks" && (
        <Dialog open={!!dialogApp} onOpenChange={(v) => { if (!v) closeDialog(); }}>
          <DialogContent className="max-w-lg rounded-2xl border-border/60 bg-card p-0 overflow-hidden shadow-2xl">
            {/* Dialog header */}
            <div className="relative px-6 pt-6 pb-5 border-b border-border/40 bg-muted/20">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-card border border-border/50 flex items-center justify-center overflow-hidden p-2.5 shadow-md">
                  <img src={dialogApp.logo} alt={dialogApp.name} className="w-full h-full object-contain" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-display font-black text-foreground">
                    {editId ? `Editar ${dialogApp.name}` : `Integrar ${dialogApp.name}`}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{dialogApp.desc}</p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 space-y-5 pt-5">
              {/* Help text */}
              {dialogApp.helpText && (
                <div className="flex items-start gap-3 rounded-xl bg-primary/5 border border-primary/15 p-4">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">{dialogApp.helpText}</p>
                </div>
              )}

              {/* Product selection */}
              {dialogApp.events.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Produto vinculado
                  </Label>
                  <Select value={formProductId} onValueChange={setFormProductId}>
                    <SelectTrigger className="rounded-xl h-11 border-border/60 bg-background hover:bg-muted/30 transition-colors">
                      <SelectValue placeholder="Selecione o produto para esta integração" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Dynamic credential fields */}
              {dialogApp.fields.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Shield className="h-3 w-3 text-primary" />
                    Credenciais
                  </Label>
                  <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 p-4">
                    {dialogApp.fields.map(field => (
                      <div key={field.key} className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">
                          {field.label} {field.required && <span className="text-primary">*</span>}
                        </label>
                        <Input
                          placeholder={field.placeholder}
                          value={formFields[field.key] || ""}
                          onChange={(e) => setFormFields({ ...formFields, [field.key]: e.target.value })}
                          className="rounded-xl h-11 font-mono text-xs border-border/50 bg-background focus:border-primary/40 transition-all"
                        />
                        {field.help && (
                          <p className="text-[10px] text-muted-foreground/60 pl-1">{field.help}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Events selection */}
              {dialogApp.events.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-primary" />
                    Eventos de disparo
                  </Label>

                  {/* Mode toggle */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setFormEventMode("all")}
                      className={`rounded-xl border px-4 py-3 text-xs font-bold transition-all ${
                        formEventMode === "all"
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border/50 text-muted-foreground hover:border-border hover:bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        {formEventMode === "all" && <Check className="h-3.5 w-3.5" />}
                        Todos ({dialogApp.events.length})
                      </div>
                    </button>
                    <button
                      onClick={() => setFormEventMode("custom")}
                      className={`rounded-xl border px-4 py-3 text-xs font-bold transition-all ${
                        formEventMode === "custom"
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border/50 text-muted-foreground hover:border-border hover:bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        {formEventMode === "custom" && <Check className="h-3.5 w-3.5" />}
                        Personalizado
                      </div>
                    </button>
                  </div>

                  {/* Custom event picker */}
                  {formEventMode === "custom" && (
                    <div className="rounded-xl border border-border/50 bg-background overflow-hidden">
                      <div className="max-h-52 overflow-y-auto p-2 space-y-0.5">
                        {dialogApp.events.map(event => {
                          const selected = formSelectedEvents.includes(event);
                          return (
                            <label
                              key={event}
                              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs cursor-pointer transition-all ${
                                selected ? "bg-primary/5 text-foreground" : "text-muted-foreground hover:bg-muted/30"
                              }`}
                            >
                              <Checkbox
                                checked={selected}
                                onCheckedChange={() => toggleEvent(event)}
                                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                              <span className="font-medium flex-1">{event}</span>
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${eventColor(event)}`}>
                                {event.includes("Refund") || event.includes("Chargeback") ? "reversal" : "trigger"}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      {formSelectedEvents.length > 0 && (
                        <div className="border-t border-border/40 px-3 py-2 bg-muted/10">
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {formSelectedEvents.length} de {dialogApp.events.length} selecionados
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Save button */}
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full h-12 rounded-xl font-bold text-sm gradient-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Salvando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {editId ? <Settings2 className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                    {editId ? "Salvar Alterações" : "Ativar Integração"}
                  </span>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </PageShell>
  );
}
