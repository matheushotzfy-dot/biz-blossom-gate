import { describe, expect, it } from "vitest";
import {
  formatClock, formatMinutes, lessonPosition, neighbors, orderedLessons, parseClock, pickContinueIndex, pickStartLessonId, progressOf, shortName, sortCourse, summarizeCourse, timeAgo, totalMinutes, videoKind,
} from "@/components/member/courseModel";
import { courseContentPathFromUrl, courseFilePath } from "@/lib/courseFiles";

const L = (id: string, module_id: string, sort_order: number, extra = {}) => ({ id, module_id, title: id, sort_order, ...extra });

const course = sortCourse([
  { id: "m2", title: "B", sort_order: 2, lessons: [L("b2", "m2", 2), L("b1", "m2", 1)] },
  { id: "m1", title: "A", sort_order: 1, lessons: [L("a2", "m1", 2), L("a1", "m1", 1)] },
]);
const lessons = orderedLessons(course);

describe("ordem do curso", () => {
  it("ordena módulos e aulas por sort_order", () => {
    expect(lessons.map((l) => l.id)).toEqual(["a1", "a2", "b1", "b2"]);
  });
  it("não muda o que recebeu", () => {
    const raw = [{ id: "m", title: "M", sort_order: 1, lessons: [L("x2", "m", 2), L("x1", "m", 1)] }];
    sortCourse(raw);
    expect(raw[0].lessons.map((l) => l.id)).toEqual(["x2", "x1"]);
  });
  it("aula sem sort_order vai para o começo", () => {
    const c = sortCourse([{ id: "m", title: "M", lessons: [L("b", "m", 5), { id: "a", module_id: "m", title: "a" }] }]);
    expect(c[0].lessons[0].id).toBe("a");
  });
});

describe("progresso", () => {
  it("conta concluídas com Map ou objeto", () => {
    expect(progressOf(lessons, new Map([["a1", true], ["a2", false], ["b1", true]]))).toEqual({ done: 2, total: 4, pct: 50 });
    expect(progressOf(lessons, { a1: true })).toEqual({ done: 1, total: 4, pct: 25 });
  });
  it("curso sem aulas é 0%, nunca NaN", () => {
    expect(progressOf([], new Map())).toEqual({ done: 0, total: 0, pct: 0 });
  });
  it("arredonda", () => {
    expect(progressOf([{ id: "1" }, { id: "2" }, { id: "3" }], { 1: true }).pct).toBe(33);
  });
});

describe("qual aula abrir", () => {
  it("usa a pedida quando ela existe no curso", () => {
    expect(pickStartLessonId(lessons, new Map(), "b1")).toBe("b1");
  });
  it("ignora pedido de aula que não é do curso", () => {
    expect(pickStartLessonId(lessons, new Map(), "zzz")).toBe("a1");
  });
  it("abre a primeira ainda não concluída", () => {
    expect(pickStartLessonId(lessons, new Map([["a1", true], ["a2", true]]))).toBe("b1");
  });
  it("com tudo concluído volta para a primeira", () => {
    expect(pickStartLessonId(lessons, { a1: true, a2: true, b1: true, b2: true })).toBe("a1");
  });
  it("sem aulas devolve null", () => {
    expect(pickStartLessonId([], new Map(), "a1")).toBeNull();
  });
});

describe("vizinhas e posição", () => {
  it("anterior e próxima", () => {
    expect(neighbors(lessons, "a2")).toEqual({ prev: lessons[0], next: lessons[2] });
    expect(neighbors(lessons, "a1").prev).toBeNull();
    expect(neighbors(lessons, "b2").next).toBeNull();
    expect(neighbors(lessons, null)).toEqual({ prev: null, next: null });
    expect(neighbors(lessons, "nao-existe")).toEqual({ prev: null, next: null });
  });
  it("posição começa em 1", () => {
    expect(lessonPosition(lessons, "a1")).toEqual({ index: 1, total: 4 });
    expect(lessonPosition(lessons, "b2")).toEqual({ index: 4, total: 4 });
    expect(lessonPosition(lessons, null)).toEqual({ index: 0, total: 4 });
  });
});

describe("duração", () => {
  it("formata minutos e horas", () => {
    expect(formatMinutes(0)).toBe("");
    expect(formatMinutes(null)).toBe("");
    expect(formatMinutes(8)).toBe("8 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(65)).toBe("1 h 05");
    expect(formatMinutes(135)).toBe("2 h 15");
  });
  it("soma ignorando vazios", () => {
    expect(totalMinutes([{ duration_minutes: 8 }, { duration_minutes: null }, {}, { duration_minutes: 12 }])).toBe(20);
  });
});

describe("tipo de vídeo", () => {
  it("reconhece YouTube e Vimeo", () => {
    expect(videoKind("https://www.youtube.com/watch?v=abc", false)).toBe("youtube");
    expect(videoKind("https://youtu.be/abc", false)).toBe("youtube");
    expect(videoKind("https://vimeo.com/76979871", false)).toBe("vimeo");
  });
  it("arquivo do bucket ou link direto para arquivo toca no player", () => {
    expect(videoKind("https://x.supabase.co/storage/v1/object/public/course-content/u/c/videos/a.bin", true)).toBe("file");
    expect(videoKind("https://cdn.exemplo.com/aula.MP4?token=1", false)).toBe("file");
  });
  it("embeds conhecidos viram iframe e o resto vira link", () => {
    expect(videoKind("https://fast.wistia.net/embed/iframe/abc", false)).toBe("embed");
    expect(videoKind("https://player.hotmart.com/embed/x", false)).toBe("embed");
    expect(videoKind("https://site-qualquer.com/aula", false)).toBe("link");
    expect(videoKind("http://youtube-falso.com/x", false)).toBe("link");
  });
  it("vazio e inválido", () => {
    expect(videoKind("", false)).toBe("none");
    expect(videoKind(null, false)).toBe("none");
    expect(videoKind("isso não é url", false)).toBe("none");
  });
});

describe("arquivos do curso", () => {
  const url = "https://x.supabase.co/storage/v1/object/public/course-content/u1/c1/videos/abc%20d.mp4?t=1";
  it("tira o caminho do endereço guardado", () => {
    expect(courseContentPathFromUrl(url)).toBe("u1/c1/videos/abc d.mp4");
    expect(courseContentPathFromUrl("https://www.youtube.com/watch?v=1")).toBeNull();
    expect(courseContentPathFromUrl(null)).toBeNull();
  });
  it("monta a pasta {dono}/{curso}/… que a política do storage exige", () => {
    const p = courseFilePath("u1", "c1", "videos", "MP4");
    expect(p).toMatch(/^u1\/c1\/videos\/[0-9a-f-]{36}\.mp4$/);
    expect(courseFilePath("u1", "c1", "attachments", "../x y")).toMatch(/^u1\/c1\/attachments\/[0-9a-f-]{36}\.xy$/);
    expect(courseFilePath("u1", "c1", "attachments", "")).toMatch(/\.bin$/);
  });
});

describe("anotações com minuto", () => {
  it("formata", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(270)).toBe("4:30");
    expect(formatClock(3723)).toBe("1:02:03");
    expect(formatClock(-5)).toBe("0:00");
  });
  it("lê mm:ss e h:mm:ss", () => {
    expect(parseClock("")).toBe(0);
    expect(parseClock(" 4:30 ")).toBe(270);
    expect(parseClock("0:05")).toBe(5);
    expect(parseClock("1:02:03")).toBe(3723);
    expect(parseClock("75:10")).toBe(4510);
  });
  it("recusa o que não é horário", () => {
    expect(parseClock("4:75")).toBeNull();
    expect(parseClock("abc")).toBeNull();
    expect(parseClock("90")).toBeNull();
    expect(parseClock("1:75:00")).toBeNull();
  });
});

describe("comentários", () => {
  it("mostra só o primeiro nome e a inicial do sobrenome", () => {
    expect(shortName("Maria da Silva Souza")).toBe("Maria S.");
    expect(shortName("  joão ")).toBe("joão");
    expect(shortName("")).toBe("Aluno");
    expect(shortName(null)).toBe("Aluno");
  });
  it("tempo relativo", () => {
    const now = new Date("2026-11-25T12:00:00Z").getTime();
    expect(timeAgo("2026-11-25T11:59:40Z", now)).toBe("agora");
    expect(timeAgo("2026-11-25T11:55:00Z", now)).toBe("há 5 min");
    expect(timeAgo("2026-11-25T09:00:00Z", now)).toBe("há 3 h");
    expect(timeAgo("2026-11-23T12:00:00Z", now)).toBe("há 2 d");
    expect(timeAgo("lixo", now)).toBe("");
  });
});

describe("resumo do curso", () => {
  const mods = [{ id: "m1", title: "Um", sort_order: 1, lessons: [L("a1", "m1", 1), L("a2", "m1", 2)] }, { id: "m2", title: "Dois", sort_order: 2, lessons: [L("b1", "m2", 1)] }];
  const row = (lesson_id: string, completed: boolean, updated_at: string) => ({ lesson_id, completed, updated_at });

  it("curso sem progresso", () => {
    const s = summarizeCourse(mods, []);
    expect(s).toMatchObject({ total: 3, done: 0, pct: 0, status: "not_started", lastActivityAt: 0 });
    expect(s.next).toEqual({ id: "a1", title: "a1", moduleTitle: "Um" });
  });
  it("em andamento aponta a primeira aula não concluída", () => {
    const s = summarizeCourse(mods, [row("a1", true, "2026-11-20T10:00:00Z")]);
    expect(s).toMatchObject({ done: 1, pct: 33, status: "in_progress" });
    expect(s.next?.id).toBe("a2");
    expect(s.lastActivityAt).toBe(new Date("2026-11-20T10:00:00Z").getTime());
  });
  it("concluído volta para a primeira aula", () => {
    const s = summarizeCourse(mods, [row("a1", true, "2026-11-20T10:00:00Z"), row("a2", true, "2026-11-21T10:00:00Z"), row("b1", true, "2026-11-22T10:00:00Z")]);
    expect(s).toMatchObject({ pct: 100, status: "completed" });
    expect(s.next?.id).toBe("a1");
  });
  it("ignora progresso de aula que não é do curso e linha não concluída", () => {
    const s = summarizeCourse(mods, [row("outra", true, "2026-11-25T10:00:00Z"), row("a1", false, "2026-11-19T10:00:00Z")]);
    expect(s).toMatchObject({ done: 0, status: "not_started" });
    expect(s.lastActivityAt).toBe(new Date("2026-11-19T10:00:00Z").getTime());
  });
  it("curso sem aulas", () => {
    const s = summarizeCourse([{ id: "m", title: "M", lessons: [] }], []);
    expect(s).toMatchObject({ total: 0, pct: 0, status: "empty", next: null });
  });
  it("destaque: o mais recente em andamento, senão o primeiro não começado, senão nenhum", () => {
    const a = { summary: summarizeCourse(mods, [row("a1", true, "2026-11-20T10:00:00Z")]) };
    const b = { summary: summarizeCourse(mods, [row("a1", true, "2026-11-24T10:00:00Z")]) };
    const fresh = { summary: summarizeCourse(mods, []) };
    const finished = { summary: summarizeCourse(mods, [row("a1", true, "2026-11-20T10:00:00Z"), row("a2", true, "2026-11-20T10:00:00Z"), row("b1", true, "2026-11-20T10:00:00Z")]) };
    expect(pickContinueIndex([a, b, fresh])).toBe(1);
    expect(pickContinueIndex([finished, fresh])).toBe(1);
    expect(pickContinueIndex([finished])).toBe(-1);
    expect(pickContinueIndex([])).toBe(-1);
  });
});
