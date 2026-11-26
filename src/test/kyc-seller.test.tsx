import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider, type UseQueryResult } from "@tanstack/react-query";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
const refresh = vi.fn(async () => {});
vi.mock("@/hooks/useProfile", () => ({ useProfile: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const prepare = vi.fn();
const upload = vi.fn();
const submit = vi.fn();
vi.mock("@/features/kyc/kycFiles", async (orig) => ({
  ...(await orig<typeof import("@/features/kyc/kycFiles")>()),
  prepareKycFile: (...a: unknown[]) => prepare(...a),
  uploadKycDoc: (...a: unknown[]) => upload(...a),
  submitKyc: (...a: unknown[]) => submit(...a),
}));

import { toast } from "sonner";
import { DocsSection } from "@/components/account/DocsSection";
import type { KycDocsData } from "@/components/account/useAccountData";

const file = (type: string, name = `${type}_ab12.jpg`) => ({ type, name, path: `u1/${name}`, url: `https://storage.test/u1/${name}`, sentAt: "2026-11-20T10:00:00Z" });
const docsQuery = (types: string[], over: Partial<UseQueryResult<KycDocsData>> = {}) => ({
  data: { docs: Object.fromEntries(types.map((t) => [t, file(t)])), files: [] },
  isLoading: false, isError: false, refetch: vi.fn(), ...over,
}) as unknown as UseQueryResult<KycDocsData>;

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { qc, ...render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>) };
}

beforeEach(() => {
  prepare.mockReset(); upload.mockReset(); submit.mockReset(); refresh.mockClear();
  vi.mocked(toast.success).mockClear();
  prepare.mockImplementation(async (f: File) => ({ file: f, error: null, changed: false }));
  upload.mockResolvedValue({ ok: true, name: "back_x.jpg", error: null });
  submit.mockResolvedValue({ ok: true, error: null });
});

const pickFile = (container: HTMLElement, type: string, f: File) => {
  const input = container.querySelector(`#kyc-${type}-file`) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [f] } });
};

describe("documentos da verificação (seller)", () => {
  it("prepara, envia e relê a pasta", async () => {
    const { container, qc } = wrap(<DocsSection kyc="pending" isCnpj={false} docs={docsQuery(["front"])} editable />);
    const spy = vi.spyOn(qc, "invalidateQueries");
    const f = new File(["x"], "verso.jpg", { type: "image/jpeg" });
    pickFile(container, "back", f);
    await waitFor(() => expect(upload).toHaveBeenCalledWith("u1", "back", f));
    expect(prepare).toHaveBeenCalledWith(f, "back");
    expect(spy).toHaveBeenCalledWith({ queryKey: ["kyc-docs", "u1"] });
    expect(screen.getByText("1 de 3")).toBeInTheDocument();
  });

  it("arquivo recusado na preparação não sobe e o motivo aparece no documento", async () => {
    prepare.mockResolvedValue({ file: null, error: "A foto está pequena demais (600 × 400) para ler o documento.", changed: false });
    const { container } = wrap(<DocsSection kyc="pending" isCnpj={false} docs={docsQuery([])} editable />);
    pickFile(container, "selfie", new File(["x"], "s.jpg", { type: "image/jpeg" }));
    const slot = screen.getByRole("article", { name: /Selfie com documento/ });
    expect(await within(slot).findByRole("alert")).toHaveTextContent("pequena demais");
    expect(upload).not.toHaveBeenCalled();
  });

  it("falha no envio aparece no documento certo", async () => {
    upload.mockResolvedValue({ ok: false, name: null, error: "O arquivo passa de 10 MB. Envie uma foto menor." });
    const { container } = wrap(<DocsSection kyc="pending" isCnpj={false} docs={docsQuery([])} editable />);
    pickFile(container, "front", new File(["x"], "f.jpg", { type: "image/jpeg" }));
    const slot = screen.getByRole("article", { name: /Documento \(frente\)/ });
    expect(await within(slot).findByRole("alert")).toHaveTextContent("passa de 10 MB");
  });

  it("só oferece enviar para análise com todos os documentos (CNPJ pede o cartão)", () => {
    const { unmount } = wrap(<DocsSection kyc="pending" isCnpj docs={docsQuery(["front", "back", "selfie"])} editable />);
    expect(screen.getByText("3 de 4")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar para análise" })).toBeNull();
    expect(screen.getByText(/CNH digital e cartão CNPJ/)).toBeInTheDocument();
    unmount();
    wrap(<DocsSection kyc="pending" isCnpj={false} docs={docsQuery(["front", "back", "selfie"])} editable />);
    expect(screen.getByRole("button", { name: "Enviar para análise" })).toBeInTheDocument();
    expect(screen.queryByText(/cartão CNPJ/)).toBeNull();
  });

  it("envia para análise depois de confirmar", async () => {
    wrap(<DocsSection kyc="pending" isCnpj={false} docs={docsQuery(["front", "back", "selfie"])} editable />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar para análise" }));
    const dlg = await screen.findByRole("alertdialog").catch(() => screen.findByRole("dialog"));
    fireEvent.click(within(dlg).getByRole("button", { name: "Enviar para análise" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(refresh).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Documentos enviados para análise");
  });

  it("recusa do servidor aparece na página (ex.: reenviar os mesmos arquivos)", async () => {
    submit.mockResolvedValue({ ok: false, error: "Troque o documento apontado na reprovação antes de enviar de novo." });
    wrap(<DocsSection kyc="rejected" isCnpj={false} docs={docsQuery(["front", "back", "selfie"])} editable />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar para análise" }));
    const dlg = await screen.findByRole("alertdialog").catch(() => screen.findByRole("dialog"));
    fireEvent.click(within(dlg).getByRole("button", { name: "Enviar para análise" }));
    expect(await screen.findByText(/Troque o documento apontado/)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("em análise os documentos ficam travados", () => {
    wrap(<DocsSection kyc="pending_review" isCnpj={false} docs={docsQuery(["front", "back", "selfie"])} editable={false} />);
    expect(screen.getByText("Estes são os documentos que a equipe está analisando.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Trocar arquivo/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Enviar para análise" })).toBeNull();
  });

  it("erro ao ler a pasta não finge que nada foi enviado", () => {
    const refetch = vi.fn();
    wrap(<DocsSection kyc="pending" isCnpj={false} docs={docsQuery([], { isError: true, data: undefined, refetch } as never)} editable />);
    expect(screen.getByText("Não conseguimos conferir seus documentos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(refetch).toHaveBeenCalled();
  });
});
