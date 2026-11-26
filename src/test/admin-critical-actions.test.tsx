import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";

/**
 * Ações do admin que mexem em acesso e dinheiro e antes não tinham teste: aprovar/recusar o cadastro (KYC) de um
 * seller e ajustar saldo / decidir pedido de ajuste. O que se confere aqui é o que o banco recebe, o que a tela
 * barra antes de enviar e que um segundo clique não repete a ação (cada uma notifica o seller ou mexe no saldo).
 */

const rpc = vi.fn();
let pendingRows: unknown[] = [];
vi.mock("@/integrations/supabase/client", () => {
  const chain: Record<string, unknown> = {};
  for (const k of ["select", "eq", "order", "in", "gte", "lte"]) chain[k] = () => chain;
  chain.limit = () => Promise.resolve({ data: pendingRows, error: null });
  return { supabase: { rpc: (...a: unknown[]) => rpc(...a), from: () => chain, channel: () => ({ on: () => ({ subscribe: () => ({}) }) }), removeChannel: vi.fn() } };
});
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
// a confirmação com senha tem teste próprio; aqui ela só repassa a ação
vi.mock("@/features/admin-finance/useSensitiveConfirm", () => ({
  useSensitiveConfirm: () => ({ confirm: (_d: string, run: () => Promise<void> | void) => { void run(); }, dialog: null }),
}));

import { toast } from "sonner";
import { BalanceAdjustCard } from "@/features/admin-finance/BalanceAdjustCard";
import { managerForApproval, MIN_KYC_REASON, useKycDecision } from "@/features/admin-finance/useKycDecision";

const calls = (name: string) => rpc.mock.calls.filter((c) => c[0] === name).map((c) => c[1] as Record<string, unknown>);

beforeEach(() => {
  rpc.mockReset();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  pendingRows = [];
  rpc.mockResolvedValue({ data: null, error: null });
});

describe("useKycDecision", () => {
  const setup = (enabled = true) => {
    const onDone = vi.fn();
    const hook = renderHook(() => useKycDecision({ enabled, onDone }));
    return { onDone, hook };
  };

  it("gerente padrão e 'sem gerente' mandam nulo; um gerente escolhido manda o id", () => {
    expect(managerForApproval("default")).toBeNull();
    expect(managerForApproval("none")).toBeNull();
    expect(managerForApproval("m-1")).toBe("m-1");
  });

  it("aprova com os nomes certos de parâmetro e avisa o painel", async () => {
    const { onDone, hook } = setup();
    let ok = false;
    await act(async () => { ok = await hook.result.current.approve("s-1", "m-9"); });
    expect(ok).toBe(true);
    expect(calls("admin_approve_seller_with_manager")).toEqual([{ _seller: "s-1", _manager: "m-9" }]);
    expect(toast.success).toHaveBeenCalledWith("KYC aprovado e carteira atribuída.");
    expect(onDone).toHaveBeenCalledWith("s-1", "approved");
  });

  it("'sem gerente' aprova sem gerente e diz isso", async () => {
    const { hook } = setup();
    await act(async () => { await hook.result.current.approve("s-1", "none"); });
    expect(calls("admin_approve_seller_with_manager")).toEqual([{ _seller: "s-1", _manager: null }]);
    expect(toast.success).toHaveBeenCalledWith("KYC aprovado sem gerente.");
  });

  it("dois cliques seguidos em Aprovar mandam uma única vez", async () => {
    let release: (v: { data: null; error: null }) => void = () => {};
    rpc.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    const { hook } = setup();
    let first: Promise<boolean> = Promise.resolve(false);
    let second = true;
    await act(async () => {
      first = hook.result.current.approve("s-1", "default");
      second = await hook.result.current.approve("s-1", "default");
    });
    expect(second).toBe(false);
    await act(async () => { release({ data: null, error: null }); await first; });
    expect(calls("admin_approve_seller_with_manager")).toHaveLength(1);
    expect(hook.result.current.busy).toBe(false);
  });

  it("falha do banco mostra o erro, não avisa o painel e libera o botão", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "not authorized" } });
    const { onDone, hook } = setup();
    let ok = true;
    await act(async () => { ok = await hook.result.current.approve("s-1", "default"); });
    expect(ok).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Você não tem permissão para esta ação.");
    expect(hook.result.current.busy).toBe(false);
  });

  it("recusar exige motivo de verdade e manda o texto sem espaços nas pontas", async () => {
    const { onDone, hook } = setup();
    await act(async () => { await hook.result.current.reject("s-1", "  ok "); });
    expect(rpc).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(`Explique o motivo da recusa em pelo menos ${MIN_KYC_REASON} caracteres`);
    await act(async () => { await hook.result.current.reject("s-1", "  Documento ilegível, refaça a foto  "); });
    expect(calls("admin_reject_kyc")).toEqual([{ _user_id: "s-1", _reason: "Documento ilegível, refaça a foto" }]);
    expect(onDone).toHaveBeenCalledWith("s-1", "rejected");
  });

  it("erro ao recusar não fecha o popup (não chama onDone) e usa o texto do banco", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "not authorized" } });
    const { onDone, hook } = setup();
    let ok = true;
    await act(async () => { ok = await hook.result.current.reject("s-1", "Nome diferente do documento"); });
    expect(ok).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Você não tem permissão para esta ação.");
  });

  it("quem não é admin não chama nada", async () => {
    const { hook } = setup(false);
    await act(async () => { await hook.result.current.approve("s-1", "default"); await hook.result.current.reject("s-1", "Motivo qualquer válido"); });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("BalanceAdjustCard", () => {
  // o cartão lê os pedidos pendentes ao abrir: espera essa leitura terminar antes de mexer
  const renderCard = async (onDone: () => void = () => {}) => {
    const view = render(<BalanceAdjustCard userId="s-1" onDone={onDone} />);
    await act(async () => { await Promise.resolve(); });
    return view;
  };
  const fill = (amount: string, reason: string) => {
    fireEvent.change(screen.getByLabelText("Valor do ajuste"), { target: { value: amount } });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: reason } });
  };

  it("crédito válido: aceita vírgula e ponto de milhar e manda o valor certo", async () => {
    const onDone = vi.fn();
    await renderCard(onDone);
    fill("1.500,50", "Compensação de estorno indevido");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    await waitFor(() => expect(calls("admin_request_balance_adjustment")).toHaveLength(1));
    expect(calls("admin_request_balance_adjustment")[0]).toEqual({ _user_id: "s-1", _type: "credit", _amount: 1500.5, _reason: "Compensação de estorno indevido" });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("débito manda o tipo certo", async () => {
    await renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Debitar" }));
    fill("20", "Cobrança de taxa extra combinada");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    await waitFor(() => expect(calls("admin_request_balance_adjustment")).toHaveLength(1));
    expect(calls("admin_request_balance_adjustment")[0]).toMatchObject({ _type: "debit", _amount: 20 });
  });

  it("'1.500' sem vírgula NÃO vira R$ 1,50: o ajuste é barrado", async () => {
    await renderCard();
    fill("1.500", "Compensação de estorno indevido");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    expect(rpc).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Informe o valor em reais, por exemplo 150,00.");
  });

  it("barra valor zero, acima do teto e motivo curto", async () => {
    await renderCard();
    const send = () => fireEvent.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    fill("0", "Motivo suficiente"); send();
    fill("2.000.000,00", "Motivo suficiente"); send();
    fill("10", "abc"); send();
    expect(rpc).not.toHaveBeenCalled();
    expect(vi.mocked(toast.error).mock.calls.map((c) => c[0])).toEqual([
      "O valor precisa ser maior que zero.",
      "O valor máximo por ajuste é R$ 1.000.000,00.",
      "Explique o motivo em pelo menos 5 caracteres.",
    ]);
  });

  it("pedido da equipe: aprovar manda os nomes certos e o segundo clique é ignorado", async () => {
    pendingRows = [{ id: "r-1", type: "debit", amount: 75, reason: "Estorno duplicado", created_at: new Date().toISOString() }];
    let release: (v: { data: null; error: null }) => void = () => {};
    rpc.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    await renderCard();
    const approve = await screen.findByRole("button", { name: /Aprovar débito de/ });
    fireEvent.click(approve);
    fireEvent.click(approve);
    expect(calls("admin_decide_balance_adjustment")).toEqual([{ _request_id: "r-1", _approve: true }]);
    await act(async () => { release({ data: null, error: null }); });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Ajuste aprovado"));
  });

  it("pedido da equipe: recusar manda _approve falso", async () => {
    pendingRows = [{ id: "r-2", type: "credit", amount: 10, reason: "Bônus", created_at: new Date().toISOString() }];
    await renderCard();
    fireEvent.click(await screen.findByRole("button", { name: /Recusar crédito de/ }));
    await waitFor(() => expect(calls("admin_decide_balance_adjustment")).toEqual([{ _request_id: "r-2", _approve: false }]));
  });
});
