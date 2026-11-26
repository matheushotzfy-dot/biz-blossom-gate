import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AFF_MAX, CO_MAX, brlFromCents, computeSplit } from "@/components/landing-vp/splitMath";
import { FAQ, NAV_LINKS, SECURITY_POINTS, SELL_FEATURES } from "@/components/landing-vp/landingData";
import { SiteNav } from "@/components/landing-vp/SiteNav";
import { SplitCalculator } from "@/components/landing-vp/SellSection";
import LandingPage from "@/pages/LandingPage";

const asText = (html: string) => html.replace(new RegExp(String.fromCharCode(160), "g"), " ");

describe("divisão de venda (espelha apply_transaction_splits)", () => {
  it("sem coprodutor nem afiliado, tudo fica com quem vende", () => {
    expect(computeSplit(10000, 0, 0)).toEqual({ owner: 10000, partner: 0, affiliate: 0, capped: false });
  });

  it("calcula cada parte sobre o valor líquido e a soma fecha no centavo", () => {
    const s = computeSplit(10000, 30, 10);
    expect(s).toEqual({ owner: 6000, partner: 3000, affiliate: 1000, capped: false });
    expect(s.owner + s.partner + s.affiliate).toBe(10000);
  });

  it("arredonda ao centavo sem perder nem criar dinheiro", () => {
    const s = computeSplit(3333, 33, 7);
    expect(s.partner).toBe(1100);
    expect(s.affiliate).toBe(233);
    expect(s.owner + s.partner + s.affiliate).toBe(3333);
  });

  it("a comissão do afiliado nunca passa do que sobra depois do coprodutor", () => {
    const s = computeSplit(10000, 99, 90);
    expect(s.partner).toBe(9900);
    expect(s.affiliate).toBe(100);
    expect(s.owner).toBe(0);
    expect(s.capped).toBe(true);
  });

  it("respeita os limites da plataforma (coprodutor até 99%, afiliado até 90%)", () => {
    expect(CO_MAX).toBe(99);
    expect(AFF_MAX).toBe(90);
    expect(computeSplit(10000, 150, 0).partner).toBe(9900);
    expect(computeSplit(10000, 0, 150).affiliate).toBe(9000);
  });

  it("ignora valores inválidos em vez de quebrar", () => {
    expect(computeSplit(Number.NaN, 30, 10)).toEqual({ owner: 0, partner: 0, affiliate: 0, capped: false });
    expect(computeSplit(-500, 30, 10).owner).toBe(0);
    expect(computeSplit(10000, Number.NaN, Number.NaN).owner).toBe(10000);
  });

  it("formata em reais", () => {
    expect(asText(brlFromCents(123456))).toBe("R$ 1.234,56");
  });
});

describe("dados da landing", () => {
  it("todas as perguntas têm resposta e nenhuma promete número que o painel não prova", () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(8);
    for (const f of FAQ) {
      expect(f.q.trim().endsWith("?")).toBe(true);
      expect(f.a.trim().length).toBeGreaterThan(30);
    }
    const all = JSON.stringify([FAQ, SELL_FEATURES, SECURITY_POINTS]);
    for (const banned of ["75%", "24/7", "24h", "instantâneo", "exclusiv", "antifraude"]) {
      expect(all.toLowerCase()).not.toContain(banned.toLowerCase());
    }
  });

  it("não repete âncoras no menu", () => {
    const hrefs = NAV_LINKS.map((l) => l.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

function renderPage() {
  const onLogin = vi.fn();
  const onSignup = vi.fn();
  return { onLogin, onSignup, ...render(<HelmetProvider><MemoryRouter><LandingPage /></MemoryRouter></HelmetProvider>) };
}

describe("página", () => {
  it("cada link do menu aponta para uma seção que existe", () => {
    const { container } = renderPage();
    for (const l of NAV_LINKS) {
      expect(container.querySelector(l.href), `seção ${l.href}`).not.toBeNull();
    }
  });

  it("libera o scroll do documento enquanto a landing está montada", () => {
    const { unmount } = renderPage();
    expect(document.documentElement.classList.contains("vx-scroll")).toBe(true);
    unmount();
    expect(document.documentElement.classList.contains("vx-scroll")).toBe(false);
  });

  it("tem um único h1 e não promete taxa de aprovação", () => {
    const { container } = renderPage();
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.textContent).not.toContain("75%");
  });

  it("lista as perguntas em detalhes nativos, sem script", () => {
    const { container } = renderPage();
    expect(container.querySelectorAll(".lp-faq details")).toHaveLength(FAQ.length);
  });

  it("o rodapé aponta para as páginas legais e a documentação", () => {
    renderPage();
    const foot = screen.getByRole("contentinfo");
    const hrefs = within(foot).getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/termos-de-uso", "/politica-de-privacidade", "/documentacao", "/status"]));
  });

  it("as placas de premiação têm texto alternativo", () => {
    const { container } = renderPage();
    const imgs = Array.from(container.querySelectorAll<HTMLImageElement>("#premiacoes img"));
    expect(imgs.length).toBe(7);
    for (const i of imgs) expect(i.alt.length).toBeGreaterThan(8);
  });
});

describe("menu no celular", () => {
  it("abre, fecha com Escape e informa o estado para leitores de tela", () => {
    render(<SiteNav onLogin={() => {}} onSignup={() => {}} />);
    const btn = screen.getByRole("button", { name: "Abrir menu" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(screen.getByRole("button", { name: "Fechar menu" }).getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById("lp-menu")).not.toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.getElementById("lp-menu")).toBeNull();
  });

  it("os botões chamam entrar e abrir conta", () => {
    const onLogin = vi.fn();
    const onSignup = vi.fn();
    render(<SiteNav onLogin={onLogin} onSignup={onSignup} />);
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir conta" }));
    expect(onLogin).toHaveBeenCalledTimes(1);
    expect(onSignup).toHaveBeenCalledTimes(1);
  });
});

describe("calculadora de divisão", () => {
  const lines = () => within(screen.getByRole("list")).getAllByRole("listitem").map((li) => asText(li.textContent ?? ""));

  it("começa com um exemplo coerente", () => {
    render(<SplitCalculator />);
    expect(lines()).toEqual(["Você" + "R$ 60,00", "Coprodutor, 30%R$ 30,00", "Afiliado, 10%R$ 10,00"]);
  });

  it("recalcula ao mexer nos controles e avisa quando a comissão é reduzida", () => {
    render(<SplitCalculator />);
    fireEvent.change(screen.getByLabelText("Coprodutor"), { target: { value: "99" } });
    fireEvent.change(screen.getByLabelText("Afiliado"), { target: { value: "90" } });
    expect(lines()).toEqual(["VocêR$ 0,00", "Coprodutor, 99%R$ 99,00", "Afiliado, 90%R$ 1,00"]);
    expect(screen.getByText(/foi reduzida/)).toBeTruthy();
  });

  it("aceita outro valor líquido com máscara de reais", () => {
    render(<SplitCalculator />);
    const input = screen.getByLabelText("Valor líquido da venda") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "25000" } });
    expect(input.value).toBe("250,00");
    expect(lines()[0]).toBe("VocêR$ 150,00");
  });

  it("zerar coprodutor e afiliado devolve tudo a quem vende", () => {
    render(<SplitCalculator />);
    fireEvent.change(screen.getByLabelText("Coprodutor"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Afiliado"), { target: { value: "0" } });
    expect(lines()).toEqual(["VocêR$ 100,00", "CoprodutorR$ 0,00", "AfiliadoR$ 0,00"]);
  });
});

describe("cena do topo (vendas do dia)", () => {
  // Importado aqui para os testes de cima não dependerem dela.
  const load = () => import("@/components/landing-vp/LiveLedger");
  const feedRows = (c: HTMLElement) => Array.from(c.querySelectorAll(".lp-feed .lp-row"));

  it("abre com o cartão cheio, as vendas novas chegam por cima e o boleto é pago no fim", async () => {
    vi.useFakeTimers();
    const { LiveLedger } = await load();
    const { EXAMPLE_SALES, HERO_ROWS } = await import("@/components/landing-vp/landingData");
    const { container } = render(<LiveLedger />);
    expect(feedRows(container)).toHaveLength(HERO_ROWS);
    // a mais nova primeiro
    expect(feedRows(container)[0].textContent).toContain(EXAMPLE_SALES[HERO_ROWS - 1].who);
    expect(container.textContent).toContain("Aguardando");

    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    const rows = feedRows(container);
    expect(rows).toHaveLength(HERO_ROWS + 1); // a que sai fica escondida embaixo (overflow do cartão)
    expect(rows[0].textContent).toContain(EXAMPLE_SALES[EXAMPLE_SALES.length - 1].who);
    expect(container.textContent).not.toContain("Aguardando");
    expect(container.textContent).toContain(`${EXAMPLE_SALES.length} vendas pagas`);
    vi.useRealTimers();
  });

  it("o resumo para leitores de tela bate com a soma das vendas de exemplo", async () => {
    const { LiveLedger } = await load();
    const { EXAMPLE_SALES } = await import("@/components/landing-vp/landingData");
    const { container } = render(<LiveLedger />);
    const total = brlFromCents(EXAMPLE_SALES.reduce((s, x) => s + x.cents, 0));
    expect(asText(container.querySelector(".sr-only")?.textContent ?? "")).toContain(asText(total));
  });
});

describe("textos que precisam ser verdade", () => {
  it("não promete sessão por aparelho, saque sem conferência nem primeira venda no mesmo dia", () => {
    const { container } = renderPage();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/onde a conta está aberta/);
    expect(text).not.toMatch(/saca sozinho|sacar sozinho/);
    expect(text).not.toMatch(/mesmo dia em que você terminar/);
    expect(text).toMatch(/revis/); // a revisão do produto aparece (FAQ e fecho)
  });
});

describe("navegação", () => {
  it("tem atalho para pular ao conteúdo e o alvo existe", () => {
    const { container } = renderPage();
    const skip = screen.getByRole("link", { name: "Pular para o conteúdo" });
    expect(skip.getAttribute("href")).toBe("#conteudo");
    expect(container.querySelector("main#conteudo")).not.toBeNull();
  });

  it("com o menu aberto a página por trás não rola e o foco vai para o primeiro link; Esc devolve o foco ao botão", () => {
    render(<SiteNav onLogin={() => {}} onSignup={() => {}} />);
    const toggle = screen.getByRole("button", { name: "Abrir menu" });
    fireEvent.click(toggle);
    expect(document.documentElement.classList.contains("lp-menu-open")).toBe(true);
    expect(document.activeElement?.textContent).toBe(NAV_LINKS[0].label);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.documentElement.classList.contains("lp-menu-open")).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Abrir menu" }));
  });

  it("clicar no véu fecha o menu", () => {
    const { container } = render(<SiteNav onLogin={() => {}} onSignup={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    fireEvent.click(container.querySelector(".lp-menu-scrim")!);
    expect(document.getElementById("lp-menu")).toBeNull();
  });

  it("o rodapé abre as preferências de cookies", () => {
    renderPage();
    const heard = vi.fn();
    window.addEventListener("venxpay:open-cookie-settings", heard);
    fireEvent.click(screen.getByRole("button", { name: "Preferências de cookies" }));
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener("venxpay:open-cookie-settings", heard);
  });
});
