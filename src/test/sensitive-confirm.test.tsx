import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const signIn = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { email: "admin@exemplo.com" } } }), signInWithPassword: (...a: unknown[]) => signIn(...a) } },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";

const action = vi.fn(async () => {});
const cancel = vi.fn();

function Harness() {
  const { confirm, dialog } = useSensitiveConfirm("Confirme sua senha");
  return (
    <>
      <button type="button" onClick={() => confirm("Aprovar a conta.", action, cancel)}>abrir</button>
      {dialog}
    </>
  );
}

const typeAndSend = (pw: string) => {
  fireEvent.change(screen.getByLabelText("Senha atual"), { target: { value: pw } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar e continuar" }));
};

beforeEach(() => { signIn.mockReset(); action.mockClear(); cancel.mockClear(); vi.mocked(toast.error).mockClear(); });

describe("senha de novo para ação sensível", () => {
  it("senha errada mantém a ação: a senha certa em seguida executa uma vez", async () => {
    signIn.mockResolvedValueOnce({ error: { message: "Invalid login credentials" } }).mockResolvedValueOnce({ error: null });
    render(<Harness />);
    fireEvent.click(screen.getByText("abrir"));
    typeAndSend("errada1");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Senha incorreta"));
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    typeAndSend("certa123");
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenLastCalledWith({ email: "admin@exemplo.com", password: "certa123" });
    expect(cancel).not.toHaveBeenCalled();
  });

  it("fechar sem confirmar avisa o cancelamento e não executa", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("abrir"));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
    expect(action).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
  });
});
