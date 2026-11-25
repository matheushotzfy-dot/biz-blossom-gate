import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Res = { data?: unknown; error?: unknown };
const rpc = vi.fn();
const invoke = vi.fn();
const upserts: Record<string, unknown>[] = [];
const state = { perms: { data: [] } as Res, upsert: { error: null } as { error: unknown } };
function plain(result: () => Res) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "order", "limit", "in", "eq"]) b[m] = () => b;
  b.then = (res: (v: Res) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej);
  return b;
}
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    auth: { getUser: async () => ({ data: { user: { id: "adm1" } } }) },
    from: (t: string) => (t === "financial_role_permissions"
      ? { ...plain(() => state.perms), upsert: async (row: Record<string, unknown>) => { upserts.push(row); return state.upsert; } }
      : plain(() => ({ data: [] }))),
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
const confirmSpy = vi.fn();
vi.mock("@/features/admin-finance/useSensitiveConfirm", () => ({
  useSensitiveConfirm: () => ({ confirm: (d: string, a: () => Promise<void>) => { confirmSpy(d); void a(); }, dialog: null }),
}));
vi.mock("@/features/admin-finance/SellerSelect", () => ({
  SellerSelect: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <input aria-label="Seller" value={value} onChange={(e) => onChange(e.target.value)} />,
}));

import { toast } from "sonner";
import FinancialAuditTab from "@/features/admin-finance/FinancialAuditTab";
import { validateAnalysis } from "@/features/admin-finance/SellerRiskAnalysis";
import { actionLabel, auditCsv, parseAuditPage, who, type AuditRow } from "@/features/admin-finance/auditModel";
import type { Tables } from "@/integrations/supabase/types";

const profiles = [{ user_id: "s1", full_name: "Marina Duarte", email: "marina@exemplo.com" }] as unknown as Tables<"profiles">[];
const row = (i: number, over: Partial<AuditRow> = {}): AuditRow => ({ id: `r${i}`, created_at: "2026-11-20T15:00:00Z", action: "ajuste_credito", actor_role: "admin", actor_name: "Lucker", actor_email: null, seller_name: "Marina Duarte", seller_email: "marina@exemplo.com", reason: `motivo ${i}`, amount: 100 + i, balance_before: 10, balance_after: 110, ...over });
const summary = { total: 9, ajuste: 4, reembolso: 2, chargeback: 1, disputa: 2 };
const pageOf = (rows: AuditRow[], total = rows.length) => ({ rows, total, summary });
const lastHist = () => [...rpc.mock.calls].reverse().find((c) => c[0] === "get_financial_action_history")?.[1] as Record<string, unknown>;

describe("auditModel", () => {
  it("rótulos em português e ação desconhecida não vaza texto técnico", () => {
    expect(actionLabel("ajuste_debito")).toBe("Ajuste de saldo: débito");
    expect(actionLabel("coisa_nova")).toBe("Ação registrada");
    expect(who({ actor_name: null, actor_email: "a@b.com", actor_role: "admin" })).toBe("a@b.com");
    expect(who({ actor_name: null, actor_email: null, actor_role: "sistema" })).toBe("Sistema");
  });
  it("csv: BOM, ponto e vírgula, vírgula decimal e fórmula neutralizada", () => {
    const csv = auditCsv([row(1, { reason: "=HYPERLINK(\"x\")", amount: 1234.5 })], () => "20/11/2026 às 12:00");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("\"'=HYPERLINK");
    expect(csv).toContain("\"1234,50\"");
    expect(csv.split("\r\n")).toHaveLength(2);
  });
  it("página inesperada vira erro", () => { expect(() => parseAuditPage({})).toThrow(); });
  it("análise por IA valida seller e período antes de chamar", () => {
    expect(validateAnalysis("", "2026-11-01", "2026-11-20").error).toContain("seller");
    expect(validateAnalysis("s1", "2026-11-20", "2026-11-01").error).toContain("final");
    expect(validateAnalysis("s1", "2025-01-01", "2026-11-20").error).toContain("1 ano");
    expect(validateAnalysis("s1", "2026-11-01", "2026-11-20").error).toBeNull();
  });
});

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><FinancialAuditTab profiles={profiles} /></QueryClientProvider>);
}
const goto = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

beforeEach(() => {
  rpc.mockReset(); invoke.mockReset(); confirmSpy.mockClear(); upserts.length = 0;
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear(); vi.mocked(toast.warning).mockClear();
  state.perms = { data: [{ role: "manager", permission: "balance_adjust_request", allowed: true }, { role: "employee", permission: "balance_adjust_request", allowed: false }] };
  state.upsert = { error: null };
  rpc.mockResolvedValue({ data: pageOf([row(1), row(2, { action: "reembolso", actor_role: "sistema", actor_name: null })], 9), error: null });
});

describe("Histórico", () => {
  it("contagens vêm do banco, período usa o dia de Brasília e rótulos em português", async () => {
    renderTab();
    await screen.findAllByText("Ajuste de saldo: crédito");
    expect(screen.getByRole("button", { name: /Ajustes de saldo · 4/ })).toBeTruthy();
    const a = lastHist();
    expect(String(a._from)).toMatch(/T0[2-3]:00:00\.000Z$/); // meia-noite de Brasília = 03:00 UTC
    expect(a._limit).toBe(50);
    expect(a._offset).toBe(0);
  });

  it("filtro de grupo vai ao banco e volta para a primeira página", async () => {
    renderTab();
    await screen.findAllByText("Ajuste de saldo: crédito");
    fireEvent.click(screen.getByRole("button", { name: /Reembolsos · 2/ }));
    await waitFor(() => expect(lastHist()._action).toBe("reembolso"));
  });

  it("período invertido mostra o aviso e não consulta com datas ruins", async () => {
    renderTab();
    await screen.findAllByText("Ajuste de saldo: crédito");
    const before = rpc.mock.calls.length;
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-12-30" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("A data final precisa ser igual ou depois da inicial.");
    expect(rpc.mock.calls.length).toBe(before);
  });

  it("erro do banco não vira 'nenhuma ação' e permite tentar de novo", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    renderTab();
    expect(await screen.findByText("Não foi possível carregar o histórico.")).toBeTruthy();
    expect(screen.queryByText("Nenhuma ação neste filtro")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    await screen.findAllByText("Ajuste de saldo: crédito");
  });

  it("vazio explica; exportar vazio avisa", async () => {
    rpc.mockResolvedValue({ data: pageOf([], 0), error: null });
    renderTab();
    expect(await screen.findByText("Nenhuma ação neste filtro")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Exportar CSV/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não há ações para exportar."));
  });

  it("exporta todas as páginas do filtro e conta o que baixou", async () => {
    const createUrl = vi.fn(() => "blob:x");
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    rpc.mockImplementation(async (_n: string, a: { _limit: number; _offset: number }) => ({
      data: pageOf(Array.from({ length: Math.min(a._limit, 450 - a._offset) }, (_, i) => row(a._offset + i)), 450), error: null,
    }));
    renderTab();
    await screen.findAllByText("Ajuste de saldo: crédito");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Exportar CSV/ })); });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const offsets = rpc.mock.calls.filter((c) => (c[1] as { _limit: number })._limit === 200).map((c) => (c[1] as { _offset: number })._offset);
    expect(offsets).toEqual([0, 200, 400]);
    expect(String(vi.mocked(toast.success).mock.calls[0][0])).toContain("450");
    click.mockRestore();
  });

  it("exportação que falha no meio não baixa arquivo", async () => {
    const createUrl = vi.fn(() => "blob:x");
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    rpc.mockImplementation(async (_n: string, a: { _limit: number; _offset: number }) => (a._limit === 200 && a._offset === 200 ? { data: null, error: { message: "x" } } : { data: pageOf(Array.from({ length: Math.min(a._limit, 450 - a._offset) }, (_, i) => row(i)), 450), error: null }));
    renderTab();
    await screen.findAllByText("Ajuste de saldo: crédito");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Exportar CSV/ })); });
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(createUrl).not.toHaveBeenCalled();
    expect(String(vi.mocked(toast.error).mock.calls[0][0])).toContain("Nada foi baixado");
  });
});

describe("Análise de risco por IA", () => {
  it("sem seller mostra o aviso e não chama a IA", async () => {
    renderTab(); goto("Análise de risco por IA");
    fireEvent.click(screen.getByRole("button", { name: "Analisar com IA" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Escolha um seller para analisar.");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("envia o período de Brasília e mostra a análise com o nome do seller", async () => {
    invoke.mockResolvedValue({ data: { success: true, analysis: { risk_level: "high", summary: "Resumo da IA.", risks: [{ title: "Chargeback alto", detail: "2,4%", severity: "high" }], next_actions: [{ priority: 1, action: "Pedir defesa", reason: "Prazo curto" }] } }, error: null });
    renderTab(); goto("Análise de risco por IA");
    fireEvent.change(screen.getByLabelText("Seller"), { target: { value: "s1" } });
    fireEvent.click(screen.getByRole("button", { name: "Analisar com IA" }));
    expect(await screen.findByText("Análise de Marina Duarte")).toBeTruthy();
    expect(screen.getByText("Risco alto")).toBeTruthy();
    expect(screen.getByText("Pedir defesa")).toBeTruthy();
    const body = invoke.mock.calls[0][1].body as { sellerId: string; from: string; to: string };
    expect(body.sellerId).toBe("s1");
    expect(body.from).toMatch(/T0[2-3]:00:00\.000Z$/);
  });

  it("falha da IA mostra o motivo no lugar e não deixa análise antiga", async () => {
    invoke.mockResolvedValue({ data: { success: false, error: "Créditos de IA esgotados." }, error: { message: "x" } });
    renderTab(); goto("Análise de risco por IA");
    fireEvent.change(screen.getByLabelText("Seller"), { target: { value: "s1" } });
    fireEvent.click(screen.getByRole("button", { name: "Analisar com IA" }));
    expect(await screen.findByText("Créditos de IA esgotados.")).toBeTruthy();
    expect(screen.queryByText("Análise de Marina Duarte")).toBeNull();
  });
});

describe("Permissões por cargo", () => {
  it("liberar pede a senha antes de gravar; retirar grava direto", async () => {
    renderTab(); goto("Permissões por cargo");
    const sw = await screen.findByRole("switch", { name: "Pedir ajuste de saldo, Funcionário" });
    fireEvent.click(sw);
    expect(confirmSpy.mock.calls[0][0]).toContain("Liberar");
    await waitFor(() => expect(upserts[0]).toMatchObject({ role: "employee", permission: "balance_adjust_request", allowed: true }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Permissão liberada."));
    confirmSpy.mockClear();
    fireEvent.click(screen.getByRole("switch", { name: "Pedir ajuste de saldo, Gerente" }));
    await waitFor(() => expect(upserts[1]).toMatchObject({ role: "manager", allowed: false }));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("falha ao salvar diz que nada mudou", async () => {
    state.upsert = { error: { message: "denied" } };
    renderTab(); goto("Permissões por cargo");
    fireEvent.click(await screen.findByRole("switch", { name: "Pedir ajuste de saldo, Funcionário" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(String(vi.mocked(toast.error).mock.calls[0][0])).toContain("Nada mudou");
  });

  it("erro ao carregar não mostra tudo desligado como se fosse o estado real", async () => {
    state.perms = { error: { message: "boom" } };
    renderTab(); goto("Permissões por cargo");
    expect(await screen.findByText("Não foi possível carregar as permissões.")).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
  });
});
