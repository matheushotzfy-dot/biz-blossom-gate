import type { TxTone } from "@/components/seller-ui/txMeta";

export interface WebhookRow {
  id: string; url: string; events: string[] | null; is_active: boolean;
  created_at: string; updated_at: string | null; secret_masked: string | null;
}

export interface DeliveryRow {
  id: string; webhook_config_id: string; transaction_id: string | null; event: string;
  attempt: number; status: string; response_status: number | null; error: string | null;
  next_retry_at: string | null; delivered_at: string | null; created_at: string;
}

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
/** Esperas entre tentativas, iguais às do worker (RETRY_DELAYS_SECONDS). */
export const RETRY_PLAN = "10 segundos, 30 segundos, 2 minutos, 10 minutos e 1 hora";

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

export function formatJson(value: unknown): string {
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

export function webhookErrorMessage(err: unknown, fallback: string): string {
  const raw = (err as { message?: string } | null)?.message ?? "";
  if (/HTTPS/i.test(raw)) return "A URL precisa usar https://.";
  if (/endere[cç]os internos/i.test(raw)) return "Use um endereço público. Redes internas não recebem webhooks.";
  if (/pausado/i.test(raw)) return "O endpoint está pausado. Reative para enviar um teste.";
  if (/n[aã]o encontrado/i.test(raw)) return "Esse endpoint não existe mais. Atualize a página.";
  if (/row-level|permission/i.test(raw)) return "Você não tem permissão para esta ação.";
  return fallback;
}
