/**
 * Curso do aluno: player, grade de aulas, materiais, quiz, comentários e anotações.
 * Dados e progresso vêm de useMemberCourse; as regras de ordem e progresso, de courseModel.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, ArrowRight, Award, Check, ChevronLeft, ChevronRight, ListVideo, Loader2, LockKeyhole, RotateCcw } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Curriculum } from "@/components/member/Curriculum";
import { LessonPlayer } from "@/components/member/LessonPlayer";
import { LessonMaterials, useLessonAttachments } from "@/components/member/LessonMaterials";
import { LessonComments } from "@/components/member/LessonComments";
import { LessonNotes } from "@/components/member/LessonNotes";
import { LessonQuiz } from "@/components/member/LessonQuiz";
import { formatMinutes, lessonPosition, neighbors, pickStartLessonId, totalMinutes } from "@/components/member/courseModel";
import { useCourseCertificate, useMemberCourse } from "@/components/member/useMemberCourse";

type Tab = "sobre" | "materiais" | "comentarios" | "anotacoes";

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progresso no curso">
      <div className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-dvh place-items-center bg-background px-6 text-foreground">{children}</div>;
}

function CourseSkeleton() {
  return (
    <div className="min-h-dvh bg-background lg:flex" aria-busy="true" aria-label="Carregando o curso">
      <div className="hidden w-[360px] shrink-0 space-y-4 border-r border-white/[0.06] p-6 lg:block">
        <div className="h-4 w-24 animate-pulse rounded bg-white/[0.07] motion-reduce:animate-none" />
        <div className="h-7 w-4/5 animate-pulse rounded bg-white/[0.07] motion-reduce:animate-none" />
        <div className="h-1.5 animate-pulse rounded bg-white/[0.07] motion-reduce:animate-none" />
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-white/[0.05] motion-reduce:animate-none" />)}
      </div>
      <div className="flex-1 space-y-5 p-4 sm:p-6 lg:p-10">
        <div className="aspect-video w-full max-w-[1040px] animate-pulse rounded-[16px] bg-white/[0.06] motion-reduce:animate-none" />
        <div className="h-9 w-2/3 animate-pulse rounded bg-white/[0.07] motion-reduce:animate-none" />
      </div>
    </div>
  );
}

export default function MemberCourse() {
  const { courseId } = useParams();
  const { user } = useOutletContext<{ user: User }>();
  return <CoursePlayer key={courseId} courseId={courseId} user={user} />;
}

function CoursePlayer({ courseId, user }: { courseId: string | undefined; user: User }) {
  const [params, setParams] = useSearchParams();
  const course = useMemberCourse(courseId, user.id);
  const data = course.data;
  const done = data?.done;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("sobre");
  const [listOpen, setListOpen] = useState(false);

  // A aula inicial é escolhida uma vez: depois disso, concluir uma aula não pode trocar a que o aluno está vendo.
  useEffect(() => {
    if (activeId || !data || course.lessons.length === 0) return;
    setActiveId(pickStartLessonId(course.lessons, data.done, params.get("aula") ?? params.get("lesson")));
  }, [activeId, data, course.lessons, params]);

  const lesson = useMemo(() => course.lessons.find((l) => l.id === activeId) ?? null, [course.lessons, activeId]);
  const { prev, next } = useMemo(() => neighbors(course.lessons, activeId), [course.lessons, activeId]);
  const position = lessonPosition(course.lessons, activeId);
  const moduleIndex = data ? data.modules.findIndex((m) => m.id === lesson?.module_id) : -1;
  const lessonDone = !!(lesson && done?.[lesson.id]);
  const attachments = useLessonAttachments(activeId);
  const finished = !!data && course.progress.total > 0 && course.progress.done === course.progress.total;
  const certificate = useCourseCertificate(courseId, user.id, finished && !course.preview);

  const select = useCallback((id: string) => {
    setActiveId(id);
    setTab("sobre");
    setListOpen(false);
    setParams({ aula: id }, { replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [setParams]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|VIDEO)$/.test(t.tagName))) return;
      if (e.key === "ArrowRight" && next) { e.preventDefault(); select(next.id); }
      if (e.key === "ArrowLeft" && prev) { e.preventDefault(); select(prev.id); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, select]);

  if (course.isPending) return <CourseSkeleton />;

  if (course.isError) {
    return (
      <Shell>
        <div role="alert" className="max-w-md text-center">
          <h1 className="text-[22px] font-extrabold tracking-[-0.02em]">Não foi possível abrir o curso</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">Confira sua conexão e tente de novo.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => void course.refetch()} className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-[14.5px] font-bold text-primary-foreground hover:opacity-90">Tentar de novo</button>
            <Link to="/membros-area" className="inline-flex h-11 items-center rounded-full bg-white/10 px-6 text-[14.5px] font-semibold hover:bg-white/15">Meus cursos</Link>
          </div>
        </div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <div className="max-w-md text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/[0.07] text-muted-foreground"><LockKeyhole className="h-6 w-6" /></span>
          <h1 className="mt-5 text-[22px] font-extrabold tracking-[-0.02em]">Você ainda não tem acesso a este curso</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">Se você acabou de comprar, o acesso pode levar alguns minutos. Entre com o mesmo e-mail que usou na compra.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/membros-area" className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-[14.5px] font-bold text-primary-foreground hover:opacity-90">Ver meus cursos</Link>
          </div>
        </div>
      </Shell>
    );
  }

  const title = data.course.title;
  const curriculum = <Curriculum modules={data.modules} done={data.done} activeId={activeId} onSelect={select} />;
  const duration = formatMinutes(lesson?.duration_minutes);
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "sobre", label: "Sobre a aula" },
    { id: "materiais", label: "Materiais", count: attachments.data?.length },
    { id: "comentarios", label: "Comentários" },
    { id: "anotacoes", label: "Anotações" },
  ];

  const progressLabel = `${course.progress.done} de ${course.progress.total} ${course.progress.total === 1 ? "aula" : "aulas"}`;
  const totalMin = formatMinutes(totalMinutes(course.lessons));

  return (
    <div className="min-h-dvh bg-background text-foreground lg:flex">
      <Seo title={`${title} — Área de membros`} description="Aulas do seu curso." path={`/membros-area/curso/${data.course.id}`} noindex />

      {/* Grade de aulas (desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-[360px] shrink-0 flex-col border-r border-white/[0.06] bg-card lg:flex">
        <div className="border-b border-white/[0.06] px-5 pb-5 pt-6">
          <Link to="/membros-area" className="inline-flex items-center gap-1.5 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ChevronLeft className="h-4 w-4" aria-hidden /> Meus cursos
          </Link>
          <h2 className="mt-4 text-[20px] font-extrabold leading-tight tracking-[-0.02em]">{title}</h2>
          <div className="mt-4"><ProgressBar pct={course.progress.pct} /></div>
          <p className="mt-2 text-[13.5px] text-muted-foreground">{progressLabel} concluídas ({course.progress.pct}%){totalMin ? `, ${totalMin} de conteúdo` : ""}</p>
        </div>
        <nav aria-label="Aulas do curso" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{curriculum}</nav>
      </aside>

      <main className="min-w-0 flex-1">
        {/* Barra do celular */}
        <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-white/[0.06] bg-background/95 px-2 backdrop-blur lg:hidden">
          <Link to="/membros-area" aria-label="Voltar para meus cursos" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"><ChevronLeft className="h-5 w-5" /></Link>
          <p className="min-w-0 flex-1 truncate text-[15px] font-bold">{title}</p>
          <button type="button" onClick={() => setListOpen(true)} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-white/10 px-4 text-[14px] font-semibold hover:bg-white/15">
            <ListVideo className="h-4 w-4" aria-hidden /> Aulas
          </button>
        </div>

        <div className="mx-auto w-full max-w-[1040px] px-4 pb-24 pt-4 sm:px-6 lg:px-10 lg:pt-8">
          {course.preview && (
            <p role="note" className="mb-4 rounded-[14px] bg-primary/10 px-4 py-3 text-[14px] text-foreground">
              <strong className="font-bold">Prévia do produtor.</strong> Você está vendo o curso como o aluno vê. O progresso não é salvo.
            </p>
          )}

          {!lesson ? (
            <div className="rounded-[16px] bg-white/[0.04] px-6 py-16 text-center">
              <h1 className="text-[20px] font-extrabold tracking-[-0.02em]">Este curso ainda não tem aulas</h1>
              <p className="mt-2 text-[15px] text-muted-foreground">Assim que o produtor publicar as aulas, elas aparecem aqui.</p>
            </div>
          ) : (
            <>
              <div className="aspect-video w-full overflow-hidden rounded-[16px] bg-black ring-1 ring-white/[0.06]">
                <LessonPlayer key={lesson.id} url={lesson.video_url} title={lesson.title} />
              </div>

              <div className="mt-6">
                <p className="text-[13.5px] font-medium text-muted-foreground">
                  Aula {position.index} de {position.total}{moduleIndex >= 0 && data.modules[moduleIndex] ? `, ${data.modules[moduleIndex].title}` : ""}{duration ? `, ${duration}` : ""}
                </p>
                <h1 className="mt-1.5 text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em] sm:text-[32px]">{lesson.title}</h1>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {lessonDone ? (
                    <>
                      <button
                        type="button"
                        onClick={() => course.toggle(lesson.id, false)}
                        disabled={course.pendingId === lesson.id}
                        aria-label="Aula concluída. Toque para desmarcar."
                        className="group inline-flex h-12 items-center gap-2 rounded-full bg-primary/15 px-5 text-[15px] font-bold text-primary transition-colors hover:bg-white/10 hover:text-foreground disabled:opacity-60"
                      >
                        <Check className="h-[18px] w-[18px] group-hover:hidden" strokeWidth={3} aria-hidden />
                        <RotateCcw className="hidden h-[16px] w-[16px] group-hover:block" aria-hidden />
                        <span className="group-hover:hidden">Aula concluída</span>
                        <span className="hidden group-hover:inline">Desmarcar</span>
                      </button>
                      {next && (
                        <button type="button" onClick={() => select(next.id)} className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-[15px] font-bold text-primary-foreground transition-opacity hover:opacity-90">
                          Próxima aula <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => course.toggle(lesson.id, true)}
                      disabled={course.pendingId === lesson.id}
                      className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-[15px] font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {course.pendingId === lesson.id ? <Loader2 className="h-[18px] w-[18px] animate-spin motion-reduce:animate-none" aria-hidden /> : <Check className="h-[18px] w-[18px]" strokeWidth={3} aria-hidden />}
                      Concluir aula
                    </button>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <button type="button" onClick={() => prev && select(prev.id)} disabled={!prev} aria-label="Aula anterior" title="Aula anterior (seta esquerda)" className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.07] text-foreground transition-colors hover:bg-white/[0.12] disabled:opacity-35 disabled:hover:bg-white/[0.07]"><ArrowLeft className="h-[18px] w-[18px]" /></button>
                    <button type="button" onClick={() => next && select(next.id)} disabled={!next} aria-label="Próxima aula" title="Próxima aula (seta direita)" className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.07] text-foreground transition-colors hover:bg-white/[0.12] disabled:opacity-35 disabled:hover:bg-white/[0.07]"><ArrowRight className="h-[18px] w-[18px]" /></button>
                  </div>
                </div>

                {finished && !course.preview && (
                  <section aria-label="Curso concluído" className="mt-6 flex flex-wrap items-center gap-4 rounded-[16px] bg-primary/10 p-5">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Award className="h-6 w-6" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[17px] font-extrabold tracking-[-0.02em]">Você concluiu o curso</p>
                      <p className="mt-0.5 text-[14.5px] text-muted-foreground">
                        {certificate.data ? "Seu certificado está pronto." : certificate.isError ? "O certificado fica disponível em Meus cursos." : "Estamos emitindo o seu certificado…"}
                      </p>
                    </div>
                    {certificate.data && (
                      <Link to={`/certificado/${certificate.data}`} className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-[14.5px] font-bold text-primary-foreground hover:opacity-90">Ver certificado</Link>
                    )}
                  </section>
                )}
              </div>

              <div role="tablist" aria-label="Conteúdo da aula" className="!border-0 mt-8 flex overflow-x-auto [scrollbar-width:none]">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    id={`tab-${t.id}`}
                    role="tab"
                    type="button"
                    aria-selected={tab === t.id}
                    aria-controls={`panel-${t.id}`}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "relative mr-7 shrink-0 whitespace-nowrap rounded-t-lg py-3.5 text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t.label}{t.count ? <span className="ml-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[12px] font-bold tabular-nums">{t.count}</span> : null}
                    {tab === t.id && <span aria-hidden className="absolute inset-x-0 bottom-0 z-10 h-[3px] rounded-full bg-primary" />}
                  </button>
                ))}
              </div>
              <div className="-mt-px h-px bg-white/[0.08]" aria-hidden />

              <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-6">
                {tab === "sobre" && (
                  <div className="max-w-[760px]">
                    {lesson.description?.trim() ? (
                      <p className="whitespace-pre-line text-[16.5px] leading-[1.7] text-foreground/85">{lesson.description}</p>
                    ) : (
                      <p className="text-[15px] text-muted-foreground">O produtor não escreveu uma descrição para esta aula.</p>
                    )}
                    <LessonQuiz lessonId={lesson.id} userId={user.id} />
                  </div>
                )}
                {tab === "materiais" && (
                  <LessonMaterials attachments={attachments.data ?? []} loading={attachments.isPending} failed={attachments.isError} onRetry={() => void attachments.refetch()} />
                )}
                {tab === "comentarios" && <LessonComments lessonId={lesson.id} currentUserId={user.id} ownerId={data.course.user_id} />}
                {tab === "anotacoes" && <LessonNotes lessonId={lesson.id} userId={user.id} />}
              </div>

              <div className="mt-10 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-6">
                {prev ? (
                  <button type="button" onClick={() => select(prev.id)} className="inline-flex min-w-0 items-center gap-2 text-left text-[14.5px] font-semibold text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">{prev.title}</span></button>
                ) : <span />}
                {next ? (
                  <button type="button" onClick={() => select(next.id)} className="inline-flex min-w-0 items-center gap-2 text-right text-[14.5px] font-semibold text-muted-foreground hover:text-foreground"><span className="truncate">{next.title}</span><ChevronRight className="h-4 w-4 shrink-0" aria-hidden /></button>
                ) : <span />}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Grade de aulas (celular) */}
      <Sheet open={listOpen} onOpenChange={setListOpen}>
        <SheetContent side="bottom" className="flex max-h-[86dvh] flex-col gap-0 rounded-t-[22px] border-white/[0.08] bg-card p-0 lg:hidden">
          <SheetHeader className="border-b border-white/[0.06] px-5 pb-4 pt-5 text-left">
            <SheetTitle className="text-[18px] font-extrabold tracking-[-0.02em]">Aulas</SheetTitle>
            <SheetDescription className="sr-only">Escolha a aula que quer assistir.</SheetDescription>
            <div className="pt-2"><ProgressBar pct={course.progress.pct} /></div>
            <p className="pt-1 text-[13.5px] text-muted-foreground">{progressLabel} concluídas ({course.progress.pct}%)</p>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6">{curriculum}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
