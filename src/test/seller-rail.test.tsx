import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { SellerRail } from "@/components/seller-shell/SellerRail";

vi.mock("@/hooks/useSupportUnread", () => ({ useSupportUnread: () => 0 }));
vi.mock("@/lib/routePrefetch", () => ({ prefetchRoute: () => {} }));

function Where() { return <p data-testid="where">{useLocation().pathname}</p>; }
const setup = (path: string) => render(<MemoryRouter initialEntries={[path]}><SellerRail /><Where /></MemoryRouter>);

describe("menu lateral", () => {
  it("abre os atalhos da seção da página e recolhe ao clicar de novo, sem sair da página", () => {
    setup("/vendas/produtos");
    const btn = screen.getByRole("button", { name: "Produtos" });
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Meus produtos")).toBeTruthy();

    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Meus produtos")).toBeNull();
    expect(screen.getByTestId("where").textContent).toBe("/vendas/produtos");

    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Meus produtos")).toBeTruthy();
  });

  it("ir para outra seção abre a de destino e fecha a anterior", () => {
    setup("/vendas/produtos");
    fireEvent.click(screen.getByRole("link", { name: /Financeiro/ }));
    expect(screen.getByTestId("where").textContent).toBe("/financeiro/saques");
    expect(screen.getByRole("button", { name: "Financeiro" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Saldo e saques")).toBeTruthy();
    expect(screen.queryByText("Meus produtos")).toBeNull();
  });

  it("depois de recolher, outra seção continua abrindo normalmente", () => {
    setup("/vendas/produtos");
    fireEvent.click(screen.getByRole("button", { name: "Produtos" }));
    fireEvent.click(screen.getByRole("link", { name: /Marketing/ }));
    expect(screen.getByRole("button", { name: "Marketing" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Cupons")).toBeTruthy();
  });

  it("seção sem atalhos continua sendo um link", () => {
    setup("/vendas/produtos");
    expect(screen.getByRole("link", { name: "Início" }).getAttribute("href")).toBe("/dashboard");
  });
});
