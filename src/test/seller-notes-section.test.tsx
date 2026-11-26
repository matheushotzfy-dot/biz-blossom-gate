import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";
import { SellerNotesSection } from "@/features/admin-tools/SellerNotesSection";

const SELLER = "11111111-1111-4111-8111-111111111111";
const note = { id: "n1", seller_id: SELLER, seller_name: "Marina Duarte", seller_email: null, author_name: "Rafa", author_role: "staff", content: "Pediu para adiar a análise", created_at: new Date().toISOString() };

function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><SellerNotesSection userId={SELLER} /></QueryClientProvider>);
}

beforeEach(() => {
  rpc.mockReset();
  vi.mocked(toast.success).mockClear();
});

describe("notas do seller no Sellers 360", () => {
  it("lista as notas só deste seller e mostra quem escreveu", async () => {
    rpc.mockImplementation((name: string) => Promise.resolve(name === "get_admin_seller_notes" ? { data: { items: [note], total: 1 }, error: null } : { data: null, error: null }));
    show();
    expect(await screen.findByText("Pediu para adiar a análise")).toBeInTheDocument();
    expect(screen.getByText(/Rafa \(equipe\)/)).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("get_admin_seller_notes", { _seller_id: SELLER, _limit: 30 });
  });

  it("nota curta não vai para o servidor; nota válida é salva para este seller", async () => {
    rpc.mockImplementation((name: string) => Promise.resolve(name === "get_admin_seller_notes" ? { data: { items: [], total: 0 }, error: null } : { data: { id: "n2" }, error: null }));
    show();
    await screen.findByText("Nenhuma nota sobre este seller");
    const box = screen.getByLabelText("Nova nota");
    fireEvent.change(box, { target: { value: "ok" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("pelo menos 3");
    expect(rpc.mock.calls.filter((c) => c[0] === "admin_add_seller_note")).toHaveLength(0);
    fireEvent.change(box, { target: { value: "  Ligou pedindo prazo  " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("admin_add_seller_note", { _seller_id: SELLER, _content: "Ligou pedindo prazo" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Nota salva."));
  });
});
