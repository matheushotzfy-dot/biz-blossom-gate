import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

type Row = Record<string, unknown>;
let data: Record<string, Row[]> = {};
let failTable: string | null = null;

const chain = (table: string) => {
  let range: [number, number] | null = null;
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order", "limit"]) q[m] = () => q;
  q.range = (from: number, to: number) => { range = [from, to]; return q; };
  q.then = (ok: (r: unknown) => unknown, bad: (e: unknown) => unknown) => {
    if (failTable === table) return Promise.resolve({ data: null, error: { message: "boom" } }).then(ok, bad);
    const rows = data[table] ?? [];
    // sem .range() o servidor devolve no máximo 1000 linhas, como o PostgREST
    return Promise.resolve({ data: range ? rows.slice(range[0], range[1] + 1) : rows.slice(0, 1000), error: null }).then(ok, bad);
  };
  return q;
};
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (t: string) => chain(t) } }));
vi.mock("@/features/admin-finance/useSensitiveConfirm", () => ({ useSensitiveConfirm: () => ({ confirm: vi.fn(), dialog: null }) }));

import AdminStaffCommissionsTab from "@/pages/admin/tabs/AdminStaffCommissionsTab";

const STAFF = "11111111-1111-4111-8111-111111111111";
const profiles = [{ user_id: STAFF, full_name: "Ana Staff", email: "ana@exemplo.com" }] as never;

beforeEach(() => {
  failTable = null;
  // 1500 lançamentos de R$ 1,00 + um pagamento de R$ 100: passa do corte de 1000 linhas do servidor
  const ledger: Row[] = Array.from({ length: 1500 }, (_, i) => ({
    id: `l${String(i).padStart(5, "0")}`, staff_user_id: STAFF, type: "accrual", amount: 1, balance_after: i + 1, created_at: new Date(2026, 0, 1, 0, 0, i).toISOString(),
  }));
  ledger.push({ id: "l99999", staff_user_id: STAFF, type: "payout", amount: -100, balance_after: 1400, created_at: new Date(2026, 5, 1).toISOString() });
  data = {
    user_roles: [{ user_id: STAFF, role: "employee" }],
    staff_commission_config: [{ user_id: STAFF, base_pct: 3 }],
    staff_commissions_ledger: ledger,
    staff_commission_payouts: [],
  };
});

describe("AdminStaffCommissionsTab", () => {
  it("soma todo o histórico, não só as primeiras 1000 linhas do servidor", async () => {
    render(<AdminStaffCommissionsTab profiles={profiles} />);
    // acumulado 1500, pago 100, saldo 1400 (formato pt-BR com espaço não separável)
    expect((await screen.findAllByText(/1\.500,00/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1\.400,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/100,00/).length).toBeGreaterThan(0);
  });

  it("falha ao consultar o ledger não mostra R$ 0,00: mostra erro e permite tentar de novo", async () => {
    failTable = "staff_commissions_ledger";
    render(<AdminStaffCommissionsTab profiles={profiles} />);
    expect(await screen.findByText(/Não foi possível carregar as comissões/)).toBeInTheDocument();
    expect(screen.queryByText("Ana Staff")).toBeNull();

    failTable = null;
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect((await screen.findAllByText("Ana Staff")).length).toBeGreaterThan(0);
  });
});
