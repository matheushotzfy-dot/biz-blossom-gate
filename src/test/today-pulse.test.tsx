import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TodayPulse, type TodayPulseProps } from "@/components/home/TodayPulse";

const hours = Array.from({ length: 24 }, (_, i) => ({ label: `${i}h`, revenue: 0, orders: 0 }));
const base: TodayPulseProps = { revenue: 0, orders: 0, hours, nowHour: 9, hidden: false, loading: false, onCreateLink: () => {} };

describe("Vendas de hoje", () => {
  it("sem vendas, convida a criar o primeiro link", () => {
    render(<TodayPulse {...base} />);
    expect(screen.getByText("Nenhuma venda paga até agora")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Criar um link de pagamento" })).toBeTruthy();
  });

  it("quando a consulta falha, avisa e deixa tentar de novo — não finge que não vendeu nada", () => {
    const onRetry = vi.fn();
    render(<TodayPulse {...base} error onRetry={onRetry} />);
    expect(screen.getByRole("alert").textContent).toContain("Não foi possível carregar as vendas de hoje");
    expect(screen.queryByText("Nenhuma venda paga até agora")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("carregando, mostra o esqueleto e nenhum valor", () => {
    render(<TodayPulse {...base} loading />);
    expect(screen.queryByText("Nenhuma venda paga até agora")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
