import { describe, expect, it } from "vitest";
import {
  ALL_EVENTS, DELIVERY_META, MAX_ATTEMPTS, deliveryErrorText, deliveryKind, deliveryOutcome, eventLabel, eventsSummary,
  generateWebhookSecret, hostOf, isStuck, pathOf, validateWebhookUrl, webhookErrorMessage, type DeliveryRow,
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

describe("guia de assinatura", () => {
  it("usa os cabeçalhos e o formato que o worker envia", () => {
    expect(VERIFY_SNIPPET).toContain("createHmac(\"sha256\"");
    expect(VERIFY_SNIPPET).toContain("${parts.t}.${rawBody}");
    expect(VERIFY_SNIPPET).toContain("timingSafeEqual");
  });
});
