import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NewPlanDialog } from "@/components/subscriptions/NewPlanDialog";
import { planSummary, trialDays, validatePlan } from "@/components/subscriptions/planMeta";
import type { PlanFormValues } from "@/components/subscriptions/types";

const values = (over: Partial<PlanFormValues> = {}): PlanFormValues => ({ name: "Plano Premium", description: "", price: "49,90", interval: "monthly", trial: "0", product: "", ...over });

describe("regras do plano", () => {
  it("aceita um plano completo", () => expect(validatePlan(values())).toEqual({}));
  it("barra nome curto, preço abaixo de R$ 1 e teste fora de 0–365", () => {
    expect(validatePlan(values({ name: " a " })).name).toBeTruthy();
    expect(validatePlan(values({ price: "0,99" })).price).toBeTruthy();
    expect(validatePlan(values({ price: "" })).price).toBeTruthy();
    expect(validatePlan(values({ trial: "366" })).trial).toBeTruthy();
    expect(validatePlan(values({ trial: "-1" })).trial).toBeTruthy();
    expect(validatePlan(values({ trial: "1.5" })).trial).toBeTruthy();
    expect(validatePlan(values({ trial: "" }))).toEqual({});
  });
  it("trialDays limita e arredonda", () => {
    expect(trialDays("")).toBe(0);
    expect(trialDays("7")).toBe(7);
    expect(trialDays("999")).toBe(365);
    expect(trialDays("abc")).toBe(0);
  });
  it("resumo diz preço, intervalo e teste", () => {
    expect(planSummary(values({ price: "" }))).toBe("Defina o preço");
    expect(planSummary(values())).toMatch(/R\$\s49,90 por mês$/);
    expect(planSummary(values({ interval: "yearly", price: "1.200,00", trial: "7" }))).toMatch(/R\$\s1\.200,00 por ano, com 7 dias de teste grátis$/);
    expect(planSummary(values({ trial: "1" }))).toMatch(/1 dia de teste grátis$/);
  });
});

function open(onCreate = vi.fn().mockResolvedValue(true), products = [{ id: "p1", name: "Método Escala 10x" }]) {
  render(<NewPlanDialog open onOpenChange={() => {}} products={products} onCreate={onCreate} />);
  return onCreate;
}
const create = async () => { await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Criar plano" })); }); };

describe("NewPlanDialog", () => {
  it("mostra os erros nos campos e não cria", async () => {
    const onCreate = open();
    await create();
    expect(screen.getByText("Dê um nome ao plano (pelo menos 2 letras).")).toBeTruthy();
    expect(screen.getByText("O preço mínimo é R$ 1,00.")).toBeTruthy();
    expect(onCreate).not.toHaveBeenCalled();
  });
  it("preço mascarado e intervalo escolhido vão para onCreate", async () => {
    const onCreate = open();
    fireEvent.change(screen.getByLabelText("Nome do plano"), { target: { value: "Plano Premium" } });
    fireEvent.change(screen.getByLabelText("Preço"), { target: { value: "199000" } });
    expect((screen.getByLabelText("Preço") as HTMLInputElement).value).toBe("1.990,00");
    fireEvent.click(screen.getByRole("button", { name: "Todo ano" }));
    expect(screen.getByText(/por ano/)).toBeTruthy();
    await create();
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: "Plano Premium", price: "1.990,00", interval: "yearly" }));
  });
  it("sem produtos não mostra o seletor de produto", () => {
    open(undefined, []);
    expect(screen.queryByLabelText("Produto ligado ao plano")).toBeNull();
  });
});
