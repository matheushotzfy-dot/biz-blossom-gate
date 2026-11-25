import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Res = { data?: unknown; error?: unknown };
const rpc = vi.fn();
const from = vi.fn(() => ({}));
vi.mock("@/integrations/supabase/client", () => {
  const ch: Record<string, unknown> = {};
  ch.on = () => ch; ch.subscribe = () => ch;
  return { supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => (from as (...x: unknown[]) => unknown)(...a), channel: () => ch, removeChannel: vi.fn(), functions: { invoke: vi.fn() } } };
});
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
const askReason = vi.fn();
vi.mock("@/components/seller-ui/confirm", () => ({
  useReason: () => ({ ask: askReason, dialog: null }),
  useConfirm: () => ({ ask: vi.fn(), dialog: null }),
}));
const confirmSpy = vi.fn();
vi.mock("@/features/admin-finance/useSensitiveConfirm", () => ({
  useSensitiveConfirm: () => ({ confirm: (d: string, a: () => Promise<void>) => { confirmSpy(d); void a(); }, dialog: null }),
}));

import { toast } from "sonner";
import DisputesCenter from "@/features/admin-disputes/DisputesCenter";
import {
  checkDecision, checkOpen, checkRefund, deadlineInfo, decisionEffect, eventLabel, fitType, methodLabel, parseDisputesPage, parseEvents, parseSales,
  relativeSpan, remainingOf, saleBlockedForDispute, saleBlockedForRefund, statusInfo, typeLabel, typeProblem, type SaleHit,
} from "@/features/admin-disputes/disputesModel";

/* ───────── dados ───────── */

const hoursFromNow = (h: number) => new Date(Date.now() + h * 36e5).toISOString();
const dispute = (over: Record<string, unknown> = {}) => ({
  id: "d1", transaction_id: "8f2a1c9e-0000-4000-8000-000000000001", seller_user_id: "s1", seller_name: "Marina Duarte", seller_email: "marina@exemplo.com",
  type: "medpix", status: "open", reason: "Cliente contestou o Pix no banco.", amount: 197, buyer_name: "Ana Souza", buyer_email: "ana@exemplo.com",
  created_at: hoursFromNow(-70), response_deadline: hoursFromNow(-3), seller_response: null, seller_responded_at: null, admin_notes: null, fee_amount: 0,
  resolved_at: null, external_ref: null, evidence: [], held_amount: 183.21, payment_method: "pix", tx_amount: 197, product_name: "Método Lançamento 7D", ...over,
});
const summary = (over: Record<string, unknown> = {}) => ({ all: 3, active: 2, open: 1, in_review: 1, seller: 0, buyer: 1, overdue: 1, soon: 0, held: 273.41, active_amount: 294, lost_amount: 297, fees: 12.5, ...over });
const counts = (over: Record<string, unknown> = {}) => ({ all: 2, medpix: 1, pre_med_pix: 0, refund: 0, chargeback: 1, ...over });
const pageOf = (items: unknown[], over: Record<string, unknown> = {}) => ({ items, total: items.length, summary: summary(), type_counts: counts(), ...over });

const SALE_PIX = { id: "8f2a1c9e-0000-4000-8000-000000000011", amount: 197, refunded_amount: 0, status: "approved", payment_method: "pix", customer_name: "Ana Souza", customer_email: "ana@exemplo.com", created_at: "2026-11-20T12:00:00Z", is_simulated: false, seller_name: "Marina Duarte", product_name: "Método Lançamento 7D", open_dispute: false, pending_refund: false };
const SALE_CARD = { ...SALE_PIX, id: "3b7d44aa-0000-4000-8000-000000000012", amount: 97, refunded_amount: 40, status: "partially_refunded", payment_method: "credit_card", customer_name: null, customer_email: "ana.souza@exemplo.com" };
const SALE_OPEN = { ...SALE_PIX, id: "5c1e0000-0000-4000-8000-000000000013", status: "disputed", open_dispute: true, customer_name: "Ana Paula", customer_email: "anapaula@exemplo.com" };

const handlers: Record<string, (a: Record<string, unknown>) => Res> = {};
const calls = (name: string) => rpc.mock.calls.filter((c) => c[0] === name).map((c) => c[1] as Record<string, unknown>);
const lastList = () => calls("get_admin_disputes_page").at(-1)!;

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
const tableRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
const sheet = () => screen.getByRole("dialog");

beforeEach(() => {
  rpc.mockReset(); from.mockClear(); askReason.mockReset(); confirmSpy.mockClear();
  for (const k of Object.keys(handlers)) delete handlers[k];
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear();
  handlers.get_admin_disputes_page = () => ({ data: pageOf([dispute(), dispute({ id: "d2", type: "chargeback", status: "in_review", seller_name: "Loja do Caio", amount: 97, payment_method: "credit_card", response_deadline: hoursFromNow(20) })]), error: null });
  handlers.get_admin_dispute_events = () => ({ data: [{ id: "e1", event: "opened", note: "Cliente contestou o Pix no banco.", created_at: "2026-11-22T10:00:00Z", actor_name: "Admin" }], error: null });
  handlers.admin_search_sales = (a) => ({ data: String(a._query).includes("zzz") ? [] : [SALE_PIX, SALE_CARD, SALE_OPEN], error: null });
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (handlers[name] ? handlers[name](args) : { data: null, error: null }));
});

/* ───────── modelo ───────── */

describe("disputesModel", () => {
  it("nomes em português", () => {
    expect(typeLabel("medpix")).toBe("MED Pix");
    expect(typeLabel("pre_med_pix")).toBe("Pré-MED");
    expect(typeLabel("x")).toBe("Outro tipo");
    expect(methodLabel("pix")).toBe("Pix");
    expect(methodLabel("credit_card")).toBe("Cartão");
    expect(methodLabel(null)).toBe("—");
    expect(eventLabel("won_by_seller")).toBe("Decidida a favor do seller");
    expect(eventLabel("lost_by_seller")).toBe("Decidida contra o seller");
    expect(eventLabel("zzz")).toBe("Outra atualização");
  });

  it("situação: defesa recebida e decisões", () => {
    expect(statusInfo({ status: "open", seller_response: null })).toEqual({ label: "Aguardando defesa", tone: "warning" });
    expect(statusInfo({ status: "open", seller_response: "oi" })).toEqual({ label: "Defesa recebida", tone: "info" });
    expect(statusInfo({ status: "in_review", seller_response: null }).label).toBe("Em análise");
    expect(statusInfo({ status: "resolved_seller", seller_response: null }).tone).toBe("success");
    expect(statusInfo({ status: "resolved_buyer", seller_response: null }).tone).toBe("destructive");
  });

  it("tempo relativo e prazo da defesa", () => {
    expect(relativeSpan(3 * 36e5)).toBe("em 3 h");
    expect(relativeSpan(-5 * 36e5)).toBe("há 5 h");
    expect(relativeSpan(-3 * 864e5)).toBe("há 3 dias");
    expect(relativeSpan(20 * 60_000)).toBe("em 20 min");
    const now = Date.parse("2026-11-25T12:00:00Z");
    const base = { status: "open", seller_response: null };
    expect(deadlineInfo({ ...base, response_deadline: "2026-11-25T09:00:00Z" }, now)).toEqual({ label: "Prazo venceu há 3 h", tone: "destructive" });
    expect(deadlineInfo({ ...base, response_deadline: "2026-11-26T09:00:00Z" }, now)).toEqual({ label: "Prazo vence em 21 h", tone: "warning" });
    expect(deadlineInfo({ ...base, response_deadline: "2026-11-30T12:00:00Z" }, now)).toEqual({ label: "Prazo vence em 5 dias", tone: "neutral" });
    expect(deadlineInfo({ ...base, response_deadline: null }, now)?.label).toBe("Sem prazo definido");
    expect(deadlineInfo({ status: "open", seller_response: "x", response_deadline: "2026-11-20T00:00:00Z" }, now)?.label).toBe("Defesa enviada");
    expect(deadlineInfo({ status: "resolved_seller", seller_response: null, response_deadline: "2026-11-20T00:00:00Z" }, now)).toBeNull();
  });

  it("MED só vale no Pix e chargeback só no cartão", () => {
    expect(typeProblem("medpix", { payment_method: "credit_card" })).toMatch(/só vale para venda no Pix.*Cartão/);
    expect(typeProblem("pre_med_pix", { payment_method: "boleto" })).toMatch(/Pré-MED só vale/);
    expect(typeProblem("chargeback", { payment_method: "pix" })).toMatch(/Chargeback só vale para venda no cartão/);
    expect(typeProblem("refund", { payment_method: "pix" })).toBeNull();
    expect(typeProblem("medpix", null)).toBeNull();
    expect(fitType("chargeback", { payment_method: "pix" })).toBe("medpix");
    expect(fitType("medpix", { payment_method: "credit_card" })).toBe("chargeback");
    expect(fitType("medpix", { payment_method: "boleto" })).toBe("refund");
    expect(fitType("refund", { payment_method: "pix" })).toBe("refund");
  });

  it("quais vendas aceitam disputa e reembolso", () => {
    const sale = (o: Partial<SaleHit>): SaleHit => ({ ...(SALE_PIX as SaleHit), ...o });
    expect(saleBlockedForDispute(sale({}))).toBeNull();
    expect(saleBlockedForDispute(sale({ is_simulated: true }))).toMatch(/simulada/);
    expect(saleBlockedForDispute(sale({ open_dispute: true }))).toMatch(/já existe uma disputa/i);
    expect(saleBlockedForDispute(sale({ status: "waiting_payment" }))).toMatch(/não está paga/);
    expect(saleBlockedForDispute(sale({ refunded_amount: 197 }))).toMatch(/toda reembolsada/);
    expect(saleBlockedForRefund(sale({}))).toBeNull();
    expect(saleBlockedForRefund(sale({ status: "disputed" }))).toMatch(/decida a disputa/);
    expect(saleBlockedForRefund(sale({ pending_refund: true }))).toMatch(/aguardando confirmação/);
    expect(remainingOf({ amount: 97, refunded_amount: 40 })).toBe(57);
    expect(remainingOf({ amount: 97, refunded_amount: 120 })).toBe(0);
  });

  it("valida abertura, reembolso e decisão antes de enviar", () => {
    const pix = SALE_PIX as SaleHit; const card = SALE_CARD as SaleHit;
    expect(checkOpen(null, "medpix", "motivo ok", 7)).toBe("Escolha a venda.");
    expect(checkOpen(pix, "medpix", "abc", 7)).toMatch(/motivo/);
    expect(checkOpen(pix, "medpix", "motivo ok", 0)).toMatch(/1 a 30/);
    expect(checkOpen(pix, "medpix", "motivo ok", 31)).toMatch(/1 a 30/);
    expect(checkOpen(card, "medpix", "motivo ok", 7)).toMatch(/só vale para venda no Pix/);
    expect(checkOpen(pix, "medpix", "motivo ok", 7)).toBeNull();
    expect(checkRefund(card, 0, "motivo ok")).toMatch(/valor/);
    expect(checkRefund(card, 58, "motivo ok")).toMatch(/passa do que ainda pode/);
    expect(checkRefund(card, 57, "abc")).toMatch(/motivo/);
    expect(checkRefund(card, 57, "motivo ok")).toBeNull();
    expect(checkRefund(SALE_OPEN as SaleHit, 10, "motivo ok")).toMatch(/decida a disputa/);
    expect(checkDecision("seller", "  ", 0, 197)).toMatch(/justificativa/);
    expect(checkDecision("buyer", "sem defesa", 300, 197)).toMatch(/taxa não pode passar/);
    expect(checkDecision("buyer", "sem defesa", 12.5, 197)).toBeNull();
    expect(checkDecision("seller", "tem prova", 0, 197)).toBeNull();
  });

  it("diz o que a decisão faz no saldo", () => {
    const fmt = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
    expect(decisionEffect("seller", { held_amount: 183.21, type: "medpix" }, 0, fmt)).toBe("O seller ganha: R$ 183,21 voltam para o saldo dele e a venda volta a ser aprovada.");
    expect(decisionEffect("buyer", { held_amount: 183.21, type: "medpix" }, 12.5, fmt)).toMatch(/O seller perde: R\$ 183,21 deixam o saldo dele e uma taxa de R\$ 12,50 é debitada/);
    expect(decisionEffect("buyer", { held_amount: 90, type: "chargeback" }, 0, fmt)).not.toMatch(/taxa/);
  });

  it("lê as respostas do servidor e recusa formato errado", () => {
    expect(() => parseDisputesPage(null)).toThrow();
    expect(() => parseDisputesPage({ items: "x" })).toThrow();
    expect(() => parseEvents({})).toThrow();
    expect(() => parseSales("x")).toThrow();
    expect(parseSales(null)).toEqual([]);
    const p = parseDisputesPage({ items: [{ id: "a", amount: "12.5", evidence: ["https://x.com", 3, ""], seller_email: "s@x.com" }], total: "1" });
    expect(p.items[0]).toMatchObject({ amount: 12.5, seller_name: "s@x.com", evidence: ["https://x.com"] });
    expect(p.total).toBe(1);
    expect(p.summary.active).toBe(0);
    expect(p.typeCounts.all).toBe(0);
  });
});

/* ───────── tela ───────── */

describe("DisputesCenter", () => {
  it("lista do servidor com cartões de resumo, status e prazo", async () => {
    wrap(<DisputesCenter initialType="medpix" />);
    expect((await screen.findAllByText("Marina Duarte", { selector: "p" })).length).toBeGreaterThan(0);
    expect(lastList()).toEqual({ _type: "medpix", _status: "active", _search: null, _page: 1, _page_size: 25 });
    expect(screen.getByRole("heading", { level: 1, name: "MED Pix" })).toBeInTheDocument();
    expect(screen.getByText("1 com prazo vencido")).toBeInTheDocument();
    const rows = tableRows();
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Aguardando defesa")).toBeInTheDocument();
    expect(within(rows[0]).getByText(/Prazo venceu há 3 h/)).toBeInTheDocument();
    expect(within(rows[0]).getByText(/R\$\s183,21 congelados/)).toBeInTheDocument();
    expect(within(rows[1]).getByText("Em análise")).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s273,41/).length).toBeGreaterThan(0);
    expect(from).not.toHaveBeenCalled();
  });

  it("filtros e busca vão para o servidor e voltam à página 1", async () => {
    wrap(<DisputesCenter />);
    await screen.findAllByText("Marina Duarte");
    expect(lastList()._type).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Chargeback/ }));
    await waitFor(() => expect(lastList()._type).toBe("chargeback"));
    expect(screen.getByRole("heading", { level: 1, name: "Chargeback" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Contra o seller/ }));
    await waitFor(() => expect(lastList()._status).toBe("buyer"));
    fireEvent.change(screen.getByLabelText("Buscar disputas"), { target: { value: "  ana  " } });
    await waitFor(() => expect(lastList()._search).toBe("ana"));
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(lastList()).toMatchObject({ _status: "active", _search: null }));
  });

  it("mostra os números nas pílulas", async () => {
    wrap(<DisputesCenter />);
    await screen.findAllByText("Marina Duarte");
    expect(screen.getByRole("button", { name: "MED Pix · 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Em aberto · 2" })).toBeInTheDocument();
  });

  it("erro de carga aparece com 'Tentar de novo' e não como lista vazia", async () => {
    let fail = true;
    handlers.get_admin_disputes_page = () => (fail ? { data: null, error: { message: "Sem conexão. Tente novamente." } } : { data: pageOf([dispute()]), error: null });
    wrap(<DisputesCenter />);
    expect(await screen.findByText("Não foi possível carregar as disputas.")).toBeInTheDocument();
    expect(screen.getAllByText("Indisponível").length).toBeGreaterThan(0);
    expect(screen.queryByText("Nenhuma disputa em aberto")).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findAllByText("Marina Duarte")).not.toHaveLength(0);
  });

  it("estados vazios: sem disputas e filtro sem resultado", async () => {
    handlers.get_admin_disputes_page = () => ({ data: pageOf([], { summary: summary({ all: 0, active: 0, open: 0, in_review: 0, buyer: 0, overdue: 0, held: 0, active_amount: 0 }), type_counts: counts({ all: 0, medpix: 0, chargeback: 0 }) }), error: null });
    wrap(<DisputesCenter />);
    expect(await screen.findByText("Nenhuma disputa em aberto")).toBeInTheDocument();
    expect(screen.getByText("Nada em aberto")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar disputas"), { target: { value: "zzz" } });
    expect(await screen.findByText("Nada por aqui")).toBeInTheDocument();
  });
});

/* ───────── detalhe e decisão ───────── */

async function openFirst() {
  wrap(<DisputesCenter initialType="medpix" />);
  await screen.findAllByText("Marina Duarte");
  fireEvent.click(screen.getAllByRole("button", { name: /Analisar MED Pix de Marina Duarte/ })[0]);
  return await screen.findByRole("dialog");
}

describe("detalhe da disputa", () => {
  it("mostra venda, defesa, histórico e só abre link http(s)", async () => {
    handlers.get_admin_disputes_page = () => ({
      data: pageOf([dispute({ seller_response: "Entrega comprovada.", seller_responded_at: "2026-11-23T10:00:00Z", evidence: ["https://exemplo.com/prova.pdf", "javascript:alert(1)"] })]), error: null,
    });
    const dlg = await openFirst();
    expect(within(dlg).getByText("Entrega comprovada.")).toBeInTheDocument();
    expect(within(dlg).getByText("Cliente contestou o Pix no banco.", { selector: "p.whitespace-pre-wrap" })).toBeInTheDocument();
    const link = within(dlg).getByRole("link", { name: "exemplo.com" });
    expect(link).toHaveAttribute("href", "https://exemplo.com/prova.pdf");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(dlg).getAllByRole("link")).toHaveLength(1);
    expect(within(dlg).getByText(/Link não aberto por segurança: javascript:alert\(1\)/)).toBeInTheDocument();
    expect(await within(dlg).findByText("Disputa aberta")).toBeInTheDocument();
    expect(calls("get_admin_dispute_events")).toEqual([{ _id: "d1" }]);
  });

  it("decidir contra o seller: pede justificativa, confirma com senha e envia taxa", async () => {
    const dlg = await openFirst();
    fireEvent.click(within(dlg).getByRole("button", { name: "Registrar decisão" }));
    expect(await within(dlg).findByText("Escolha quem ganha a disputa.", { selector: "p[role=alert]" })).toBeInTheDocument();
    expect(calls("admin_resolve_dispute")).toHaveLength(0);

    fireEvent.click(within(dlg).getByRole("radio", { name: /Seller perdeu/ }));
    expect(within(dlg).getByText(/O seller perde: R\$\s183,21 deixam o saldo dele\./)).toBeInTheDocument();
    fireEvent.change(within(dlg).getByLabelText("Taxa da disputa"), { target: { value: "1250" } });
    expect(within(dlg).getByText(/uma taxa de R\$\s12,50 é debitada/)).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: "Registrar decisão" }));
    expect(calls("admin_resolve_dispute")).toHaveLength(0);
    expect(confirmSpy).not.toHaveBeenCalled();

    fireEvent.change(within(dlg).getByLabelText("Justificativa"), { target: { value: "Seller não respondeu no prazo." } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Registrar decisão" }));
    await waitFor(() => expect(calls("admin_resolve_dispute")).toHaveLength(1));
    expect(calls("admin_resolve_dispute")[0]).toEqual({ _dispute_id: "d1", _outcome: "buyer", _fee: 12.5, _note: "Seller não respondeu no prazo." });
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toMatch(/contra o seller/);
    expect(confirmSpy.mock.calls[0][0]).toMatch(/O seller perde/);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/contra o seller/)));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(from).not.toHaveBeenCalled();
  });

  it("decidir a favor do seller não manda taxa", async () => {
    const dlg = await openFirst();
    fireEvent.click(within(dlg).getByRole("radio", { name: /Seller ganhou/ }));
    expect(within(dlg).queryByLabelText("Taxa da disputa")).not.toBeInTheDocument();
    fireEvent.change(within(dlg).getByLabelText("Justificativa"), { target: { value: "Comprovante de entrega ok." } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Registrar decisão" }));
    await waitFor(() => expect(calls("admin_resolve_dispute")).toHaveLength(1));
    expect(calls("admin_resolve_dispute")[0]).toEqual({ _dispute_id: "d1", _outcome: "seller", _fee: 0, _note: "Comprovante de entrega ok." });
  });

  it("falha da decisão fica dentro do diálogo e nada fecha", async () => {
    handlers.admin_resolve_dispute = () => ({ data: null, error: { message: "reautenticação necessária: confirme sua senha" } });
    const dlg = await openFirst();
    fireEvent.click(within(dlg).getByRole("radio", { name: /Seller ganhou/ }));
    fireEvent.change(within(dlg).getByLabelText("Justificativa"), { target: { value: "Comprovante de entrega ok." } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Registrar decisão" }));
    expect(await within(dlg).findByText("reautenticação necessária: confirme sua senha")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("mover para análise pede a anotação e some o botão depois que já está em análise", async () => {
    askReason.mockResolvedValue("Pedi o comprovante ao seller");
    const dlg = await openFirst();
    fireEvent.click(within(dlg).getByRole("button", { name: "Mover para análise" }));
    await waitFor(() => expect(calls("admin_set_dispute_review")).toHaveLength(1));
    expect(calls("admin_set_dispute_review")[0]).toEqual({ _dispute_id: "d1", _note: "Pedi o comprovante ao seller" });
    expect(askReason).toHaveBeenCalledWith(expect.objectContaining({ minLength: 3 }));
  });

  it("mover para análise cancelado não envia nada", async () => {
    askReason.mockResolvedValue(null);
    const dlg = await openFirst();
    fireEvent.click(within(dlg).getByRole("button", { name: "Mover para análise" }));
    await waitFor(() => expect(askReason).toHaveBeenCalled());
    expect(calls("admin_set_dispute_review")).toHaveLength(0);
  });

  it("disputa já decidida mostra a decisão e não oferece ação", async () => {
    handlers.get_admin_disputes_page = () => ({
      data: pageOf([dispute({ status: "resolved_buyer", fee_amount: 12.5, admin_notes: "Seller não respondeu no prazo.", resolved_at: "2026-11-24T12:00:00Z" })]), error: null,
    });
    wrap(<DisputesCenter initialType="medpix" />);
    await screen.findAllByText("Marina Duarte");
    fireEvent.change(screen.getByLabelText("Buscar disputas"), { target: { value: "" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Ver MED Pix de Marina Duarte/ })[0]);
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText(/Contra o seller em 24\/11\/2026/)).toBeInTheDocument();
    expect(within(dlg).getByText(/Taxa cobrada do seller: R\$\s12,50/)).toBeInTheDocument();
    expect(within(dlg).getByText("Seller não respondeu no prazo.")).toBeInTheDocument();
    expect(within(dlg).queryByRole("button", { name: "Registrar decisão" })).not.toBeInTheDocument();
    expect(within(dlg).queryByRole("button", { name: "Mover para análise" })).not.toBeInTheDocument();
  });
});

/* ───────── abrir disputa ───────── */

describe("abrir disputa", () => {
  it("busca a venda (mínimo 3 letras), escolhe o tipo que combina e envia depois da senha", async () => {
    wrap(<DisputesCenter initialType="chargeback" />);
    await screen.findAllByText("Marina Duarte");
    fireEvent.click(screen.getByRole("button", { name: /Abrir disputa/ }));
    const dlg = await screen.findByRole("dialog");
    const search = within(dlg).getByLabelText("Venda");
    fireEvent.change(search, { target: { value: "an" } });
    expect(within(dlg).getByText(/Digite pelo menos 3 caracteres/)).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "ana" } });
    await waitFor(() => expect(calls("admin_search_sales")).toEqual([{ _query: "ana" }]));
    const options = await within(dlg).findAllByRole("button", { name: /Ana/ });
    // a venda que já tem disputa não pode ser escolhida
    const blocked = options.find((b) => /anapaula/.test(b.textContent ?? ""))!;
    expect(blocked).toBeDisabled();
    expect(within(blocked).getByText("Já existe uma disputa em aberto nesta venda.")).toBeInTheDocument();
    // escolhe a venda no Pix com o tipo padrão "Chargeback" → vira MED Pix sozinho
    fireEvent.click(options.find((b) => /ana@exemplo/.test(b.textContent ?? ""))!);
    expect(within(dlg).getByRole("radio", { name: "MED Pix" })).toHaveAttribute("aria-checked", "true");
    // escolher um tipo que não combina mostra o aviso e não envia
    fireEvent.click(within(dlg).getByRole("radio", { name: "Chargeback" }));
    expect(within(dlg).getByText(/Chargeback só vale para venda no cartão. Esta foi paga com Pix./)).toBeInTheDocument();
    fireEvent.change(within(dlg).getByLabelText("Motivo"), { target: { value: "Cliente contestou no banco" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Abrir e congelar" }));
    expect(calls("admin_open_dispute")).toHaveLength(0);
    fireEvent.click(within(dlg).getByRole("radio", { name: "MED Pix" }));
    fireEvent.change(within(dlg).getByLabelText("Prazo de defesa do seller"), { target: { value: "5" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Abrir e congelar" }));
    await waitFor(() => expect(calls("admin_open_dispute")).toHaveLength(1));
    expect(calls("admin_open_dispute")[0]).toEqual({ _transaction_id: SALE_PIX.id, _type: "medpix", _reason: "Cliente contestou no banco", _deadline_days: 5 });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/Abrir MED Pix na venda 8f2a1c9e/);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/MED Pix aberto/)));
  });

  it("busca sem resultado e erro de busca são ditos", async () => {
    wrap(<DisputesCenter />);
    await screen.findAllByText("Marina Duarte");
    fireEvent.click(screen.getByRole("button", { name: /Abrir disputa/ }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Venda"), { target: { value: "zzz" } });
    expect(await within(dlg).findByText(/Nenhuma venda encontrada para “zzz”/)).toBeInTheDocument();
    handlers.admin_search_sales = () => ({ data: null, error: { message: "Sem conexão. Tente novamente." } });
    fireEvent.change(within(dlg).getByLabelText("Venda"), { target: { value: "carlos" } });
    expect(await within(dlg).findByText(/Sem conexão/)).toBeInTheDocument();
    expect(within(dlg).getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});

/* ───────── reembolso ───────── */

describe("reembolsar venda", () => {
  it("sugere o que ainda resta, barra valor acima e envia depois da senha", async () => {
    handlers.admin_refund_transaction = () => ({ data: { partial: true, request_id: "rq1" }, error: null });
    wrap(<DisputesCenter initialType="refund" />);
    await screen.findAllByText("Marina Duarte");
    fireEvent.click(screen.getByRole("button", { name: /Reembolsar venda/ }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Venda"), { target: { value: "ana" } });
    const options = await within(dlg).findAllByRole("button", { name: /ana/i });
    const disputed = options.find((b) => /anapaula/.test(b.textContent ?? ""))!;
    expect(disputed).toBeDisabled();
    expect(within(disputed).getByText("Venda em disputa: decida a disputa antes de reembolsar.")).toBeInTheDocument();
    fireEvent.click(options.find((b) => /ana\.souza/.test(b.textContent ?? ""))!);
    expect(within(dlg).getByLabelText("Valor a reembolsar")).toHaveValue("57,00");
    expect(within(dlg).getByText(/Já reembolsado: R\$\s40,00\. Ainda pode: R\$\s57,00\./)).toBeInTheDocument();

    fireEvent.change(within(dlg).getByLabelText("Valor a reembolsar"), { target: { value: "6000" } });
    fireEvent.change(within(dlg).getByLabelText("Motivo"), { target: { value: "Produto fora do ar" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Reembolsar" }));
    expect(await within(dlg).findByText("O valor passa do que ainda pode ser reembolsado.", { selector: "p[role=alert]" })).toBeInTheDocument();
    expect(calls("admin_refund_transaction")).toHaveLength(0);

    fireEvent.change(within(dlg).getByLabelText("Valor a reembolsar"), { target: { value: "2000" } });
    expect(within(dlg).getByText(/Reembolso parcial/)).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: "Reembolsar" }));
    await waitFor(() => expect(calls("admin_refund_transaction")).toHaveLength(1));
    expect(calls("admin_refund_transaction")[0]).toEqual({ _transaction_id: SALE_CARD.id, _amount: 20, _reason: "Produto fora do ar" });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/Reembolsar R\$\s20,00 da venda 3b7d44aa/);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Reembolso parcial registrado.", expect.objectContaining({ description: expect.stringMatching(/Pendentes de aprovação/) })));
  });

  it("o toast leva para Pendentes de aprovação", async () => {
    const onNavigate = vi.fn();
    handlers.admin_refund_transaction = () => ({ data: { partial: false }, error: null });
    wrap(<DisputesCenter initialType="refund" onNavigate={onNavigate} />);
    await screen.findAllByText("Marina Duarte");
    fireEvent.click(screen.getByRole("button", { name: /Reembolsar venda/ }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.change(within(dlg).getByLabelText("Venda"), { target: { value: "ana" } });
    const options = await within(dlg).findAllByRole("button", { name: /Ana/ });
    fireEvent.click(options.find((b) => /ana@exemplo/.test(b.textContent ?? ""))!);
    fireEvent.change(within(dlg).getByLabelText("Motivo"), { target: { value: "Pedido do cliente" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Reembolsar" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const [msg, opts] = vi.mocked(toast.success).mock.calls[0] as [string, { action: { label: string; onClick: () => void } }];
    expect(msg).toBe("Reembolso total registrado.");
    opts.action.onClick();
    expect(onNavigate).toHaveBeenCalledWith("refund-approvals");
    expect(calls("admin_refund_transaction")[0]._amount).toBe(197);
  });
});
