import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const rpc = vi.fn();
let tableResult: (table: string) => { data: unknown; error: unknown } = () => ({ data: null, error: null });
const chain = (table: string) => {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) c[m] = () => c;
  c.maybeSingle = () => Promise.resolve(tableResult(table));
  c.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(tableResult(table)).then(res, rej);
  return c;
};
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (t: string) => chain(t), functions: { invoke: vi.fn() } } }));

// a confirmação por senha é testada à parte: aqui ela só repassa a descrição e executa a ação
const confirmSpy = vi.fn();
vi.mock("@/features/admin-finance/useSensitiveConfirm", () => ({
  useSensitiveConfirm: () => ({ confirm: (desc: string, action: () => Promise<void>) => { confirmSpy(desc); void action(); }, dialog: null }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import RefundApprovalsTab from "@/features/admin-finance/RefundApprovalsTab";
import StaffRequestsTab from "@/features/admin-finance/StaffRequestsTab";
import { ManualApprovalSettings } from "@/features/admin-finance/ManualApprovalSettings";
import type { Tables } from "@/integrations/supabase/types";

const refundRow = {
  id: "rf1", created_at: "2026-11-24T16:20:00Z", status: "pending_confirmation", amount: 197, debited_amount: 180.5, reason: "Cliente pediu estorno", requested_role: "seller",
  decision_note: null, proof_ref: null, decided_at: null, transaction_id: "8f2a1c9e-0000-4000-8000-000000000001", tx_amount: 197, payment_method: "pix",
  customer_name: "Ana Souza", customer_email: "ana@exemplo.com", seller_name: "Marina Duarte", seller_email: "marina@exemplo.com",
};
const wrap = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

beforeEach(() => { rpc.mockReset(); confirmSpy.mockReset(); tableResult = () => ({ data: null, error: null }); });

describe("Pendentes de aprovação (reembolsos)", () => {
  const listReply = (rows: unknown[], total = rows.length) => rpc.mockImplementation((name: string) => {
    if (name === "admin_list_refund_requests") return Promise.resolve({ data: { total, rows }, error: null });
    return Promise.resolve({ data: null, error: null });
  });

  it("mostra seller, comprador, valores e quantos esperam o dono", async () => {
    listReply([refundRow]);
    wrap(<RefundApprovalsTab />);
    expect(await screen.findByText("Marina Duarte")).toBeInTheDocument();
    expect(screen.getByText("marina@exemplo.com")).toBeInTheDocument();
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("1 aguardando você")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*180,50/)).toBeInTheDocument(); // descontado do seller
  });

  it("se a lista não carrega, avisa e deixa tentar de novo (nunca finge que a fila está vazia)", async () => {
    rpc.mockImplementation(() => Promise.resolve({ data: null, error: { message: "not authorized" } }));
    wrap(<RefundApprovalsTab />);
    expect(await screen.findByText("Não foi possível carregar os reembolsos.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum reembolso esperando você")).toBeNull();
    listReply([refundRow]);
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Marina Duarte")).toBeInTheDocument();
  });

  it("'Não efetivada' exige motivo; com motivo devolve o saldo e recarrega a fila", async () => {
    listReply([refundRow]);
    wrap(<RefundApprovalsTab />);
    fireEvent.click(await screen.findByRole("button", { name: /Não efetivada/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Motivo \(obrigatório\)/), { target: { value: "abc" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Continuar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("pelo menos 5 caracteres");
    expect(rpc.mock.calls.some((c) => c[0] === "admin_decide_refund")).toBe(false);

    fireEvent.change(within(dialog).getByLabelText(/Motivo \(obrigatório\)/), { target: { value: "Estorno não saiu do banco" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("admin_decide_refund", { _request_id: "rf1", _outcome: "reverted", _note: "Estorno não saiu do banco", _proof: undefined }));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("volta ao saldo do seller"));
    await waitFor(() => expect(rpc.mock.calls.filter((c) => c[0] === "admin_list_refund_requests").length).toBeGreaterThan(1));
  });

  it("'Devolução efetivada' leva o comprovante e não exige motivo", async () => {
    listReply([refundRow]);
    wrap(<RefundApprovalsTab />);
    fireEvent.click(await screen.findByRole("button", { name: /Devolução efetivada/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Comprovante/), { target: { value: "E2026112012345" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("admin_decide_refund", { _request_id: "rf1", _outcome: "confirmed", _note: undefined, _proof: "E2026112012345" }));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("foi devolvido ao comprador"));
  });

  it("se outra pessoa já decidiu, fecha o diálogo e atualiza a fila", async () => {
    rpc.mockImplementation((name: string) => {
      if (name === "admin_list_refund_requests") return Promise.resolve({ data: { total: 1, rows: [refundRow] }, error: null });
      if (name === "admin_decide_refund") return Promise.resolve({ data: null, error: { message: "pedido já decidido" } });
      return Promise.resolve({ data: null, error: null });
    });
    wrap(<RefundApprovalsTab />);
    fireEvent.click(await screen.findByRole("button", { name: /Devolução efetivada/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Continuar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(rpc.mock.calls.filter((c) => c[0] === "admin_list_refund_requests").length).toBeGreaterThan(1));
  });

  it("avisa quando há mais pedidos do que a tela mostra", async () => {
    listReply([refundRow], 140);
    wrap(<RefundApprovalsTab />);
    expect(await screen.findByText(/Mostrando os 1 mais recentes de 140/)).toBeInTheDocument();
  });
});

describe("Aprovação manual (interruptores)", () => {
  it("se não consegue ler as regras, não mostra interruptores no escuro", async () => {
    tableResult = () => ({ data: null, error: { message: "boom" } });
    wrap(<ManualApprovalSettings />);
    expect(await screen.findByText("Não foi possível ler as regras atuais.")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).toBeNull();
    tableResult = () => ({ data: null, error: null });
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect((await screen.findAllByRole("switch")).length).toBe(4);
  });

  it("desligar uma regra descreve o que muda e só grava depois da confirmação", async () => {
    tableResult = () => ({ data: { value: { refunds: true, med: true, withdrawals: true, acquirer_auto_intake: false } }, error: null });
    rpc.mockResolvedValue({ data: { refunds: false, med: true, withdrawals: true, acquirer_auto_intake: false }, error: null });
    wrap(<ManualApprovalSettings />);
    fireEvent.click(await screen.findByRole("switch", { name: "Reembolsos manuais" }));
    expect(confirmSpy).toHaveBeenCalledWith('Desligar "Reembolsos manuais". As devoluções deixam de esperar a sua confirmação.');
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("admin_set_manual_approval", { _value: { refunds: false, med: true, withdrawals: true, acquirer_auto_intake: false } }));
  });
});

describe("Pedidos da equipe", () => {
  const profiles = [{ user_id: "u1", full_name: "Rafa Gerente", email: "rafa@exemplo.com" }] as unknown as Tables<"profiles">[];
  const req = (over: Record<string, unknown>) => ({ id: "sr1", kind: "acquirer_change", target_seller_id: null, target_acquirer_id: null, payload: { seller_email: "marina@exemplo.com" }, reason: "Testar outra adquirente",
    requested_by: "u1", requested_role: "manager", status: "pending", decision_note: null, decided_by: null, decided_at: null, created_at: "2026-11-24T14:10:00Z", updated_at: "2026-11-24T14:10:00Z", ...over });

  it("se a lista falha, mostra o erro em vez de 'nenhum pedido'", async () => {
    tableResult = (t) => (t === "staff_action_requests" ? { data: null, error: { message: "boom" } } : { data: [], error: null });
    rpc.mockResolvedValue({ data: [], error: null });
    wrap(<StaffRequestsTab profiles={profiles} />);
    expect(await screen.findByText("Não foi possível carregar os pedidos.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum pedido esperando você")).toBeNull();
  });

  it("explica o que a aprovação faz: troca de adquirente executa; mudança de taxa só registra", async () => {
    tableResult = (t) => (t === "staff_action_requests" ? { data: [req({}), req({ id: "sr2", kind: "fee_change" })], error: null } : { data: null, error: null });
    rpc.mockResolvedValue({ data: [], error: null });
    wrap(<StaffRequestsTab profiles={profiles} />);
    expect(await screen.findByText("Ao aprovar, a mudança é feita na hora.")).toBeInTheDocument();
    expect(screen.getByText(/só registramos a sua decisão/)).toBeInTheDocument();
    expect(screen.getAllByText(/Rafa Gerente/).length).toBe(2);
  });

  it("recusar sem motivo mostra o aviso ali mesmo e não chama o banco; com motivo, recusa", async () => {
    tableResult = (t) => (t === "staff_action_requests" ? { data: [req({})], error: null } : { data: null, error: null });
    rpc.mockImplementation((name: string) => Promise.resolve({ data: name === "admin_decide_staff_action" ? { status: "rejected" } : [], error: null }));
    wrap(<StaffRequestsTab profiles={profiles} />);
    fireEvent.click(await screen.findByRole("button", { name: "Recusar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("pelo menos 5 caracteres");
    expect(rpc.mock.calls.some((c) => c[0] === "admin_decide_staff_action")).toBe(false);

    fireEvent.change(screen.getByLabelText(/Observação/), { target: { value: "Sem justificativa" } });
    fireEvent.click(screen.getByRole("button", { name: "Recusar" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("admin_decide_staff_action", { _id: "sr1", _approve: false, _note: "Sem justificativa" }));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("Recusar"));
  });
});
