import { useState } from "react";
import { Puzzle, Settings2, Trash2, Power, Zap, Check, ChevronRight, Shield, Sparkles, ExternalLink, Radio, CheckCircle2 } from "lucide-react";
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
import { cn } from "@/lib/utils";

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
  id: string; name: string; desc: string; logo: string; category: string;
  fields: AppField[]; events: string[]; helpText?: string;
}

const APPS: AppDef[] = [
  {
    id: "zapi", name: "Z-API", desc: "WhatsApp Business via API REST", category: "Comunicação",
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
    id: "utmify", name: "UTMify", desc: "Rastreamento UTM avançado", category: "Analytics",
    logo: utmifyLogo,
    fields: [{ key: "api_key", label: "Token da UTMify", placeholder: "Cole seu token aqui", type: "api_key", required: true, help: "UTMify → Configurações → API → Token" }],
    events: ["Purchase", "InitiateCheckout", "PageView", "AddToCart", "ViewContent", "Lead", "CompleteRegistration", "AddPaymentInfo", "GenerateLead", "BoletoGenerated", "PixGenerated", "Refund", "Chargeback"],
    helpText: "Rastreia automaticamente a origem das conversões via UTM.",
  },
  {
    id: "activecampaign", name: "ActiveCampaign", desc: "Automação de e-mail marketing", category: "Marketing",
    logo: activecampaignLogo,
    fields: [
      { key: "api_key", label: "API Key", placeholder: "Cole sua API key", type: "api_key", required: true, help: "Settings → Developer → API Key" },
      { key: "api_url", label: "URL da conta", placeholder: "https://suaconta.api-us1.com", type: "api_url", required: true, help: "Settings → Developer → URL" },
    ],
    events: ["Purchase", "Lead", "InitiateCheckout", "Refund", "Chargeback"],
    helpText: "Adiciona contatos e aplica tags automaticamente.",
  },
  {
    id: "notazz", name: "Notazz", desc: "Emissão automática de notas fiscais", category: "Fiscal",
    logo: notazzLogo,
    fields: [{ key: "api_key", label: "API Key da Notazz", placeholder: "Cole sua API key", type: "api_key", required: true, help: "Notazz → Configurações → Integrações → API Key" }],
    events: ["Purchase", "Refund"],
    helpText: "Emissão automática de NF-e ao confirmar venda.",
  },
  {
    id: "themembers", name: "TheMembers", desc: "Área de membros", category: "Membros",
    logo: themembersLogo,
    fields: [
      { key: "api_key", label: "API Key", placeholder: "Cole sua API key", type: "api_key", required: true, help: "TheMembers → Integrações → API → Chave" },
      { key: "api_url", label: "URL da API (opcional)", placeholder: "https://api.themembers.com.br", type: "api_url", required: false },
    ],
    events: ["Purchase", "Refund", "Chargeback"],
    helpText: "Libera/revoga acesso automático na área de membros.",
  },
  {
    id: "spedy", name: "Spedy", desc: "Logística e envios automatizados", category: "Logística",
    logo: spedyLogo,
    fields: [{ key: "api_key", label: "Token da Spedy", placeholder: "Cole seu token", type: "api_key", required: true, help: "Spedy → Configurações → API → Token" }],
    events: ["Purchase"],
    helpText: "Cria pedidos de envio ao confirmar compra.",
  },
  {
    id: "astron", name: "Astron Members", desc: "Área de membros premium", category: "Membros",
    logo: astronLogo,
    fields: [{ key: "api_key", label: "API Key", placeholder: "Cole sua API key", type: "api_key", required: true, help: "Astron → Configurações → Integrações → API Key" }],
    events: ["Purchase", "Refund", "Chargeback"],
    helpText: "Libera/revoga acesso na plataforma Astron.",
  },
  {
    id: "memberkit", name: "MemberKit", desc: "Gestão completa de membros", category: "Membros",
    logo: memberkitLogo,
    fields: [{ key: "api_key", label: "API Key", placeholder: "Cole sua API key", type: "api_key", required: true, help: "MemberKit → Configurações → API → Chave" }],
    events: ["Purchase", "Refund", "Chargeback"],
    helpText: "Gerencia acesso dos membros automaticamente.",
  },
  {
    id: "smsfunnel", name: "SMSFunnel", desc: "Automação de SMS marketing", category: "Comunicação",
    logo: smsfunnelLogo,
    fields: [{ key: "api_key", label: "Token", placeholder: "Cole seu token", type: "api_key", required: true, help: "SMSFunnel → Configurações → API → Token" }],
    events: ["Purchase", "Lead", "InitiateCheckout", "PixGenerated", "BoletoGenerated", "Refund"],
    helpText: "Dispara SMS automáticos com base nos eventos.",
  },
  {
    id: "voxuy", name: "Voxuy", desc: "Chatbot e automação WhatsApp", category: "Comunicação",
    logo: voxuyLogo,
    fields: [{ key: "api_key", label: "API Key", placeholder: "Cole sua API key", type: "api_key", required: true, help: "Voxuy → Configurações → API → Chave" }],
    events: ["Purchase", "Lead", "InitiateCheckout", "PixGenerated", "Refund", "Chargeback"],
    helpText: "Mensagens automáticas via WhatsApp com Voxuy.",
  },
  {
    id: "cademi", name: "Cademi", desc: "Plataforma de cursos online", category: "Membros",
    logo: cademiLogo,
    fields: [{ key: "api_key", label: "API Key", placeholder: "Cole sua API key", type: "api_key", required: true, help: "Cademi → Integrações → API → Chave" }],
    events: ["Purchase", "Refund", "Chargeback"],
    helpText: "Libera/revoga acesso dos alunos automaticamente.",
  },
  {
    id: "webhooks", name: "Webhooks", desc: "Integre com qualquer sistema", category: "Avançado",
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

const eventColor = (e: string) => {
  if (e === "Purchase") return "bg-success/10 text-success border-success/20";
  if (e === "Refund" || e === "Chargeback") return "bg-destructive/10 text-destructive border-destructive/20";
  if (e.includes("Pix") || e.includes("Boleto")) return "bg-warning/10 text-warning border-warning/20";
  if (e === "Lead") return "bg-info/10 text-info border-info/20";
  return "bg-muted/60 text-muted-foreground border-border/40";
};

const categoryColor = (cat: string) => {
  switch (cat) {
    case "Comunicação": return "text-info";
    case "Analytics": return "text-warning";
    case "Marketing": return "text-primary";
    case "Fiscal": return "text-success";
    case "Membros": return "text-accent-foreground";
    case "Logística": return "text-warning";
    case "Avançado": return "text-primary";
    default: return "text-muted-foreground";
  }
};

export default function Apps() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: products = [] } = useProducts();
  const { data: integrationsRaw = [] } = useAppIntegrations();
  const integrations = integrationsRaw as unknown as AppIntegration[];
  const invalidateAll = useInvalidateAll();
  const [dialogApp, setDialogApp] = useState<AppDef | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formProductId, setFormProductId] = useState("");
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const [formEventMode, setFormEventMode] = useState<"all" | "custom">("all");
  const [formSelectedEvents, setFormSelectedEvents] = useState<string[]>([]);

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
      const { error: e } = await supabase.from("app_integrations").update(payload).eq("id", editId).eq("user_id", user.id);
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
    else { toast.success(`${dialogApp.name} ${editId ? "atualizada" : "integrada"} com sucesso!`); closeDialog(); invalidateAll(["app_integrations"]); }
  };

  const toggleActive = async (int_: AppIntegration) => {
    if (!user) return;
    await supabase.from("app_integrations").update({ is_active: !int_.is_active }).eq("id", int_.id).eq("user_id", user.id);
    invalidateAll(["app_integrations"]);
  };

  const deleteIntegration = async (id: string) => {
    if (!user) return;
    if (!window.confirm("Tem certeza que deseja remover esta integração?")) return;
    const { error } = await supabase.from("app_integrations").delete().eq("id", id).eq("user_id", user.id);
    if (error) { toast.error("Erro ao remover integração"); return; }
    toast.success("Integração removida"); invalidateAll(["app_integrations"]);
  };

  const toggleEvent = (event: string) => {
    setFormSelectedEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]);
  };

  const hasIntegration = (appId: string) => integrations.some(i => i.app_name === appId);
  const getIntegration = (appId: string) => integrations.find(i => i.app_name === appId);
  const getProductName = (id: string | null) => products.find(p => p.id === id)?.name || "—";

  return (
    <PageShell>
      <PageTitle icon={<Puzzle className="h-6 w-6" />} title="Apps & Integrações" subtitle="Conecte ferramentas ao seu ecossistema de vendas" />

      {/* ─── App Grid ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {APPS.map((app, idx) => {
          const active = hasIntegration(app.id);
          const integration = getIntegration(app.id);
          return (
            <button
              key={app.id}
              onClick={() => openDialog(app, integration || undefined)}
              className={cn(
                "group relative overflow-hidden rounded-2xl border text-left transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] animate-fade-in active:scale-[0.98]",
                active
                  ? "border-primary/25 bg-card shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:border-primary/40"
                  : "border-border/40 bg-card hover:border-border/70 hover:shadow-lg hover:shadow-black/5"
              )}
              style={{ animationDelay: `${idx * 35}ms`, animationFillMode: "backwards" }}
            >
              {/* Hover glow effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent" />
              </div>

              {/* Top: Logo area */}
              <div className={cn(
                "relative h-[100px] flex items-center justify-center px-8 border-b transition-colors duration-300",
                active
                  ? "border-primary/10 bg-primary/[0.02]"
                  : "border-border/20 bg-muted/15 group-hover:bg-muted/25"
              )}>
                <img
                  src={app.logo}
                  alt={app.name}
                  className="max-h-12 max-w-[160px] object-contain drop-shadow-sm transition-transform duration-500 ease-out group-hover:scale-105"
                />

                {/* Status badge */}
                {active && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/20">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-success">Ativo</span>
                  </div>
                )}

                {/* Category tag */}
                <span className={cn(
                  "absolute top-3 left-3 text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-md bg-muted/30 border border-border/20",
                  categoryColor(app.category)
                )}>
                  {app.category}
                </span>
              </div>

              {/* Bottom: Info */}
              <div className="relative p-4 space-y-3">
                <div>
                  <h3 className="text-[14px] font-bold text-foreground tracking-tight">{app.name}</h3>
                  <p className="text-[12px] text-muted-foreground/70 leading-relaxed mt-0.5 line-clamp-2">{app.desc}</p>
                </div>

                {/* Events count & fields info */}
                <div className="flex items-center gap-3">
                  {app.events.length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                      <Radio className="h-3 w-3" />
                      {app.events.length} eventos
                    </span>
                  )}
                  {app.fields.length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                      <Shield className="h-3 w-3" />
                      {app.fields.length} {app.fields.length === 1 ? "credencial" : "credenciais"}
                    </span>
                  )}
                </div>

                {/* Footer CTA */}
                <div className={cn(
                  "flex items-center justify-between pt-3 border-t transition-colors duration-300",
                  active ? "border-primary/10" : "border-border/20"
                )}>
                  <span className={cn(
                    "text-[12px] font-semibold transition-colors duration-300",
                    active
                      ? "text-primary"
                      : "text-muted-foreground/60 group-hover:text-foreground"
                  )}>
                    {app.id === "webhooks"
                      ? "Gerenciar Webhooks"
                      : active ? "Gerenciar" : "Conectar"}
                  </span>
                  <div className={cn(
                    "h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-300",
                    active
                      ? "bg-primary/10 text-primary"
                      : "bg-muted/20 text-muted-foreground/30 group-hover:bg-primary/10 group-hover:text-primary"
                  )}>
                    {app.id === "webhooks" ? (
                      <ExternalLink className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ─── Active Integrations ─── */}
      {integrations.length > 0 && (
        <div className="pt-4 space-y-4">
          <SectionHeader icon={<Settings2 className="h-4.5 w-4.5" />} title="Integrações Ativas" subtitle={`${integrations.length} integração${integrations.length > 1 ? "ões" : ""} configurada${integrations.length > 1 ? "s" : ""}`} />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {integrations.map((int_, idx) => {
              const appDef = APPS.find(a => a.id === int_.app_name);
              if (!appDef) return null;
              return (
                <div
                  key={int_.id}
                  className={cn(
                    "rounded-2xl border p-5 transition-all duration-300 animate-fade-in",
                    int_.is_active
                      ? "border-primary/20 bg-card shadow-sm"
                      : "border-border/30 bg-card/50 opacity-70"
                  )}
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-11 w-11 rounded-xl border flex items-center justify-center overflow-hidden p-2 transition-colors",
                        int_.is_active
                          ? "bg-primary/5 border-primary/15"
                          : "bg-muted/20 border-border/30"
                      )}>
                        <img src={appDef.logo} alt={appDef.name} className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <span className="font-bold text-sm text-foreground">{appDef.name}</span>
                        <p className="text-[11px] text-muted-foreground/60">{getProductName(int_.product_id)}</p>
                      </div>
                    </div>
                    <Switch checked={int_.is_active} onCheckedChange={() => toggleActive(int_)} />
                  </div>

                  {/* Events */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-4">
                    {(int_.events || []).slice(0, 4).map(e => (
                      <span key={e} className={cn("text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider", eventColor(e))}>{e}</span>
                    ))}
                    {(int_.events || []).length > 4 && (
                      <span className="text-[9px] font-bold text-muted-foreground/40 bg-muted/20 px-2 py-0.5 rounded-md">
                        +{(int_.events || []).length - 4}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 rounded-xl text-[11px] h-9 border-border/40 hover:border-primary/30 hover:bg-primary/5 hover:text-primary transition-all"
                      onClick={() => openDialog(appDef, int_)}
                    >
                      <Settings2 className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 rounded-xl text-[11px] h-9 text-destructive/40 hover:text-destructive hover:bg-destructive/5"
                      onClick={() => deleteIntegration(int_.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Premium Integration Dialog ─── */}
      {dialogApp && dialogApp.id !== "webhooks" && (
        <Dialog open={!!dialogApp} onOpenChange={(v) => { if (!v) closeDialog(); }}>
          <DialogContent className="max-w-lg rounded-2xl border-border/60 bg-card/95 backdrop-blur-xl p-0 overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent pointer-events-none rounded-2xl" />

            {/* Header */}
            <div className="relative px-6 pt-6 pb-5 border-b border-border/20">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-card border border-border/30 flex items-center justify-center overflow-hidden p-2.5 shadow-sm">
                  <img src={dialogApp.logo} alt={dialogApp.name} className="w-full h-full object-contain" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-foreground">
                    {editId ? `Editar ${dialogApp.name}` : `Conectar ${dialogApp.name}`}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">{dialogApp.desc}</p>
                </div>
              </div>
            </div>

            <div className="relative px-6 pb-6 space-y-5 pt-5">
              {/* Help text */}
              {dialogApp.helpText && (
                <div className="flex items-start gap-3 rounded-xl bg-primary/5 border border-primary/10 p-4">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-[12px] text-muted-foreground leading-relaxed">{dialogApp.helpText}</p>
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
                    <SelectTrigger className="rounded-xl h-11 border-border/40 bg-background hover:bg-muted/20 transition-colors">
                      <SelectValue placeholder="Selecione o produto para esta integração" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Credential fields */}
              {dialogApp.fields.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Shield className="h-3 w-3 text-primary" />
                    Credenciais
                  </Label>
                  <div className="space-y-3 rounded-xl border border-border/30 bg-muted/5 p-4">
                    {dialogApp.fields.map(field => (
                      <div key={field.key} className="space-y-1.5">
                        <label className="text-[12px] font-semibold text-foreground/80">
                          {field.label} {field.required && <span className="text-primary">*</span>}
                        </label>
                        <Input
                          placeholder={field.placeholder}
                          value={formFields[field.key] || ""}
                          onChange={(e) => setFormFields({ ...formFields, [field.key]: e.target.value })}
                          className="rounded-xl h-11 font-mono text-xs border-border/30 bg-background"
                        />
                        {field.help && (
                          <p className="text-[10px] text-muted-foreground/50 pl-1">{field.help}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Events */}
              {dialogApp.events.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-primary" />
                    Eventos de disparo
                  </Label>

                  <div className="grid grid-cols-2 gap-2">
                    {(["all", "custom"] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setFormEventMode(mode)}
                        className={cn(
                          "rounded-xl border px-4 py-3 text-xs font-bold transition-all",
                          formEventMode === mode
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border/30 text-muted-foreground/60 hover:border-border/50 hover:bg-muted/10"
                        )}
                      >
                        <div className="flex items-center justify-center gap-2">
                          {formEventMode === mode && <CheckCircle2 className="h-3.5 w-3.5" />}
                          {mode === "all" ? `Todos (${dialogApp.events.length})` : "Personalizado"}
                        </div>
                      </button>
                    ))}
                  </div>

                  {formEventMode === "custom" && (
                    <div className="rounded-xl border border-border/30 bg-background overflow-hidden">
                      <div className="max-h-52 overflow-y-auto p-2 space-y-0.5">
                        {dialogApp.events.map(event => {
                          const selected = formSelectedEvents.includes(event);
                          return (
                            <label
                              key={event}
                              className={cn(
                                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs cursor-pointer transition-all",
                                selected ? "bg-primary/5 text-foreground" : "text-muted-foreground/60 hover:bg-muted/20 hover:text-foreground"
                              )}
                            >
                              <Checkbox
                                checked={selected}
                                onCheckedChange={() => toggleEvent(event)}
                                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                              <span className="font-medium flex-1">{event}</span>
                              <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider", eventColor(event))}>
                                {event.includes("Refund") || event.includes("Chargeback") ? "reversal" : "trigger"}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      {formSelectedEvents.length > 0 && (
                        <div className="border-t border-border/20 px-3 py-2 bg-muted/5">
                          <span className="text-[10px] font-medium text-muted-foreground/60">
                            {formSelectedEvents.length} de {dialogApp.events.length} selecionados
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

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
