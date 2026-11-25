import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

type Res = { data: unknown[] | null; error: { message: string } | null };
const results: Record<string, Res> = {};
const chain = (table: string) => {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "is", "order", "limit"]) q[m] = () => q;
  q.then = (ok: (r: Res) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(results[table]).then(ok, bad);
  return q;
};
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (t: string) => chain(t), rpc: vi.fn(), functions: { invoke: vi.fn() } } }));
vi.mock("@/features/staff/StaffAssignment", () => ({ StaffAssignment: () => null }));
vi.mock("@/lib/auditLog", () => ({ logAdminAction: vi.fn() }));

import StaffManagementTab from "@/pages/admin/tabs/StaffManagementTab";

const profile = { user_id: "11111111-1111-4111-8111-111111111111", full_name: "Ana Staff", email: "ana@exemplo.com", frozen: false, created_at: "2026-10-01T10:00:00Z" } as never;

beforeEach(() => {
  results.user_roles = { data: [{ user_id: "11111111-1111-4111-8111-111111111111" }], error: null };
  results.staff_commission_config = { data: [{ user_id: "11111111-1111-4111-8111-111111111111", base_pct: 2 }], error: null };
  results.staff_permissions = { data: [], error: null };
  results.staff_fee_limits = { data: [], error: null };
  results.staff_audit_log = { data: [], error: null };
});

describe("StaffManagementTab", () => {
  it("lista as contas e dá nome aos botões de ação", async () => {
    render(<StaffManagementTab profiles={[profile]} onReload={() => {}} role="employee" />);
    expect(await screen.findAllByText("Ana Staff")).not.toHaveLength(0);
    expect(screen.getAllByRole("button", { name: "Resetar senha" }).length).toBeGreaterThan(0);
  });

  it("falha ao consultar a equipe não vira 'nenhuma conta': mostra erro e tenta de novo", async () => {
    results.user_roles = { data: null, error: { message: "boom" } };
    render(<StaffManagementTab profiles={[profile]} onReload={() => {}} role="employee" />);
    expect(await screen.findByText(/Não foi possível carregar a equipe/)).toBeInTheDocument();
    expect(screen.queryByText("Nenhuma conta ainda")).toBeNull();

    results.user_roles = { data: [{ user_id: "11111111-1111-4111-8111-111111111111" }], error: null };
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect((await screen.findAllByText("Ana Staff")).length).toBeGreaterThan(0);
  });

  it("falha na auditoria avisa em vez de mostrar 'nenhuma ação registrada'", async () => {
    results.staff_audit_log = { data: null, error: { message: "boom" } };
    render(<StaffManagementTab profiles={[profile]} onReload={() => {}} role="employee" />);
    await screen.findAllByText("Ana Staff");
    fireEvent.click(screen.getAllByRole("button", { name: "Auditoria" })[0]);
    expect(await screen.findByText(/Não foi possível carregar a auditoria/)).toBeInTheDocument();
    expect(screen.queryByText("Nenhuma ação registrada")).toBeNull();
  });
});
