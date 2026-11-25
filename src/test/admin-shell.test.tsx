import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const rpc = vi.fn();
const navigate = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" }, loading: false }) }));
vi.mock("react-router-dom", async () => ({ ...(await vi.importActual<object>("react-router-dom")), useNavigate: () => navigate }));

import AdminDateBar from "@/pages/admin/AdminDateBar";
import { RequireAdmin } from "@/hooks/useAdminGuard";
import { presetRange } from "@/pages/admin/adminNav";
import { todayInSaoPaulo } from "@/components/period/periodMeta";

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: wide && query.includes("min-width"), media: query, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
};

beforeEach(() => { rpc.mockReset(); navigate.mockReset(); });
afterEach(() => setWide(false));

describe("AdminDateBar", () => {
  const today = presetRange("today", todayInSaoPaulo());

  it("em tela estreita mostra um botão só com o período atual", () => {
    setWide(false);
    render(<AdminDateBar range={today} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Período: Hoje. Escolher outro" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "7d" })).toBeNull();
  });

  it("em tela larga marca o atalho ativo e aplica o intervalo do atalho clicado", () => {
    setWide(true);
    const onChange = vi.fn();
    render(<AdminDateBar range={today} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Hoje" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "7d" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "7d" }));
    const expected = presetRange("7d", todayInSaoPaulo());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].from).toEqual(expected.from);
    expect(onChange.mock.calls[0][0].to).toEqual(expected.to);
  });

  it("intervalo livre não marca atalho e mostra as datas no botão do calendário", () => {
    setWide(true);
    const range = { from: new Date(2026, 9, 3), to: new Date(2026, 9, 9, 23, 59, 59) };
    render(<AdminDateBar range={range} onChange={() => {}} />);
    for (const name of ["Hoje", "Ontem", "7d", "30d"]) expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Período: 03 out a 09 out/ })).toBeInTheDocument();
  });
});

describe("RequireAdmin", () => {
  const renderGuard = () => render(<MemoryRouter><RequireAdmin><p>conteúdo do admin</p></RequireAdmin></MemoryRouter>);

  it("erro de rede ao conferir o acesso não manda para o login: pede para tentar de novo", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Failed to fetch" } });
    renderGuard();
    expect(await screen.findByText("Não deu para confirmar seu acesso")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();

    rpc.mockResolvedValue({ data: true, error: null });
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("conteúdo do admin")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("sem papel de admin nem de staff vai para o login", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    renderGuard();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/admin-matheus", { replace: true }));
    expect(screen.queryByText("conteúdo do admin")).toBeNull();
  });
});
