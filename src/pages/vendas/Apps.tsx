import { useState } from "react";
import { Puzzle, Settings2, Zap, Shield, Sparkles, CheckCircle2 } from "lucide-react";
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
 <div className="flex items-center justify-between gap-4">
 <div className="space-y-1">
 <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/50 bg-card/80 text-primary shadow-[0_10px_30px_hsl(var(--foreground)/0.06)] backdrop-blur-xl">
 <Puzzle className="h-5 w-5" />
 </div>
 <h1 className="font-display text-2xl font-black tracking-tight text-foreground md:text-3xl">Apps</h1>
 <p className="text-sm text-muted-foreground/70">Clique no logo para configurar a integração.</p>
 </div>

 <div className="hidden rounded-full border border-border/50 bg-card/80 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70 backdrop-blur-xl md:inline-flex">
 {integrations.length} ativas
 </div>
 </div>

 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
 {APPS.map((app, idx) => {
 const integration = getIntegration(app.id);
 const active = Boolean(integration?.is_active);

 return (
 <button
 key={app.id}
 onClick={() => openDialog(app, integration || undefined)}
 className={cn(
 "group relative flex h-32 items-center overflow-hidden rounded-[26px] border px-7 text-left backdrop-blur-xl transition-all duration-300 ease-out animate-fade-in active:scale-[0.985] md:h-[8.5rem] md:px-8",
 active
 ? "border-primary/30 bg-card shadow-[0_18px_40px_hsl(var(--primary)/0.10)] hover:border-primary/40 hover:shadow-[0_24px_52px_hsl(var(--primary)/0.14)]"
 : "border-border/50 bg-card/95 shadow-[0_14px_32px_hsl(var(--foreground)/0.06)] hover:-translate-y-0.5 hover:border-border/70 hover:shadow-[0_22px_46px_hsl(var(--foreground)/0.10)]"
 )}
 style={{ animationDelay: `${idx * 35}ms`, animationFillMode: "backwards" }}
 >
 <div className="pointer-events-none absolute inset-0">
 <div className="absolute inset-0 bg-gradient-to-br from-background/35 via-transparent to-background/20" />
 <div className={cn(
 "absolute inset-y-0 left-0 w-[3px] transition-opacity duration-300",
 active ? "bg-primary opacity-100" : "bg-border opacity-0 group-hover:opacity-100"
 )} />
 <div className={cn(
 "absolute -right-10 top-1/2 h-28 w-28 -translate-y-1/2 rounded-full blur-3xl transition-opacity duration-300",
 active ? "bg-primary/15 opacity-100" : "bg-muted opacity-0 group-hover:opacity-60"
 )} />
 </div>

              <div className="relative z-[1] flex h-full w-full items-center justify-center">
                <div className="flex h-20 w-32 items-center justify-center md:h-24 md:w-40">
                  <img
                    src={app.logo}
                    alt={app.name}
                    className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.06]"
                  />
                </div>
              </div>
 </button>
 );
 })}
 </div>
 </section>

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
 const eventTone = event.includes("Refund") || event.includes("Chargeback")
 ? "border-destructive/20 bg-destructive/10 text-destructive"
 : event.includes("Pix") || event.includes("Boleto")
 ? "border-warning/20 bg-warning/10 text-warning"
 : event === "Lead"
 ? "border-info/20 bg-info/10 text-info"
 : "border-primary/20 bg-primary/10 text-primary";

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
 <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider", eventTone)}>
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

 {editId && (dialogApp.id === "zapi" || dialogApp.id === "utmify") && (
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
 className="w-full h-11 rounded-xl text-xs font-bold border-border/40"
 >
 {testing ? "Testando..." : "Testar conexão (envio real)"}
 </Button>
 )}
 </div>
 </DialogContent>
 </Dialog>
 )}
 </PageShell>
 );
}
