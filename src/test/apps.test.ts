import { describe, expect, it } from "vitest";
import {
  APPS, APP_EVENTS, CATEGORIES, DARK_LOGO_APPS, appById, appDeliveryError, appDeliveryOutcome, appErrorMessage, appEventLabel,
  connectionEvents, readTestResult, validateConnection,
} from "@/components/integrations/appCatalog";
import { deliveryKind, type DeliveryRow } from "@/components/integrations/webhookMeta";

const app = (id: string) => appById(id)!;
const delivery = (over: Partial<DeliveryRow> = {}): DeliveryRow => ({
  id: "d1", webhook_config_id: "a1", transaction_id: null, event: "Purchase", attempt: 0, status: "pending",
  response_status: null, error: null, next_retry_at: null, delivered_at: null, created_at: "2026-11-24T12:00:00Z", ...over,
});

describe("catálogo de apps", () => {
  it("tem ids únicos e categorias conhecidas", () => {
    const ids = APPS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of APPS) expect(CATEGORIES).toContain(a.category);
  });

  it("só oferece eventos que o dispatcher conhece", () => {
    const known = new Set(APP_EVENTS.map((e) => e.key));
    for (const a of APPS) for (const e of a.events) expect(known.has(e)).toBe(true);
  });

  it("cada app com campos tem uma chave obrigatória e uma política de teste", () => {
    for (const a of APPS.filter((x) => x.fields.length > 0)) {
      expect(a.fields.some((f) => f.target === "api_key" && f.required)).toBe(true);
      expect(a.test).toBeDefined();
      expect(a.test!.note.length).toBeGreaterThan(20);
    }
  });

  it("não deixa testar apps que mexem com gente de verdade", () => {
    for (const id of ["zapi", "notazz", "smsfunnel", "voxuy"]) expect(app(id).test?.mode).toBe("blocked");
    expect(app("utmify").test?.mode).toBe("safe");
  });

  it("webhooks não tem campos nem eventos próprios (tem página própria)", () => {
    expect(app("webhooks").fields).toEqual([]);
    expect(app("webhooks").events).toEqual([]);
  });

  it("logos claros têm fundo escuro e apps existentes", () => {
    for (const id of DARK_LOGO_APPS) expect(appById(id)).toBeDefined();
  });

  it("rotula eventos em português e devolve a chave quando desconhece", () => {
    expect(appEventLabel("Purchase")).toBe("Venda aprovada");
    expect(appEventLabel("Outro")).toBe("Outro");
  });
});

describe("validateConnection", () => {
  const ok = { fields: { api_key: "tok_123456" }, productId: "all", events: ["Purchase"] };

  it("aceita uma conexão completa", () => {
    expect(validateConnection(app("utmify"), ok, false)).toEqual({});
  });

  it("exige a chave ao criar, mas mantém a salva ao editar", () => {
    const blank = { ...ok, fields: { api_key: "  " } };
    expect(validateConnection(app("utmify"), blank, false).api_key).toBe("Preencha o campo Token da UTMify.");
    expect(validateConnection(app("utmify"), blank, true)).toEqual({});
  });

  it("exige ao menos um evento", () => {
    expect(validateConnection(app("utmify"), { ...ok, events: [] }, false).events).toBe("Escolha pelo menos um evento.");
  });

  it("Z-API: token e ID só com letras, números, hífen e sublinhado", () => {
    const base = { fields: { api_key: "abc123", api_url: "3DF2A1B7C9" }, productId: "p1", events: ["Purchase"] };
    expect(validateConnection(app("zapi"), base, false)).toEqual({});
    const bad = validateConnection(app("zapi"), { ...base, fields: { api_key: "a b", api_url: "id!" } }, false);
    expect(bad.api_key).toBeDefined();
    expect(bad.api_url).toBeDefined();
  });

  it("Z-API: Client-Token é opcional", () => {
    const v = { fields: { api_key: "abc", api_url: "123" }, productId: "all", events: ["Purchase"] };
    expect(validateConnection(app("zapi"), v, false).webhook_url).toBeUndefined();
  });

  it("ActiveCampaign: a URL da conta precisa ser https e pública", () => {
    const base = { fields: { api_key: "k", api_url: "https://conta.api-us1.com" }, productId: "all", events: ["Purchase"] };
    expect(validateConnection(app("activecampaign"), base, false)).toEqual({});
    expect(validateConnection(app("activecampaign"), { ...base, fields: { ...base.fields, api_url: "http://conta.com" } }, false).api_url).toBeDefined();
    expect(validateConnection(app("activecampaign"), { ...base, fields: { ...base.fields, api_url: "https://localhost" } }, false).api_url).toBeDefined();
  });

  it("recusa valores gigantes", () => {
    expect(validateConnection(app("utmify"), { ...ok, fields: { api_key: "x".repeat(501) } }, false).api_key).toBe("Esse valor é longo demais.");
  });
});

describe("connectionEvents", () => {
  it("resume os eventos escolhidos", () => {
    const utm = app("utmify");
    expect(connectionEvents({ events: utm.events }, utm)).toBe("Todos os eventos");
    expect(connectionEvents({ events: ["Purchase"] }, utm)).toBe("Venda aprovada");
    expect(connectionEvents({ events: ["Purchase", "Refund"] }, utm)).toBe("2 eventos");
    expect(connectionEvents({ events: [] }, utm)).toBe("Nenhum evento");
    expect(connectionEvents({ events: null }, utm)).toBe("Nenhum evento");
  });

  it("ignora eventos que o app não usa", () => {
    expect(connectionEvents({ events: ["Chargeback"] }, app("notazz"))).toBe("Nenhum evento");
  });
});

describe("readTestResult", () => {
  it("sucesso mostra o status do app", () => {
    const r = readTestResult({ ok: true, status: 200, body: "{}" });
    expect(r.ok).toBe(true);
    expect(r.message).toContain("200");
  });

  it.each([
    [401, "recusou a chave"], [403, "recusou a chave"], [404, "não encontrou"], [429, "esperar"], [503, "instabilidade"], [422, "422"],
  ])("status %i vira mensagem clara", (status, part) => {
    const r = readTestResult({ ok: false, status, body: "x" });
    expect(r.ok).toBe(false);
    expect(r.message).toContain(part);
  });

  it("erros sem status são traduzidos", () => {
    expect(readTestResult({ ok: false, status: 0, error: "Z-API missing instance_id" }).message).toContain("Faltam dados");
    expect(readTestResult({ ok: false, status: 0, error: "The signal has been aborted" }).message).toContain("10 segundos");
    expect(readTestResult({ ok: false, status: 0, error: "Integration not found" }).message).toContain("não existe mais");
    expect(readTestResult(null).message).toBe("O teste não passou.");
  });

  it("limita o detalhe que aparece na tela", () => {
    expect(readTestResult({ ok: false, status: 500, body: "x".repeat(5000) }).detail.length).toBeLessThanOrEqual(600);
  });
});

describe("entregas dos apps", () => {
  it("usa os status reais do banco", () => {
    expect(deliveryKind(delivery({ status: "delivered", attempt: 1 }))).toBe("success");
    expect(deliveryKind(delivery({ status: "pending", attempt: 0 }))).toBe("queued");
    expect(deliveryKind(delivery({ status: "pending", attempt: 2 }))).toBe("retrying");
    expect(deliveryKind(delivery({ status: "exhausted", attempt: 5 }))).toBe("exhausted");
  });

  it("fala do app, não do servidor do vendedor", () => {
    expect(appDeliveryOutcome(delivery({ status: "delivered", response_status: 200 }))).toBe("O app respondeu 200");
    expect(appDeliveryOutcome(delivery({ status: "exhausted", response_status: 401 }))).toBe("O app respondeu 401");
    expect(appDeliveryOutcome(delivery({ status: "pending", attempt: 1, error: "abort" }))).toContain("Vamos tentar de novo");
  });

  it("traduz os erros do dispatcher", () => {
    expect(appDeliveryError(null)).toBe("Sem resposta do app");
    expect(appDeliveryError("Z-API skipped: customer phone missing")).toContain("telefone");
    expect(appDeliveryError("Notazz: customer document missing")).toContain("CPF");
    expect(appDeliveryError("UTMify missing api_token")).toContain("sem uma chave");
    expect(appDeliveryError("Z-API instance_id/instance_token inválidos")).toContain("inválido");
    expect(appDeliveryError("skipped: Spedy only acts on Purchase")).toContain("não se aplica");
    expect(appDeliveryError("The signal has been aborted")).toContain("10 segundos");
    expect(appDeliveryError("boom")).toBe("Não foi possível falar com o app");
  });
});

describe("appErrorMessage", () => {
  it("traduz erros do banco", () => {
    expect(appErrorMessage({ message: "URL must use HTTPS" }, "x")).toContain("https://");
    expect(appErrorMessage({ message: "new row violates row-level security policy" }, "x")).toContain("permissão");
    expect(appErrorMessage({ message: "violates foreign key constraint product_id" }, "x")).toContain("produto");
    expect(appErrorMessage({ message: "???" }, "Falhou.")).toBe("Falhou.");
    expect(appErrorMessage(null, "Falhou.")).toBe("Falhou.");
  });
});
