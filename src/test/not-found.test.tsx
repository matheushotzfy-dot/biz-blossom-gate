import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import NotFound from "@/pages/NotFound";

describe("página não encontrada", () => {
  it("mostra o endereço e leva ao início, à entrada e às áreas reais", () => {
    render(<HelmetProvider><MemoryRouter initialEntries={["/link-antigo"]}><NotFound /></MemoryRouter></HelmetProvider>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Esta página não existe.");
    expect(screen.getByText("/link-antigo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para o início" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Entrar na conta" })).toHaveAttribute("href", "/auth");
    expect(screen.getByRole("link", { name: "Área de membros" })).toHaveAttribute("href", "/membros-area");
    expect(screen.queryByText(/Dashboard/)).not.toBeInTheDocument();
  });
});
