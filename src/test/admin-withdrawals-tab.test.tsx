import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Res = { data?: unknown; error?: unknown };
const state = {
  auto: { data: [{ id: "aw1", user_id: "s1", enabled: true, max_amount: 500, admin_user_id: "adm1" }] } as Res,
  adjustments: { data: [] } as Res,
  extraProfiles: { data: [] } as Res,
  rejectResults: {} as Record<string, Res>,
};
const updates: { payload: Record<string, unknown>; id?: string }[] = [];
const rpc = vi.fn();

function plain(result: () => Res) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "order", "limit", "in", "eq", "upsert"]) b[m] = () => b;
  b.then = (res: (v: Res) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej);
  return b;
}
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: (table: string) => {
      if (table === "seller_auto_withdraw") return plain(() => state.auto);
      if (table === "balance_adjustments") return plain(() => state.adjustments);
      if (table === "profiles") return plain(() => state.extraProfiles);
      if (table === "withdrawals") {
        return {
          update: (payload: Record<string, unknown>) => {
            const rec: { payload: Record<string, unknown>; id?: string } = { payload };
            updates.push(rec);
            const c: Record<string, unknown> = {};
            c.eq = (col: string, val: string) => { if (col === "id") rec.id = val; return c; };
            c.select = () => c;
            c.then = (res: (v: Res) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(state.rejectResults[rec.id ?? ""] ?? { data: [{ id: rec.id }], error: null }).then(res, rej);
            return c;
          },
        };
      }
      return plain(() => ({ data: [] }));
    },
    storage: { from: () => ({ upload: vi.fn(), createSignedUrl: vi.fn() }) },
  },
}));
const confirmSpy = vi.fn();
vi.mock("@/features/admin-finance/useSensitiveConfirm", () => ({
  useSensitiveConfirm: () => ({ confirm: (d: string, a: () => Promise<void>) => { confirmSpy(d); void a(); }, dialog: null }),
}));
const askReason = vi.fn();
vi.mock("@/components/seller-ui/confirm", () => ({ useReason: () => ({ ask: askReason, dialog: null }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "adm1" } }) }));
const logAdminAction = vi.fn();
vi.mock("@/lib/auditLog", () => ({ logAdminAction: (...a: unknown[]) => logAdminAction(...a) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock("@/features/admin-finance/SellerSelect", () => ({
  SellerSelect: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <input aria-label="Seller" value={value} onChange={(e) => onChange(e.target.value)} />,
}));

import { toast } from "sonner";
import AdminWithdrawalsTab from "@/pages/admin/tabs/AdminWithdrawalsTab";
import type { Tables } from "@/integrations/supabase/types";

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const wd = (id: string, user_id: string, status: string, amount: number, minutesAgo: number, extra: Record<string, unknown> = {}) =>
  ({ id, user_id, status, amount, fee_amount: 5, net_amount: amount - 5, created_at: ago(minutesAgo), withdrawal_type: "pix", origin: "manual", processed_by: null, processed_at: null, payment_proof_url: null, rejection_reason: null, failure_code: null, ...extra }) as unknown as Tables<"withdrawals">;
const prof = (user_id: string, full_name: string, ageDays: number) => ({ user_id, full_name, email: `${full_name.split(" ")[0].toLowerCase()}@exemplo.com`, created_at: ago(ageDays * 1440), seller_type: null }) as unknown as Tables<"profiles">;

const profiles = [prof("s1", "Marina Duarte", 200), prof("s2", "Rafael Souza", 5), prof("adm1", "Admin Teste", 900)];
const withdrawals = [
  wd("w-new", "s1", "pending", 480, 30),
  wd("w-old", "s2", "pending", 62000, 60 * 50),
  wd("w-mid", "s1", "pending", 1200, 60 * 6),
  wd("w-done", "s1", "approved", 2300, 60 * 72, { processed_by: "adm1", processed_at: ago(60 * 70) }),
];

const onReload = vi.fn();
function renderTab(w = withdrawals, p = profiles) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AdminWithdrawalsTab withdrawals={w} profiles={p} onReload={onReload} /></QueryClientProvider>);
}
const table = () => screen.getByRole("table");
const bodyRows = () => within(table()).getAllByRole("row").slice(1);

beforeEach(() => {
  updates.length = 0;
  state.auto = { data: [{ id: "aw1", user_id: "s1", enabled: true, max_amount: 500, admin_user_id: "adm1" }] };
  state.adjustments = { data: [] };
  state.extraProfiles = { data: [] };
  state.rejectResults = {};
  rpc.mockReset(); confirmSpy.mockReset(); askReason.mockReset(); logAdminAction.mockReset(); onReload.mockReset();
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear(); vi.mocked(toast.warning).mockClear();
});

describe("fila de saques", () => {
  it("pendentes aparecem do mais antigo para o mais novo, com alertas de risco", () => {
    renderTab();
    const rows = bodyRows();
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Rafael Souza");
    expect(rows[0]).toHaveTextContent("Seller novo");
    expect(rows[0]).toHaveTextContent("Valor alto");
    expect(rows[1]).toHaveTextContent("Marina Duarte");
    expect(rows[2]).toHaveTextContent("Marina Duarte");
    expect(within(rows[1]).queryByText("Seller novo")).toBeNull();
  });

  it("avisa que aprovar está desligado e não oferece botão de aprovar", () => {
    renderTab();
    expect(screen.getByRole("note")).toHaveTextContent("Aprovar saque está desligado");
    expect(screen.queryByRole("button", { name: /aprovar/i })).toBeNull();
  });

  it("seller fora da lista carregada: busca o perfil em vez de tratar como desconhecido para sempre", async () => {
    state.extraProfiles = { data: [{ user_id: "s3", full_name: "Paulo Antigo", email: "paulo@exemplo.com", created_at: ago(400 * 1440), seller_type: null }] };
    renderTab([wd("w3", "s3", "pending", 300, 10)], profiles);
    expect((await screen.findAllByText("Paulo Antigo")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Perfil não carregado")).toBeNull();
  });

  it("sem perfil nenhum, sinaliza como alerta em vez de esconder", () => {
    state.extraProfiles = { error: { message: "boom" } };
    renderTab([wd("w3", "s3", "pending", 300, 10)], profiles);
    expect(screen.getAllByText("Perfil não carregado").length).toBeGreaterThan(0);
  });

  it("sem pendentes, explica e leva ao histórico", () => {
    renderTab([wd("w-done", "s1", "approved", 100, 60)]);
    expect(screen.getByText("Nenhum saque está esperando. O histórico está em “Todos”.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver todos os saques" }));
    expect(within(table()).getAllByRole("row")).toHaveLength(2);
  });
});

describe("recusar", () => {
  it("um saque: pede motivo, grava com quem recusou e audita", async () => {
    askReason.mockResolvedValue("Chave Pix em nome de terceiros");
    renderTab();
    fireEvent.click(within(bodyRows()[0]).getByRole("button", { name: /Recusar/ }));
    await waitFor(() => expect(onReload).toHaveBeenCalled());
    expect(updates).toEqual([{ id: "w-old", payload: { status: "rejected", rejection_reason: "Chave Pix em nome de terceiros", processed_by: "adm1" } }]);
    expect(logAdminAction).toHaveBeenCalledWith("reject_withdrawal", "withdrawal", "w-old", { reason: "Chave Pix em nome de terceiros", method: "single" });
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("1 saque recusado"));
  });

  it("cancelar o motivo não mexe em nada", async () => {
    askReason.mockResolvedValue(null);
    renderTab();
    fireEvent.click(within(bodyRows()[0]).getByRole("button", { name: /Recusar/ }));
    await waitFor(() => expect(askReason).toHaveBeenCalled());
    expect(updates).toHaveLength(0);
    expect(onReload).not.toHaveBeenCalled();
  });

  it("em lote: conta o que foi recusado, o que outra pessoa já tinha processado e o que deu erro", async () => {
    askReason.mockResolvedValue("Em análise de risco");
    state.rejectResults = { "w-mid": { data: [], error: null }, "w-new": { data: null, error: { message: "boom" } } };
    renderTab();
    for (const row of bodyRows()) fireEvent.click(within(row).getByRole("checkbox"));
    expect(screen.getByText("3 selecionados")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Recusar selecionados/ }));
    await waitFor(() => expect(toast.warning).toHaveBeenCalled());
    const text = vi.mocked(toast.warning).mock.calls[0][0] as string;
    expect(text).toContain("1 saque recusado");
    expect(text).toContain("1 já tinha sido processado por outra pessoa");
    expect(text).toContain("1 com erro");
    expect(logAdminAction).toHaveBeenCalledTimes(1);
    expect(logAdminAction).toHaveBeenCalledWith("reject_withdrawal", "withdrawal", "w-old", { reason: "Em análise de risco", method: "batch" });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("se nenhum saque foi recusado, é erro e não sucesso", async () => {
    askReason.mockResolvedValue("Em análise de risco");
    state.rejectResults = { "w-old": { data: null, error: { message: "boom" } } };
    renderTab();
    fireEvent.click(within(bodyRows()[0]).getByRole("button", { name: /Recusar/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
    expect(logAdminAction).not.toHaveBeenCalled();
  });
});

describe("ajuste de saldo", () => {
  const open = () => { renderTab(); fireEvent.click(screen.getByRole("button", { name: "Ajuste de saldo" })); };

  it("valida seller, valor e motivo antes de pedir a senha", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Escolha o seller.");
    fireEvent.change(screen.getByLabelText("Seller"), { target: { value: "s1" } });
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o valor em reais");
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "150,00" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("pelo menos 5 caracteres");
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("confirma com valor e seller, aplica e atualiza a tela", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    open();
    fireEvent.change(screen.getByLabelText("Seller"), { target: { value: "s1" } });
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "1.234,50" } });
    fireEvent.change(screen.getByLabelText("Motivo (obrigatório)"), { target: { value: "Compensação de chargeback indevido" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("admin_request_balance_adjustment", { _user_id: "s1", _type: "credit", _amount: 1234.5, _reason: "Compensação de chargeback indevido" }));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("Creditar"));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("Marina Duarte"));
    await waitFor(() => expect(onReload).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Crédito de"));
  });

  it("erro do banco aparece no formulário e o diálogo continua aberto", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Saldo insuficiente para este débito" } });
    open();
    fireEvent.click(screen.getByRole("button", { name: /Débito/ }));
    fireEvent.change(screen.getByLabelText("Seller"), { target: { value: "s1" } });
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "90" } });
    fireEvent.change(screen.getByLabelText("Motivo (obrigatório)"), { target: { value: "Correção de lançamento" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Saldo insuficiente para este débito")).toBeInTheDocument();
    expect(onReload).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("ajustes e extrato", () => {
  it("falha ao carregar ajustes não vira lista vazia: mostra o erro e deixa tentar de novo", async () => {
    state.adjustments = { error: { message: "boom" } };
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Ajustes de saldo" }));
    expect(await screen.findByText("Não foi possível carregar os ajustes.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum ajuste ainda")).toBeNull();
    state.adjustments = { data: [{ id: "a1", user_id: "s1", amount: 50, type: "credit", reason: "Compensação", admin_user_id: "adm1", created_at: ago(60) }] };
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Crédito para Marina Duarte")).toBeInTheDocument();
    expect(screen.getByText(/feito por Admin Teste/)).toBeInTheDocument();
  });

  it("extrato: saque aprovado sai, taxa entra, e avisa quando os ajustes não carregaram", async () => {
    state.adjustments = { error: { message: "boom" } };
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Extrato" }));
    expect(screen.getByText("Saque aprovado")).toBeInTheDocument();
    expect(screen.getByText("-R$ 2.295,00")).toBeInTheDocument();
    expect(screen.getByText("+R$ 5,00")).toBeInTheDocument();
    expect(await screen.findByText(/o extrato está incompleto sem eles/)).toBeInTheDocument();
  });
});
