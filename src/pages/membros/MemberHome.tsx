/**
 * Início do aluno: continuar de onde parou, meus cursos (com busca) e certificados.
 * Quem acabou de comprar e ainda não vê o curso pode pedir "Atualizar acesso".
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, GraduationCap, Loader2, Play, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { pickContinueIndex, summarizeCourse, type CourseSummary, type ModuleLite } from "@/components/member/courseModel";
import type { MemberOutletContext } from "@/pages/membros/MemberLayout";

type HomeCourse = { id: string; title: string; description: string | null; thumbnail_url: string | null; summary: CourseSummary };
type Cert = { id: string; code: string; course_title: string; issued_at: string };
type Home = { courses: HomeCourse[]; certs: Cert[] };

type CourseRow = {
  id: string; title: string; description: string | null; thumbnail_url: string | null;
  modules: { id: string; title: string; sort_order: number | null; lessons: { id: string; module_id?: string; title: string; sort_order: number | null }[] | null }[] | null;
};

async function fetchHome(userId: string): Promise<Home> {
  const [{ data: access, error: aErr }, { data: owned, error: oErr }] = await Promise.all([
    supabase.from("user_access").select("course_id").eq("user_id", userId).eq("status", "active"),
    supabase.from("courses").select("id").eq("user_id", userId),
  ]);
  if (aErr) throw aErr;
  if (oErr) throw oErr;
  const ids = [...new Set([...(access ?? []).map((a) => a.course_id), ...(owned ?? []).map((o) => o.id)])];

  const certQuery = supabase.from("certificates").select("id, code, course_title, issued_at").eq("user_id", userId).order("issued_at", { ascending: false }).limit(20);
  if (ids.length === 0) {
    const { data: certs } = await certQuery;
    return { courses: [], certs: (certs ?? []) as Cert[] };
  }

  const [{ data: rows, error: cErr }, { data: progress, error: pErr }, { data: certs }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, description, thumbnail_url, modules ( id, title, sort_order, lessons ( id, title, sort_order ) )")
      .in("id", ids)
      .eq("is_published", true)
      .order("sort_order"),
    supabase.from("user_progress").select("lesson_id, completed, updated_at").eq("user_id", userId),
    certQuery,
  ]);
  if (cErr) throw cErr;
  if (pErr) throw pErr;

  const courses = ((rows ?? []) as unknown as CourseRow[]).map((c) => {
    const modules: ModuleLite[] = (c.modules ?? []).map((m) => ({
      id: m.id, title: m.title, sort_order: m.sort_order,
      lessons: (m.lessons ?? []).map((l) => ({ id: l.id, module_id: m.id, title: l.title, sort_order: l.sort_order })),
    }));
    return { id: c.id, title: c.title, description: c.description, thumbnail_url: c.thumbnail_url, summary: summarizeCourse(modules, progress ?? []) };
  });
  return { courses, certs: (certs ?? []) as Cert[] };
}

/** Capa sem imagem: degradê estável por curso (matiz vem do id), nunca dois cursos iguais lado a lado por acaso. */
const hueFor = (id: string) => [...id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 360, 7);

function Cover({ course, className }: { course: HomeCourse; className?: string }) {
  if (course.thumbnail_url) return <img src={course.thumbnail_url} alt="" loading="lazy" className={`object-cover ${className ?? ""}`} />;
  const h = hueFor(course.id);
  return (
    <div aria-hidden style={{ backgroundImage: `linear-gradient(135deg, hsl(${h} 55% 30%), hsl(${(h + 40) % 360} 60% 16%))` }} className={`grid place-items-center ${className ?? ""}`}>
      <GraduationCap className="h-10 w-10 text-white/70" />
    </div>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.1]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progresso">
      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

const courseLink = (c: HomeCourse) => `/membros-area/curso/${c.id}${c.summary.next && c.summary.status !== "completed" ? `?aula=${c.summary.next.id}` : ""}`;
const statusText = (s: CourseSummary) =>
  s.status === "completed" ? "Curso concluído" : s.status === "empty" ? "Sem aulas ainda" : `${s.done} de ${s.total} ${s.total === 1 ? "aula" : "aulas"}`;
const ctaText = (s: CourseSummary) => (s.status === "completed" ? "Rever" : s.status === "in_progress" ? "Continuar" : "Começar");

export default function MemberHome() {
  const { user, name } = useOutletContext<MemberOutletContext>();
  const qc = useQueryClient();
  const home = useQuery({ queryKey: ["member-home", user.id], queryFn: () => fetchHome(user.id), staleTime: 15_000, retry: 1 });
  const [q, setQ] = useState("");
  const [claiming, setClaiming] = useState(false);
  const autoClaimed = useRef(false);

  const claim = async (manual: boolean) => {
    setClaiming(true);
    const { data, error } = await supabase.rpc("claim_my_pending_deliveries");
    setClaiming(false);
    if (!error && typeof data === "number" && data > 0) {
      toast.success(data === 1 ? "Seu curso foi liberado." : `${data} cursos liberados.`);
      await qc.invalidateQueries({ queryKey: ["member-home", user.id] });
      return;
    }
    if (manual) {
      toast.info(error ? "Não foi possível conferir agora. Tente de novo em instantes." : "Ainda não encontramos uma compra paga com o e-mail desta conta.");
      void home.refetch();
    }
  };

  // Quem acabou de criar a conta depois de pagar: tenta liberar sozinho uma vez, em silêncio.
  const empty = home.isSuccess && home.data.courses.length === 0;
  useEffect(() => {
    if (empty && !autoClaimed.current) { autoClaimed.current = true; void claim(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empty]);

  const courses = useMemo(() => home.data?.courses ?? [], [home.data]);
  const featuredIdx = useMemo(() => pickContinueIndex(courses), [courses]);
  const featured = featuredIdx >= 0 ? courses[featuredIdx] : null;
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? courses.filter((c) => c.title.toLowerCase().includes(t)) : courses;
  }, [courses, q]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  if (home.isPending) {
    return (
      <div aria-busy="true" aria-label="Carregando seus cursos" className="space-y-8">
        <div className="h-10 w-72 animate-pulse rounded-lg bg-white/[0.07] motion-reduce:animate-none" />
        <div className="h-56 animate-pulse rounded-[22px] bg-white/[0.05] motion-reduce:animate-none" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-64 animate-pulse rounded-[16px] bg-white/[0.05] motion-reduce:animate-none" />)}</div>
      </div>
    );
  }

  if (home.isError) {
    return (
      <div role="alert" className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-[22px] font-extrabold tracking-[-0.02em]">Não foi possível carregar seus cursos</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">Confira sua conexão e tente de novo.</p>
        <button type="button" onClick={() => void home.refetch()} className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-[14.5px] font-bold text-primary-foreground hover:opacity-90">Tentar de novo</button>
      </div>
    );
  }

  const certs = home.data.certs;

  return (
    <div className="space-y-12">
      <Seo title="Meus cursos — Área de membros" description="Seus cursos, progresso e certificados." path="/membros-area" noindex />

      <header>
        <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[40px]">{greeting}, {name}</h1>
        <p className="mt-1.5 text-[16px] text-muted-foreground">
          {courses.length === 0 ? "Seus cursos aparecem aqui." : courses.length === 1 ? "Você tem 1 curso." : `Você tem ${courses.length} cursos.`}
        </p>
      </header>

      {courses.length === 0 ? (
        <section className="mx-auto max-w-xl rounded-[22px] bg-white/[0.05] px-6 py-12 text-center sm:px-10">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-primary"><GraduationCap className="h-7 w-7" /></span>
          <h2 className="mt-5 text-[22px] font-extrabold tracking-[-0.02em]">Nenhum curso por aqui ainda</h2>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Se você acabou de comprar, o acesso é liberado assim que o pagamento é confirmado. Entre com o <strong className="font-semibold text-foreground">mesmo e-mail da compra</strong>.
          </p>
          {user.email && (
            <p className="mx-auto mt-3 w-fit max-w-full rounded-[16px] bg-white/[0.06] px-4 py-2 text-[13.5px] text-muted-foreground">
              Conta atual: <span className="break-all font-semibold text-foreground">{user.email}</span>
            </p>
          )}
          <button type="button" onClick={() => void claim(true)} disabled={claiming} className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-[15px] font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60">
            {claiming ? <Loader2 className="h-[18px] w-[18px] animate-spin motion-reduce:animate-none" aria-hidden /> : <RefreshCw className="h-[18px] w-[18px]" aria-hidden />}
            Atualizar acesso
          </button>
        </section>
      ) : (
        <>
          {featured && (
            <section aria-labelledby="continuar">
              <h2 id="continuar" className="sr-only">Continuar</h2>
              <Link to={courseLink(featured)} className="group grid overflow-hidden rounded-[22px] bg-white/[0.05] transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
                <Cover course={featured} className="aspect-video h-full w-full md:aspect-auto md:min-h-[260px]" />
                <div className="flex flex-col justify-center p-6 sm:p-8">
                  <p className="text-[14px] font-semibold text-primary">{featured.summary.status === "in_progress" ? "Continue de onde parou" : "Comece por aqui"}</p>
                  <h3 className="mt-2 text-[24px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[28px]">{featured.title}</h3>
                  {featured.summary.next && (
                    <p className="mt-2 text-[15px] text-muted-foreground">
                      {featured.summary.status === "in_progress" ? "Próxima aula" : "Primeira aula"}: <span className="text-foreground/90">{featured.summary.next.title}</span>
                    </p>
                  )}
                  <div className="mt-5 max-w-sm">
                    <Bar pct={featured.summary.pct} />
                    <p className="mt-2 text-[13.5px] text-muted-foreground">{statusText(featured.summary)}{featured.summary.total > 0 ? ` (${featured.summary.pct}%)` : ""}</p>
                  </div>
                  <span className="mt-6 inline-flex h-12 w-fit items-center gap-2 rounded-full bg-primary px-6 text-[15px] font-bold text-primary-foreground">
                    <Play className="h-4 w-4 fill-current" aria-hidden /> {ctaText(featured.summary)}
                  </span>
                </div>
              </Link>
            </section>
          )}

          <section aria-labelledby="meus-cursos">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 id="meus-cursos" className="text-[22px] font-extrabold tracking-[-0.02em]">Meus cursos</h2>
              {courses.length > 3 && (
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <input
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar curso"
                    aria-label="Buscar curso"
                    className="h-11 w-full rounded-full border border-white/10 bg-white/[0.04] pl-11 pr-4 text-[15px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  />
                </div>
              )}
            </div>
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-[15px] text-muted-foreground">Nenhum curso com “{q.trim()}”.</p>
            ) : (
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((c) => (
                  <li key={c.id}>
                    <Link to={courseLink(c)} className="group block h-full overflow-hidden rounded-[16px] bg-white/[0.05] transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      <Cover course={c} className="aspect-[16/10] w-full" />
                      <div className="p-5">
                        <h3 className="line-clamp-2 min-h-[2.6em] text-[17px] font-extrabold leading-snug tracking-[-0.02em]">{c.title}</h3>
                        <div className="mt-4"><Bar pct={c.summary.pct} /></div>
                        <div className="mt-2.5 flex items-center justify-between gap-3 text-[13.5px]">
                          <span className={c.summary.status === "completed" ? "font-semibold text-primary" : "text-muted-foreground"}>{statusText(c.summary)}</span>
                          <span className="font-bold text-foreground group-hover:text-primary">{ctaText(c.summary)}</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {certs.length > 0 && (
        <section id="certificados" aria-labelledby="certs" className="scroll-mt-24">
          <h2 id="certs" className="mb-5 text-[22px] font-extrabold tracking-[-0.02em]">Certificados</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {certs.map((c) => (
              <li key={c.id}>
                <Link to={`/certificado/${c.code}`} className="flex items-center gap-4 rounded-[16px] bg-white/[0.05] p-4 transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"><Award className="h-6 w-6" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15.5px] font-bold">{c.course_title}</span>
                    <span className="block text-[13.5px] text-muted-foreground">Emitido em {new Date(c.issued_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                  </span>
                  <span className="shrink-0 text-[14px] font-bold text-primary">Ver</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
