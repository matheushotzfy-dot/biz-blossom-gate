import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { GlobalSearchDialog } from "@/components/layout/GlobalSearchDialog";
import { SEARCH_PAGES, filterPages, normalizeText, sanitizeTerm } from "@/components/layout/globalSearch";
import { SELLER_EXTRA, SELLER_NAV } from "@/components/seller-shell/navConfig";
import { MAX_PERIOD_DAYS, rangeProblem, spanDays, yearPeriod } from "@/components/period/periodMeta";

type Call = { table: string; ops: Array<[string, unknown[]]> };
const mock = vi.hoisted(() => ({
  calls: [] as Array<{ table: string; ops: Array<[string, unknown[]]> }>,
  responses: {} as Record<string, { data: unknown[] | null; error: unknown }>,
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const rec: Call = { table, ops: [] };
      mock.calls.push(rec);
      const builder: unknown = new Proxy({}, {
        get: (_t, prop: string) => {
          if (prop === "then") return (resolve: (v: unknown) => void) => resolve(mock.responses[table] ?? { data: [], error: null });
          return (...args: unknown[]) => { rec.ops.push([prop, args]); return builder; };
        },
      });
      return builder;
    },
  },
}));

function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname + l.search}</p>; }
function setup() {
  const onOpenChange = vi.fn();
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <GlobalSearchDialog open onOpenChange={onOpenChange} />
      <Where />
    </MemoryRouter>,
  );
  return { onOpenChange, input: screen.getByRole("combobox") as HTMLInputElement };
}
const type = (input: HTMLInputElement, value: string) => fireEvent.change(input, { target: { value } });

beforeEach(() => {
  mock.calls.length = 0;
  mock.responses = {};
});

describe("regras da busca", () => {
  it("ignora acento e maiúsculas", () => {
    expect(normalizeText("  Cobrança Á ")).toBe("cobranca a");
    expect(filterPages(SEARCH_PAGES, "COBRANCA").map((p) => p.title)).toContain("Link de pagamento");
  });

  it("acha a página pelo que o seller costuma digitar, não só pelo nome", () => {
    expect(filterPages(SEARCH_PAGES, "pix")[0].href).toBe("/financeiro/config");
    expect(filterPages(SEARCH_PAGES, "sacar")[0].href).toBe("/financeiro/saques");
    expect(filterPages(SEARCH_PAGES, "kyc")[0].href).toBe("/perfil?tab=identidade");
    expect(filterPages(SEARCH_PAGES, "senha")[0].href).toBe("/perfil?tab=seguranca");
    expect(filterPages(SEARCH_PAGES, "webhook")[0].href).toBe("/integracoes?tab=webhooks");
  });

  it("quem começa com o texto vem antes de quem só contém", () => {
    const titles = filterPages(SEARCH_PAGES, "co").map((p) => p.title);
    expect(titles[0]).toBe("Coproduções");
    expect(titles).toContain("Premiações");
  });

  it("singular acha plural e o contrário", () => {
    expect(filterPages(SEARCH_PAGES, "cupom")[0].title).toBe("Cupons");
    expect(filterPages(SEARCH_PAGES, "premiacao")[0].title).toBe("Premiações");
    expect(filterPages(SEARCH_PAGES, "coproducao")[0].title).toBe("Coproduções");
    expect(filterPages(SEARCH_PAGES, "cupon")[0].title).toBe("Cupons");
    expect(filterPages(SEARCH_PAGES, "vendas")[0].title).toBe("Todas as vendas");
  });

  it("todos os termos precisam casar", () => {
    expect(filterPages(SEARCH_PAGES, "chave pix").map((p) => p.href)).toEqual(["/financeiro/config"]);
    expect(filterPages(SEARCH_PAGES, "pix xyzabc")).toEqual([]);
  });

  it("as páginas saem do menu: tudo que abre está lá, o que está 'em breve' não", () => {
    const hrefs = SEARCH_PAGES.map((p) => p.href);
    for (const s of SELLER_NAV) {
      if (!s.links) expect(hrefs).toContain(s.url);
      for (const l of s.links ?? []) expect(hrefs.includes(l.url)).toBe(!l.soon);
    }
    for (const e of SELLER_EXTRA) expect(hrefs).toContain(e.url);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("tira do termo o que quebraria o filtro do servidor", () => {
    expect(sanitizeTerm('ana,user_id.neq.x)"  (maria)')).toBe("ana user_id.neq.x maria");
    expect(sanitizeTerm("100%*\\")).toBe("100");
  });
});

describe("destino das vendas", () => {
  it("a lista de vendas aberta pela busca olha o último ano, dentro do limite do seletor", () => {
    const p = yearPeriod(new Date(2026, 10, 25));
    expect(p.presetId).toBeNull();
    expect(spanDays(p.from, p.to)).toBe(365);
    expect(spanDays(p.from, p.to)).toBeLessThanOrEqual(MAX_PERIOD_DAYS);
    expect(rangeProblem(p.from, p.to, new Date(2026, 10, 25))).toBeNull();
  });
});

describe("diálogo de busca", () => {
  it("abre com o campo em foco e as páginas agrupadas, sem consultar o servidor", () => {
    const { input } = setup();
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole("option", { name: /Saldo e saques/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Início/ }).getAttribute("aria-selected")).toBe("true");
    expect(mock.calls).toHaveLength(0);
  });

  it("setas escolhem, Enter abre e fecha o diálogo", () => {
    const { input, onOpenChange } = setup();
    type(input, "saque");
    expect(screen.getByRole("option", { name: /Saldo e saques/ }).getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("where").textContent).toBe("/financeiro/saques");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("a seta para baixo no último resultado volta ao primeiro", () => {
    const { input } = setup();
    type(input, "venda");
    const options = screen.getAllByRole("option");
    for (let i = 0; i < options.length; i++) fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[0].getAttribute("aria-selected")).toBe("true");
  });

  it("clicar num resultado abre a página", () => {
    setup();
    fireEvent.click(screen.getByRole("option", { name: /Cupons/ }));
    expect(screen.getByTestId("where").textContent).toBe("/vendas/cupons");
  });

  it("com uma letra só mostra páginas e não consulta o servidor", () => {
    const { input } = setup();
    type(input, "m");
    expect(mock.calls).toHaveLength(0);
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });

  it("produtos e vendas vêm do servidor, só da própria conta, e levam à lista já filtrada", async () => {
    mock.responses.products = { data: [{ id: "p1", name: "Mentoria Black", price: 1997, status: "active" }], error: null };
    mock.responses.transactions = {
      data: [{ id: "t1", customer_name: "Marina Alves", customer_email: "marina@exemplo.com", amount: 297, status: "completed", payment_method: "pix", created_at: new Date().toISOString(), pix_expires_at: null }],
      error: null,
    };
    const { input } = setup();
    type(input, "mar");

    const product = await screen.findByRole("option", { name: /Mentoria Black/ }, { timeout: 2000 });
    expect(product.textContent).toContain("Ativo");
    expect(product.textContent).toContain("1.997,00");
    const sale = await screen.findByRole("option", { name: /Marina Alves/ });
    expect(sale.textContent).toContain("marina@exemplo.com");
    expect(sale.textContent).toContain("Paga");

    const prod = mock.calls.find((c) => c.table === "products")!;
    expect(prod.ops).toContainEqual(["eq", ["user_id", "u1"]]);
    expect(prod.ops).toContainEqual(["is", ["deleted_at", null]]);
    const tx = mock.calls.find((c) => c.table === "transactions")!;
    expect(tx.ops).toContainEqual(["eq", ["user_id", "u1"]]);

    fireEvent.click(sale);
    expect(screen.getByTestId("where").textContent).toBe("/vendas?search=marina%40exemplo.com");
  });

  it("produto leva à lista de produtos com o nome na busca", async () => {
    mock.responses.products = { data: [{ id: "p1", name: "Mentoria Black", price: 10, status: "draft" }], error: null };
    const { input } = setup();
    type(input, "mentoria");
    fireEvent.click(await screen.findByRole("option", { name: /Mentoria Black/ }, { timeout: 2000 }));
    expect(screen.getByTestId("where").textContent).toBe("/vendas/produtos?q=Mentoria%20Black");
  });

  it("o termo vai limpo para o filtro do servidor", async () => {
    const { input } = setup();
    type(input, "ana,user_id.neq.x)");
    await waitFor(() => expect(mock.calls.length).toBeGreaterThan(0), { timeout: 2000 });
    const tx = mock.calls.find((c) => c.table === "transactions")!;
    const filter = String(tx.ops.find(([op]) => op === "or")![1][0]);
    expect(filter).toBe("customer_name.ilike.%ana user_id.neq.x%,customer_email.ilike.%ana user_id.neq.x%");
  });

  it("sem resultado explica o que dá para procurar", async () => {
    const { input } = setup();
    type(input, "zzzqx");
    expect(await screen.findByText(/Nada encontrado para “zzzqx”/, {}, { timeout: 2000 })).toBeTruthy();
  });

  it("se o servidor falha, avisa e as páginas continuam", async () => {
    mock.responses.products = { data: null, error: { message: "boom" } };
    mock.responses.transactions = { data: null, error: { message: "boom" } };
    const { input } = setup();
    type(input, "cupons");
    expect(await screen.findByText(/Não deu para buscar produtos e vendas agora/, {}, { timeout: 2000 })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Cupons/ })).toBeTruthy();
  });

  it("limpar apaga o texto e devolve o foco ao campo", () => {
    const { input } = setup();
    type(input, "cupons");
    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
  });
});
