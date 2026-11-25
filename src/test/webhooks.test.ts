import { describe, expect, it } from "vitest";
import {
  ALL_EVENTS, DEFAULT_TEST_EVENT, DELIVERY_META, MAX_ATTEMPTS, PULSE_SIZE, deliveryErrorText, deliveryHint, deliveryKind, deliveryOutcome,
  endpointEventLabels, eventLabel, eventsSummary, generateWebhookSecret, hostOf, isStuck, isTestDelivery, pathOf, pulseSummary, pulseTicks,
  retryIn, testableEvents, validateWebhookUrl, webhookErrorMessage, type DeliveryRow,
} from "@/components/integrations/webhookMeta";
import { VERIFY_SNIPPET } from "@/components/integrations/SignatureGuide";

const delivery = (over: Partial<DeliveryRow> = {}): DeliveryRow => ({
  id: "d1", webhook_config_id: "w1", transaction_id: null, event: "payment.approved", attempt: 0, status: "pending",
  response_status: null, error: null, next_retry_at: null, delivered_at: null, created_at: "2026-11-24T12:00:00Z", ...over,
});

describe("validateWebhookUrl", () => {
  it("aceita https público", () => {
    expect(validateWebhookUrl("https://api.minhaloja.com.br/hooks?x=1")).toBeNull();
    expect(validateWebhookUrl("  https://hooks.zapier.com/abc  ")).toBeNull();
  });
  it("recusa vazio, http e URL quebrada", () => {
    expect(validateWebhookUrl("")).toMatch(/Informe/);
    expect(validateWebhookUrl("http://site.com")).toMatch(/https/);
    expect(validateWebhookUrl("https://")).toMatch(/válida/);
  });
  it("recusa rede interna, loopback e IPs privados", () => {
    for (const u of ["https://localhost/x", "https://app.localhost/x", "https://127.0.0.1/x", "https://10.0.0.5/x", "https://172.20.1.1/x", "https://192.168.0.9/x", "https://169.254.169.254/x", "https://meu.servico.local/x", "https://db.internal/x", "https://[::1]/x"]) {
      expect(validateWebhookUrl(u), u).toMatch(/público/);
    }
  });
  it("não confunde 172.15 e 172.32 (públicos) com a faixa privada", () => {
    expect(validateWebhookUrl("https://172.15.1.1/x")).toBeNull();
    expect(validateWebhookUrl("https://172.32.1.1/x")).toBeNull();
  });
  it("recusa usuário e senha na URL e host sem ponto", () => {
    expect(validateWebhookUrl("https://user:pw@site.com/x")).toMatch(/usuário/);
    expect(validateWebhookUrl("https://servidor/x")).toMatch(/domínio/);
  });
});

describe("eventos", () => {
  it("rótulos e resumo", () => {
    expect(eventLabel("payment.approved")).toBe("Pagamento aprovado");
    expect(eventLabel("webhook.test")).toBe("Evento de teste");
    expect(eventLabel("outro.evento")).toBe("outro.evento");
    expect(eventsSummary([])).toBe("Todos os eventos");
    expect(eventsSummary(null)).toBe("Todos os eventos");
    expect(eventsSummary(ALL_EVENTS)).toBe("Todos os eventos");
    expect(eventsSummary(["payment.refunded"])).toBe("Reembolso");
    expect(eventsSummary(["payment.refunded", "payment.approved"])).toBe("2 eventos");
  });
  it("lista de eventos bate com os que o banco emite", () => {
    expect([...ALL_EVENTS].sort()).toEqual(["chargeback.received", "payment.approved", "payment.created", "payment.expired", "payment.failed", "payment.refunded", "payout.approved", "payout.rejected"]);
  });
});

describe("generateWebhookSecret", () => {
  it("whsec_ + 48 hex, diferente a cada chamada", () => {
    const a = generateWebhookSecret(); const b = generateWebhookSecret();
    expect(a).toMatch(/^whsec_[0-9a-f]{48}$/);
    expect(a).not.toBe(b);
  });
});

describe("hostOf e pathOf", () => {
  it("separa domínio e caminho", () => {
    expect(hostOf("https://api.x.com/hooks/a?b=1")).toBe("api.x.com");
    expect(pathOf("https://api.x.com/hooks/a?b=1")).toBe("/hooks/a?b=1");
    expect(pathOf("https://api.x.com/")).toBe("");
    expect(hostOf("quebrada")).toBe("quebrada");
  });
});

describe("deliveryKind", () => {
  it("traduz status do banco", () => {
    expect(deliveryKind(delivery({ status: "success" }))).toBe("success");
    expect(deliveryKind(delivery({ status: "pending", attempt: 0 }))).toBe("queued");
    expect(deliveryKind(delivery({ status: "pending", attempt: 2 }))).toBe("retrying");
    expect(deliveryKind(delivery({ status: "processing" }))).toBe("sending");
    expect(deliveryKind(delivery({ status: "exhausted" }))).toBe("exhausted");
    expect(deliveryKind(delivery({ status: "failed" }))).toBe("exhausted");
  });
  it("todo tipo tem rótulo", () => {
    for (const k of ["success", "queued", "sending", "retrying", "exhausted"] as const) expect(DELIVERY_META[k].label).toBeTruthy();
    expect(MAX_ATTEMPTS).toBe(5);
  });
});

describe("deliveryOutcome e erros", () => {
  it("descreve cada situação em português", () => {
    expect(deliveryOutcome(delivery({ status: "success", response_status: 200 }))).toBe("Seu servidor respondeu 200");
    expect(deliveryOutcome(delivery({ status: "pending", attempt: 1, response_status: 500 }))).toBe("Seu servidor respondeu 500. Vamos tentar de novo.");
    expect(deliveryOutcome(delivery({ status: "exhausted", attempt: 5, response_status: 404 }))).toBe("Seu servidor respondeu 404");
    expect(deliveryOutcome(delivery({ status: "exhausted", attempt: 5, error: "The signal has been aborted" }))).toMatch(/10 segundos/);
  });
  it("mapeia mensagens técnicas do worker", () => {
    expect(deliveryErrorText(null)).toMatch(/Sem resposta/);
    expect(deliveryErrorText("Webhook config disabled or removed.")).toMatch(/pausado/);
    expect(deliveryErrorText("Webhook secret is missing; unsigned delivery blocked.")).toMatch(/sem chave/);
    expect(deliveryErrorText("certificate has expired")).toMatch(/certificado/);
    expect(deliveryErrorText("redirect não permitido")).toMatch(/redirecionar/);
    expect(deliveryErrorText("Endereço de destino não permitido.")).toBe("Endereço de destino não permitido");
    expect(deliveryErrorText("ECONNREFUSED 1.2.3.4")).toMatch(/conectar/);
  });
});

describe("isStuck", () => {
  const now = new Date("2026-11-24T12:10:00Z").getTime();
  it("só a entrega na fila há mais de 5 minutos", () => {
    expect(isStuck(delivery({ created_at: "2026-11-24T12:00:00Z" }), now)).toBe(true);
    expect(isStuck(delivery({ created_at: "2026-11-24T12:08:00Z" }), now)).toBe(false);
    expect(isStuck(delivery({ created_at: "2026-11-24T12:00:00Z", status: "success" }), now)).toBe(false);
  });
});

describe("webhookErrorMessage", () => {
  it("traduz as mensagens do banco", () => {
    expect(webhookErrorMessage({ message: "Webhook URL deve usar HTTPS" }, "x")).toMatch(/https/);
    expect(webhookErrorMessage({ message: "Webhook URL não pode apontar para endereços internos" }, "x")).toMatch(/público/);
    expect(webhookErrorMessage({ message: "Endpoint pausado" }, "x")).toMatch(/pausado/);
    expect(webhookErrorMessage({ message: "Endpoint não encontrado" }, "x")).toMatch(/não existe/);
    expect(webhookErrorMessage({ message: "algo estranho" }, "padrão")).toBe("padrão");
  });
});

describe("webhookErrorMessage (teste, reenvio e limites)", () => {
  it("traduz o que as RPCs novas devolvem", () => {
    expect(webhookErrorMessage({ message: "Muitos testes seguidos. Aguarde um minuto." }, "x")).toMatch(/Aguarde um minuto/);
    expect(webhookErrorMessage({ message: "Há muitas entregas na fila. Aguarde alguns minutos e tente de novo." }, "x")).toMatch(/fila/);
    expect(webhookErrorMessage({ message: "Essa entrega ainda está em andamento" }, "x")).toMatch(/em andamento/);
    expect(webhookErrorMessage({ message: "Entrega não encontrada" }, "x")).toMatch(/não existe/);
    expect(webhookErrorMessage({ message: "Limite de 10 endpoints por conta" }, "x")).toMatch(/10 endpoints/);
    expect(webhookErrorMessage({ message: "Evento inválido" }, "x")).toMatch(/simulado/);
  });
  it("função ainda não criada no banco não vira erro técnico", () => {
    expect(webhookErrorMessage({ code: "PGRST202", message: "Could not find the function public.resend_webhook_delivery" }, "x")).toMatch(/ainda não está disponível/);
  });
});

describe("deliveryHint", () => {
  const hint = (over: Partial<DeliveryRow>) => deliveryHint(delivery({ status: "exhausted", attempt: 5, ...over }));
  it("só explica o que falhou ou está falhando", () => {
    expect(deliveryHint(delivery({ status: "success", attempt: 1, response_status: 200 }))).toBeNull();
    expect(deliveryHint(delivery({ status: "pending", attempt: 0 }))).toBeNull();
    expect(deliveryHint(delivery({ status: "pending", attempt: 2, response_status: 500 }))).toMatch(/erro dentro do seu servidor/);
  });
  it("diz o que fazer para cada resposta do servidor", () => {
    expect(hint({ response_status: 404 })).toMatch(/URL/);
    expect(hint({ response_status: 403 })).toMatch(/POST sem login/);
    expect(hint({ response_status: 405 })).toMatch(/POST/);
    expect(hint({ response_status: 429 })).toMatch(/chamadas por minuto/);
    expect(hint({ response_status: 502 })).toMatch(/log/);
    expect(hint({ response_status: 301 })).toMatch(/redirecionamento/);
    expect(hint({ response_status: 422 })).toMatch(/recusou os dados/);
  });
  it("diz o que fazer quando nem houve resposta", () => {
    expect(hint({ error: "The signal has been aborted" })).toMatch(/200 assim que receber/);
    expect(hint({ error: "invalid peer certificate: UnknownIssuer" })).toMatch(/certificado HTTPS/);
    expect(hint({ error: "Webhook config disabled or removed." })).toMatch(/Reative/);
    expect(hint({ error: "Webhook secret is missing; unsigned delivery blocked." })).toMatch(/nova chave/);
    expect(hint({ error: "dns error: failed to lookup address" })).toMatch(/no ar/);
  });
});

describe("pulso das entregas", () => {
  const rows = (...s: Array<[string, number]>) => s.map(([status, attempt]) => ({ status, attempt }));
  it("completa até 30 com pontos vazios à esquerda e a mais nova à direita", () => {
    const t = pulseTicks(rows(["pending", 0], ["exhausted", 5], ["success", 1])); // da mais nova para a mais antiga
    expect(t).toHaveLength(PULSE_SIZE);
    expect(t.slice(0, 27).every((k) => k === "none")).toBe(true);
    expect(t.slice(27)).toEqual(["ok", "bad", "wait"]);
  });
  it("ignora o que passa de 30", () => {
    const many = Array.from({ length: 45 }, () => ({ status: "success", attempt: 1 }));
    expect(pulseTicks(many).filter((k) => k === "ok")).toHaveLength(30);
  });
  it("resume em português", () => {
    expect(pulseSummary([])).toBe("Nenhuma entrega ainda");
    expect(pulseSummary(rows(["success", 1], ["success", 1], ["exhausted", 5]))).toBe("2 de 3 entregues");
    expect(pulseSummary(rows(["success", 1]))).toBe("1 de 1 entregue");
    expect(pulseSummary(rows(["exhausted", 5]))).toBe("0 de 1 entregue");
    expect(pulseSummary(rows(["pending", 0]))).toBe("Nada concluído ainda · 1 em andamento");
    expect(pulseSummary(rows(["success", 1], ["pending", 1]), PULSE_SIZE, false)).toBe("1 de 1 entregue");
  });
});

describe("eventos do endpoint e do teste", () => {
  it("sem filtro ou com todos = todos os eventos", () => {
    expect(endpointEventLabels([])).toEqual({ all: true, labels: [] });
    expect(endpointEventLabels(null).all).toBe(true);
    expect(endpointEventLabels(ALL_EVENTS).all).toBe(true);
  });
  it("com filtro lista os rótulos na ordem do catálogo", () => {
    expect(endpointEventLabels(["payment.refunded", "payment.approved"])).toEqual({ all: false, labels: ["Pagamento aprovado", "Reembolso"] });
  });
  it("o teste só oferece o que o endpoint recebe", () => {
    expect(testableEvents([]).map((e) => e.key)).toEqual(ALL_EVENTS);
    expect(testableEvents(["payout.approved", "payment.approved"]).map((e) => e.key)).toEqual(["payment.approved", "payout.approved"]);
    expect(ALL_EVENTS).toContain(DEFAULT_TEST_EVENT);
  });
});

describe("teste, retryIn", () => {
  it("reconhece teste pelo corpo ou pelo evento antigo", () => {
    expect(isTestDelivery({ event: "payment.approved", is_test: "true" })).toBe(true);
    expect(isTestDelivery({ event: "webhook.test", is_test: null })).toBe(true);
    expect(isTestDelivery({ event: "payment.approved", is_test: null })).toBe(false);
  });
  it("conta o tempo até a próxima tentativa", () => {
    const now = new Date("2026-11-24T12:00:00Z").getTime();
    expect(retryIn(null, now)).toBe("em instantes");
    expect(retryIn("2026-11-24T12:00:02Z", now)).toBe("em instantes");
    expect(retryIn("2026-11-24T12:00:30Z", now)).toBe("em 30 s");
    expect(retryIn("2026-11-24T12:10:00Z", now)).toBe("em 10 min");
  });
});

describe("guia de assinatura", () => {
  it("usa os cabeçalhos e o formato que o worker envia", () => {
    expect(VERIFY_SNIPPET).toContain("createHmac(\"sha256\"");
    expect(VERIFY_SNIPPET).toContain("${parts.t}.${rawBody}");
    expect(VERIFY_SNIPPET).toContain("timingSafeEqual");
  });
});
