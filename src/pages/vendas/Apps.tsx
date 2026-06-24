import { useState } from "react";
import { Puzzle, Settings2, Zap, Shield, Sparkles, CheckCircle2, Clock } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts, useAppIntegrations, useInvalidateAll } from "@/hooks/useQueryData";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
 fields: AppField[]; events: string[]; helpText?: string; comingSoon?: boolean;
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
 logo: activecampaignLogo, comingSoon: true,
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
 logo: themembersLogo, comingSoon: true,
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
 logo: astronLogo, comingSoon: true,
 fields: [{ key: "api_key", label: "API Key", placeholder: "Cole sua API key", type: "api_key", required: true, help: "Astron → Configurações → Integrações → API Key" }],
 events: ["Purchase", "Refund", "Chargeback"],
 helpText: "Libera/revoga acesso na plataforma Astron.",
 },
 {
 id: "memberkit", name: "MemberKit", desc: "Gestão completa de membros", category: "Membros",
 logo: memberkitLogo, comingSoon: true,
 fields: [{ key: "api_key", label: "API Key", placeholder: "Cole sua API key", type: "api_key", required: true, help: "MemberKit → Configurações → API → Chave" }],
 events: ["Purchase", "Refund", "Chargeback"],
 helpText: "Gerencia acesso dos membros automaticamente.",
 },
 {
 id: "smsfunnel", name: "SMSFunnel", desc: "Automação de SMS marketing", category: "Comunicação",
 logo: smsfunnelLogo, comingSoon: true,
 fields: [{ key: "api_key", label: "Token", placeholder: "Cole seu token", type: "api_key", required: true, help: "SMSFunnel → Configurações → API → Token" }],
 events: ["Purchase", "Lead", "InitiateCheckout", "PixGenerated", "BoletoGenerated", "Refund"],
 helpText: "Dispara SMS automáticos com base nos eventos.",
 },
 {
 id: "voxuy", name: "Voxuy", desc: "Chatbot e automação WhatsApp", category: "Comunicação",
 logo: voxuyLogo, comingSoon: true,
 fields: [{ key: "api_key", label: "API Key", placeholder: "Cole sua API key", type: "api_key", required: true, help: "Voxuy → Configurações → API → Chave" }],
 events: ["Purchase", "Lead", "InitiateCheckout", "PixGenerated", "Refund", "Chargeback"],
 helpText: "Mensagens automáticas via WhatsApp com Voxuy.",
 },
 {
 id: "cademi", name: "Cademi", desc: "Plataforma de cursos online", category: "Membros",
 logo: cademiLogo, comingSoon: true,
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
 const [testing, setTesting] = useState(false);
 const [formProductId, setFormProductId] = useState("");
 const [formFields, setFormFields] = useState<Record<string, string>>({});
 const [formEventMode, setFormEventMode] = useState<"all" | "custom">("all");
 const [formSelectedEvents, setFormSelectedEvents] = useState<string[]>([]);

 const openDialog = (app: AppDef, existing?: AppIntegration) => {
 if (app.comingSoon) { toast.info(`${app.name} estará disponível em breve.`); return; }
 if (app.id === "webhooks") { navigate("/integracoes?tab=webhooks"); return; }
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

 const toggleEvent = (event: string) => {
 setFormSelectedEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]);
 };

 const getIntegration = (appId: string) => integrations.find(i => i.app_name === appId);

 return (
 <PageShell>
 <section className="space-y-6">
  <div className="flex items-end justify-between gap-4 flex-wrap">
  <div className="space-y-1">
  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
  Conectores
  </span>
  <h1 className="font-display text-2xl font-black tracking-tight text-foreground md:text-3xl">Apps</h1>
  <p className="text-sm text-muted-foreground/70">Clique no logo para configurar a integração.</p>
  </div>

  <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/80 backdrop-blur-xl">
  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
  {integrations.length} ativas
  </div>
  </div>

 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
 {[...APPS].sort((a, b) => Number(!!a.comingSoon) - Number(!!b.comingSoon)).map((app, idx) => {
 const integration = getIntegration(app.id);
 const active = Boolean(integration?.is_active);
 const isComingSoon = Boolean(app.comingSoon);

 return (
 <button
 key={app.id}
 onClick={() => openDialog(app, integration || undefined)}
 disabled={isComingSoon}
 className={cn(
 "group relative flex h-32 items-center overflow-hidden rounded-[26px] border px-7 text-left backdrop-blur-xl transition-all duration-300 ease-out animate-fade-in md:h-[8.5rem] md:px-8",
 isComingSoon
 ? "border-border/40 bg-card/50 cursor-not-allowed"
 : active
 ? "border-primary/30 bg-card shadow-[0_18px_40px_hsl(var(--primary)/0.10)] hover:border-primary/40 hover:shadow-[0_24px_52px_hsl(var(--primary)/0.14)] active:scale-[0.985]"
 : "border-border/50 bg-card/95 shadow-[0_14px_32px_hsl(var(--foreground)/0.06)] hover:-translate-y-0.5 hover:border-border/70 hover:shadow-[0_22px_46px_hsl(var(--foreground)/0.10)] active:scale-[0.985]"
 )}
 style={{ animationDelay: `${idx * 35}ms`, animationFillMode: "backwards" }}
 >
 <div className="pointer-events-none absolute inset-0">
 <div className="absolute inset-0 bg-gradient-to-br from-background/35 via-transparent to-background/20" />
 <div className={cn(
 "absolute inset-y-0 left-0 w-[3px] transition-opacity duration-300",
 active ? "bg-primary opacity-100" : "bg-border opacity-0 group-hover:opacity-100",
 isComingSoon && "opacity-0"
 )} />
 <div className={cn(
 "absolute -right-10 top-1/2 h-28 w-28 -translate-y-1/2 rounded-full blur-3xl transition-opacity duration-300",
 active ? "bg-primary/15 opacity-100" : "bg-muted opacity-0 group-hover:opacity-60",
 isComingSoon && "opacity-0"
 )} />
 </div>

              <div className="relative z-[1] flex h-full w-full items-center justify-center">
                <div className={cn(
                  "flex h-20 w-32 items-center justify-center md:h-24 md:w-40 transition-all",
                  isComingSoon && "grayscale opacity-40"
                )}>
                  <img
                    src={app.logo}
                    alt={app.name}
                    className={cn(
                      "max-h-full max-w-full object-contain transition-transform duration-300",
                      !isComingSoon && "group-hover:scale-[1.06]"
                    )}
                  />
                </div>
              </div>

              {isComingSoon && (
                <span className="absolute right-3 top-3 z-[2] inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/80 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" strokeWidth={2.5} />
                  Em breve
                </span>
              )}
              {active && !isComingSoon && (
                <span className="absolute right-3 top-3 z-[2] inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.16em] text-success">
                  <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={2.5} />
                  Ativo
                </span>
              )}
 </button>
 );
 })}

 </div>
 </section>

      {/* ─── Integration Dialog · Billion-Dollar SaaS ─── */}
      {dialogApp && dialogApp.id !== "webhooks" && (
        <Dialog open={!!dialogApp} onOpenChange={(v) => { if (!v) closeDialog(); }}>
          <DialogContent className="max-w-[560px] rounded-2xl border border-border bg-card p-0 overflow-hidden max-h-[92vh] flex flex-col gap-0">
            {/* Header */}
            <div className="flex items-center gap-4 border-b border-border bg-card px-6 py-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary p-2.5">
                <img src={dialogApp.logo} alt={dialogApp.name} className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <DialogTitle className="font-display text-[15px] font-black tracking-tight text-foreground">
                    {editId ? `Editar ${dialogApp.name}` : `Conectar ${dialogApp.name}`}
                  </DialogTitle>
                  <span className="inline-flex h-5 items-center rounded-md border border-border bg-secondary px-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    {dialogApp.category}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{dialogApp.desc}</p>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {dialogApp.helpText && (
                <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.04] px-3.5 py-3">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.2} />
                  <p className="text-[12px] leading-relaxed text-foreground/80">{dialogApp.helpText}</p>
                </div>
              )}

              {/* Produto vinculado */}
              {dialogApp.events.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Produto vinculado
                  </Label>
                  <Select value={formProductId} onValueChange={setFormProductId}>
                    <SelectTrigger className="h-11 rounded-xl border border-border bg-secondary">
                      <SelectValue placeholder="Selecione o produto para esta integração" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.length === 0 ? (
                        <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                          Nenhum produto cadastrado
                        </div>
                      ) : (
                        products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Credenciais */}
              {dialogApp.fields.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    <Shield className="h-3 w-3 text-primary" strokeWidth={2.2} />
                    Credenciais
                  </Label>
                  <div className="rounded-xl border border-border bg-secondary divide-y divide-border">
                    {dialogApp.fields.map(field => (
                      <div key={field.key} className="px-4 py-3.5 space-y-1.5">
                        <label className="flex items-center justify-between text-[11px] font-semibold text-foreground">
                          <span>
                            {field.label}
                            {field.required && <span className="ml-1 text-primary">*</span>}
                          </span>
                          {!field.required && (
                            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">
                              Opcional
                            </span>
                          )}
                        </label>
                        <Input
                          placeholder={field.placeholder}
                          value={formFields[field.key] || ""}
                          onChange={(e) => setFormFields({ ...formFields, [field.key]: e.target.value })}
                          className="h-10 rounded-lg border border-border bg-card font-mono text-xs"
                        />
                        {field.help && (
                          <p className="text-[10px] leading-relaxed text-muted-foreground/70">{field.help}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Eventos */}
              {dialogApp.events.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    <Zap className="h-3 w-3 text-primary" strokeWidth={2.2} />
                    Eventos de disparo
                  </Label>

                  <div className="inline-flex h-10 w-full items-center rounded-xl border border-border bg-secondary p-1">
                    {(["all", "custom"] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setFormEventMode(mode)}
                        className={cn(
                          "flex-1 h-full rounded-lg text-[11.5px] font-bold transition-colors flex items-center justify-center gap-1.5",
                          formEventMode === mode
                            ? "bg-card border border-border text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {formEventMode === mode && <CheckCircle2 className="h-3 w-3 text-primary" strokeWidth={2.4} />}
                        {mode === "all" ? `Todos (${dialogApp.events.length})` : "Personalizado"}
                      </button>
                    ))}
                  </div>

                  {formEventMode === "custom" && (
                    <div className="rounded-xl border border-border bg-secondary overflow-hidden">
                      <div className="max-h-56 overflow-y-auto divide-y divide-border">
                        {dialogApp.events.map(event => {
                          const selected = formSelectedEvents.includes(event);
                          const isReversal = event.includes("Refund") || event.includes("Chargeback");
                          const isPending = event.includes("Pix") || event.includes("Boleto");
                          const tone = isReversal
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : isPending
                            ? "border-warning/30 bg-warning/10 text-warning"
                            : event === "Lead"
                            ? "border-info/30 bg-info/10 text-info"
                            : "border-primary/30 bg-primary/10 text-primary";

                          return (
                            <label
                              key={event}
                              className={cn(
                                "flex items-center gap-3 px-3.5 py-2.5 text-xs cursor-pointer transition-colors",
                                selected ? "bg-card text-foreground" : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                              )}
                            >
                              <Checkbox
                                checked={selected}
                                onCheckedChange={() => toggleEvent(event)}
                                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                              <span className="flex-1 font-semibold">{event}</span>
                              <span className={cn("rounded-md border px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.12em]", tone)}>
                                {isReversal ? "reversal" : isPending ? "pending" : "trigger"}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="border-t border-border bg-card px-3.5 py-2">
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {formSelectedEvents.length} de {dialogApp.events.length} eventos selecionados
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border bg-card px-6 py-4 space-y-2.5">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full h-11 rounded-xl font-bold text-[13px] bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <div className="h-3.5 w-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Salvando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {editId ? <Settings2 className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                    {editId ? "Salvar alterações" : "Ativar integração"}
                  </span>
                )}
              </Button>

              {editId && ["zapi","utmify","activecampaign","notazz","themembers","spedy","astron","memberkit","smsfunnel","voxuy","cademi"].includes(dialogApp.id) && (
                <Button
                  variant="outline"
                  disabled={testing}
                  onClick={async () => {
                    setTesting(true);
                    const { data, error } = await supabase.functions.invoke("apps-dispatcher", {
                      body: { action: "test", integration_id: editId },
                    });
                    setTesting(false);
                    if (error || !data?.ok) {
                      toast.error(`Falha no teste: ${data?.error || data?.body || error?.message || "desconhecido"}`);
                    } else {
                      toast.success(`Teste OK (HTTP ${data.status})`);
                    }
                  }}
                  className="w-full h-10 rounded-xl text-[12px] font-bold border border-border bg-secondary hover:bg-card"
                >
                  {testing ? "Testando conexão..." : "Testar conexão (envio real)"}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </PageShell>
  );
}
