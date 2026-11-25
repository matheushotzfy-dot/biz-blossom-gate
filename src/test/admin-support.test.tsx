import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Res = { data?: unknown; error?: unknown };
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => {
  const ch: Record<string, unknown> = {};
  ch.on = () => ch; ch.subscribe = () => ch;
  return { supabase: { rpc: (...a: unknown[]) => rpc(...a), from: () => ({}), channel: () => ch, removeChannel: vi.fn(), functions: { invoke: vi.fn() } } };
});
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock("@/hooks/useTicketTyping", () => ({ useTicketTyping: () => ({ others: [], notifyTyping: vi.fn() }) }));
const upload = vi.fn();
const discard = vi.fn();
vi.mock("@/lib/ticketAttachments", async (orig) => ({
  ...(await orig<typeof import("@/lib/ticketAttachments")>()),
  uploadTicketAttachments: (...a: unknown[]) => upload(...a),
  discardAttachments: (...a: unknown[]) => discard(...a),
  playIncomingBeep: vi.fn(),
}));

import { toast } from "sonner";
import SupportCenter from "@/features/admin-support/SupportCenter";
import {
  durationLabel, emptyCopy, parseSupportPage, parseTicketDetail, previewLine, priorityInfo, replyProblem, salesText, sellerName, ticketRef, withQuickReply,
  messageLabel, accountStatusLabel, MESSAGE_MAX,
} from "@/features/admin-support/supportAdminModel";

/* ───────── dados ───────── */

const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();
const ID1 = "847a1c39-0000-4000-8000-000000000001";
const ID2 = "e5f6a7b8-0000-4000-8000-000000000002";
const ID3 = "aaaa1111-0000-4000-8000-000000000003";

const row = (over: Record<string, unknown> = {}) => ({
  id: ID1, subject: "Saque pendente há 3 dias", first: "Meu saque está pendente.", status: "open", stage: "waiting", priority: "urgent",
  created_at: ago(48), last_message_at: ago(5), replied_at: ago(30), unread_by_staff: 2, last_sender: "customer", last_body: "Entendi, mas já faz mais de 72 horas.",
  user: { user_id: "u1", name: "Marina Duarte", email: "marina@exemplo.com" }, ...over,
});
const rows = () => [
  row(),
  row({ id: ID2, subject: "Como configurar o webhook", priority: "high", unread_by_staff: 0, last_body: "Erro 401 ao validar.", user: { user_id: "u2", name: "Loja do Caio", email: "caio@exemplo.com" } }),
];
const page = (items: unknown[] = rows(), over: Record<string, unknown> = {}) => ({
  items, total: items.length, can_reply: true,
  counts: { waiting: 2, unread: 1, urgent: 1, answered: 3, done: 4, all: 9 },
  program: { waiting: 2, waiting_since: ago(5), unread: 2, unread_tickets: 1, urgent: 1, answered: 3, done: 4, total: 9, median_first_reply_seconds: 1500, reply_sample: 6 },
  ...over,
});
const msg = (over: Record<string, unknown> = {}) => ({
  id: "m1", sender_type: "customer", sender_name: null, sender_role: null, body: "Categoria: Saques e financeiro\nReferência: saque 4F2A\n\nMeu saque de R$ 1.200,00 está pendente.",
  created_at: ago(30), attachments: [], ...over,
});
const detail = (over: Record<string, unknown> = {}) => ({
  id: ID1, subject: "Saque pendente há 3 dias", first: "Meu saque está pendente.", status: "open", stage: "waiting", priority: "urgent",
  created_at: ago(48), last_message_at: ago(5), replied_at: ago(30), unread_by_staff: 2, can_reply: true, messages_total: 2,
  messages: [msg(), msg({ id: "m2", sender_type: "staff", sender_name: "Admin", sender_role: "admin", body: "Oi, Marina! Veja https://exemplo.com/ajuda", created_at: ago(29) })],
  user: {
    user_id: "u1", name: "Marina Duarte", email: "marina@exemplo.com", account_status: "approved", joined_at: ago(24 * 90), sales: 12, gross: 4500.5, last_sale: ago(3), tickets_total: 2,
    previous: [{ id: ID3, subject: "Alterar chave Pix", status: "closed", stage: "done", created_at: ago(24 * 20) }],
  }, ...over,
});

const handlers: Record<string, (a: Record<string, unknown>) => Res> = {};
const calls = (n: string) => rpc.mock.calls.filter((c) => c[0] === n).map((c) => c[1] as Record<string, unknown>);

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  rpc.mockReset(); upload.mockReset(); discard.mockReset();
  upload.mockResolvedValue([]); discard.mockResolvedValue(undefined);
  for (const k of Object.keys(handlers)) delete handlers[k];
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear();
  handlers.get_admin_support_page = () => ({ data: page(), error: null });
  handlers.get_admin_support_ticket = (a) => ({ data: a._id === ID2 ? detail({ id: ID2, subject: "Como configurar o webhook", priority: "high", unread_by_staff: 0 }) : a._id === ID3 ? detail({ id: ID3, subject: "Alterar chave Pix", stage: "done", status: "closed", priority: "normal", unread_by_staff: 0 }) : detail(), error: null });
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (handlers[name] ? handlers[name](args) : { data: { ok: true }, error: null }));
});

const open = async (name = /Saque pendente há 3 dias/) => {
  fireEvent.click(await screen.findByRole("button", { name }));
  await screen.findByRole("log", { name: "Mensagens do chamado" });
};
const textbox = () => screen.getByRole("textbox", { name: "Resposta ao seller" }) as HTMLTextAreaElement;

/* ───────── modelo ───────── */

describe("modelo do suporte do admin", () => {
  it("lê a lista e o detalhe com tolerância, e recusa resposta que não é do servidor", () => {
    const p = parseSupportPage(page([row({ stage: "estranho", unread_by_staff: -3, last_sender: "x" })]));
    expect(p.items[0].stage).toBe("waiting");
    expect(p.items[0].unread_by_staff).toBe(0);
    expect(p.items[0].last_sender).toBeNull();
    expect(p.counts.all).toBe(9);
    expect(parseSupportPage({ items: [], program: { median_first_reply_seconds: null } }).program.median_first_reply_seconds).toBeNull();
    expect(() => parseSupportPage(null)).toThrow();
    expect(() => parseSupportPage({ total: 1 })).toThrow();
    expect(() => parseTicketDetail({})).toThrow();
    const d = parseTicketDetail(detail({ messages_total: 0 }));
    expect(d.messages_total).toBe(2);
    expect(d.messages[1].sender_type).toBe("staff");
    expect(d.user.previous[0].stage).toBe("done");
  });

  it("descarta anexo malformado e nunca marca resposta como permitida sem o servidor dizer", () => {
    const d = parseTicketDetail(detail({ can_reply: "true", messages: [msg({ attachments: [{ path: "a/b.png", name: "b.png", size: 10, type: "image/png" }, { path: 1 }, "x"] })] }));
    expect(d.can_reply).toBe(false);
    expect(d.messages[0].attachments).toHaveLength(1);
  });

  it("escreve tempos, referências e prévias em português claro", () => {
    expect(durationLabel(20)).toBe("menos de 1 min");
    expect(durationLabel(12 * 60)).toBe("12 min");
    expect(durationLabel(3 * 3600 + 20 * 60)).toBe("3 h 20 min");
    expect(durationLabel(5 * 3600)).toBe("5 h");
    expect(durationLabel(86400)).toBe("1 dia");
    expect(durationLabel(3 * 86400)).toBe("3 dias");
    expect(ticketRef("847a1c39-0000-4000-8000-000000000001")).toBe("#847A1C39");
    expect(sellerName({ name: null, email: "a@b.co" })).toBe("a@b.co");
    expect(sellerName({ name: null, email: null })).toBe("Seller sem nome");
    expect(previewLine({ last_sender: "staff", last_body: "Tudo certo\n\nobrigado" })).toBe("Equipe: Tudo certo obrigado");
    expect(previewLine({ last_sender: "customer", last_body: "Categoria: Saques e financeiro\nReferência: x\n\nOlá" })).toBe("Olá");
    expect(salesText(1)).toBe("1 venda paga");
    expect(salesText(2)).toBe("2 vendas pagas");
    expect(priorityInfo("urgent").label).toBe("Urgente");
    expect(priorityInfo("qualquer").label).toBe("Normal");
    expect(accountStatusLabel("approved")).toBe("Cadastro aprovado");
    expect(accountStatusLabel(null)).toBe("Sem cadastro");
    expect(emptyCopy("waiting", false, true).title).toBe("Todos os chamados foram respondidos");
    expect(emptyCopy("all", false, false).title).toBe("Nenhum chamado ainda");
    expect(emptyCopy("done", true, true).title).toBe("Nada por aqui");
  });

  it("valida a resposta antes de enviar e junta textos prontos ao rascunho", () => {
    expect(replyProblem("   ", 0)).toBe("Escreva a resposta.");
    expect(replyProblem("", 1)).toBeNull();
    expect(replyProblem("oi", 0)).toBeNull();
    expect(replyProblem("a".repeat(MESSAGE_MAX + 1), 0)).toContain("passa de");
    expect(withQuickReply("", "Pronto")).toBe("Pronto");
    expect(withQuickReply("Olá  \n", "Pronto")).toBe("Olá\n\nPronto");
  });

  it("mostra o cargo de quem respondeu e o nome do seller nas mensagens dele", () => {
    const roles = { admin: "Administrador" };
    const mine = parseTicketDetail(detail()).messages;
    expect(messageLabel(mine[0], "Marina Duarte", roles)).toEqual({ who: "Marina Duarte", role: null });
    expect(messageLabel(mine[1], "Marina Duarte", roles)).toEqual({ who: "Admin", role: "Administrador" });
    expect(messageLabel({ ...mine[1], sender_name: null, sender_role: null }, "x", roles)).toEqual({ who: "Suporte", role: "Suporte" });
  });
});

/* ───────── tela ───────── */

describe("Suporte do admin", () => {
  it("quem não é admin e não tem a permissão não chama o servidor", () => {
    wrap(<SupportCenter isAdmin={false} hasSupportAccess={false} />);
    expect(screen.getByText("Você não tem acesso ao suporte")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("mostra a fila com as contagens e começa pelos que esperam a equipe", async () => {
    wrap(<SupportCenter />);
    expect(await screen.findByRole("button", { name: /Saque pendente há 3 dias, de Marina Duarte, 2 mensagens novas/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Como configurar o webhook, de Loja do Caio$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aguardando · 2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Encerrados · 4" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("25 min")).toBeInTheDocument();
    expect(calls("get_admin_support_page")[0]).toMatchObject({ _filter: "waiting", _search: null, _page: 1 });
  });

  it("troca o filtro e pede a lista certa ao servidor; limpar volta ao começo", async () => {
    wrap(<SupportCenter />);
    await screen.findByRole("button", { name: /Saque pendente/ });
    fireEvent.click(screen.getByRole("button", { name: "Urgentes · 1" }));
    await waitFor(() => expect(calls("get_admin_support_page").some((c) => c._filter === "urgent")).toBe(true));
    fireEvent.click(await screen.findByRole("button", { name: /Limpar filtros/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Aguardando · 2" })).toHaveAttribute("aria-pressed", "true"));
  });

  it("a busca vai ao servidor depois de uma pausa", async () => {
    wrap(<SupportCenter />);
    await screen.findByRole("button", { name: /Saque pendente/ });
    fireEvent.change(screen.getByLabelText("Buscar chamados"), { target: { value: "marina" } });
    await waitFor(() => expect(calls("get_admin_support_page").some((c) => c._search === "marina")).toBe(true));
  });

  it("sem chamados explica o que fazer; com erro mostra o aviso e tenta de novo", async () => {
    handlers.get_admin_support_page = () => ({ data: page([], { total: 0, program: { ...page().program, total: 0, waiting: 0 } }), error: null });
    const first = wrap(<SupportCenter />);
    expect((await screen.findAllByText("Nenhum chamado ainda")).length).toBeGreaterThan(0);
    expect(screen.getByText("Quando um seller abrir um chamado, ele aparece aqui.")).toBeInTheDocument();
    first.unmount();

    handlers.get_admin_support_page = () => ({ data: null, error: { message: "permission denied for table support_tickets" } });
    wrap(<SupportCenter />);
    expect(await screen.findByText("Não foi possível carregar os chamados.")).toBeInTheDocument();
    expect(screen.queryByText(/permission denied/)).not.toBeInTheDocument();
    handlers.get_admin_support_page = () => ({ data: page(), error: null });
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("button", { name: /Saque pendente/ })).toBeInTheDocument();
  });

  it("abrir o chamado carrega a conversa e marca como lido uma vez", async () => {
    let read = false;
    handlers.admin_mark_ticket_read = () => { read = true; return { data: { ok: true }, error: null }; };
    handlers.get_admin_support_ticket = () => ({ data: detail({ unread_by_staff: read ? 0 : 2 }), error: null });
    wrap(<SupportCenter />);
    await open();
    expect(calls("get_admin_support_ticket")[0]).toEqual({ _id: ID1 });
    await waitFor(() => expect(calls("admin_mark_ticket_read")).toEqual([{ _ticket_id: ID1 }]));
    await waitFor(() => expect(calls("get_admin_support_ticket").length).toBeGreaterThan(1));
    expect(calls("admin_mark_ticket_read")).toHaveLength(1);
    expect(screen.getByText("Referência: saque 4F2A")).toBeInTheDocument();
    expect(screen.getByText(/Meu saque de R\$ 1\.200,00/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "https://exemplo.com/ajuda" });
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByRole("heading", { name: "Saque pendente há 3 dias" })).toBeInTheDocument();
  });

  it("'Sobre o seller' mostra o histórico e abre um chamado anterior", async () => {
    wrap(<SupportCenter />);
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Sobre o seller/ }));
    expect(await screen.findByText("Cadastro aprovado")).toBeInTheDocument();
    expect(screen.getByText("R$ 4.500,50")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Alterar chave Pix/ }));
    await waitFor(() => expect(calls("get_admin_support_ticket").some((c) => c._id === ID3)).toBe(true));
    expect(await screen.findByText("Este chamado está encerrado. Reabra para responder ao seller.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Resposta ao seller" })).not.toBeInTheDocument();
  });

  it("responde com o texto aparado, sem mandar nome nem cargo, e limpa só esse rascunho", async () => {
    wrap(<SupportCenter />);
    await open();
    fireEvent.change(textbox(), { target: { value: "  Já resolvemos.  " } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar resposta/ }));
    await waitFor(() => expect(calls("admin_reply_ticket")).toHaveLength(1));
    expect(calls("admin_reply_ticket")[0]).toEqual({ _ticket_id: ID1, _body: "Já resolvemos.", _attachments: [] });
    expect(toast.success).toHaveBeenCalledWith("Resposta enviada.");
    await waitFor(() => expect(textbox().value).toBe(""));
  });

  it("Ctrl+Enter envia; texto vazio não envia", async () => {
    wrap(<SupportCenter />);
    await open();
    expect(screen.getByRole("button", { name: /Enviar resposta/ })).toBeDisabled();
    fireEvent.change(textbox(), { target: { value: "Oi" } });
    fireEvent.keyDown(textbox(), { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(calls("admin_reply_ticket")).toHaveLength(1));
  });

  it("cada chamado guarda o seu rascunho: trocar de conversa não leva o texto", async () => {
    wrap(<SupportCenter />);
    await open();
    fireEvent.change(textbox(), { target: { value: "rascunho do primeiro" } });
    fireEvent.click(screen.getByRole("button", { name: "Voltar à lista" }));
    fireEvent.click(await screen.findByRole("button", { name: /Como configurar o webhook/ }));
    await waitFor(() => expect(calls("get_admin_support_ticket").some((c) => c._id === ID2)).toBe(true));
    await screen.findByRole("heading", { name: "Como configurar o webhook" });
    expect(textbox().value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Voltar à lista" }));
    fireEvent.click(await screen.findByRole("button", { name: /Saque pendente/ }));
    await screen.findByRole("heading", { name: "Saque pendente há 3 dias" });
    expect(textbox().value).toBe("rascunho do primeiro");
  });

  it("texto pronto entra no rascunho e pode ser editado antes de enviar", async () => {
    wrap(<SupportCenter />);
    await open();
    fireEvent.change(textbox(), { target: { value: "Oi Marina," } });
    fireEvent.click(screen.getByRole("button", { name: "Recebemos" }));
    expect(textbox().value).toBe("Oi Marina,\n\nOlá! Recebemos o seu chamado e já estamos analisando. Voltamos com uma resposta o quanto antes.");
    expect(calls("admin_reply_ticket")).toHaveLength(0);
  });

  it("falha ao responder mostra o motivo no campo, descarta os anexos já enviados e mantém o texto", async () => {
    upload.mockResolvedValue([{ path: `${ID1}/a.png`, name: "a.png", size: 10, type: "image/png" }]);
    handlers.admin_reply_ticket = () => ({ data: null, error: { message: "relation \"ticket_messages\" does not exist" } });
    wrap(<SupportCenter />);
    await open();
    fireEvent.change(textbox(), { target: { value: "Resposta" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar resposta/ }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível enviar a resposta. Nada foi enviado.");
    expect(discard).toHaveBeenCalledWith([expect.objectContaining({ path: `${ID1}/a.png` })]);
    expect(textbox().value).toBe("Resposta");
  });

  it("mostra a mensagem do servidor quando ela já está em português", async () => {
    handlers.admin_reply_ticket = () => ({ data: null, error: { message: "Este chamado está encerrado. Reabra para responder." } });
    wrap(<SupportCenter />);
    await open();
    fireEvent.change(textbox(), { target: { value: "Resposta" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar resposta/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Este chamado está encerrado. Reabra para responder.");
  });

  it("encerrar pede confirmação e só então chama o servidor, sem apagar anexos", async () => {
    wrap(<SupportCenter />);
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Encerrar/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/anexos continuam guardados/)).toBeInTheDocument();
    expect(calls("admin_set_ticket_status")).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(calls("admin_set_ticket_status")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /Encerrar/ }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Encerrar chamado" }));
    await waitFor(() => expect(calls("admin_set_ticket_status")).toEqual([{ _ticket_id: ID1, _status: "closed" }]));
    expect(toast.success).toHaveBeenCalledWith("Chamado encerrado.");
  });

  it("reabre um chamado encerrado sem pedir confirmação", async () => {
    handlers.get_admin_support_ticket = () => ({ data: detail({ stage: "done", status: "closed", unread_by_staff: 0 }), error: null });
    wrap(<SupportCenter />);
    await open();
    fireEvent.click(await screen.findByRole("button", { name: /Reabrir/ }));
    await waitFor(() => expect(calls("admin_set_ticket_status")).toEqual([{ _ticket_id: ID1, _status: "open" }]));
    expect(toast.success).toHaveBeenCalledWith("Chamado reaberto.");
  });

  it("muda a prioridade e avisa quando o servidor recusa", async () => {
    wrap(<SupportCenter />);
    await open();
    fireEvent.change(screen.getByLabelText("Prioridade do chamado"), { target: { value: "low" } });
    await waitFor(() => expect(calls("admin_set_ticket_priority")).toEqual([{ _ticket_id: ID1, _priority: "low" }]));
    expect(toast.success).toHaveBeenCalledWith("Prioridade: baixa.");

    handlers.admin_set_ticket_priority = () => ({ data: null, error: { message: "not authorized" } });
    fireEvent.change(screen.getByLabelText("Prioridade do chamado"), { target: { value: "normal" } });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Você não tem permissão para esta ação."));
  });

  it("quem só pode ler vê o aviso e não vê campo de resposta nem ações", async () => {
    handlers.get_admin_support_ticket = () => ({ data: detail({ can_reply: false }), error: null });
    wrap(<SupportCenter isAdmin={false} hasSupportAccess />);
    await open();
    expect(await screen.findByText(/Você pode ler este chamado, mas não responder/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Resposta ao seller" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Encerrar/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Prioridade do chamado")).not.toBeInTheDocument();
  });

  it("se a conversa não abre, mostra o erro e deixa tentar de novo", async () => {
    let fail = true;
    handlers.get_admin_support_ticket = () => (fail ? { data: null, error: { message: "relation \"x\" does not exist" } } : { data: detail(), error: null });
    wrap(<SupportCenter />);
    fireEvent.click(await screen.findByRole("button", { name: /Saque pendente/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível abrir este chamado.");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("heading", { name: "Saque pendente há 3 dias" })).toBeInTheDocument();
  });
});
