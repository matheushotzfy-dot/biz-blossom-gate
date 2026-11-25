import type { TxTone } from "@/components/seller-ui/txMeta";

export interface WebhookRow {
  id: string; url: string; events: string[] | null; is_active: boolean;
  created_at: string; updated_at: string | null; secret_masked: string | null;
}

export interface DeliveryRow {
  id: string; webhook_config_id: string; transaction_id: string | null; event: string;
  attempt: number; status: string; response_status: number | null; error: string | null;
  next_retry_at: string | null; delivered_at: string | null; created_at: string;
  /** "true" quando foi um teste (vem de payload->>test). Entregas antigas de teste só têm o evento webhook.test. */
  is_test?: string | null;
}

/** Limite de endpoints por conta (trigger enforce_max_webhook_configs). */
export const MAX_ENDPOINTS = 10;

export interface EventDef { key: string; label: string; hint: string }
export interface EventGroup { label: string; events: EventDef[] }

export const EVENT_GROUPS: EventGroup[] = [
  {
    label: "Pagamentos",
    events: [
      { key: "payment.created", label: "Cobrança criada", hint: "Cliente gerou um PIX ou boleto" },
      { key: "payment.approved", label: "Pagamento aprovado", hint: "O dinheiro entrou" },
      { key: "payment.failed", label: "Pagamento recusado", hint: "Cartão negado ou erro no pagamento" },
      { key: "payment.expired", label: "Cobrança expirada", hint: "PIX ou boleto venceu sem pagar" },
      { key: "payment.refunded", label: "Reembolso", hint: "Venda devolvida ao cliente" },
    ],
  },
  {
    label: "Risco e saques",
    events: [
      { key: "chargeback.received", label: "Chargeback recebido", hint: "Cliente contestou no cartão" },
      { key: "payout.approved", label: "Saque aprovado", hint: "Seu saque foi liberado" },
      { key: "payout.rejected", label: "Saque recusado", hint: "Seu saque não foi aprovado" },
    ],
  },
];

export const ALL_EVENTS: string[] = EVENT_GROUPS.flatMap((g) => g.events.map((e) => e.key));
const LABELS: Record<string, string> = { "webhook.test": "Evento de teste", Purchase: "Venda aprovada", InitiateCheckout: "Checkout iniciado", PixGenerated: "PIX gerado", BoletoGenerated: "Boleto gerado", Refund: "Reembolso", Chargeback: "Chargeback", ...Object.fromEntries(EVENT_GROUPS.flatMap((g) => g.events.map((e) => [e.key, e.label]))) };
export const eventLabel = (key: string) => LABELS[key] ?? key;

/** Endpoint sem eventos escolhidos recebe todos (regra do banco): mostramos como "Todos os eventos". */
export function eventsSummary(events: string[] | null): string {
  const list = events ?? [];
  if (list.length === 0 || ALL_EVENTS.every((e) => list.includes(e))) return "Todos os eventos";
  if (list.length === 1) return eventLabel(list[0]);
  return `${list.length} eventos`;
}

/** Eventos que o endpoint recebe, para mostrar em etiquetas. Lista vazia no banco = todos. */
export function endpointEventLabels(events: string[] | null): { all: boolean; labels: string[] } {
  const list = (events ?? []).filter((e) => ALL_EVENTS.includes(e));
  if (list.length === 0 || ALL_EVENTS.every((e) => list.includes(e))) return { all: true, labels: [] };
  return { all: false, labels: ALL_EVENTS.filter((e) => list.includes(e)).map(eventLabel) };
}

/** Eventos que dá para simular nesse endpoint: os que ele recebe (todos, se não filtrou nenhum). */
export function testableEvents(events: string[] | null): EventDef[] {
  const list = (events ?? []).filter((e) => ALL_EVENTS.includes(e));
  const defs = EVENT_GROUPS.flatMap((g) => g.events);
  return list.length === 0 ? defs : defs.filter((d) => list.includes(d.key));
}

/** Evento que o teste manda quando a pessoa não escolhe outro. */
export const DEFAULT_TEST_EVENT = "payment.approved";

/** Chave que assina as entregas. Aparece uma vez, na criação ou ao girar. */
export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return "whsec_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const hostOf = (url: string): string => {
  try { return new URL(url).host; } catch { return url; }
};

/** Resto da URL depois do domínio, para o cartão não repetir o host. */
export const pathOf = (url: string): string => {
  try { const u = new URL(url); const rest = `${u.pathname}${u.search}`; return rest === "/" ? "" : rest; } catch { return ""; }
};

const PRIVATE_V4 = /^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

/** Espelha o gatilho do banco (https, sem rede interna) e fecha o que ele deixa passar. Devolve a mensagem de erro ou null. */
export function validateWebhookUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Informe a URL.";
  if (value.length > 2000) return "A URL é longa demais.";
  if (!/^https:\/\//i.test(value)) return "A URL precisa começar com https://.";
  let u: URL;
  try { u = new URL(value); } catch { return "Essa URL não parece válida. Exemplo: https://seusite.com/webhook."; }
  if (u.username || u.password) return "A URL não pode ter usuário e senha.";
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.startsWith("[") || host === "::1")
    return "Use um endereço público. Localhost e redes internas não são aceitos.";
  if (PRIVATE_V4.test(host)) return "Use um endereço público. Localhost e redes internas não são aceitos.";
  if (!host.includes(".")) return "Use um domínio completo, como seusite.com.";
  return null;
}

export const normalizeUrl = (raw: string) => raw.trim();

/* ── Entregas ── */
export type DeliveryKind = "success" | "queued" | "retrying" | "sending" | "exhausted";

export const MAX_ATTEMPTS = 5;
/** Esperas entre as 5 tentativas. O worker tem 5 valores em RETRY_DELAYS_SECONDS, mas a 5ª falha já encerra a entrega, então só os 4 primeiros são usados. */
export const RETRY_PLAN = "10 segundos, 30 segundos, 2 minutos e 10 minutos";

export function deliveryKind(d: Pick<DeliveryRow, "status" | "attempt">): DeliveryKind {
  if (d.status === "success" || d.status === "delivered") return "success";
  if (d.status === "processing") return "sending";
  if (d.status === "pending") return d.attempt > 0 ? "retrying" : "queued";
  return "exhausted"; // exhausted e failed
}

export const DELIVERY_META: Record<DeliveryKind, { label: string; tone: TxTone }> = {
  success: { label: "Entregue", tone: "ok" },
  queued: { label: "Na fila", tone: "wait" },
  sending: { label: "Enviando", tone: "wait" },
  retrying: { label: "Nova tentativa", tone: "wait" },
  exhausted: { label: "Falhou", tone: "alert" },
};

/** Texto curto do que aconteceu, sem jargão. */
export function deliveryOutcome(d: DeliveryRow, explain: (error: string | null) => string = deliveryErrorText, subject = "Seu servidor"): string {
  const kind = deliveryKind(d);
  if (kind === "success") return d.response_status ? `${subject} respondeu ${d.response_status}` : "Entregue";
  if (kind === "queued") return "Aguardando o próximo envio";
  if (kind === "sending") return "Enviando agora";
  const why = d.response_status ? `${subject} respondeu ${d.response_status}` : explain(d.error);
  return kind === "retrying" ? `${why}. Vamos tentar de novo.` : why;
}

export function deliveryErrorText(error: string | null): string {
  if (!error) return "Sem resposta do seu servidor";
  if (/disabled or removed/i.test(error)) return "O endpoint estava pausado ou foi removido na hora do envio";
  if (/secret is missing/i.test(error)) return "O endpoint está sem chave secreta, então o envio foi bloqueado";
  if (/abort|timed? ?out|timeout/i.test(error)) return "Seu servidor demorou mais de 10 segundos para responder";
  if (/certificate|ssl|tls|handshake/i.test(error)) return "O certificado HTTPS do seu servidor é inválido";
  if (/redirect/i.test(error)) return "Seu servidor tentou redirecionar a chamada, e isso não é permitido";
  if (/[À-ſ]/.test(error) && error.length < 120) return error.replace(/\.$/, ""); // já vem em português do servidor
  return "Não foi possível conectar ao seu servidor";
}

/** Entrega travada na fila por mais tempo do que o worker leva (roda a cada minuto). */
export const isStuck = (d: DeliveryRow, now = Date.now()) =>
  deliveryKind(d) === "queued" && now - new Date(d.created_at).getTime() > 5 * 60_000;

/** "em 30 s", "em 2 min": quando a próxima tentativa sai. */
export function retryIn(iso: string | null, now = Date.now()): string {
  if (!iso) return "em instantes";
  const sec = Math.max(0, Math.round((new Date(iso).getTime() - now) / 1000));
  if (sec < 5) return "em instantes";
  return sec < 90 ? `em ${sec} s` : `em ${Math.round(sec / 60)} min`;
}

export const isTestDelivery = (d: Pick<DeliveryRow, "event" | "is_test">) => d.is_test === "true" || d.event === "webhook.test";

/** O que fazer para destravar uma entrega que falhou (ou está falhando). Null quando não há o que corrigir. */
export function deliveryHint(d: Pick<DeliveryRow, "status" | "attempt" | "response_status" | "error">): string | null {
  const kind = deliveryKind(d);
  if (kind !== "exhausted" && kind !== "retrying") return null;
  const s = d.response_status;
  if (s) {
    if (s === 404 || s === 410) return "Seu servidor não encontrou essa URL. Confira o endereço do endpoint.";
    if (s === 401 || s === 403) return "Seu servidor recusou a chamada. A rota precisa aceitar POST sem login e sem bloqueio de firewall.";
    if (s === 405) return "Essa URL não aceita o método POST. É POST que a gente envia.";
    if (s === 429) return "Seu servidor pediu para esperar. Libere mais chamadas por minuto para essa rota.";
    if (s >= 500) return "Deu erro dentro do seu servidor. Veja o log dele no horário desta entrega.";
    if (s >= 300 && s < 400) return "Seu servidor respondeu com um redirecionamento, e a gente não segue. Use a URL final, já em https.";
    return "Seu servidor recusou os dados. Veja o log dele para entender o motivo.";
  }
  const e = d.error ?? "";
  if (/disabled or removed/i.test(e)) return "O endpoint estava pausado na hora do envio. Reative e use Reenviar.";
  if (/secret is missing/i.test(e)) return "Gere uma nova chave de assinatura para esse endpoint e depois use Reenviar.";
  if (/abort|timed? ?out|timeout/i.test(e)) return "Responda 200 assim que receber e processe o pedido depois. O limite é de 10 segundos.";
  if (/certificate|ssl|tls|handshake/i.test(e)) return "Instale um certificado HTTPS válido no seu domínio. Certificado autoassinado não é aceito.";
  if (/redirect/i.test(e)) return "Use a URL final, já em https. A gente não segue redirecionamentos.";
  return "Confira se o domínio está no ar e abre pela internet, sem VPN nem bloqueio de IP.";
}

/* ── Pulso: as últimas entregas de um endpoint, da mais antiga para a mais nova ── */
export type PulseKind = "ok" | "bad" | "wait" | "none";
export const PULSE_SIZE = 30;

export function pulseTicks(newestFirst: Array<Pick<DeliveryRow, "status" | "attempt">>, size = PULSE_SIZE): PulseKind[] {
  const kinds: PulseKind[] = newestFirst.slice(0, size).map((r) => {
    const k = deliveryKind(r);
    return k === "success" ? "ok" : k === "exhausted" ? "bad" : "wait";
  }).reverse();
  return [...Array.from({ length: size - kinds.length }, () => "none" as const), ...kinds];
}

/** Frase curta sobre as últimas entregas: "28 de 30 entregues", "2 na fila". */
export function pulseSummary(newestFirst: Array<Pick<DeliveryRow, "status" | "attempt">>, size = PULSE_SIZE, withWaiting = true): string {
  const sample = newestFirst.slice(0, size);
  if (sample.length === 0) return "Nenhuma entrega ainda";
  let ok = 0, bad = 0, wait = 0;
  for (const r of sample) { const k = deliveryKind(r); if (k === "success") ok++; else if (k === "exhausted") bad++; else wait++; }
  const done = ok + bad;
  const head = done === 0 ? "Nada concluído ainda" : `${ok} de ${done} ${done === 1 ? "entregue" : "entregues"}`;
  return withWaiting && wait > 0 ? `${head} · ${wait} em andamento` : head;
}

export function formatJson(value: unknown): string {
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

export function webhookErrorMessage(err: unknown, fallback: string): string {
  const raw = (err as { message?: string } | null)?.message ?? "";
  if (/Could not find the function|PGRST202/i.test(raw) || (err as { code?: string } | null)?.code === "PGRST202") return "Esse recurso ainda não está disponível. Tente de novo em instantes.";
  if (/Limite de \d+ endpoints/i.test(raw)) return `Você já tem ${MAX_ENDPOINTS} endpoints. Exclua um para criar outro.`;
  if (/Muitos testes/i.test(raw)) return "Muitos testes seguidos. Aguarde um minuto.";
  if (/muitas entregas na fila/i.test(raw)) return "Há muitas entregas na fila. Aguarde alguns minutos e tente de novo.";
  if (/ainda est[aá] em andamento/i.test(raw)) return "Essa entrega ainda está em andamento.";
  if (/Entrega n[aã]o encontrada/i.test(raw)) return "Essa entrega não existe mais. Atualize a página.";
  if (/Evento inv[aá]lido/i.test(raw)) return "Esse evento não pode ser simulado.";
  if (/HTTPS/i.test(raw)) return "A URL precisa usar https://.";
  if (/endere[cç]os internos/i.test(raw)) return "Use um endereço público. Redes internas não recebem webhooks.";
  if (/pausado/i.test(raw)) return "O endpoint está pausado. Reative para enviar um teste.";
  if (/n[aã]o encontrado/i.test(raw)) return "Esse endpoint não existe mais. Atualize a página.";
  if (/row-level|permission/i.test(raw)) return "Você não tem permissão para esta ação.";
  return fallback;
}
