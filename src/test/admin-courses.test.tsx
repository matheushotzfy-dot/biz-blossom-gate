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
const openExternalSpy = vi.fn((_url: string) => true);
vi.mock("@/lib/safeUrl", async (orig) => ({ ...(await orig<typeof import("@/lib/safeUrl")>()), openExternal: (u: string) => openExternalSpy(u) }));

import { toast } from "sonner";
import CoursesCenter from "@/features/admin-courses/CoursesCenter";
import {
  checkReason, courseAttention, courseState, dayLabel, durationLabel, historyLabel, parseCourseDetail, parseCoursesPage, productStateLabel, videoKind,
} from "@/features/admin-courses/coursesModel";

/* ───────── dados ───────── */

const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();
const course = (over: Record<string, unknown> = {}) => ({
  id: "c1", title: "Método Lançamento 7D", category: "Marketing digital", thumbnail_url: null, is_published: true, hold_reason: null, hold_at: null,
  created_at: ago(300), updated_at: ago(5), product_id: "p1", product_name: "Método Lançamento 7D", product_status: "active", product_deleted: false,
  seller_user_id: "s1", seller_name: "Marina Duarte", seller_email: "marina@exemplo.com", modules: 4, lessons: 22, minutes: 187, students: 64, certificates: 11, ...over,
});
const summary = (over: Record<string, unknown> = {}) => ({ all: 3, published: 2, draft: 0, held: 1, published_empty: 0, published_product_off: 0, ...over });
const pageOf = (items: unknown[], over: Record<string, unknown> = {}) => ({ items, total: items.length, summary: summary(), generated_at: ago(0), ...over });

const lesson = (over: Record<string, unknown> = {}) => ({ id: "l1", title: "Boas-vindas", minutes: 8, is_free: true, video_url: "https://youtu.be/abc123", attachments: 2, ...over });
const detail = (over: Record<string, unknown> = {}) => ({
  course: { id: "c1", title: "Método Lançamento 7D", description: "Passo a passo para montar a oferta.", category: "Marketing digital", thumbnail_url: null, is_published: true, hold_reason: null, hold_at: null, created_at: ago(300), updated_at: ago(5) },
  product: { id: "p1", name: "Método Lançamento 7D", status: "active", deleted: false },
  seller: { user_id: "s1", name: "Marina Duarte", email: "marina@exemplo.com", account_status: "active" },
  stats: { modules: 2, lessons: 3, minutes: 30, free_lessons: 1, without_video: 1, students: 64, revoked: 2, with_progress: 41, active_7d: 17, certificates: 11, comments: 1 },
  modules: [
    { id: "m1", title: "Comece por aqui", lessons: [lesson(), lesson({ id: "l2", title: "Sem vídeo ainda", is_free: false, video_url: null, attachments: 0, minutes: 0 })] },
    { id: "m2", title: "Colocando no ar", lessons: [lesson({ id: "l3", title: "Aula enviada", is_free: false, video_url: "javascript:alert(1)", attachments: 0 })] },
  ],
  history: [{ id: "h1", action: "course_release", created_at: ago(50), admin_name: "Admin", details: { reason: "Seller corrigiu a promessa" } }],
  ...over,
});

const handlers: Record<string, (a: Record<string, unknown>) => Res> = {};
const calls = (n: string) => rpc.mock.calls.filter((c) => c[0] === n).map((c) => c[1] as Record<string, unknown>);

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
const tableRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

beforeEach(() => {
  rpc.mockReset(); from.mockClear(); confirmSpy.mockClear(); openExternalSpy.mockClear();
  for (const k of Object.keys(handlers)) delete handlers[k];
  vi.mocked(toast.error).mockClear(); vi.mocked(toast.success).mockClear();
  handlers.get_admin_courses_page = () => ({
    data: pageOf([
      course(),
      course({ id: "c2", title: "Planilha em vídeo", lessons: 0, modules: 0, minutes: 0, students: 3, certificates: 0, seller_name: "Loja do Caio" }),
      course({ id: "c3", title: "Promessa de renda", is_published: false, hold_at: ago(30), hold_reason: "Promessa irreal de resultado", seller_name: "Loja do Caio" }),
    ], { summary: summary({ published_empty: 1 }) }),
    error: null,
  });
  handlers.get_admin_course_detail = () => ({ data: detail(), error: null });
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => (handlers[name] ? handlers[name](args) : { data: { ok: true }, error: null }));
});

/* ───────── modelo ───────── */

describe("coursesModel", () => {
  it("lê a lista e rejeita formato inesperado", () => {
    const p = parseCoursesPage(pageOf([course({ lessons: "22", category: "" })]));
    expect(p.items[0]).toMatchObject({ title: "Método Lançamento 7D", lessons: 22, category: null, is_published: true });
    expect(p.summary.held).toBe(1);
    expect(() => parseCoursesPage(null)).toThrow();
    expect(() => parseCoursesPage({ items: "x" })).toThrow();
  });

  it("lê o raio-X com módulos, aulas e histórico", () => {
    const d = parseCourseDetail(detail());
    expect(d.modules).toHaveLength(2);
    expect(d.modules[0].lessons[1]).toMatchObject({ title: "Sem vídeo ainda", video_url: null });
    expect(d.history[0]).toMatchObject({ action: "course_release", reason: "Seller corrigiu a promessa", admin_name: "Admin" });
    expect(parseCourseDetail(detail({ product: null })).product).toBeNull();
    expect(() => parseCourseDetail({})).toThrow();
  });

  it("situação: tirado do ar vence publicado", () => {
    expect(courseState({ is_published: true, hold_at: null })).toEqual({ label: "No ar", tone: "success" });
    expect(courseState({ is_published: false, hold_at: null }).label).toBe("Rascunho");
    expect(courseState({ is_published: false, hold_at: ago(1) })).toEqual({ label: "Tirado do ar", tone: "destructive" });
  });

  it("atenção: só quando está no ar e algo impede o aluno", () => {
    const base = { is_published: true, lessons: 5, product_id: "p1", product_status: "active", product_deleted: false, hold_at: null };
    expect(courseAttention(base)).toBeNull();
    expect(courseAttention({ ...base, lessons: 0 })).toBe("No ar sem nenhuma aula");
    expect(courseAttention({ ...base, product_status: "inactive" })).toBe("O produto ligado está fora do ar");
    expect(courseAttention({ ...base, product_deleted: true })).toBe("O produto ligado está fora do ar");
    expect(courseAttention({ ...base, product_id: null, product_status: null })).toBeNull();
    expect(courseAttention({ ...base, is_published: false, lessons: 0 })).toBeNull();
    expect(courseAttention({ ...base, lessons: 0, hold_at: ago(1) })).toBeNull();
  });

  it("textos de produto, duração, dia e histórico", () => {
    expect(productStateLabel(null)).toBeNull();
    expect(productStateLabel({ status: "active", deleted: false })).toBeNull();
    expect(productStateLabel({ status: "active", deleted: true })).toBe("apagado");
    expect(productStateLabel({ status: "pending_review", deleted: false })).toBe("em revisão");
    expect(durationLabel(0)).toBe("—");
    expect(durationLabel(45)).toBe("45 min");
    expect(durationLabel(120)).toBe("2 h");
    expect(durationLabel(187)).toBe("3 h 7 min");
    expect(dayLabel("2026-11-25T02:00:00Z")).toBe("24/11/2026");
    expect(dayLabel("lixo")).toBe("—");
    expect(historyLabel("course_hold")).toBe("Tirado do ar");
    expect(historyLabel("course_release")).toBe("Liberado para o seller publicar");
    expect(historyLabel("outra")).toBe("Ação registrada");
  });

  it("tipo de vídeo: link seguro, enviado, inválido e vazio", () => {
    expect(videoKind(null).kind).toBe("none");
    expect(videoKind("https://www.youtube.com/watch?v=1")).toEqual({ kind: "link", label: "YouTube" });
    expect(videoKind("https://youtu.be/abc")).toEqual({ kind: "link", label: "YouTube" });
    expect(videoKind("https://vimeo.com/123")).toEqual({ kind: "link", label: "Vimeo" });
    expect(videoKind("https://cdn.exemplo.com/a.mp4")).toEqual({ kind: "link", label: "cdn.exemplo.com" });
    expect(videoKind("javascript:alert(1)")).toEqual({ kind: "link", label: "Link inválido" });
  });

  it("motivo precisa de 5 caracteres", () => {
    expect(checkReason("  ab ")).toMatch(/mínimo 5/);
    expect(checkReason("Direitos autorais")).toBeNull();
  });
});

/* ───────── tela ───────── */

describe("CoursesCenter", () => {
  it("quem não é admin vê o aviso e nada é consultado", () => {
    wrap(<CoursesCenter isAdmin={false} />);
    expect(screen.getByText("A curadoria de cursos é do administrador")).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("mostra totais, avisos e a lista pela RPC (nunca lê a tabela)", async () => {
    wrap(<CoursesCenter />);
    await screen.findAllByText("Método Lançamento 7D");
    expect(calls("get_admin_courses_page")[0]).toEqual({ _status: "all", _search: null, _page: 1, _page_size: 25 });
    expect(from).not.toHaveBeenCalled();
    expect(screen.getByText("1 no ar com problema")).toBeInTheDocument();
    const rows = tableRows();
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("22 aulas")).toBeInTheDocument();
    expect(within(rows[1]).getByText("No ar sem nenhuma aula")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Tirado do ar")).toBeInTheDocument();
    expect(within(rows[2]).getByText(/Motivo: Promessa irreal de resultado/)).toBeInTheDocument();
    expect(screen.getByText("Todos · 3")).toBeInTheDocument();
    expect(screen.getByText("Tirados do ar · 1")).toBeInTheDocument();
    expect(from).not.toHaveBeenCalled();
  });

  it("filtro de situação e busca viram argumentos da RPC; limpar volta ao começo", async () => {
    wrap(<CoursesCenter />);
    await screen.findAllByText("Método Lançamento 7D");
    fireEvent.click(screen.getByRole("button", { name: /Tirados do ar/ }));
    await waitFor(() => expect(calls("get_admin_courses_page").at(-1)).toMatchObject({ _status: "held", _page: 1 }));
    fireEvent.change(screen.getByLabelText("Buscar cursos"), { target: { value: "  caio " } });
    await waitFor(() => expect(calls("get_admin_courses_page").at(-1)).toMatchObject({ _status: "held", _search: "caio" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);
    expect((screen.getByLabelText("Buscar cursos") as HTMLInputElement).value).toBe("");
    await waitFor(() => expect(calls("get_admin_courses_page").at(-1)).toMatchObject({ _status: "all", _search: null }));
  });

  it("sem resultado e sem cursos têm textos diferentes", async () => {
    handlers.get_admin_courses_page = () => ({ data: pageOf([], { summary: summary({ all: 0, published: 0, held: 0 }) }), error: null });
    wrap(<CoursesCenter />);
    expect(await screen.findByText("Nenhum curso criado ainda")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar cursos"), { target: { value: "zzz" } });
    expect(await screen.findByText("Nada por aqui")).toBeInTheDocument();
  });

  it("erro na lista mostra aviso e tenta de novo", async () => {
    handlers.get_admin_courses_page = () => ({ data: null, error: { message: "falha de rede" } });
    wrap(<CoursesCenter />);
    expect(await screen.findByText("Não foi possível carregar os cursos.")).toBeInTheDocument();
    handlers.get_admin_courses_page = () => ({ data: pageOf([course()], { summary: summary({ all: 1, published: 1, held: 0 }) }), error: null });
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect((await screen.findAllByText("Método Lançamento 7D")).length).toBeGreaterThan(0);
  });

  it("raio-X mostra conteúdo, alunos, histórico e abre só links seguros", async () => {
    wrap(<CoursesCenter />);
    await screen.findAllByText("Método Lançamento 7D");
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Ver Método Lançamento 7D" }));
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText("Passo a passo para montar a oferta.")).toBeInTheDocument();
    expect(calls("get_admin_course_detail")[0]).toEqual({ _id: "c1" });
    expect(within(dlg).getByText("Comece por aqui")).toBeInTheDocument();
    expect(within(dlg).getByText("Sem vídeo ainda")).toBeInTheDocument();
    expect(within(dlg).getByText("Sem vídeo")).toBeInTheDocument();
    expect(within(dlg).getByText("Link inválido")).toBeInTheDocument();
    expect(within(dlg).getByText("Seller corrigiu a promessa")).toBeInTheDocument();
    expect(within(dlg).getByText("2 com acesso retirado")).toBeInTheDocument();
    expect(within(dlg).getByText(/1 aula sem vídeo/)).toBeInTheDocument();
    // só a aula com link válido ganha o botão Abrir
    const abrir = within(dlg).getAllByRole("button", { name: /Abrir o vídeo/ });
    expect(abrir).toHaveLength(1);
    fireEvent.click(abrir[0]);
    await waitFor(() => expect(openExternalSpy).toHaveBeenCalledWith("https://youtu.be/abc123"));
    // curso no ar: oferece tirar do ar, não liberar
    expect(within(dlg).getByRole("button", { name: "Tirar do ar" })).toBeInTheDocument();
    expect(within(dlg).queryByRole("button", { name: "Liberar curso" })).toBeNull();
  });

  it("falha no raio-X mostra erro e tenta de novo", async () => {
    handlers.get_admin_course_detail = () => ({ data: null, error: { message: "curso não encontrado" } });
    wrap(<CoursesCenter />);
    await screen.findAllByText("Método Lançamento 7D");
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Ver Método Lançamento 7D" }));
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText(/curso não encontrado/)).toBeInTheDocument();
    handlers.get_admin_course_detail = () => ({ data: detail(), error: null });
    fireEvent.click(within(dlg).getByRole("button", { name: "Tentar de novo" }));
    expect(await within(dlg).findByText("Passo a passo para montar a oferta.")).toBeInTheDocument();
  });

  it("tirar do ar: exige motivo, pede senha, chama a RPC e avisa", async () => {
    wrap(<CoursesCenter />);
    await screen.findAllByText("Método Lançamento 7D");
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Ver Método Lançamento 7D" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByRole("button", { name: "Tirar do ar" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    expect(within(mod).getByText("Tirar do ar?")).toBeInTheDocument();
    // sem motivo: nada é enviado e o erro aparece
    fireEvent.click(within(mod).getByRole("button", { name: "Tirar do ar" }));
    expect(await within(mod).findByRole("alert")).toHaveTextContent(/mínimo 5/);
    expect(calls("admin_set_course_hold")).toHaveLength(0);
    expect(confirmSpy).not.toHaveBeenCalled();
    // chip preenche o motivo
    fireEvent.click(within(mod).getByRole("button", { name: "Direitos autorais" }));
    expect((within(mod).getByLabelText("Motivo") as HTMLTextAreaElement).value).toBe("Direitos autorais");
    fireEvent.click(within(mod).getByRole("button", { name: "Tirar do ar" }));
    await waitFor(() => expect(calls("admin_set_course_hold")).toHaveLength(1));
    expect(calls("admin_set_course_hold")[0]).toEqual({ _id: "c1", _hold: true, _reason: "Direitos autorais" });
    expect(confirmSpy.mock.calls[0][0]).toMatch(/Tirar do ar: Método Lançamento 7D, de Marina Duarte/);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Curso tirado do ar. O seller não consegue publicar de novo."));
    await waitFor(() => expect(calls("get_admin_courses_page").length).toBeGreaterThan(1));
  });

  it("liberar: curso tirado do ar mostra o motivo e libera com motivo", async () => {
    handlers.get_admin_course_detail = () => ({
      data: detail({ course: { ...detail().course, id: "c3", title: "Promessa de renda", is_published: false, hold_at: ago(30), hold_reason: "Promessa irreal de resultado" } }), error: null,
    });
    wrap(<CoursesCenter />);
    await screen.findAllByText("Promessa de renda");
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Ver Promessa de renda" }));
    const dlg = await screen.findByRole("dialog");
    expect(await within(dlg).findByText(/O seller não consegue publicar de novo\./)).toBeInTheDocument();
    expect(within(dlg).getByText(/Motivo: Promessa irreal de resultado/)).toBeInTheDocument();
    expect(within(dlg).queryByRole("button", { name: "Tirar do ar" })).toBeNull();
    fireEvent.click(within(dlg).getByRole("button", { name: "Liberar curso" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    expect(within(mod).getByText("Liberar curso?")).toBeInTheDocument();
    expect(within(mod).queryByRole("button", { name: "Direitos autorais" })).toBeNull();
    fireEvent.change(within(mod).getByLabelText("Motivo"), { target: { value: "Seller corrigiu a página" } });
    fireEvent.click(within(mod).getByRole("button", { name: "Liberar curso" }));
    await waitFor(() => expect(calls("admin_set_course_hold")).toHaveLength(1));
    expect(calls("admin_set_course_hold")[0]).toEqual({ _id: "c3", _hold: false, _reason: "Seller corrigiu a página" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Curso liberado. O seller já pode publicar quando quiser."));
  });

  it("erro do servidor fica no diálogo e nada fecha", async () => {
    handlers.admin_set_course_hold = () => ({ data: null, error: { message: "Autenticação recente necessária" } });
    wrap(<CoursesCenter />);
    await screen.findAllByText("Método Lançamento 7D");
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Ver Método Lançamento 7D" }));
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByRole("button", { name: "Tirar do ar" }));
    const mod = (await screen.findAllByRole("dialog")).at(-1)!;
    fireEvent.change(within(mod).getByLabelText("Motivo"), { target: { value: "Conteúdo ilegal" } });
    fireEvent.click(within(mod).getByRole("button", { name: "Tirar do ar" }));
    expect(await within(mod).findByText(/Autenticação recente necessária/)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByText("Tirar do ar?")).toBeInTheDocument();
  });
});
