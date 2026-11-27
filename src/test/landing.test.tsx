import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { FAQ, NAV_LINKS, PROOFS, SECURITY_POINTS, SELL_FEATURES, STEPS, TOUR, hasCompany } from "@/components/landing-vp/landingData";
import { SiteNav } from "@/components/landing-vp/SiteNav";
import LandingPage from "@/pages/LandingPage";

describe("dados da landing", () => {
  it("todas as perguntas têm resposta e nenhuma promete número que o painel não prova", () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(8);
    for (const f of FAQ) {
      expect(f.q.trim().endsWith("?")).toBe(true);
      expect(f.a.trim().length).toBeGreaterThan(30);
    }
    const all = JSON.stringify([FAQ, SELL_FEATURES, SECURITY_POINTS, STEPS, PROOFS, TOUR.map((t) => [t.title, t.points, t.alt])]);
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

  it("não tem mais a calculadora de divisão de venda", () => {
    const { container } = renderPage();
    expect(container.querySelector(".lp-split")).toBeNull();
    expect(screen.queryByLabelText("Valor líquido da venda")).toBeNull();
    expect(container.textContent).not.toContain("Para onde vai cada real");
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

describe("topo e telas reais", () => {
  it("mostra o checkout e o painel com texto alternativo e avisa que os dados são exemplos", () => {
    const { container } = renderPage();
    const scene = container.querySelector(".lp-scene") as HTMLElement;
    const imgs = Array.from(scene.querySelectorAll("img"));
    expect(imgs).toHaveLength(2);
    for (const i of imgs) expect(i.alt.length).toBeGreaterThan(20);
    expect(scene.textContent).toMatch(/Nomes e valores são exemplos/);
    // O aviso da venda repete o título da notificação real do painel (notify_transaction_paid).
    expect(scene.textContent).toContain("Nova venda aprovada");
  });

  it("as abas do painel também andam com as setas para cima e para baixo", () => {
    renderPage();
    const tabs = within(screen.getByRole("tablist", { name: "Telas do painel" })).getAllByRole("tab");
    const visible = () => screen.getAllByRole("tabpanel").filter((p) => !p.hasAttribute("hidden"));
    fireEvent.keyDown(tabs[0], { key: "ArrowDown" });
    expect(visible()[0].textContent).toContain(TOUR[1].title);
    fireEvent.keyDown(tabs[1], { key: "ArrowUp" });
    expect(visible()[0].textContent).toContain(TOUR[0].title);
  });

  it("as abas do painel trocam com clique e com as setas, e só uma tela aparece por vez", () => {
    renderPage();
    const tabs = within(screen.getByRole("tablist", { name: "Telas do painel" })).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(TOUR.map((t) => t.label));
    const visible = () => screen.getAllByRole("tabpanel").filter((p) => !p.hasAttribute("hidden"));
    expect(visible()).toHaveLength(1);
    expect(visible()[0].textContent).toContain(TOUR[0].title);

    fireEvent.click(tabs[2]);
    expect(tabs[2].getAttribute("aria-selected")).toBe("true");
    expect(visible()[0].textContent).toContain(TOUR[2].title);

    fireEvent.keyDown(tabs[2], { key: "ArrowRight" });
    expect(visible()[0].textContent).toContain(TOUR[3].title);
    fireEvent.keyDown(tabs[3], { key: "End" });
    expect(visible()[0].textContent).toContain(TOUR[TOUR.length - 1].title);
    fireEvent.keyDown(tabs[TOUR.length - 1], { key: "ArrowRight" });
    expect(visible()[0].textContent).toContain(TOUR[0].title);
  });

  it("os passos seguem a ordem real, do cadastro ao saque", () => {
    expect(STEPS.map((s) => s.t)).toEqual(["Abra a conta", "Monte o produto", "Venda", "Saque por Pix"]);
  });

  it("as provas levam a páginas públicas que existem", () => {
    const { container } = renderPage();
    const strip = container.querySelector(".lp-proofs") as HTMLElement;
    for (const p of PROOFS) {
      expect(within(strip).getByRole("link", { name: p.cta }).getAttribute("href")).toBe(p.to);
    }
  });
});

describe("empresa", () => {
  it("sem razão social e CNPJ preenchidos, nada de empresa aparece na página", () => {
    expect(hasCompany()).toBe(false);
    const { container } = renderPage();
    expect(container.querySelector("#empresa")).toBeNull();
    expect(container.textContent).not.toContain("Quem está por trás");
  });

  it("só considera a empresa preenchida com razão social e CNPJ", () => {
    expect(hasCompany({ legalName: "Empresa Exemplo Ltda", cnpj: "", city: null, email: null, whatsapp: null })).toBe(false);
    expect(hasCompany({ legalName: "Empresa Exemplo Ltda", cnpj: "00.000.000/0001-00", city: null, email: null, whatsapp: null })).toBe(true);
  });
});
