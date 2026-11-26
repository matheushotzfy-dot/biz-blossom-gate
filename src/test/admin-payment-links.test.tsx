import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Res = { data?: unknown; error?: unknown };
const rpc = vi.fn();
const state = { events: { data: [] } as Res };
function plain(result: () => Res) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "order", "limit", "in", "eq"]) b[m] = () => b;
  b.then = (res: (v: Res) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej);
  return b;
}
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (t: string) => plain(() => (t === "payment_link_events" ? state.events : { data: [] })) } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
const logAdminAction = vi.fn(async () => undefined);
vi.mock("@/lib/auditLog", () => ({ logAdminAction: (...a: unknown[]) => (logAdminAction as (...x: unknown[]) => unknown)(...a) }));
const askReason = vi.fn();
const askConfirm = vi.fn();
vi.mock("@/components/seller-ui/confirm", () => ({
  useReason: () => ({ ask: askReason, dialog: null }),
  useConfirm: () => ({ ask: askConfirm, dialog: null }),
}));

import { toast } from "sonner";
import AdminPaymentLinksTab from "@/pages/admin/tabs/AdminPaymentLinksTab";
import { dedupeEvents, linkSituation, moderationActions, parseLinksPage, publicLinkUrl, type LinkEvent } from "@/features/admin-payment-links/linksModel";

const NOW = Date.parse("2026-11-25T12:00:00Z");
const link = (id: string, over: Record<string, unknown> = {}) => ({
  id, user_id: "s1", seller_name: "Marina Duarte", seller_email: "marina@exemplo.com", title: `Link ${id}`, slug: `link-${id}`, amount: 100, is_active: true, archived_at: null,
  admin_status: "clear", admin_block_reason: null, admin_blocked_at: null, expires_at: null, max_uses: null, current_uses: 1, clicks: 5, pricing_type: "fixed", billing_type: "one_time",
  net_revenue: 93, pending_count: 0, last_payment_at: null, created_at: "2026-11-20T12:00:00Z", ...over,
});
const summary = { total: 40, active: 30, paused: 4, blocked: 3, review: 2, archived: 2, net_revenue: 1234.5 };
const pageOf = (items: unknown[], total = items.length) => ({ items, total, summary });

describe("linksModel", () => {
  it("situação: bloqueio vence tudo, depois arquivado, pausado, vencido, esgotado", () => {
    const base = link("a") as never;
    expect(linkSituation({ ...(base as object), admin_status: "blocked", archived_at: "x", is_active: false } as never, NOW).key).toBe("blocked");
    expect(linkSituation({ ...(base as object), archived_at: "2026-01-01" } as never, NOW).key).toBe("archived");
    expect(linkSituation({ ...(base as object), is_active: false } as never, NOW).key).toBe("paused");
    expect(linkSituation({ ...(base as object), expires_at: "2026-11-25T11:00:00Z" } as never, NOW).key).toBe("expired");
    expect(linkSituation({ ...(base as object), max_uses: 3, current_uses: 3 } as never, NOW).key).toBe("exhausted");
    expect(linkSituation({ ...(base as object), admin_status: "review" } as never, NOW).key).toBe("active");
  });
  it("ações oferecidas dependem do estado de moderação (inclui sair da revisão)", () => {
    expect(moderationActions({ admin_status: "clear" })).toEqual(["review", "block"]);
    expect(moderationActions({ admin_status: "review" })).toEqual(["clear", "block"]);
    expect(moderationActions({ admin_status: "blocked" })).toEqual(["unblock"]);
  });
  it("evento duplicado da regra do banco some quando existe o específico", () => {
    const ev = (id: string, event_type: string, created_at: string): LinkEvent => ({ id, event_type, actor_type: "admin", created_at, metadata: null });
    const out = dedupeEvents([ev("1", "admin_status_changed", "t1"), ev("2", "admin_status_blocked", "t1"), ev("3", "admin_status_changed", "t2")]);
    expect(out.map((e) => e.id)).toEqual(["2", "3"]);
  });
  it("página inesperada vira erro e números inválidos viram zero", () => {
    expect(() => parseLinksPage({})).toThrow();
    const p = parseLinksPage({ items: [link("a", { net_revenue: "x", pending_count: null })], total: "7", summary: { total: "oi" } });
    expect(p.items[0].net_revenue).toBe(0); expect(p.total).toBe(7); expect(p.summary.total).toBe(0);
  });
  it("endereço público é o da página do link (/pl/), não o checkout de produto", () => expect(publicLinkUrl("meu-link", "https://x.com")).toBe("https://x.com/pl/meu-link"));
});

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AdminPaymentLinksTab /></QueryClientProvider>);
}
const lastList = () => [...rpc.mock.calls].reverse().find((c) => c[0] === "get_admin_payment_links_page")?.[1] as Record<string, unknown>;
const table = () => screen.getByRole("table");

beforeEach(() => {
  rpc.mockReset(); askReason.mockReset(); askConfirm.mockReset(); logAdminAction.mockClear();
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear();
  state.events = { data: [] };
  rpc.mockImplementation(async (name: string) => (name === "get_admin_payment_links_page" ? { data: pageOf([link("a"), link("b", { admin_status: "review" }), link("c", { admin_status: "blocked", admin_block_reason: "golpe" })], 40), error: null } : { data: {}, error: null }));
});

describe("AdminPaymentLinksTab", () => {
  it("KPIs e contagens das pílulas vêm do resumo do banco", async () => {
    renderTab();
    await screen.findByRole("table");
    expect(screen.getByRole("button", { name: /Ativos · 30/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Em revisão · 2/ })).toBeTruthy();
    expect(screen.getByText(/1\.234,50/)).toBeTruthy();
    expect(within(table()).getAllByRole("row")).toHaveLength(4);
  });

  it("filtro e busca pedem ao banco e voltam para a página 1", async () => {
    renderTab();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: /Bloqueados · 3/ }));
    await waitFor(() => expect(lastList()._status).toBe("blocked"));
    fireEvent.change(screen.getByLabelText("Buscar link"), { target: { value: "  mentoria " } });
    await waitFor(() => expect(lastList()._search).toBe("mentoria"));
    expect(lastList()._page).toBe(1);
  });

  it("bloquear pede motivo, grava com o motivo e registra na auditoria", async () => {
    askReason.mockResolvedValue("Promete resultado garantido");
    renderTab();
    await screen.findByRole("table");
    fireEvent.click(within(table()).getByRole("button", { name: "Bloquear: Link a" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("admin_set_payment_link_status", { _payment_link_id: "a", _status: "blocked", _reason: "Promete resultado garantido" }));
    expect(askReason.mock.calls[0][0]).toMatchObject({ minLength: 5 });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Link bloqueado."));
    expect(logAdminAction).toHaveBeenCalledWith("payment_link_admin_status", "payment_link", "a", { status: "blocked", reason: "Promete resultado garantido" });
  });

  it("cancelar o pedido de motivo não muda nada", async () => {
    askReason.mockResolvedValue(null);
    renderTab();
    await screen.findByRole("table");
    fireEvent.click(within(table()).getByRole("button", { name: "Bloquear: Link a" }));
    await Promise.resolve();
    expect(rpc.mock.calls.some((c) => c[0] === "admin_set_payment_link_status")).toBe(false);
  });

  it("desbloquear confirma antes; recusar a confirmação não muda nada", async () => {
    askConfirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    renderTab();
    await screen.findByRole("table");
    const btn = within(table()).getByRole("button", { name: "Desbloquear: Link c" });
    fireEvent.click(btn);
    await waitFor(() => expect(askConfirm).toHaveBeenCalledTimes(1));
    expect(rpc.mock.calls.some((c) => c[0] === "admin_set_payment_link_status")).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("admin_set_payment_link_status", { _payment_link_id: "c", _status: "clear", _reason: null }));
  });

  it("link em revisão pode ser liberado sem passar por bloqueio", async () => {
    renderTab();
    await screen.findByRole("table");
    fireEvent.click(within(table()).getByRole("button", { name: "Liberar da revisão: Link b" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("admin_set_payment_link_status", { _payment_link_id: "b", _status: "clear", _reason: null }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Link liberado da revisão."));
  });

  it("falha ao atualizar avisa que nada mudou e não registra auditoria", async () => {
    askReason.mockResolvedValue("motivo válido");
    rpc.mockImplementation(async (name: string) => (name === "admin_set_payment_link_status" ? { data: null, error: { message: "forbidden" } } : { data: pageOf([link("a")]), error: null }));
    renderTab();
    await screen.findByRole("table");
    fireEvent.click(within(table()).getByRole("button", { name: "Bloquear: Link a" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(String(vi.mocked(toast.error).mock.calls[0][0])).toContain("Nada mudou");
    expect(logAdminAction).not.toHaveBeenCalled();
  });

  it("erro ao listar mostra mensagem e permite tentar de novo", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    renderTab();
    expect(await screen.findByText("Não foi possível carregar os links.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await screen.findByRole("table");
  });

  it("lista vazia com filtro oferece limpar; sem filtro explica que não há links", async () => {
    rpc.mockResolvedValue({ data: pageOf([], 0), error: null });
    renderTab();
    expect(await screen.findByText("Os vendedores ainda não criaram links de pagamento.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Pausados/ }));
    expect(await screen.findByText("Nenhum link bate com esses filtros.")).toBeTruthy();
  });

  it("histórico mostra rótulos em português, motivo, e esconde o evento duplicado", async () => {
    state.events = { data: [
      { id: "e1", event_type: "admin_status_changed", actor_type: "admin", created_at: "2026-11-24T10:00:00Z", metadata: { operation: "UPDATE" } },
      { id: "e2", event_type: "admin_status_blocked", actor_type: "admin", created_at: "2026-11-24T10:00:00Z", metadata: { reason: "golpe" } },
      { id: "e3", event_type: "created", actor_type: "seller", created_at: "2026-11-20T10:00:00Z", metadata: {} },
    ] };
    renderTab();
    await screen.findByRole("table");
    fireEvent.click(within(table()).getByRole("button", { name: "Ver histórico do link Link a" }));
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText("Bloqueado pela equipe")).toBeTruthy();
    expect(within(dlg).getByText("Motivo: golpe")).toBeTruthy();
    expect(within(dlg).getByText("Link criado")).toBeTruthy();
    expect(within(dlg).queryByText("Moderação alterada")).toBeNull();
    expect(within(dlg).queryByText(/UPDATE/)).toBeNull();
  });
});
