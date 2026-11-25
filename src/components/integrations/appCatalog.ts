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
import { deliveryOutcome, validateWebhookUrl } from "./webhookMeta";

/** Eventos que o banco realmente dispara para os apps (enqueue_app_dispatch_on_tx_change). */
export interface AppEventDef { key: string; label: string; hint: string }
export const APP_EVENTS: AppEventDef[] = [
  { key: "Purchase", label: "Venda aprovada", hint: "O pagamento caiu" },
  { key: "InitiateCheckout", label: "Checkout iniciado", hint: "Cliente começou a pagar no cartão" },
  { key: "PixGenerated", label: "PIX gerado", hint: "Cliente gerou o QR Code" },
  { key: "BoletoGenerated", label: "Boleto gerado", hint: "Cliente gerou o boleto" },
  { key: "Refund", label: "Reembolso", hint: "Venda devolvida ao cliente" },
  { key: "Chargeback", label: "Chargeback", hint: "Cliente contestou no cartão" },
];
export const appEventLabel = (key: string) => APP_EVENTS.find((e) => e.key === key)?.label ?? key;

/** Onde cada campo é guardado: colunas de app_integrations ou o JSON `config`. */
export type FieldTarget = "api_key" | "api_url" | "webhook_url" | "config";
export interface AppField {
  key: string; target: FieldTarget; label: string; placeholder: string; required: boolean; help?: string;
  kind?: "secret" | "url" | "id" | "text";
}

/** safe: o envio de teste vai marcado como teste. confirm: cria algo de teste no app. blocked: o teste mexeria com gente de verdade. */
export type TestMode = "safe" | "confirm" | "blocked";

export interface AppDef {
  id: string; name: string; desc: string; logo: string; category: string; fields: AppField[]; events: string[];
  help?: string; comingSoon?: boolean; test?: { mode: TestMode; note: string };
}

const E = (...keys: string[]) => APP_EVENTS.map((e) => e.key).filter((k) => keys.includes(k));
const ALL = APP_EVENTS.map((e) => e.key);
const MEMBERS = E("Purchase", "Refund", "Chargeback");

const confirmTest = (app: string, what: string) => ({ mode: "confirm" as const, note: `${what} Pode aparecer no painel do ${app}, e você precisa apagar por lá.` });

export const APPS: AppDef[] = [
  {
    id: "zapi", name: "Z-API", desc: "Mensagens automáticas no WhatsApp", category: "Comunicação", logo: zapiLogo, events: ALL,
    help: "Manda uma mensagem pelo WhatsApp para o cliente a cada evento que você marcar. O cliente precisa ter telefone no cadastro.",
    fields: [
      { key: "api_key", target: "api_key", kind: "id", label: "Token da instância", placeholder: "Cole o token da instância", required: true, help: "Z-API, Sua instância, Token" },
      { key: "api_url", target: "api_url", kind: "id", label: "ID da instância", placeholder: "Cole o ID da instância", required: true, help: "Z-API, Sua instância, ID" },
      { key: "webhook_url", target: "webhook_url", kind: "secret", label: "Client-Token", placeholder: "Só se você ativou o token de segurança", required: false, help: "Z-API, Segurança, Token da conta" },
    ],
    test: { mode: "blocked", note: "O teste mandaria uma mensagem de WhatsApp para um número fictício, que pode ser de uma pessoa de verdade. Confira o funcionamento pela atividade da primeira venda." },
  },
  {
    id: "utmify", name: "UTMify", desc: "Rastreamento de origem das vendas", category: "Analytics", logo: utmifyLogo, events: ALL,
    help: "Cada venda chega na UTMify com a origem do clique, para você ver o que está dando retorno.",
    fields: [{ key: "api_key", target: "api_key", kind: "secret", label: "Token da UTMify", placeholder: "Cole seu token", required: true, help: "UTMify, Configurações, API, Token" }],
    test: { mode: "safe", note: "Envia um pedido marcado como teste para a UTMify. Ele não entra nos seus números." },
  },
  {
    id: "activecampaign", name: "ActiveCampaign", desc: "Contatos e tags de e-mail marketing", category: "Marketing", logo: activecampaignLogo, comingSoon: true,
    events: E("Purchase", "InitiateCheckout", "Refund", "Chargeback"),
    help: "Cria o contato e aplica uma tag para cada evento, como venxpay_purchase.",
    fields: [
      { key: "api_key", target: "api_key", kind: "secret", label: "Chave da API", placeholder: "Cole sua chave", required: true, help: "ActiveCampaign, Settings, Developer, API Key" },
      { key: "api_url", target: "api_url", kind: "url", label: "URL da conta", placeholder: "https://suaconta.api-us1.com", required: true, help: "ActiveCampaign, Settings, Developer, URL" },
    ],
    test: confirmTest("ActiveCampaign", "Cria o contato teste@hotzfy.com e aplica a tag venxpay_purchase."),
  },
  {
    id: "notazz", name: "Notazz", desc: "Emissão automática de nota fiscal", category: "Fiscal", logo: notazzLogo, events: E("Purchase", "Refund"),
    help: "Emite a nota ao aprovar a venda e cancela quando houver reembolso. O cliente precisa ter CPF ou CNPJ no cadastro.",
    fields: [{ key: "api_key", target: "api_key", kind: "secret", label: "Chave da API", placeholder: "Cole sua chave", required: true, help: "Notazz, Configurações, Integrações, API Key" }],
    test: { mode: "blocked", note: "O teste tentaria emitir uma nota fiscal de verdade. Valide com a primeira venda real e confira em Notas fiscais." },
  },
  {
    id: "themembers", name: "TheMembers", desc: "Libera e retira acesso à área de membros", category: "Membros", logo: themembersLogo, comingSoon: true, events: MEMBERS,
    help: "Libera o aluno quando a venda é aprovada e retira o acesso em reembolso ou chargeback.",
    fields: [
      { key: "api_key", target: "api_key", kind: "secret", label: "Chave da API", placeholder: "Cole sua chave", required: true, help: "TheMembers, Integrações, API" },
      { key: "api_url", target: "api_url", kind: "url", label: "URL da API", placeholder: "https://api.themembers.com.br", required: false, help: "Deixe em branco para usar o endereço padrão." },
    ],
    test: confirmTest("TheMembers", "Registra uma venda de teste para teste@hotzfy.com."),
  },
  {
    id: "spedy", name: "Spedy", desc: "Pedidos de envio automáticos", category: "Logística", logo: spedyLogo, events: E("Purchase"),
    help: "Cria o pedido de envio assim que a venda é aprovada.",
    fields: [{ key: "api_key", target: "api_key", kind: "secret", label: "Token da Spedy", placeholder: "Cole seu token", required: true, help: "Spedy, Configurações, API, Token" }],
    test: confirmTest("Spedy", "Envia uma venda de teste de R$ 99,90 para a Spedy."),
  },
  {
    id: "astron", name: "Astron Members", desc: "Matrícula automática na área de membros", category: "Membros", logo: astronLogo, comingSoon: true, events: MEMBERS,
    help: "Matricula o aluno ao aprovar a venda e cancela em reembolso ou chargeback.",
    fields: [
      { key: "api_key", target: "api_key", kind: "secret", label: "Chave da API", placeholder: "Cole sua chave", required: true, help: "Astron, Configurações, Integrações, API Key" },
      { key: "product_external_id", target: "config", kind: "text", label: "ID do produto na Astron", placeholder: "Opcional", required: false, help: "Sem isso, usamos o ID do produto daqui." },
    ],
    test: confirmTest("Astron", "Registra uma matrícula de teste para teste@hotzfy.com."),
  },
  {
    id: "memberkit", name: "MemberKit", desc: "Gestão de assinantes e turmas", category: "Membros", logo: memberkitLogo, comingSoon: true, events: MEMBERS,
    help: "Cria o assinante na turma que você indicar e retira o acesso em reembolso ou chargeback.",
    fields: [
      { key: "api_key", target: "api_key", kind: "secret", label: "Chave da API", placeholder: "Cole sua chave", required: true, help: "MemberKit, Configurações, API" },
      { key: "classroom_id", target: "config", kind: "text", label: "ID da turma", placeholder: "Recomendado", required: false, help: "Indica em qual turma o aluno entra." },
    ],
    test: confirmTest("MemberKit", "Registra um assinante de teste, teste@hotzfy.com."),
  },
  {
    id: "smsfunnel", name: "SMSFunnel", desc: "SMS automático para o cliente", category: "Comunicação", logo: smsfunnelLogo, comingSoon: true,
    events: E("Purchase", "InitiateCheckout", "PixGenerated", "BoletoGenerated", "Refund"),
    help: "Dispara um SMS para o cliente a cada evento que você marcar. O cliente precisa ter telefone no cadastro.",
    fields: [{ key: "api_key", target: "api_key", kind: "secret", label: "Token", placeholder: "Cole seu token", required: true, help: "SMSFunnel, Configurações, API" }],
    test: { mode: "blocked", note: "O teste mandaria um SMS para um número fictício, que pode ser de uma pessoa de verdade." },
  },
  {
    id: "voxuy", name: "Voxuy", desc: "Chatbot e mensagens no WhatsApp", category: "Comunicação", logo: voxuyLogo, comingSoon: true,
    events: E("Purchase", "InitiateCheckout", "PixGenerated", "Refund", "Chargeback"),
    help: "Aciona o seu chatbot da Voxuy a cada evento. O cliente precisa ter telefone no cadastro.",
    fields: [
      { key: "api_key", target: "api_key", kind: "secret", label: "Chave da API", placeholder: "Cole sua chave", required: true, help: "Voxuy, Configurações, API" },
      { key: "instance_id", target: "config", kind: "text", label: "ID da instância", placeholder: "Opcional", required: false },
    ],
    test: { mode: "blocked", note: "O teste mandaria uma mensagem de WhatsApp para um número fictício, que pode ser de uma pessoa de verdade." },
  },
  {
    id: "cademi", name: "Cademi", desc: "Matrícula automática em cursos", category: "Membros", logo: cademiLogo, comingSoon: true, events: MEMBERS,
    help: "Matricula o aluno no curso ao aprovar a venda e cancela em reembolso ou chargeback.",
    fields: [
      { key: "api_key", target: "api_key", kind: "secret", label: "Chave da API", placeholder: "Cole sua chave", required: true, help: "Cademi, Integrações, API" },
      { key: "course_id", target: "config", kind: "text", label: "ID do curso", placeholder: "Recomendado", required: false, help: "Indica em qual curso o aluno entra." },
    ],
    test: confirmTest("Cademi", "Registra uma matrícula de teste para teste@hotzfy.com."),
  },
  { id: "webhooks", name: "Webhooks", desc: "Receba os eventos em qualquer sistema", category: "Avançado", logo: webhooksLogo, fields: [], events: [], help: "Envia cada evento assinado para a URL do seu servidor." },
];

export const CATEGORIES = ["Analytics", "Comunicação", "Fiscal", "Logística", "Marketing", "Membros", "Avançado"] as const;
/** Logos de letra clara: precisam de fundo escuro para aparecer. */
export const DARK_LOGO_APPS: ReadonlySet<string> = new Set(["zapi", "notazz", "spedy", "themembers", "astron", "smsfunnel", "cademi"]);

export const appById = (id: string) => APPS.find((a) => a.id === id);

export interface AppConnection {
  id: string; user_id: string; app_name: string; product_id: string | null; api_key_masked: string | null; has_api_key: boolean;
  api_url: string | null; webhook_url: string | null; events: string[] | null; is_active: boolean; config: Record<string, unknown> | null; created_at: string;
}

export const ZAPI_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

export interface ConnectionValues { fields: Record<string, string>; productId: string; events: string[] }

/** Erros por campo (chave do campo, "events"); vazio quando está tudo certo. `editing` dispensa os segredos já salvos. */
export function validateConnection(app: AppDef, v: ConnectionValues, editing: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of app.fields) {
    const val = (v.fields[f.key] ?? "").trim();
    const keepSaved = editing && f.kind === "secret" && !val; // segredo salvo: em branco mantém
    const keepSavedId = editing && f.target === "api_key" && !val;
    if (!val) { if (f.required && !keepSaved && !keepSavedId) errors[f.key] = `Preencha o campo ${f.label}.`; continue; }
    if (app.id === "zapi" && (f.key === "api_key" || f.key === "api_url") && !ZAPI_ID_RE.test(val)) errors[f.key] = "Use só letras, números, hífen e sublinhado.";
    else if (f.kind === "url") { const m = validateWebhookUrl(val); if (m) errors[f.key] = m; }
    else if (val.length > 500) errors[f.key] = "Esse valor é longo demais.";
  }
  if (app.events.length > 0 && v.events.length === 0) errors.events = "Escolha pelo menos um evento.";
  return errors;
}

export function appErrorMessage(err: unknown, fallback: string): string {
  const raw = (err as { message?: string } | null)?.message ?? "";
  if (/HTTPS/i.test(raw)) return "Use um endereço que comece com https://.";
  if (/endere[cç]os internos/i.test(raw)) return "Use um endereço público. Redes internas não são aceitas.";
  if (/row-level|permission/i.test(raw)) return "Você não tem permissão para esta ação.";
  if (/foreign key|product/i.test(raw)) return "Esse produto não existe mais. Escolha outro.";
  return fallback;
}

/** Resultado do envio de teste, já em português. */
export interface TestResult { ok: boolean; status: number; message: string; detail: string }

export function readTestResult(raw: { ok?: boolean; status?: number; body?: string; error?: string | null } | null): TestResult {
  const status = raw?.status ?? 0;
  if (raw?.ok) return { ok: true, status, message: `O app respondeu ${status}. A conexão está funcionando.`, detail: (raw.body ?? "").slice(0, 400) };
  const err = raw?.error ?? "";
  const detail = [err, raw?.body].filter(Boolean).join("\n").slice(0, 600);
  let message = "O teste não passou.";
  if (status === 401 || status === 403) message = "O app recusou a chave. Confira se ela está certa e se tem permissão.";
  else if (status === 404) message = "O app não encontrou o endereço. Confira a URL e os IDs.";
  else if (status === 429) message = "O app pediu para esperar. Tente de novo em alguns minutos.";
  else if (status >= 500) message = `O app respondeu ${status}. Parece instabilidade do lado deles.`;
  else if (status >= 400) message = `O app respondeu ${status}. Confira os dados da conexão.`;
  else if (/missing|inv[aá]lid/i.test(err)) message = "Faltam dados na conexão. Edite e confira os campos.";
  else if (/not found/i.test(err)) message = "Essa conexão não existe mais. Atualize a página.";
  else if (/abort|timed? ?out|timeout/i.test(err)) message = "O app demorou mais de 10 segundos para responder.";
  else if (/n[aã]o permitido|resolver/i.test(err)) message = "Não foi possível acessar o endereço do app. Confira a URL.";
  return { ok: false, status, message, detail };
}

/** Resumo curto dos eventos escolhidos. */
export function connectionEvents(c: Pick<AppConnection, "events">, app?: AppDef): string {
  const list = (c.events ?? []).filter((e) => !app || app.events.includes(e));
  if (list.length === 0) return "Nenhum evento";
  if (app && app.events.length > 0 && app.events.every((e) => list.includes(e))) return "Todos os eventos";
  if (list.length === 1) return appEventLabel(list[0]);
  return `${list.length} eventos`;
}

/** Traduz o erro que o `apps-dispatcher` grava quando nem chegou a ter resposta do app. */
export function appDeliveryError(error: string | null): string {
  if (!error) return "Sem resposta do app";
  if (/skipped: event not relevant|skipped: .* only acts on/i.test(error)) return "Esse evento não se aplica a este app, então foi pulado";
  if (/customer phone missing/i.test(error)) return "O cliente não informou telefone, então o envio foi pulado";
  if (/customer email missing/i.test(error)) return "O cliente não informou e-mail, então o envio foi pulado";
  if (/customer document missing/i.test(error)) return "O cliente não informou CPF ou CNPJ, então a nota não foi emitida";
  if (/inv[aá]lidos?/i.test(error)) return "O ID ou o token da instância está inválido. Edite a conexão e confira";
  if (/missing/i.test(error)) return "A conexão está sem uma chave ou ID. Edite a conexão e confira os campos";
  if (/abort|timed? ?out|timeout/i.test(error)) return "O app demorou mais de 10 segundos para responder";
  if (/n[aã]o permitido|resolver|private|blocked/i.test(error)) return "Não foi possível acessar o endereço do app. Confira a URL";
  if (/disabled|removed/i.test(error)) return "A conexão estava pausada ou foi removida na hora do envio";
  return "Não foi possível falar com o app";
}
export const appDeliveryOutcome = (d: Parameters<typeof deliveryOutcome>[0]) => deliveryOutcome(d, appDeliveryError, "O app");
