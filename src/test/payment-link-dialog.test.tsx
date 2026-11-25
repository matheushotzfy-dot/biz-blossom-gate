import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { PaymentLinkDialog } from "@/features/payment-links/PaymentLinkDialog";
import { paymentLinkToDraft, toLocalInput, type PaymentLink } from "@/features/payment-links/types";
import { maskBRL, parseBRL, toMaskedBRL } from "@/components/seller-ui/money";

const perms = { accept_pix: true, accept_card: true, accept_boleto: false };

function open(over: Partial<Parameters<typeof PaymentLinkDialog>[0]> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  render(<PaymentLinkDialog open busy={false} permissions={perms} editing={null} onOpenChange={onOpenChange} onSubmit={onSubmit} {...over} />);
  return { onSubmit, onOpenChange };
}
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const publish = async () => { await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Publicar link|Salvar alterações/ })); }); };

describe("máscara de valor", () => {
  it("empurra os centavos e volta para número", () => {
    expect(maskBRL("45000")).toBe("450,00");
  });
});

describe("expiração no horário local", () => {
  it("ISO vira o valor local do campo e não UTC", () => {
    const local = new Date(2026, 11, 1, 15, 30);
    expect(toLocalInput(local.toISOString())).toBe("2026-12-01T15:30");
  });
  it("editar e salvar sem mexer não desloca a validade", () => {
    const iso = new Date(2026, 11, 1, 21, 45).toISOString();
    const draft = paymentLinkToDraft({ amount: 450, title: "x", slug: "x", expires_at: iso } as unknown as PaymentLink, perms);
    expect(new Date(draft.expires_at).toISOString()).toBe(iso);
    expect(draft.amount).toBe("450,00");
  });
  it("sem data e data inválida ficam vazias", () => {
    expect(toLocalInput(null)).toBe("");
    expect(toLocalInput("lixo")).toBe("");
  });
  it("valor mascarado ida e volta", () => {
    expect(toMaskedBRL(89.9)).toBe("89,90");
    expect(parseBRL(toMaskedBRL(1997))).toBe(1997);
  });
});

describe("PaymentLinkDialog", () => {
  it("mostra o erro em cada campo e não envia", async () => {
    const { onSubmit } = open();
    await publish();
    expect(screen.getByText("Informe um título com pelo menos 3 caracteres")).toBeTruthy();
    expect(screen.getByText("O valor mínimo é R$ 1,00")).toBeTruthy();
    expect(screen.getByLabelText("Título").getAttribute("aria-invalid")).toBe("true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("corrigir o campo tira o erro dele", async () => {
    open();
    await publish();
    type("Título", "Consultoria premium");
    expect(screen.queryByText("Informe um título com pelo menos 3 caracteres")).toBeNull();
    expect(screen.getByText("O valor mínimo é R$ 1,00")).toBeTruthy();
  });

  it("envia valor mascarado, endereço normalizado e o que foi escolhido", async () => {
    const { onSubmit } = open();
    type("Título", "Consultoria Premium Ágil");
    type("Valor", "45000");
    expect((screen.getByLabelText("Valor") as HTMLInputElement).value).toBe("450,00");
    expect(screen.getByText("/pl/consultoria-premium-agil")).toBeTruthy();
    await publish();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [draft, cover] = onSubmit.mock.calls[0];
    expect(draft).toMatchObject({ title: "Consultoria Premium Ágil", amount: "450", slug: "consultoria-premium-agil", accept_pix: true, accept_card: false });
    expect(cover).toBeNull();
  });

  it("método não liberado fica desligado e travado", () => {
    open();
    const boleto = screen.getByRole("switch", { name: "Aceitar Boleto" });
    expect((boleto as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Ainda não liberado para a sua conta")).toBeTruthy();
  });

  it("falha do servidor aparece no próprio diálogo", async () => {
    const { onSubmit } = open();
    onSubmit.mockRejectedValueOnce(new Error("Esse endereço já está em uso"));
    type("Título", "Consultoria");
    type("Valor", "1000");
    await publish();
    expect(await screen.findByText("Esse endereço já está em uso")).toBeTruthy();
  });

  it("Cancelar fecha sem enviar", () => {
    const { onSubmit, onOpenChange } = open();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
