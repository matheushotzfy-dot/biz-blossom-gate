import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { ConfirmDialog, useConfirm, useReason } from "@/components/seller-ui/confirm";
import { ChoiceGrid, DialogBody, DialogFoot } from "@/components/seller-ui/form";

describe("ConfirmDialog", () => {
  it("confirma sem fechar sozinho e mostra o título e o texto", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(<ConfirmDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} title="Remover este link?" description="Ele deixa de existir." confirmLabel="Remover link" />);
    expect(screen.getByText("Remover este link?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remover link" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("ocupado: trava os dois botões e não fecha por Esc", () => {
    const onOpenChange = vi.fn();
    render(<ConfirmDialog open busy onOpenChange={onOpenChange} onConfirm={() => {}} title="Apagar?" />);
    expect((screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /Aguarde/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("Cancelar pede para fechar", () => {
    const onOpenChange = vi.fn();
    render(<ConfirmDialog open onOpenChange={onOpenChange} onConfirm={() => {}} title="Apagar?" cancelLabel="Manter" />);
    fireEvent.click(screen.getByRole("button", { name: "Manter" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

function ConfirmHarness({ onDone }: { onDone: (v: boolean) => void }) {
  const { ask, dialog } = useConfirm();
  return <>{dialog}<button onClick={() => { void ask({ title: "Excluir este gasto?", confirmLabel: "Excluir gasto" }).then(onDone); }}>abrir</button></>;
}

describe("useConfirm (no lugar de window.confirm)", () => {
  it("resolve true ao confirmar", async () => {
    const done = vi.fn();
    render(<ConfirmHarness onDone={done} />);
    fireEvent.click(screen.getByText("abrir"));
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Excluir gasto" })); });
    expect(done).toHaveBeenCalledWith(true);
  });
  it("resolve false ao cancelar", async () => {
    const done = vi.fn();
    render(<ConfirmHarness onDone={done} />);
    fireEvent.click(screen.getByText("abrir"));
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Cancelar" })); });
    expect(done).toHaveBeenCalledWith(false);
  });
});

function ReasonHarness({ onDone, min = 5 }: { onDone: (v: string | null) => void; min?: number }) {
  const { ask, dialog } = useReason();
  return <>{dialog}<button onClick={() => { void ask({ title: "Motivo da recusa", minLength: min, confirmLabel: "Recusar" }).then(onDone); }}>abrir</button></>;
}

describe("useReason (no lugar de window.prompt)", () => {
  it("barra texto curto e devolve o motivo sem espaços nas pontas", async () => {
    const done = vi.fn();
    render(<ReasonHarness onDone={done} />);
    fireEvent.click(screen.getByText("abrir"));
    const box = await screen.findByLabelText("Motivo");
    fireEvent.change(box, { target: { value: "abc" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Recusar" })); });
    expect(screen.getByText("Escreva pelo menos 5 caracteres.")).toBeTruthy();
    expect(done).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: "  documento ilegível  " } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Recusar" })); });
    expect(done).toHaveBeenCalledWith("documento ilegível");
  });
  it("cancelar devolve null", async () => {
    const done = vi.fn();
    render(<ReasonHarness onDone={done} />);
    fireEvent.click(screen.getByText("abrir"));
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Cancelar" })); });
    expect(done).toHaveBeenCalledWith(null);
  });
  it("um segundo pedido abre com o campo vazio", async () => {
    const done = vi.fn();
    render(<ReasonHarness onDone={done} min={1} />);
    fireEvent.click(screen.getByText("abrir"));
    fireEvent.change(await screen.findByLabelText("Motivo"), { target: { value: "primeiro" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Recusar" })); });
    fireEvent.click(screen.getByText("abrir"));
    expect(((await screen.findByLabelText("Motivo")) as HTMLTextAreaElement).value).toBe("");
  });
});

function ChoiceHarness() {
  const [v, setV] = useState<"corrente" | "poupanca">("corrente");
  return <ChoiceGrid label="Tipo de conta" value={v} onChange={setV} options={[{ value: "corrente", label: "Conta corrente" }, { value: "poupanca", label: "Poupança" }]} />;
}

describe("ChoiceGrid", () => {
  it("é um radiogroup com um item marcado por vez", () => {
    render(<ChoiceHarness />);
    const [a, b] = screen.getAllByRole("radio");
    expect(a.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(b);
    expect(a.getAttribute("aria-checked")).toBe("false");
    expect(b.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radiogroup", { name: "Tipo de conta" })).toBeTruthy();
  });
});

describe("DialogFoot", () => {
  it("com resumo à esquerda, os botões ficam à direita", () => {
    render(<DialogFoot lead={<p>R$ 49,90 por mês</p>}><button>Criar</button></DialogFoot>);
    expect(screen.getByText("R$ 49,90 por mês")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Criar" })).toBeTruthy();
  });
  it("DialogBody rola e DialogFoot não (estrutura que mantém o rodapé fixo)", () => {
    const { container } = render(<><DialogBody>x</DialogBody><DialogFoot>y</DialogFoot></>);
    expect(container.firstElementChild?.className).toMatch(/overflow-y-auto/);
    expect(container.lastElementChild?.className).toMatch(/shrink-0/);
  });
});
