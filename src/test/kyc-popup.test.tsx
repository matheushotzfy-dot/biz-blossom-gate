import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const rpc = vi.fn(async () => ({ data: null, error: null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...(a as [])) } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
let profile: Record<string, unknown> = {};
const refresh = vi.fn(async () => {});
vi.mock("@/hooks/useProfile", () => ({ useProfile: () => ({ profile, refresh }) }));
let kycState = "pending";
vi.mock("@/hooks/useKycStatus", () => ({ useKycStatus: () => ({ state: kycState, resolved: true }) }));

type Docs = { docs: Record<string, unknown>; files: unknown[] };
let docsData: Docs = { docs: {}, files: [] };
const refetch = vi.fn(async () => ({ data: docsData }));
vi.mock("@/components/account/useAccountData", async (orig) => ({
  ...(await orig<typeof import("@/components/account/useAccountData")>()),
  useKycDocs: (_u: string, enabled: boolean) => ({ data: enabled ? docsData : undefined, isLoading: false, isError: false, isSuccess: enabled, refetch }),
}));
const prepare = vi.fn();
const upload = vi.fn();
const submit = vi.fn();
vi.mock("@/features/kyc/kycFiles", async (orig) => ({
  ...(await orig<typeof import("@/features/kyc/kycFiles")>()),
  prepareKycFile: (...a: unknown[]) => prepare(...a),
  uploadKycDoc: (...a: unknown[]) => upload(...a),
  submitKyc: (...a: unknown[]) => submit(...a),
}));

import { KycOnboardingPopup } from "@/components/KycOnboardingPopup";

const f = (t: string) => ({ type: t, name: `${t}_a1b2.jpg`, path: `u1/${t}_a1b2.jpg`, url: `https://storage.test/${t}`, sentAt: "2026-11-25T10:00:00Z" });
const show = (path = "/") => render(<MemoryRouter initialEntries={[path]}><KycOnboardingPopup /></MemoryRouter>);

beforeEach(() => {
  profile = { account_status: "pending", document_type: "cpf", kyc_popup_snoozed_until: null, kyc_rejection_reason: null };
  kycState = "pending";
  docsData = { docs: {}, files: [] };
  rpc.mockClear(); refresh.mockClear(); refetch.mockClear(); prepare.mockReset(); upload.mockReset(); submit.mockReset();
  prepare.mockImplementation(async (file: File) => ({ file, error: null, changed: false }));
  upload.mockResolvedValue({ ok: true, name: "x", error: null });
  submit.mockResolvedValue({ ok: true, error: null });
});

describe("popup de verificação", () => {
  it("abre para conta nova e começa pelo primeiro documento que falta", async () => {
    docsData = { docs: { front: f("front") }, files: [] };
    show();
    const dlg = await screen.findByRole("dialog", {}, { timeout: 2000 });
    expect(within(dlg).getByText("Verifique sua conta")).toBeInTheDocument();
    expect(within(dlg).getByText("1 de 3 enviados")).toBeInTheDocument();
    expect(within(dlg).getByRole("button", { name: /Verso/ })).toHaveAttribute("aria-current", "step");
  });

  it("não abre em Minha conta, adiado, em análise ou aprovado", async () => {
    const cases: [string, () => void][] = [
      ["/perfil?tab=identidade", () => {}],
      ["/", () => { profile = { ...profile, kyc_popup_snoozed_until: new Date(Date.now() + 864e5).toISOString() }; }],
      ["/", () => { kycState = "pending_review"; }],
      ["/", () => { kycState = "approved"; }],
    ];
    for (const [path, setup] of cases) {
      setup();
      const { unmount } = show(path);
      await new Promise((r) => setTimeout(r, 900));
      expect(screen.queryByRole("dialog")).toBeNull();
      unmount();
      profile = { account_status: "pending", document_type: "cpf", kyc_popup_snoozed_until: null }; kycState = "pending";
    }
  });

  it("reprovada mostra o motivo", async () => {
    kycState = "rejected";
    profile = { ...profile, account_status: "rejected", kyc_rejection_reason: "Selfie sem o documento." };
    show();
    const dlg = await screen.findByRole("dialog", {}, { timeout: 2000 });
    expect(within(dlg).getByText("Envie os documentos de novo")).toBeInTheDocument();
    expect(within(dlg).getByText("Selfie sem o documento.")).toBeInTheDocument();
  });

  it("\"Fazer depois\" adia na conta", async () => {
    show();
    const dlg = await screen.findByRole("dialog", {}, { timeout: 2000 });
    fireEvent.click(within(dlg).getByRole("button", { name: /Fazer depois/ }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("snooze_my_kyc_popup"));
    expect(refresh).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("envia o documento, relê a pasta e passa para o próximo que falta", async () => {
    show();
    const dlg = await screen.findByRole("dialog", {}, { timeout: 2000 });
    refetch.mockImplementation(async () => { docsData = { docs: { front: f("front") }, files: [] }; return { data: docsData }; });
    const input = dlg.querySelector("#kyc-front-file") as HTMLInputElement;
    const photo = new File(["x"], "frente.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [photo] } });
    await waitFor(() => expect(upload).toHaveBeenCalledWith("u1", "front", photo));
    await waitFor(() => expect(within(dlg).getByRole("button", { name: /Verso/ })).toHaveAttribute("aria-current", "step"), { timeout: 1500 });
  });

  it("com tudo enviado, envia para análise e mostra o fim", async () => {
    docsData = { docs: { front: f("front"), back: f("back"), selfie: f("selfie") }, files: [] };
    show();
    const dlg = await screen.findByRole("dialog", {}, { timeout: 2000 });
    fireEvent.click(within(dlg).getByRole("button", { name: "Enviar para análise" }));
    expect(await within(dlg).findByText("Documentos enviados")).toBeInTheDocument();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(within(dlg).getByText(/A equipe vai conferir os 3 documentos/)).toBeInTheDocument();
  });

  it("recusa do servidor fica no popup", async () => {
    docsData = { docs: { front: f("front"), back: f("back"), selfie: f("selfie") }, files: [] };
    submit.mockResolvedValue({ ok: false, error: "Ainda falta enviar: selfie com o documento." });
    show();
    const dlg = await screen.findByRole("dialog", {}, { timeout: 2000 });
    fireEvent.click(within(dlg).getByRole("button", { name: "Enviar para análise" }));
    expect(await within(dlg).findByRole("alert")).toHaveTextContent("Ainda falta enviar: selfie com o documento.");
  });
});
