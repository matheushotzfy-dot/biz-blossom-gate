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
const confirmSpy = vi.fn();
vi.mock("@/features/admin-finance/useSensitiveConfirm", () => ({
  useSensitiveConfirm: () => ({ confirm: (d: string, a: () => Promise<void>) => { confirmSpy(d); void a(); }, dialog: null }),
}));

import { toast } from "sonner";
import NotificationsCenter from "@/features/admin-notifications/NotificationsCenter";
import {
  audienceCount, checkCompose, cleanText, cleanedText, parseAudiences, parseBatch, parseCleanResult, parseNotificationsPage, parseSendResult, readPct, readText,
  recipientsLabel, retractedText, sellersText, sendConfirmText, sentText, typeInfo,
} from "@/features/admin-notifications/notificationsModel";

/* ───────── dados ───────── */

const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();

const aviso = (over: Record<string, unknown> = {}) => ({
  batch_id: "b1", title: "Manutenção programada no sábado", message: "O painel fica fora do ar por 2 horas.", type: "announcement", sent_at: ago(5), sent_by_name: "Admin",
  recipients: 482, read: 301, one: null, ...over,
});
const avisos = () => [
  aviso(),
  aviso({ batch_id: "b2", title: "Seu cadastro foi aprovado", message: "Já dá para criar produtos.", type: "success", recipients: 1, read: 0, one: { user_id: "s1", name: "Marina Duarte", email: "marina@exemplo.com" } }),
  aviso({ batch_id: "b3", title: "Atualize seus dados de saque", message: "Confirme a chave Pix.", type: "warning", recipients: 37, read: 37 }),
];
const notif = (over: Record<string, unknown> = {}) => ({
  id: "n1", type: "sale_paid", title: "Venda aprovada", message: "Você vendeu Método Lançamento 7D por R$ 297,00.", is_read: false, created_at: ago(0.2),
  batch_id: null, user_id: "s1", user_name: "Marina Duarte", user_email: "marina@exemplo.com", ...over,
});
const todas = () => [
  notif(),
  notif({ id: "n2", type: "announcement", title: "Manutenção programada no sábado", message: "O painel fica fora do ar.", is_read: true, batch_id: "b1", user_id: "s2", user_name: "Loja do Caio", user_email: "caio@exemplo.com" }),
  notif({ id: "n3", type: "dispute_opened", title: "Análise aberta em uma venda", message: "O valor ficou congelado.", user_id: "s2", user_name: "Loja do Caio", user_email: "caio@exemplo.com" }),
  notif({ id: "n4", type: "sale_paid", title: "Venda aprovada", message: "Venda antiga.", is_read: true, user_id: null, user_name: null, user_email: null }),
];
const program = (over: Record<string, unknown> = {}) => ({
  total: 1204, unread: 412, read: 792, read_old: 640, last_24h: 38, oldest: ago(24 * 90), avisos: 3, avisos_rows: 520, avisos_read: 338, last_sent: ago(5), size_bytes: 410_000, ...over,
});
const avisosPage = (rows: unknown[] = avisos(), over: Record<string, unknown> = {}) => ({ view: "avisos", items: rows, total: rows.length, types: {}, program: program(), ...over });
const todasPage = (rows: unknown[] = todas(), over: Record<string, unknown> = {}) => ({
  view: "todas", items: rows, total: rows.length, types: { sale_paid: 2, announcement: 1, dispute_opened: 1 }, program: program(), ...over,
});
const batch = (over: Record<string, unknown> = {}) => ({
  batch_id: "b1", title: "Manutenção programada no sábado", message: "O painel fica fora do ar por 2 horas.\nVendas pagas não são afetadas.", type: "announcement", sent_at: ago(5), sent_by_name: "Admin",
  recipients: 482, read: 301,
  items: [{ user_id: "s1", name: "Marina Duarte", email: "marina@exemplo.com", is_read: false }, { user_id: "s2", name: "Loja do Caio", email: "caio@exemplo.com", is_read: true }], ...over,
});
const sellers = [{ user_id: "s1", name: "Marina Duarte", email: "marina@exemplo.com" }, { user_id: "s2", name: "Loja do Caio", email: "caio@exemplo.com" }];

const handlers: Record<string, (a: Record<string, unknown>) => Res> = {};
const calls = (n: string) => rpc.mock.calls.filter((c) => c[0] === n).map((c) => c[1] as Record<string, unknown>);

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  rpc.mockReset(); from.mockClear(); confirmSpy.mockClear();
  for (const k of Object.keys(handlers)) delete handlers[k];
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear();
  handlers.get_admin_notifications_page = (a) => ({ data: a._view === "todas" ? todasPage() : avisosPage(), error: null });
  handlers.get_admin_notification_audiences = () => ({ data: { all: 482, approved: 440, pending: 42 }, error: null });
  handlers.get_admin_notification_batch = () => ({ data: batch(), error: null });
  handlers.admin_search_sellers = () => ({ data: sellers, error: null });
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (handlers[name] ? handlers[name](args) : { data: { ok: true }, error: null }));
});

/* ───────── modelo ───────── */

describe("notificationsModel", () => {
  it("lê a lista de avisos e a de notificações, e rejeita formato inesperado", () => {
    const a = parseNotificationsPage(avisosPage([aviso({ recipients: "3", read: -4, type: "", sent_by_name: "" })]));
    expect(a.view).toBe("avisos");
    expect(a.avisos[0]).toMatchObject({ recipients: 3, read: 0, type: "info", sent_by_name: null });
    expect(a.todas).toEqual([]);
    expect(a.program).toMatchObject({ total: 1204, avisos: 3, read_old: 640, size_bytes: 410_000 });
    const t = parseNotificationsPage(todasPage([notif({ user_name: "", is_read: "sim" })], { types: { sale_paid: "2", x: "abc" } }));
    expect(t.view).toBe("todas");
    expect(t.todas[0]).toMatchObject({ user_name: null, is_read: false });
    expect(t.types).toEqual({ sale_paid: 2, x: 0 });
    expect(() => parseNotificationsPage(null)).toThrow();
    expect(() => parseNotificationsPage({ items: "x" })).toThrow();
  });

  it("lê quem pode receber, o aviso aberto e os resultados do envio e da limpeza", () => {
    expect(parseAudiences({ all: "10", approved: 4, pending: "x" })).toEqual({ all: 10, approved: 4, pending: 0 });
    expect(() => parseAudiences(null)).toThrow();
    const b = parseBatch(batch({ items: [{ user_id: "s1", name: "", email: null, is_read: 1 }] }));
    expect(b.items[0]).toEqual({ user_id: "s1", name: "Seller sem nome", email: null, is_read: false });
    expect(() => parseBatch({})).toThrow();
    expect(parseSendResult({ delivered: "7", name: "" })).toEqual({ delivered: 7, name: null });
    expect(parseSendResult(null)).toEqual({ delivered: 0, name: null });
    expect(parseCleanResult({ deleted: -5, remaining: "3" })).toEqual({ deleted: 0, remaining: 3 });
  });

  it("tipos em palavras de quem opera; tipo novo aparece sem sublinhado", () => {
    expect(typeInfo("sale_paid")).toEqual({ label: "Venda aprovada", tone: "success" });
    expect(typeInfo("alert")).toEqual({ label: "Urgente", tone: "destructive" });
    expect(typeInfo("dispute_lost").tone).toBe("destructive");
    expect(typeInfo("novo_tipo_estranho")).toEqual({ label: "Novo tipo estranho", tone: "neutral" });
    expect(typeInfo("").label).toBe("Outro");
  });

  it("quem leu, em palavras e em porcentagem", () => {
    expect(readText(0, 1)).toBe("Ainda não leu");
    expect(readText(1, 1)).toBe("Já leu");
    expect(readText(0, 40)).toBe("Ninguém leu ainda");
    expect(readText(40, 40)).toBe("Todos leram");
    expect(readText(1200, 3000)).toBe("1.200 de 3.000 leram");
    expect(readPct(301, 482)).toBe(62);
    expect(readPct(5, 0)).toBe(0);
    expect(readPct(9, 3)).toBe(100);
    expect(sellersText(1)).toBe("1 seller");
    expect(sellersText(1500)).toBe("1.500 sellers");
    expect(recipientsLabel({ recipients: 1, one: { user_id: "s1", name: "Marina Duarte", email: null } })).toBe("Marina Duarte");
    expect(recipientsLabel({ recipients: 482, one: null })).toBe("482 sellers");
    expect(audienceCount({ all: 5, approved: 3, pending: 2 }, "approved")).toBe(3);
    expect(audienceCount({ all: 5, approved: 3, pending: 2 }, "one")).toBe(1);
    expect(audienceCount(undefined, "all")).toBeNull();
  });

  it("limpa o texto igual ao banco: tira o que está entre < e > e o javascript:", () => {
    expect(cleanText("  Olá <b>mundo</b> <script>x</script>  ")).toBe("Olá mundo x");
    expect(cleanText("clique JavaScript:alert(1)")).toBe("clique alert(1)");
    expect(cleanText("2 < 3 e 5 > 4")).toBe("2  4");
  });

  it("valida o aviso antes de enviar", () => {
    const base = { audience: "all" as const, seller: null, title: "Oi", message: "Tudo certo", count: 10 };
    expect(checkCompose(base)).toEqual({});
    expect(checkCompose({ ...base, audience: "one" }).seller).toBe("Escolha o seller que vai receber.");
    expect(checkCompose({ ...base, audience: "one", seller: sellers[0] })).toEqual({});
    expect(checkCompose({ ...base, count: 0 }).audience).toBe("Ninguém está nessa lista agora.");
    expect(checkCompose({ ...base, count: null })).toEqual({});
    expect(checkCompose({ ...base, title: " <b></b> ", message: "" })).toEqual({ title: "Escreva o título do aviso.", message: "Escreva a mensagem do aviso." });
    expect(checkCompose({ ...base, title: "x".repeat(101) }).title).toBe("O título passa de 100 caracteres.");
    expect(checkCompose({ ...base, message: "x".repeat(501) }).message).toBe("A mensagem passa de 500 caracteres.");
    expect(checkCompose({ ...base, message: "x".repeat(500) })).toEqual({});
  });

  it("textos do envio, da confirmação, do recolher e da limpeza", () => {
    expect(sentText(1, "Marina Duarte")).toBe("Aviso enviado para Marina Duarte.");
    expect(sentText(482, null)).toBe("Aviso enviado para 482 sellers.");
    expect(sendConfirmText("Manutenção <b>no</b> sábado", "approved", 440)).toBe("Enviar o aviso “Manutenção no sábado” para 440 sellers (cadastro aprovado). Se mudar de ideia, dá para recolher depois.");
    expect(sendConfirmText("Oi", "all", 1)).toMatch(/para 1 seller\./);
    expect(retractedText(482)).toBe("Aviso recolhido da caixa de 482 sellers.");
    expect(cleanedText(315570)).toBe("315.570 notificações apagadas.");
  });
});

/* ───────── tela ───────── */

describe("NotificationsCenter", () => {
  it("quem não é admin vê o aviso e nada é consultado", () => {
    wrap(<NotificationsCenter isAdmin={false} />);
    expect(screen.getByText("Os avisos aos sellers são do administrador")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("lê pela RPC (nunca a tabela) e mostra números, avisos e quem leu", async () => {
    wrap(<NotificationsCenter />);
    expect(await screen.findByText("Manutenção programada no sábado")).toBeInTheDocument();
    expect(calls("get_admin_notifications_page")[0]).toEqual({ _view: "avisos", _type: null, _search: null, _page: 1, _page_size: 25 });
    expect(from).not.toHaveBeenCalled();
    expect(screen.getByText("Avisos enviados · 3")).toBeInTheDocument();
    expect(screen.getByText("Todas as notificações · 1.204")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
    expect(screen.getByText("338 de 520")).toBeInTheDocument();
    expect(screen.getByText("301 de 482 leram")).toBeInTheDocument();
    expect(screen.getByText("Ainda não leu")).toBeInTheDocument();
    expect(screen.getByText("Todos leram")).toBeInTheDocument();
    expect(screen.getByText("Marina Duarte")).toBeInTheDocument();
    expect(screen.getByText("37 sellers")).toBeInTheDocument();
  });

  it("troca para todas as notificações, filtra por tipo e busca no servidor", async () => {
    wrap(<NotificationsCenter />);
    await screen.findByText("Manutenção programada no sábado");
    fireEvent.click(screen.getByRole("button", { name: /Todas as notificações/ }));
    expect(await screen.findByText("Análise aberta em uma venda")).toBeInTheDocument();
    expect(calls("get_admin_notifications_page").at(-1)).toMatchObject({ _view: "todas", _type: null, _search: null, _page: 1 });
    expect(screen.getByText("Aviso da equipe")).toBeInTheDocument();
    expect(screen.getByText("Para Sem destinatário (registro antigo)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Disputa aberta · 1" }));
    await waitFor(() => expect(calls("get_admin_notifications_page").at(-1)).toMatchObject({ _view: "todas", _type: "dispute_opened" }));
    fireEvent.change(screen.getByLabelText("Buscar notificações"), { target: { value: "  caio " } });
    await waitFor(() => expect(calls("get_admin_notifications_page").at(-1)).toMatchObject({ _view: "todas", _type: "dispute_opened", _search: "caio", _page: 1 }));
    fireEvent.click(screen.getByRole("button", { name: /Limpar filtros/ }));
    expect((screen.getByLabelText("Buscar notificações") as HTMLInputElement).value).toBe("");
    await waitFor(() => expect(calls("get_admin_notifications_page").at(-1)).toMatchObject({ _type: null, _search: null }));
  });

  it("voltar para os avisos zera o tipo escolhido", async () => {
    wrap(<NotificationsCenter />);
    await screen.findByText("Manutenção programada no sábado");
    fireEvent.click(screen.getByRole("button", { name: /Todas as notificações/ }));
    await screen.findByText("Análise aberta em uma venda");
    fireEvent.click(screen.getByRole("button", { name: "Disputa aberta · 1" }));
    fireEvent.click(screen.getByRole("button", { name: /Avisos enviados/ }));
    await waitFor(() => expect(calls("get_admin_notifications_page").at(-1)).toMatchObject({ _view: "avisos", _type: null }));
  });

  it("sem nenhum aviso oferece escrever o primeiro; busca sem resultado oferece limpar filtros", async () => {
    handlers.get_admin_notifications_page = () => ({ data: avisosPage([], { program: program({ avisos: 0, avisos_rows: 0, avisos_read: 0, last_sent: null }) }), error: null });
    wrap(<NotificationsCenter />);
    expect((await screen.findAllByText("Nenhum aviso enviado ainda")).length).toBe(2);
    expect(screen.getByText("nenhum ainda")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Escrever o primeiro aviso/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar notificações"), { target: { value: "zzz" } });
    expect(await screen.findByText("Nada por aqui")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma notificação bate com esses filtros.")).toBeInTheDocument();
  });

  it("erro do servidor aparece em palavras e dá para tentar de novo", async () => {
    handlers.get_admin_notifications_page = () => ({ data: null, error: { message: "falha de rede" } });
    wrap(<NotificationsCenter />);
    expect(await screen.findByText("Não foi possível carregar as notificações.")).toBeInTheDocument();
    expect(screen.getAllByText("Indisponível").length).toBeGreaterThan(0);
    handlers.get_admin_notifications_page = () => ({ data: avisosPage(), error: null });
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect(await screen.findByText("Manutenção programada no sábado")).toBeInTheDocument();
  });

  it("registro grande avisa no topo, com o tamanho", async () => {
    handlers.get_admin_notifications_page = () => ({ data: avisosPage(avisos(), { program: program({ total: 315573, size_bytes: 135_000_000 }) }), error: null });
    wrap(<NotificationsCenter />);
    expect(await screen.findByText(/Registro grande: /)).toBeInTheDocument();
    expect(screen.getByText("Todas as notificações · 315.573")).toBeInTheDocument();
  });
});

/* ───────── novo aviso ───────── */

describe("novo aviso", () => {
  const open = async () => {
    wrap(<NotificationsCenter />);
    await screen.findByText("Manutenção programada no sábado");
    fireEvent.click(screen.getByRole("button", { name: /Novo aviso/ }));
    return screen.findByRole("dialog");
  };

  it("mostra quantos sellers recebem e a prévia com o texto já limpo", async () => {
    const dlg = await open();
    expect(await within(dlg).findByRole("button", { name: "Todos os sellers · 482" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dlg).getByRole("button", { name: "Cadastro aprovado · 440" })).toBeInTheDocument();
    expect(within(dlg).getByRole("button", { name: "Aguardando aprovação · 42" })).toBeInTheDocument();
    expect(within(dlg).getByText("Vai chegar para 482 sellers.")).toBeInTheDocument();
    fireEvent.change(within(dlg).getByLabelText("Título"), { target: { value: "Oi <b>time</b>" } });
    fireEvent.change(within(dlg).getByLabelText("Mensagem"), { target: { value: "Texto javascript:x" } });
    const preview = within(dlg).getByLabelText("Prévia do aviso");
    expect(preview).toHaveTextContent("Oi time");
    expect(preview).toHaveTextContent("Texto x");
    expect(within(dlg).getByText("7/100")).toBeInTheDocument();
    expect(within(dlg).getByText(/são removidos por segurança/)).toBeInTheDocument();
  });

  it("campos vazios mostram o que falta e nada é enviado", async () => {
    const dlg = await open();
    fireEvent.click(await within(dlg).findByRole("button", { name: "Enviar aviso" }));
    expect(await within(dlg).findByText("Escreva o título do aviso.")).toBeInTheDocument();
    expect(within(dlg).getByText("Escreva a mensagem do aviso.")).toBeInTheDocument();
    expect(calls("admin_send_notification")).toHaveLength(0);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("para todos: pede a senha, manda o tipo escolhido e avisa quantos receberam", async () => {
    handlers.admin_send_notification = () => ({ data: { delivered: 482, name: null, batch_id: "b9" }, error: null });
    const dlg = await open();
    await within(dlg).findByRole("button", { name: "Todos os sellers · 482" });
    fireEvent.click(within(dlg).getByRole("button", { name: "Comunicado" }));
    expect(within(dlg).getByText(/Fica em destaque no topo do sino/)).toBeInTheDocument();
    fireEvent.change(within(dlg).getByLabelText("Título"), { target: { value: "Manutenção no sábado" } });
    fireEvent.change(within(dlg).getByLabelText("Mensagem"), { target: { value: "Ficamos fora do ar por 2 horas." } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Enviar aviso" }));
    await waitFor(() => expect(calls("admin_send_notification")).toHaveLength(1));
    expect(calls("admin_send_notification")[0]).toEqual({ _audience: "all", _user_id: null, _title: "Manutenção no sábado", _message: "Ficamos fora do ar por 2 horas.", _type: "announcement" });
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toMatch(/Enviar o aviso “Manutenção no sábado” para 482 sellers\./);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Aviso enviado para 482 sellers."));
    await waitFor(() => expect(calls("get_admin_notifications_page").length).toBeGreaterThan(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("só cadastro aprovado: manda o público certo, com a contagem dele na confirmação", async () => {
    handlers.admin_send_notification = () => ({ data: { delivered: 440, name: null }, error: null });
    const dlg = await open();
    fireEvent.click(await within(dlg).findByRole("button", { name: "Cadastro aprovado · 440" }));
    expect(within(dlg).getByText("Vai chegar para 440 sellers.")).toBeInTheDocument();
    fireEvent.change(within(dlg).getByLabelText("Título"), { target: { value: "Novidade" } });
    fireEvent.change(within(dlg).getByLabelText("Mensagem"), { target: { value: "Chegou o recurso novo." } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Enviar aviso" }));
    await waitFor(() => expect(calls("admin_send_notification")).toHaveLength(1));
    expect(calls("admin_send_notification")[0]).toMatchObject({ _audience: "approved", _user_id: null, _type: "info" });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/440 sellers \(cadastro aprovado\)/);
  });

  it("público vazio barra o envio", async () => {
    handlers.get_admin_notification_audiences = () => ({ data: { all: 482, approved: 440, pending: 0 }, error: null });
    const dlg = await open();
    fireEvent.click(await within(dlg).findByRole("button", { name: "Aguardando aprovação · 0" }));
    fireEvent.change(within(dlg).getByLabelText("Título"), { target: { value: "Oi" } });
    fireEvent.change(within(dlg).getByLabelText("Mensagem"), { target: { value: "Tudo certo" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Enviar aviso" }));
    expect(await within(dlg).findByText("Ninguém está nessa lista agora.")).toBeInTheDocument();
    expect(calls("admin_send_notification")).toHaveLength(0);
  });

  it("para um seller: busca no servidor, não pede senha de novo e avisa o nome", async () => {
    handlers.admin_send_notification = () => ({ data: { delivered: 1, name: "Marina Duarte", batch_id: "b9" }, error: null });
    const dlg = await open();
    fireEvent.click(await within(dlg).findByRole("button", { name: "Um seller" }));
    fireEvent.change(within(dlg).getByLabelText("Título"), { target: { value: "Cadastro aprovado" } });
    fireEvent.change(within(dlg).getByLabelText("Mensagem"), { target: { value: "Já dá para vender." } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Enviar aviso" }));
    expect(await within(dlg).findByText("Escolha o seller que vai receber.")).toBeInTheDocument();
    expect(calls("admin_send_notification")).toHaveLength(0);
    fireEvent.change(within(dlg).getByLabelText("Seller"), { target: { value: "mar" } });
    fireEvent.click(await within(dlg).findByRole("button", { name: /Marina Duarte/ }));
    expect(calls("admin_search_sellers").at(-1)).toEqual({ _query: "mar" });
    expect(within(dlg).getByText("Vai para Marina Duarte.")).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: "Enviar aviso" }));
    await waitFor(() => expect(calls("admin_send_notification")).toHaveLength(1));
    expect(calls("admin_send_notification")[0]).toEqual({ _audience: "one", _user_id: "s1", _title: "Cadastro aprovado", _message: "Já dá para vender.", _type: "info" });
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Aviso enviado para Marina Duarte."));
  });

  it("erro do servidor fica dentro da janela, que continua aberta com o texto", async () => {
    handlers.admin_send_notification = () => ({ data: null, error: { message: "reautenticação necessária: confirme sua senha" } });
    const dlg = await open();
    await within(dlg).findByRole("button", { name: "Todos os sellers · 482" });
    fireEvent.change(within(dlg).getByLabelText("Título"), { target: { value: "Oi" } });
    fireEvent.change(within(dlg).getByLabelText("Mensagem"), { target: { value: "Tudo certo" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Enviar aviso" }));
    expect(await within(dlg).findByText(/reautenticação necessária/)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
    expect((within(dlg).getByLabelText("Título") as HTMLInputElement).value).toBe("Oi");
  });

  it("quando o servidor devolve um erro sem texto útil, a mensagem não vaza SQL", async () => {
    handlers.admin_send_notification = () => ({ data: null, error: { message: 'relation "public.notifications" does not exist' } });
    const dlg = await open();
    fireEvent.click(await within(dlg).findByRole("button", { name: "Todos os sellers · 482" }));
    fireEvent.change(within(dlg).getByLabelText("Título"), { target: { value: "Oi" } });
    fireEvent.change(within(dlg).getByLabelText("Mensagem"), { target: { value: "Tudo certo" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Enviar aviso" }));
    expect(await within(dlg).findByText("Não foi possível enviar o aviso. Nada foi enviado.")).toBeInTheDocument();
  });
});

/* ───────── detalhes do aviso ───────── */

describe("detalhes do aviso", () => {
  it("abre pelo servidor e mostra a mensagem, quem leu e quem não leu", async () => {
    wrap(<NotificationsCenter />);
    await screen.findByText("Manutenção programada no sábado");
    fireEvent.click(screen.getByRole("button", { name: /Ver detalhes do aviso: Manutenção programada/ }));
    const dlg = await screen.findByRole("dialog");
    await within(dlg).findByText("Quem leu");
    expect(calls("get_admin_notification_batch")).toEqual([{ _batch_id: "b1" }]);
    expect(within(dlg).getByText(/Vendas pagas não são afetadas/)).toBeInTheDocument();
    expect(within(dlg).getByText("482 sellers", { selector: "p" })).toBeInTheDocument();
    expect(within(dlg).getByText("62%")).toBeInTheDocument();
    expect(within(dlg).getByText("181")).toBeInTheDocument();
    const list = within(dlg).getByRole("list", { name: "Quem recebeu o aviso" });
    expect(within(list).getByText("Marina Duarte")).toBeInTheDocument();
    expect(within(list).getByText("Não leu")).toBeInTheDocument();
    expect(within(list).getByText("Leu")).toBeInTheDocument();
    expect(within(dlg).getByText(/Mostrando 2 de 482 sellers/)).toBeInTheDocument();
  });

  it("erro ao abrir mostra o problema, deixa tentar de novo e não deixa recolher", async () => {
    handlers.get_admin_notification_batch = () => ({ data: null, error: { message: "falha de rede" } });
    wrap(<NotificationsCenter />);
    await screen.findByText("Manutenção programada no sábado");
    fireEvent.click(screen.getByRole("button", { name: /Ver detalhes do aviso: Manutenção programada/ }));
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText(/Não foi possível carregar o aviso|conexão|rede/i)).toBeInTheDocument();
    expect(within(dlg).getByRole("button", { name: /Recolher aviso/ })).toBeDisabled();
    handlers.get_admin_notification_batch = () => ({ data: batch(), error: null });
    fireEvent.click(within(dlg).getByRole("button", { name: "Tentar de novo" }));
    expect(await within(dlg).findByText("Quem leu")).toBeInTheDocument();
  });

  it("recolher: pede confirmação, chama o servidor e avisa quantas caixas esvaziou", async () => {
    handlers.admin_retract_notification = () => ({ data: { removed: 482 }, error: null });
    wrap(<NotificationsCenter />);
    await screen.findByText("Manutenção programada no sábado");
    fireEvent.click(screen.getByRole("button", { name: /Ver detalhes do aviso: Manutenção programada/ }));
    const dlg = await screen.findByRole("dialog");
    await within(dlg).findByText("Quem leu");
    fireEvent.click(within(dlg).getByRole("button", { name: /Recolher aviso/ }));
    const ask = await screen.findByRole("alertdialog");
    expect(within(ask).getByText("Recolher este aviso?")).toBeInTheDocument();
    expect(within(ask).getByText(/Ele some da caixa de 482 sellers, inclusive de quem já leu/)).toBeInTheDocument();
    expect(calls("admin_retract_notification")).toHaveLength(0);
    fireEvent.click(within(ask).getByRole("button", { name: "Recolher aviso" }));
    await waitFor(() => expect(calls("admin_retract_notification")).toEqual([{ _batch_id: "b1" }]));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Aviso recolhido da caixa de 482 sellers."));
    await waitFor(() => expect(calls("get_admin_notifications_page").length).toBeGreaterThan(1));
  });

  it("recolher: erro do servidor vira aviso e nada some", async () => {
    handlers.admin_retract_notification = () => ({ data: null, error: { message: "not authorized" } });
    wrap(<NotificationsCenter />);
    await screen.findByText("Manutenção programada no sábado");
    fireEvent.click(screen.getByRole("button", { name: /Ver detalhes do aviso: Manutenção programada/ }));
    const dlg = await screen.findByRole("dialog");
    await within(dlg).findByText("Quem leu");
    fireEvent.click(within(dlg).getByRole("button", { name: /Recolher aviso/ }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Recolher aviso" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("cancelar a confirmação não recolhe nada", async () => {
    wrap(<NotificationsCenter />);
    await screen.findByText("Manutenção programada no sábado");
    fireEvent.click(screen.getByRole("button", { name: /Ver detalhes do aviso: Manutenção programada/ }));
    const dlg = await screen.findByRole("dialog");
    await within(dlg).findByText("Quem leu");
    fireEvent.click(within(dlg).getByRole("button", { name: /Recolher aviso/ }));
    const ask = await screen.findByRole("alertdialog");
    fireEvent.click(within(ask).getByRole("button", { name: /Cancelar|Voltar/ }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(calls("admin_retract_notification")).toHaveLength(0);
  });
});

/* ───────── limpeza ───────── */

describe("limpeza", () => {
  const openClean = async () => {
    wrap(<NotificationsCenter />);
    await screen.findByText("Manutenção programada no sábado");
    fireEvent.click(screen.getByRole("button", { name: /Apagar lidas/ }));
    return screen.findByRole("dialog");
  };

  it("diz o que está guardado e o botão fica desligado quando não há lidas", async () => {
    handlers.get_admin_notifications_page = () => ({ data: avisosPage(avisos(), { program: program({ read: 0, read_old: 0 }) }), error: null });
    wrap(<NotificationsCenter />);
    await screen.findByText("Manutenção programada no sábado");
    expect(screen.getByRole("button", { name: /Apagar lidas/ })).toBeDisabled();
    expect(screen.getByText(/Nada é apagado sozinho: 0 já foram lidas há mais de 30 dias/)).toBeInTheDocument();
  });

  it("exige motivo e senha, manda o escopo e avisa quantas apagou", async () => {
    handlers.admin_clean_notifications = () => ({ data: { deleted: 640, remaining: 0 }, error: null });
    const dlg = await openClean();
    expect(within(dlg).getByText("Apagar notificações lidas?")).toBeInTheDocument();
    expect(within(dlg).getByText("792 notificações lidas hoje")).toBeInTheDocument();
    expect(within(dlg).getByRole("button", { name: "Lidas há mais de 30 dias · 640" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dlg).getByText(/As que o seller ainda não abriu ficam/)).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: "Apagar" }));
    expect(await within(dlg).findByRole("alert")).toHaveTextContent(/mínimo 5/);
    expect(calls("admin_clean_notifications")).toHaveLength(0);
    expect(confirmSpy).not.toHaveBeenCalled();
    fireEvent.click(within(dlg).getByRole("button", { name: "Todas as lidas · 792" }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Registros de teste" }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Apagar" }));
    await waitFor(() => expect(calls("admin_clean_notifications")).toHaveLength(1));
    expect(calls("admin_clean_notifications")[0]).toEqual({ _scope: "read_all", _reason: "Registros de teste" });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/Apagar notificações: todas as lidas \(792\)\. Não dá para desfazer\./);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("640 notificações apagadas."));
    await waitFor(() => expect(calls("get_admin_notifications_page").length).toBeGreaterThan(1));
  });

  it("repete os lotes até acabar e soma o total apagado", async () => {
    const seq = [{ deleted: 20000, remaining: 40000 }, { deleted: 20000, remaining: 20000 }, { deleted: 20000, remaining: 0 }];
    let i = 0;
    handlers.admin_clean_notifications = () => ({ data: seq[Math.min(i++, seq.length - 1)], error: null });
    const dlg = await openClean();
    fireEvent.click(within(dlg).getByRole("button", { name: "Limpeza de notificações antigas" }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Apagar" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("60.000 notificações apagadas."));
    expect(calls("admin_clean_notifications")).toHaveLength(3);
    expect(calls("admin_clean_notifications").every((c) => c._scope === "read_old" && c._reason === "Limpeza de notificações antigas")).toBe(true);
  });

  it("falha no meio: diz quantas já foram, não dá como concluído e deixa continuar", async () => {
    let i = 0;
    handlers.admin_clean_notifications = () => (i++ === 0
      ? { data: { deleted: 20000, remaining: 40000 }, error: null }
      : { data: null, error: { message: "falha de rede" } });
    const dlg = await openClean();
    fireEvent.click(within(dlg).getByRole("button", { name: "Limpeza de notificações antigas" }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Apagar" }));
    expect(await within(dlg).findByText(/Apagou 20\.000 e parou/)).toBeInTheDocument();
    expect(within(dlg).getByText(/Tente de novo para continuar/)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("falha logo no primeiro lote: erro do servidor dentro da janela", async () => {
    handlers.admin_clean_notifications = () => ({ data: null, error: { message: "reautenticação necessária: confirme sua senha" } });
    const dlg = await openClean();
    fireEvent.change(within(dlg).getByLabelText("Motivo"), { target: { value: "Registros de teste" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Apagar" }));
    expect(await within(dlg).findByText(/reautenticação necessária/)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
