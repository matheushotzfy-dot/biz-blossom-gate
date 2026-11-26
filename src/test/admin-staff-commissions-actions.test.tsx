import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

/**
 * Os campos são `type="number"`: o navegador entrega o valor com ponto decimal mesmo em pt-BR, e valor que não é
 * número vira "" (o jsdom faz o mesmo). Painel de comissão de um staff: % padrão, overrides por seller e pagamentos. Confere o que vai para o banco,
 * o que a tela barra antes (valor em reais, % entre 0 e 100, saldo livre) e que clique duplo não grava duas vezes.
 */

type Row = Record<string, unknown>;
type Write = { table: string; op: "insert" | "upsert" | "update" | "delete"; payload?: Row };
let data: Record<string, Row[]> = {};
let writes: Write[] = [];
let release: (() => void) | null = null;
let hold = false;
let writeError: string | null = null;

const chain = (table: string) => {
  let op: Write["op"] | null = null;
  let payload: Row | undefined;
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order", "limit", "range"]) q[m] = () => q;
  q.insert = (p: Row) => { op = "insert"; payload = p; return q; };
  q.upsert = (p: Row) => { op = "upsert"; payload = p; return q; };
  q.update = (p: Row) => { op = "update"; payload = p; return q; };
  q.delete = () => { op = "delete"; return q; };
  q.then = (ok: (r: unknown) => unknown, bad: (e: unknown) => unknown) => {
    if (!op) return Promise.resolve({ data: data[table] ?? [], error: null }).then(ok, bad);
    writes.push({ table, op, payload });
    const done = () => Promise.resolve({ data: null, error: writeError ? { message: writeError } : null });
    if (!hold) return done().then(ok, bad);
    return new Promise<void>((res) => { release = res; }).then(done).then(ok, bad);
  };
  return q;
};
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (t: string) => chain(t) } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
// a confirmação com senha tem teste próprio; aqui ela só repassa a ação
vi.mock("@/features/admin-finance/useSensitiveConfirm", () => ({
  useSensitiveConfirm: () => ({ confirm: (_d: string, run: () => Promise<void> | void) => { void run(); }, dialog: null }),
}));

import { toast } from "sonner";
import AdminStaffCommissionsTab from "@/pages/admin/tabs/AdminStaffCommissionsTab";

const STAFF = "11111111-1111-4111-8111-111111111111";
const SELLER = "22222222-2222-4222-8222-222222222222";
const profiles = [
  { user_id: STAFF, full_name: "Ana Staff", email: "ana@exemplo.com" },
  { user_id: SELLER, full_name: "Loja do Beto", email: "beto@exemplo.com" },
] as never;

const writesTo = (table: string) => writes.filter((w) => w.table === table);

beforeEach(() => {
  writes = []; hold = false; release = null; writeError = null;
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  data = {
    user_roles: [{ user_id: STAFF, role: "employee" }],
    staff_commission_config: [{ user_id: STAFF, base_pct: 3 }],
    staff_commissions_ledger: [{ id: "l1", staff_user_id: STAFF, type: "accrual", amount: 1000, balance_after: 1000, created_at: "2026-01-01T00:00:00Z" }],
    staff_commission_overrides: [],
    staff_commission_payouts: [],
  };
});

async function openPanel() {
  render(<AdminStaffCommissionsTab profiles={profiles} />);
  fireEvent.click((await screen.findAllByText("Ana Staff"))[0]);
  return await screen.findByRole("dialog");
}
const goTo = async (dialog: HTMLElement, name: RegExp) => {
  fireEvent.click(within(dialog).getByRole("button", { name }));
};

describe("Painel de comissão do staff", () => {
  it("salva a % padrão (o campo numérico entrega ponto decimal) e barra valor fora de 0–100 ou com 3 casas", async () => {
    const dialog = await openPanel();
    const input = within(dialog).getByLabelText(/% padrão sobre o líquido/);
    const save = () => fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    for (const bad of ["101", "-1", "12.345", ""]) {
      fireEvent.change(input, { target: { value: bad } }); save();
    }
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(4));
    expect(writesTo("staff_commission_config")).toHaveLength(0);

    fireEvent.change(input, { target: { value: "12.5" } }); save();
    await waitFor(() => expect(writesTo("staff_commission_config")).toHaveLength(1));
    expect(writesTo("staff_commission_config")[0].payload).toMatchObject({ user_id: STAFF, base_pct: 12.5, is_active: true });
    expect(toast.success).toHaveBeenCalledWith("Percentual padrão atualizado");
  });

  it("override: exige seller e %, e não deixa duplicar o seller", async () => {
    data.staff_commission_overrides = [{ id: "o1", staff_user_id: STAFF, seller_user_id: SELLER, pct: 5 }];
    const dialog = await openPanel();
    await goTo(dialog, /^Overrides/);
    const add = () => fireEvent.click(within(dialog).getByRole("button", { name: /Adicionar/ }));

    add();
    expect(toast.error).toHaveBeenLastCalledWith("Escolha o seller do override.");

    fireEvent.change(within(dialog).getByLabelText("Seller"), { target: { value: SELLER } });
    fireEvent.change(within(dialog).getByLabelText(/% específica/), { target: { value: "4" } });
    add();
    await waitFor(() => expect(toast.error).toHaveBeenLastCalledWith("Esse seller já tem override. Remova o atual antes de criar outro."));
    expect(writesTo("staff_commission_overrides")).toHaveLength(0);
  });

  it("override novo grava seller e % em número", async () => {
    const dialog = await openPanel();
    await goTo(dialog, /^Overrides/);
    fireEvent.change(within(dialog).getByLabelText("Seller"), { target: { value: SELLER } });
    fireEvent.change(within(dialog).getByLabelText(/% específica/), { target: { value: "7.5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Adicionar/ }));
    await waitFor(() => expect(writesTo("staff_commission_overrides")).toHaveLength(1));
    expect(writesTo("staff_commission_overrides")[0].payload).toEqual({ staff_user_id: STAFF, seller_user_id: SELLER, pct: 7.5 });
  });

  it("pagamento: valor em reais, até 2 casas, dentro do saldo; 'R$ 1.500' não vira R$ 1,50", async () => {
    const dialog = await openPanel();
    await goTo(dialog, /^Pagamentos/);
    const amount = within(dialog).getByLabelText(/Valor \(R\$\)/);
    const register = () => fireEvent.click(within(dialog).getByRole("button", { name: /Registrar pagamento/ }));

    for (const bad of ["", "0", "-5", "10.999", "1.500", "abc"]) { fireEvent.change(amount, { target: { value: bad } }); register(); }
    fireEvent.change(amount, { target: { value: "1000.01" } }); register(); // passa do saldo de R$ 1.000,00
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(7));
    expect(writesTo("staff_commission_payouts")).toHaveLength(0);

    fireEvent.change(amount, { target: { value: "250.50" } }); register();
    await waitFor(() => expect(writesTo("staff_commission_payouts")).toHaveLength(1));
    expect(writesTo("staff_commission_payouts")[0].payload).toMatchObject({ staff_user_id: STAFF, amount: 250.5, method: "PIX", status: "pending" });
    expect(toast.success).toHaveBeenCalledWith("Pagamento criado como pendente");
  });

  it("clique duplo em 'Registrar pagamento' cria um pagamento só", async () => {
    const dialog = await openPanel();
    await goTo(dialog, /^Pagamentos/);
    fireEvent.change(within(dialog).getByLabelText(/Valor \(R\$\)/), { target: { value: "100" } });
    hold = true;
    const register = within(dialog).getByRole("button", { name: /Registrar pagamento/ });
    fireEvent.click(register); fireEvent.click(register); fireEvent.click(register);
    await waitFor(() => expect(release).not.toBeNull());
    expect(writesTo("staff_commission_payouts")).toHaveLength(1);
    expect(register).toBeDisabled();
    hold = false; release?.();
    await waitFor(() => expect(register).not.toBeDisabled());
    expect(writesTo("staff_commission_payouts")).toHaveLength(1);
  });

  it("pagamento já pendente reduz o saldo livre e 'Marcar pago' só roda uma vez", async () => {
    data.staff_commission_payouts = [{ id: "p1", staff_user_id: STAFF, amount: 900, method: "PIX", notes: "", status: "pending", created_at: "2026-02-01T00:00:00Z" }];
    const dialog = await openPanel();
    await goTo(dialog, /^Pagamentos/);

    fireEvent.change(within(dialog).getByLabelText(/Valor \(R\$\)/), { target: { value: "150" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Registrar pagamento/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Só restam .*100,00 livres/)));
    expect(writesTo("staff_commission_payouts")).toHaveLength(0);

    hold = true;
    const mark = within(dialog).getByRole("button", { name: /Marcar pago/ });
    fireEvent.click(mark); fireEvent.click(mark);
    await waitFor(() => expect(release).not.toBeNull());
    expect(writesTo("staff_commission_payouts")).toHaveLength(1);
    expect(writesTo("staff_commission_payouts")[0]).toMatchObject({ op: "update", payload: { status: "paid" } });
    hold = false; release?.();
  });

  it("erro do banco aparece em português e libera os botões", async () => {
    writeError = "new row violates row-level security policy";
    const dialog = await openPanel();
    await goTo(dialog, /^Pagamentos/);
    fireEvent.change(within(dialog).getByLabelText(/Valor \(R\$\)/), { target: { value: "10" } });
    const register = within(dialog).getByRole("button", { name: /Registrar pagamento/ });
    fireEvent.click(register);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(String(vi.mocked(toast.error).mock.calls[0][0])).not.toMatch(/row-level|violates/);
    await waitFor(() => expect(register).not.toBeDisabled());
  });
});
