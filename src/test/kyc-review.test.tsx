import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Res = { data?: unknown; error?: unknown };
const rpc = vi.fn();
const signed = vi.fn();
vi.mock("@/integrations/supabase/client", () => {
  const ch: Record<string, unknown> = {};
  ch.on = () => ch; ch.subscribe = () => ch;
  const q: Record<string, unknown> = {};
  q.select = () => q; q.eq = () => q; q.in = () => Promise.resolve({ data: [], error: null });
  return {
    supabase: {
      rpc: (...a: unknown[]) => rpc(...a),
      from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [], error: null }), in: () => Promise.resolve({ data: [], error: null }) }) }),
      channel: () => ch, removeChannel: vi.fn(),
      storage: { from: () => ({ createSignedUrls: (...a: unknown[]) => signed(...a) }) },
    },
  };
});
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
// Senha de novo: o teste decide se confirma (roda a ação) ou fecha (roda o cancelamento).
let confirmMode: "ok" | "cancel" = "ok";
const confirmSpy = vi.fn();
vi.mock("@/features/admin-finance/useSensitiveConfirm", () => ({
  useSensitiveConfirm: () => ({
    confirm: (d: string, a: () => Promise<void>, cancel?: () => void) => { confirmSpy(d); if (confirmMode === "ok") void a(); else cancel?.(); },
    dialog: null,
  }),
}));

import { toast } from "sonner";
import KycCenter from "@/features/admin-kyc/KycCenter";
import { StaffSellerPanel } from "@/features/staff/StaffSellerPanel";
import { isKycPending } from "@/features/staff/staffActions";
import {
  duplicateGroups, formatBytes, formatDocNumber, formatPhone, missingTypes, parseDocuments, parseQueue, parseReview,
  reasonProblem, reviewActionError, waitingLabel,
} from "@/features/kyc/kycReviewModel";

/* ───────── dados ───────── */

const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();
const S1 = "00000000-0000-4000-8000-00000000d001";
const S2 = "00000000-0000-4000-8000-00000000d002";

const item = (over: Record<string, unknown> = {}) => ({
  user_id: S1, full_name: "Juliana Prado", nickname: null, email: "juliana@exemplo.com", document_type: "cpf", document_number_masked: "321.***.***-09",
  account_status: "pending_review", created_at: ago(200), submitted_at: ago(50), attempts: 1, documents_uploaded: 3, documents_required: 3, kyc_rejection_reason: null, ...over,
});
const queue = (items: unknown[], over: Record<string, unknown> = {}) => ({
  items, total: items.length,
  summary: { pending_review: 2, pending: 1, rejected: 1, approved: 7, oldest_waiting_at: ago(50), decided_7d: 4, approved_7d: 3 }, ...over,
});
const doc = (type: string, over: Record<string, unknown> = {}) => ({ type, name: `${type}_ab12.jpg`, path: `${S1}/${type}_ab12.jpg`, size: 900000, mime: "image/jpeg", etag: `e-${type}`, uploaded_at: ago(51), ...over });
const review = (over: Record<string, unknown> = {}) => ({
  seller: { user_id: S1, full_name: "Juliana Prado", email: "juliana@exemplo.com", phone: "5544998887766", document_type: "cpf", document_number: "32145698709", account_status: "pending_review", created_at: ago(200), last_login_at: ago(2), street: "Rua A", street_number: "10", city: "Maringá", state: "PR", zip_code: "87020-180" },
  documents: [doc("front"), doc("back"), doc("selfie")], required: ["front", "back", "selfie"],
  submissions: [{ id: "k1", submitted_at: ago(50), status: "pending", documents: [], reviewed_at: null, review_reason: null, reviewer: null }],
  can_approve: true, can_reject: true, is_admin: true, ...over,
});

const handlers: Record<string, (a: Record<string, unknown>) => Res> = {};
const calls = (n: string) => rpc.mock.calls.filter((c) => c[0] === n).map((c) => c[1] as Record<string, unknown>);

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  rpc.mockReset(); signed.mockReset(); confirmSpy.mockClear(); confirmMode = "ok";
  for (const k of Object.keys(handlers)) delete handlers[k];
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear();
  handlers.get_admin_kyc_queue = () => ({ data: queue([item(), item({ user_id: S2, full_name: "Moda Rápida LTDA", email: "contato@moda.com", document_type: "cnpj", document_number_masked: "12.***.***/0001-90", submitted_at: ago(5), documents_required: 4, documents_uploaded: 4 })]), error: null });
  handlers.get_kyc_review = (a) => ({ data: review(a._seller === S2 ? { seller: { ...review().seller, user_id: S2, full_name: "Moda Rápida LTDA" } } : {}), error: null });
  handlers.admin_reject_kyc = () => ({ data: null, error: null });
  handlers.admin_approve_seller_with_manager = () => ({ data: null, error: null });
  handlers.staff_review_kyc = () => ({ data: null, error: null });
  rpc.mockImplementation((name: string, args: Record<string, unknown>) => Promise.resolve(handlers[name]?.(args ?? {}) ?? { data: null, error: null }));
  signed.mockImplementation((paths: string[]) => Promise.resolve({ data: paths.map((p) => ({ path: p, signedUrl: `https://storage.test/${p}?token=x` })), error: null }));
});

/* ───────── regras puras ───────── */

describe("modelo da análise de verificação", () => {
  it("lê a fila com campos faltando sem quebrar", () => {
    const p = parseQueue({ items: [{ user_id: "a", email: "x@y.com" }, { full_name: "sem id" }, null], total: "3", summary: { pending_review: "2" } });
    expect(p.items).toHaveLength(1);
    expect(p.items[0]).toMatchObject({ userId: "a", name: "x@y.com", documentType: "cpf", required: 3, status: "pending" });
    expect(p.total).toBe(3);
    expect(p.summary.pendingReview).toBe(2);
    expect(parseQueue(null)).toMatchObject({ items: [], total: 0 });
    expect(parseQueue({ items: [{ user_id: "b", document_type: "cnpj" }] }).items[0].required).toBe(4);
  });

  it("lê a ficha e só aceita tipos de documento conhecidos", () => {
    const r = parseReview({ seller: { user_id: "a" }, documents: [doc("front"), { type: "rg", name: "x" }, { type: "back" }], required: ["front", "back", "lixo"] });
    expect(r.documents.map((d) => d.type)).toEqual(["front"]);
    expect(r.required).toEqual(["front", "back"]);
    expect(parseReview({}).required).toEqual(["front", "back", "selfie"]);
    expect(r.canApprove).toBe(false);
    expect(parseDocuments("nada")).toEqual([]);
  });

  it("acusa o mesmo arquivo enviado em dois lugares e o que falta", () => {
    const docs = parseDocuments([doc("front", { etag: "same" }), doc("back", { etag: "same" }), doc("selfie", { etag: null })]);
    expect(duplicateGroups(docs)).toEqual([["front", "back"]]);
    expect(duplicateGroups(parseDocuments([doc("front"), doc("back")]))).toEqual([]);
    expect(missingTypes({ documents: parseDocuments([doc("front")]), required: ["front", "back", "selfie"] })).toEqual(["back", "selfie"]);
  });

  it("formata espera, documento, telefone e tamanho", () => {
    const now = Date.parse("2026-11-26T12:00:00Z");
    expect(waitingLabel("2026-11-26T11:59:40Z", now)).toBe("agora");
    expect(waitingLabel("2026-11-26T11:20:00Z", now)).toBe("há 40 min");
    expect(waitingLabel("2026-11-26T07:00:00Z", now)).toBe("há 5 h");
    expect(waitingLabel("2026-11-25T11:00:00Z", now)).toBe("há 1 dia");
    expect(waitingLabel("2026-11-23T12:00:00Z", now)).toBe("há 3 dias");
    expect(waitingLabel(null, now)).toBe("—");
    expect(formatDocNumber("cpf", "32145698709")).toBe("321.456.987-09");
    expect(formatDocNumber("cnpj", "12345678000190")).toBe("12.345.678/0001-90");
    expect(formatDocNumber("cpf", "123")).toBe("123");
    expect(formatPhone("5544998887766")).toBe("(44) 99888-7766");
    expect(formatPhone("4433221100")).toBe("(44) 3322-1100");
    expect(formatPhone("+1 555 0100")).toBe("+1 555 0100");
    expect(formatPhone("  ")).toBeNull();
    expect(formatBytes(0)).toBe("—");
    expect(formatBytes(300)).toBe("1 KB");
    expect(formatBytes(1_572_864)).toBe("1,5 MB");
  });

  it("exige motivo que o seller entenda e traduz os erros do servidor", () => {
    expect(reasonProblem("abc")).toMatch(/pelo menos 5/);
    expect(reasonProblem("   ilegível   ")).toBeNull();
    expect(reasonProblem("x".repeat(501))).toMatch(/500/);
    expect(reviewActionError({ message: "reautenticação necessária: confirme sua senha" })).toBe("Confirme sua senha para continuar.");
    expect(reviewActionError({ message: "Seller not pending review" })).toMatch(/não está mais esperando/);
    expect(reviewActionError({ message: "Access denied" })).toMatch(/permissão/);
    expect(reviewActionError({ message: "KYC decision not applied" })).toMatch(/não foi aplicada/);
    expect(reviewActionError({ message: "rate limit exceeded" })).toMatch(/Espere/);
    expect(reviewActionError({ message: "boom" })).toBe("Não foi possível concluir. Tente de novo.");
  });

  it("a equipe só decide verificação enviada", () => {
    expect(isKycPending("pending_review")).toBe(true);
    expect(isKycPending("pending")).toBe(false);
    expect(isKycPending("rejected")).toBe(false);
  });
});

/* ───────── fila do admin ───────── */

const openSeller = async (name: string) => {
  fireEvent.click(await screen.findByRole("button", { name: `Analisar ${name}` }));
  return screen.findByRole("dialog");
};

describe("Verificações do admin", () => {
  it("não chama nada para quem não é administrador", () => {
    wrap(<KycCenter isAdmin={false} />);
    expect(screen.getByText("A fila de verificação é do administrador")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("mostra a fila em análise com contagens e o que falta", async () => {
    handlers.get_admin_kyc_queue = () => ({ data: queue([item({ documents_uploaded: 2 })]), error: null });
    wrap(<KycCenter />);
    expect(await screen.findByText("Juliana Prado")).toBeInTheDocument();
    expect(screen.getByText("2 de 3 arquivos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Em análise · 2/ })).toBeInTheDocument();
    expect(calls("get_admin_kyc_queue")[0]).toEqual({ _status: "pending_review", _search: null, _page: 1, _page_size: 25 });
    expect(screen.getByText("2 esperando análise")).toBeInTheDocument();
  });

  it("troca de filtro e busca vão para o servidor", async () => {
    wrap(<KycCenter />);
    await screen.findByText("Juliana Prado");
    fireEvent.click(screen.getByRole("button", { name: /Reprovadas · 1/ }));
    await waitFor(() => expect(calls("get_admin_kyc_queue").some((c) => c._status === "rejected")).toBe(true));
    fireEvent.change(screen.getByLabelText("Buscar verificações"), { target: { value: "321" } });
    await waitFor(() => expect(calls("get_admin_kyc_queue").some((c) => c._search === "321")).toBe(true), { timeout: 2000 });
  });

  it("falha ao carregar mostra erro com nova tentativa", async () => {
    handlers.get_admin_kyc_queue = () => ({ data: null, error: { message: "boom" } });
    wrap(<KycCenter />);
    expect(await screen.findByText("Não foi possível carregar a fila.")).toBeInTheDocument();
  });

  it("abre a ficha com o cadastro completo e os documentos assinados", async () => {
    wrap(<KycCenter />);
    const dlg = await openSeller("Juliana Prado");
    expect(await within(dlg).findByText("321.456.987-09")).toBeInTheDocument();
    expect(within(dlg).getByText("(44) 99888-7766")).toBeInTheDocument();
    expect(within(dlg).getByRole("img", { name: "Documento (frente)" })).toHaveAttribute("src", expect.stringContaining("token=x"));
    expect(signed).toHaveBeenCalledWith([`${S1}/front_ab12.jpg`, `${S1}/back_ab12.jpg`, `${S1}/selfie_ab12.jpg`], 900);
    expect(calls("get_kyc_review")).toEqual([{ _seller: S1 }]);
  });

  it("avisa arquivo repetido e trava a aprovação sem todos os documentos", async () => {
    handlers.get_kyc_review = () => ({ data: review({ documents: [doc("front", { etag: "same" }), doc("back", { etag: "same" })] }), error: null });
    wrap(<KycCenter />);
    const dlg = await openSeller("Juliana Prado");
    expect(await within(dlg).findByText(/O mesmo arquivo foi enviado como documento \(frente\) e documento \(verso\)/)).toBeInTheDocument();
    expect(within(dlg).getByText("Falta: selfie com documento.")).toBeInTheDocument();
    expect(within(dlg).getByRole("button", { name: "Aprovar verificação" })).toBeDisabled();
  });

  it("reprovar exige motivo; o modelo pronto vai inteiro e a fila segue para o próximo", async () => {
    wrap(<KycCenter />);
    const dlg = await openSeller("Juliana Prado");
    fireEvent.click(await within(dlg).findByRole("button", { name: "Reprovar" }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Reprovar e avisar o seller" }));
    expect(await within(dlg).findByRole("alert")).toHaveTextContent(/pelo menos 5/);
    expect(calls("admin_reject_kyc")).toHaveLength(0);
    fireEvent.click(within(dlg).getByRole("button", { name: /A foto do documento está ilegível ou cortada/ }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Reprovar e avisar o seller" }));
    await waitFor(() => expect(calls("admin_reject_kyc")).toEqual([{ _user_id: S1, _reason: expect.stringMatching(/^A foto do documento está ilegível ou cortada\. Envie uma foto nítida/) }]));
    expect(toast.success).toHaveBeenCalledWith("Verificação reprovada. O seller recebeu o motivo.");
    await waitFor(() => expect(calls("get_kyc_review").map((c) => c._seller)).toContain(S2));
  });

  it("aprovar sem senha recente pede a senha e repete; fechar a senha não aprova", async () => {
    let first = true;
    handlers.admin_approve_seller_with_manager = () => {
      if (first) { first = false; return { data: null, error: { message: "reautenticação necessária: confirme sua senha" } }; }
      return { data: null, error: null };
    };
    wrap(<KycCenter />);
    const dlg = await openSeller("Juliana Prado");
    fireEvent.click(await within(dlg).findByRole("button", { name: "Aprovar verificação" }));
    await waitFor(() => expect(calls("admin_approve_seller_with_manager")).toHaveLength(2));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("Juliana Prado"));
    expect(calls("admin_approve_seller_with_manager")[1]).toEqual({ _seller: S1, _manager: null });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Verificação aprovada. O seller foi avisado."));
  });

  it("cancelar a senha devolve os botões sem aprovar", async () => {
    confirmMode = "cancel";
    handlers.admin_approve_seller_with_manager = () => ({ data: null, error: { message: "reautenticação necessária: confirme sua senha" } });
    wrap(<KycCenter />);
    const dlg = await openSeller("Juliana Prado");
    const btn = await within(dlg).findByRole("button", { name: "Aprovar verificação" });
    fireEvent.click(btn);
    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    await waitFor(() => expect(within(dlg).getByRole("button", { name: "Aprovar verificação" })).not.toBeDisabled());
    expect(calls("admin_approve_seller_with_manager")).toHaveLength(1);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("erro do servidor na decisão aparece dentro da ficha", async () => {
    handlers.admin_approve_seller_with_manager = () => ({ data: null, error: { message: "seller not found" } });
    wrap(<KycCenter />);
    const dlg = await openSeller("Juliana Prado");
    fireEvent.click(await within(dlg).findByRole("button", { name: "Aprovar verificação" }));
    expect(await within(dlg).findByRole("alert")).toHaveTextContent("Não foi possível concluir. Tente de novo.");
  });

  it("conta que não está em análise não tem botões de decisão", async () => {
    handlers.get_kyc_review = () => ({ data: review({ seller: { ...review().seller, account_status: "pending" }, submissions: [] }), error: null });
    wrap(<KycCenter />);
    const dlg = await openSeller("Juliana Prado");
    expect(await within(dlg).findByText(/ainda não enviou os documentos para análise/)).toBeInTheDocument();
    expect(within(dlg).queryByRole("button", { name: "Aprovar verificação" })).toBeNull();
  });
});

/* ───────── equipe (carteira do gerente) ───────── */

describe("Análise pela equipe", () => {
  const flags = { approveKyc: true, rejectKyc: true, editFees: false, editNotes: false, viewTransactions: false };
  const seller = (status: string) => ({ seller_user_id: S1, full_name: "Juliana Prado", email: "juliana@exemplo.com", account_status: status });

  it("sem envio não abre análise", () => {
    wrap(<StaffSellerPanel seller={seller("pending")} flags={flags} onClose={vi.fn()} onChanged={vi.fn()} />);
    expect(screen.getByText("O seller ainda não enviou os documentos para análise.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Analisar documentos/ })).toBeNull();
  });

  it("vê os documentos antes de decidir e a decisão passa por staff_review_kyc", async () => {
    const onChanged = vi.fn();
    handlers.get_kyc_review = () => ({ data: review({ is_admin: false, can_approve: false }), error: null });
    wrap(<StaffSellerPanel seller={seller("pending_review")} flags={flags} onClose={vi.fn()} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: /Analisar documentos/ }));
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByRole("img", { name: "Selfie com documento" })).toBeInTheDocument();
    expect(within(dlg).getByRole("button", { name: "Aprovar verificação" })).toBeDisabled();
    expect(within(dlg).getByText("Sua conta não tem permissão para aprovar.")).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: "Reprovar" }));
    fireEvent.change(within(dlg).getByLabelText("Motivo da reprovação"), { target: { value: "  Selfie sem o documento  " } });
    await act(async () => { fireEvent.click(within(dlg).getByRole("button", { name: "Reprovar e avisar o seller" })); });
    await waitFor(() => expect(calls("staff_review_kyc")).toEqual([{ _seller: S1, _approve: false, _reason: "Selfie sem o documento" }]));
    expect(onChanged).toHaveBeenCalled();
  });

  it("recusa do servidor vira mensagem clara", async () => {
    handlers.staff_review_kyc = () => ({ data: null, error: { message: "Seller not pending review" } });
    wrap(<StaffSellerPanel seller={seller("pending_review")} flags={flags} onClose={vi.fn()} onChanged={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Analisar documentos/ }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByRole("button", { name: "Aprovar verificação" }));
    expect(await within(dlg).findByRole("alert")).toHaveTextContent("Esta conta não está mais esperando análise.");
  });
});
