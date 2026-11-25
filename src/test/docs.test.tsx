import crypto, { createHmac } from "node:crypto";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Documentacao, { DOC_SECTIONS } from "@/pages/vendas/Documentacao";
import { CodeTabs } from "@/components/integrations/docs/DocBlocks";
import {
  API_ERRORS, CHARGE_PARAMS, CHARGE_REQUEST, CHARGE_RESPONSE, NODE_RECEIVER, PAYMENT_EVENT_EXAMPLE, PAYMENT_FIELDS, PAYOUT_EVENT_EXAMPLE,
  PHP_RECEIVER, PYTHON_RECEIVER, RATE_LIMITS, WEBHOOK_HEADERS,
} from "@/components/integrations/docs/docsData";
import { VERIFY_SNIPPET } from "@/components/integrations/SignatureGuide";
import { ALL_EVENTS, EVENT_GROUPS, MAX_ATTEMPTS, RETRY_PLAN } from "@/components/integrations/webhookMeta";

/** Monta a função do exemplo em Node.js tal como o vendedor a copiaria. */
function loadVerifier(): (raw: string, header: string, secret: string) => boolean {
  const body = VERIFY_SNIPPET.replace(/^import .*$/m, "").replace("export function", "function");
  return new Function("crypto", `${body}\nreturn isFromVemprapay;`)(crypto);
}

/** Assina como o webhook-dispatcher: HMAC-SHA256 hex de `${t}.${corpo}`, cabeçalho `t=...,v1=...`. */
const sign = (secret: string, raw: string, t: number) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex")}`;

afterEach(() => vi.useRealTimers());

describe("exemplo de verificação da assinatura", () => {
  const secret = "whsec_0123456789abcdef0123456789abcdef0123456789abcdef";
  const raw = PAYMENT_EVENT_EXAMPLE;

  it("aceita uma assinatura feita como o worker faz", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(loadVerifier()(raw, sign(secret, raw, now), secret)).toBe(true);
  });

  it("recusa corpo alterado, chave errada e cabeçalho vazio ou torto", () => {
    const now = Math.floor(Date.now() / 1000);
    const verify = loadVerifier();
    expect(verify(raw.replace("19700", "100"), sign(secret, raw, now), secret)).toBe(false);
    expect(verify(raw, sign("whsec_outra", raw, now), secret)).toBe(false);
    expect(verify(raw, "", secret)).toBe(false);
    expect(verify(raw, "lixo", secret)).toBe(false);
    expect(verify(raw, `t=${now}`, secret)).toBe(false);
  });

  it("recusa envio com mais de 5 minutos", () => {
    const now = Math.floor(Date.now() / 1000);
    const verify = loadVerifier();
    expect(verify(raw, sign(secret, raw, now - 299), secret)).toBe(true);
    expect(verify(raw, sign(secret, raw, now - 301), secret)).toBe(false);
  });

  it("os exemplos em Python e PHP seguem o mesmo esquema", () => {
    for (const code of [PYTHON_RECEIVER, PHP_RECEIVER]) {
      expect(code).toMatch(/\.\s*\$?raw|f"\{t\}\."/);
      expect(code).toMatch(/sha256/);
      expect(code).toMatch(/300/);
    }
    expect(PYTHON_RECEIVER).toContain("compare_digest");
    expect(PYTHON_RECEIVER).toContain("X-Venxpay-Signature");
    expect(PHP_RECEIVER).toContain("hash_equals");
    expect(PHP_RECEIVER).toContain("HTTP_X_VENXPAY_SIGNATURE");
    expect(NODE_RECEIVER.startsWith(VERIFY_SNIPPET)).toBe(true);
    expect(NODE_RECEIVER).toContain("express.raw");
  });
});

describe("formato dos eventos", () => {
  const pay = JSON.parse(PAYMENT_EVENT_EXAMPLE);
  const out = JSON.parse(PAYOUT_EVENT_EXAMPLE);

  it("os exemplos são JSON de eventos que existem", () => {
    expect(ALL_EVENTS).toContain(pay.event);
    expect(ALL_EVENTS).toContain(out.event);
  });

  it("a tabela de campos descreve só campos do exemplo", () => {
    const has = (path: string) => path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), pay) !== undefined;
    for (const f of PAYMENT_FIELDS) expect(has(f.name), f.name).toBe(true);
  });

  it("valores vão em centavos inteiros", () => {
    for (const v of [pay.data.amount_cents, pay.data.net_amount_cents, out.data.amount_cents, out.data.net_amount_cents, out.data.fee_cents]) expect(Number.isInteger(v)).toBe(true);
    expect(out.data.amount_cents - out.data.fee_cents).toBe(out.data.net_amount_cents);
  });

  it("lista os cabeçalhos reais do worker", () => {
    const names = WEBHOOK_HEADERS.map(([n]) => n);
    for (const h of ["X-Venxpay-Signature", "X-Venxpay-Event", "X-Venxpay-Delivery", "X-Venxpay-Timestamp"]) expect(names).toContain(h);
  });
});

describe("prévia da API de cobranças", () => {
  it("o exemplo de criação cobre os campos obrigatórios", () => {
    for (const p of CHARGE_PARAMS.filter((x) => x.required)) expect(CHARGE_REQUEST).toContain(p.name.split(".").pop()!);
    expect(JSON.parse(CHARGE_RESPONSE).data.pix.copy_paste).toBeTruthy();
  });

  it("os códigos de erro são únicos e têm HTTP válido", () => {
    const codes = API_ERRORS.map(([, c]) => c);
    expect(new Set(codes).size).toBe(codes.length);
    for (const [http] of API_ERRORS) expect(Number(http)).toBeGreaterThanOrEqual(400);
    expect(RATE_LIMITS).toHaveLength(4);
  });
});

describe("página de documentação", () => {
  const renderDocs = () => render(<MemoryRouter><Documentacao standalone /></MemoryRouter>);

  it("tem uma seção para cada item da navegação", () => {
    const ids = DOC_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    renderDocs();
    for (const s of DOC_SECTIONS) expect(document.getElementById(s.id), s.id).not.toBeNull();
  });

  it("mostra todos os eventos de webhook e as regras de entrega reais", () => {
    renderDocs();
    for (const g of EVENT_GROUPS) for (const e of g.events) expect(screen.getAllByText(e.key).length).toBeGreaterThan(0);
    expect(screen.getByText(new RegExp(`Até ${MAX_ATTEMPTS} tentativas no total, esperando ${RETRY_PLAN}`))).toBeTruthy();
  });

  it("deixa claro que a API de cobranças ainda não está no ar", () => {
    renderDocs();
    const section = document.getElementById("cobrancas")!;
    expect(within(section).getByText("Em breve")).toBeTruthy();
    expect(within(section).getByText("Ainda não está no ar")).toBeTruthy();
    expect(screen.queryByText(/pix-api/)).toBeNull();
  });

  it("troca a linguagem do exemplo de código", () => {
    render(<CodeTabs label="Linguagem" tabs={[{ id: "a", label: "Node.js", code: "console.log(1)" }, { id: "b", label: "Python", code: "print(1)" }]} />);
    expect(screen.getByText("console.log(1)")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Python" }));
    expect(screen.getByText("print(1)")).toBeTruthy();
    expect(screen.queryByText("console.log(1)")).toBeNull();
  });
});
