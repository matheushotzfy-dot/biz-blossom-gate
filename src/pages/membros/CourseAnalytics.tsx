/**
 * Estatísticas da área de membros (vendedor): engajamento dos alunos de um curso.
 * Fica fora do DashboardLayout, por isso aplica a identidade do vendedor por conta própria.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Loader2, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSellerSkin } from "@/hooks/useSellerSkin";
import { StatBand } from "@/components/seller-ui/StatBand";
import { Notice, StepEmpty, StudioPanel } from "@/components/seller-ui/studio";

type Analytics = {
  total_lessons: number;
  total_students: number;
  active_7d: number;
  completions: number;
  total_comments: number;
  avg_quiz_score: number;
};

type StudentRow = { user_id: string; lessons_completed: number; last_activity: string };
type ScreenState = "loading" | "ready" | "denied" | "error";

const nf = new Intl.NumberFormat("pt-BR");
const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

export default function CourseAnalytics() {
  useSellerSkin();
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [state, setState] = useState<ScreenState>("loading");
  const [course, setCourse] = useState<{ title: string } | null>(null);
  const [data, setData] = useState<Analytics | null>(null);
  const [enrolled, setEnrolled] = useState<number | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentsFailed, setStudentsFailed] = useState(false);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!courseId) return;
    const request = ++requestRef.current;
    setState("loading");
    setStudentsFailed(false);

    const [courseRes, analyticsRes, accessRes] = await Promise.all([
      supabase.from("courses").select("title").eq("id", courseId).maybeSingle(),
      supabase.rpc("get_course_analytics", { _course_id: courseId }),
      supabase.from("user_access").select("id", { count: "exact", head: true }).eq("course_id", courseId).eq("status", "active"),
    ]);
    if (request !== requestRef.current) return;

    if (analyticsRes.error) {
      setState(/access denied/i.test(analyticsRes.error.message ?? "") ? "denied" : "error");
      return;
    }
    setCourse((courseRes.data as { title: string } | null) ?? null);
    setData(analyticsRes.data as unknown as Analytics);
    setEnrolled(accessRes.error ? null : accessRes.count ?? 0);

    // Alunos mais avançados: aulas concluídas por aluno, limitado às 5000 primeiras linhas como antes.
    const { data: lessonRows, error: lessonsError } = await supabase
      .from("lessons")
      .select("id, modules!inner(course_id)")
      .eq("modules.course_id", courseId)
      .limit(5000);
    if (request !== requestRef.current) return;
    const ids = (lessonRows ?? []).map((l) => l.id);
    if (lessonsError) { setStudentsFailed(true); setStudents([]); setState("ready"); return; }

    if (ids.length === 0) { setStudents([]); setState("ready"); return; }
    const { data: progress, error: progressError } = await supabase
      .from("user_progress")
      .select("user_id, completed, updated_at")
      .in("lesson_id", ids)
      .eq("completed", true)
      .limit(5000);
    if (request !== requestRef.current) return;
    if (progressError) { setStudentsFailed(true); setStudents([]); setState("ready"); return; }

    const byStudent = new Map<string, StudentRow>();
    (progress ?? []).forEach((p) => {
      const row = byStudent.get(p.user_id) ?? { user_id: p.user_id, lessons_completed: 0, last_activity: p.updated_at };
      row.lessons_completed += 1;
      if (p.updated_at > row.last_activity) row.last_activity = p.updated_at;
      byStudent.set(p.user_id, row);
    });
    setStudents(Array.from(byStudent.values()).sort((a, b) => b.lessons_completed - a.lessons_completed).slice(0, 10));
    setState("ready");
  }, [courseId]);

  useEffect(() => { void load(); }, [load]);

  const backToBuilder = () => navigate(`/vendas/conteudo/${courseId}/builder`);
  const backToList = () => navigate("/vendas/conteudo");

  if (state === "loading") {
    return (
      <div className="vp-seller-shell vp-stage min-h-[100dvh]" aria-busy="true">
        <div className="flex h-[72px] items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
          <span className="vp-skel h-11 w-11 rounded-full" />
          <span className="vp-skel h-6 w-56 rounded-full" />
        </div>
        <div className="mx-auto max-w-[1180px] space-y-6 px-4 py-8 sm:px-6">
          <span className="vp-skel block h-28 w-full rounded-[22px]" />
          <span className="vp-skel block h-28 w-full rounded-[22px]" />
          <span className="vp-skel block h-64 w-full rounded-[22px]" />
        </div>
        <span className="sr-only" role="status"><Loader2 className="h-4 w-4 animate-spin" />Carregando estatísticas</span>
      </div>
    );
  }

  if (state === "denied" || state === "error" || !data) {
    const denied = state === "denied";
    return (
      <div className="vp-seller-shell vp-stage grid min-h-[100dvh] place-items-center px-4">
        <div className="w-full max-w-[460px]">
          <StepEmpty
            icon={<AlertCircle className="h-7 w-7" />}
            title={denied ? "Você não tem acesso a esta área" : "Não foi possível carregar as estatísticas"}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {!denied && <button type="button" onClick={() => void load()} className="vp-cta h-11 px-6">Tentar de novo</button>}
                <button type="button" onClick={backToList} className="vp-ghost h-11 px-6"><ArrowLeft className="h-4 w-4" />Voltar para a lista</button>
              </div>
            }
          >
            {denied ? "Só quem criou a área pode ver estes números." : "Confira a conexão e tente de novo."}
          </StepEmpty>
        </div>
      </div>
    );
  }

  const started = data.total_students;
  const hasActivity = started > 0;

  return (
    <div className="vp-seller-shell vp-stage min-h-[100dvh]">
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex h-[72px] max-w-[1180px] items-center gap-3 px-4 sm:px-6">
          <button type="button" onClick={backToBuilder} aria-label="Voltar para o construtor" className="vp-orb shrink-0"><ArrowLeft className="h-[18px] w-[18px]" /></button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading text-[19px] font-extrabold leading-tight tracking-[-0.03em] text-foreground">{course?.title ?? "Área de membros"}</h1>
            <p className="truncate text-[13px] text-muted-foreground">Estatísticas dos alunos</p>
          </div>
          <div className="hidden shrink-0 sm:block"><button type="button" onClick={backToBuilder} className="vp-ghost">Abrir construtor</button></div>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] space-y-6 px-4 py-8 !pb-16 sm:px-6">
        {!hasActivity && (
          <Notice tone="info" title="Ainda não há atividade">
            Os números abaixo aparecem quando os alunos começarem a assistir às aulas.
          </Notice>
        )}

        <StatBand
          label="Alunos"
          cells={[
            { label: "Alunos com acesso", value: enrolled === null ? "—" : nf.format(enrolled), sub: "Acesso ativo agora", featured: true },
            { label: "Já começaram", value: nf.format(started), sub: enrolled ? `${percent(started, enrolled)}% de quem tem acesso` : "Assistiram ao menos uma aula", meter: enrolled ? percent(started, enrolled) : undefined },
            { label: "Ativos nos últimos 7 dias", value: nf.format(data.active_7d), sub: hasActivity ? `${percent(data.active_7d, started)}% de quem começou` : "Sem atividade ainda", meter: hasActivity ? percent(data.active_7d, started) : undefined },
            { label: "Certificados emitidos", value: nf.format(data.completions), sub: hasActivity ? `${percent(data.completions, started)}% de quem começou` : "Sem certificados ainda", meter: hasActivity ? percent(data.completions, started) : undefined },
          ]}
        />

        <StatBand
          label="Conteúdo"
          cells={[
            { label: "Aulas na área", value: nf.format(data.total_lessons) },
            { label: "Comentários nas aulas", value: nf.format(data.total_comments), sub: data.total_comments === 0 ? "Nenhum comentário ainda" : undefined },
            { label: "Média nos quizzes", value: data.avg_quiz_score > 0 ? `${nf.format(data.avg_quiz_score)}%` : "—", sub: data.avg_quiz_score > 0 ? undefined : "Nenhuma tentativa ainda" },
          ]}
        />

        <StudioPanel title="Alunos mais avançados" subtitle="Os 10 que concluíram mais aulas. Os alunos aparecem sem identificação.">
          {studentsFailed ? (
            <Notice tone="warn" title="Não foi possível carregar o progresso dos alunos">
              Os números acima continuam valendo. Atualize a página para tentar de novo.
            </Notice>
          ) : students.length === 0 ? (
            <div className="vp-r16 flex items-center gap-3.5 border border-dashed border-border px-4 py-6">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><Users className="h-[18px] w-[18px]" /></span>
              <p className="text-[14px] leading-snug text-muted-foreground">Nenhuma aula concluída ainda. A lista aparece quando o primeiro aluno terminar uma aula.</p>
            </div>
          ) : (
            <ol className="divide-y divide-border">
              {students.map((s, i) => {
                const pct = percent(s.lessons_completed, data.total_lessons);
                return (
                  <li key={s.user_id} className="flex items-center gap-3.5 py-3.5 first:pt-0 last:pb-0">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-bold tabular-nums text-accent-foreground">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-[14.5px] font-semibold text-foreground">Aluno {i + 1}</p>
                        <p className="shrink-0 text-[13.5px] font-semibold tabular-nums text-foreground">
                          {s.lessons_completed} {s.lessons_completed === 1 ? "aula" : "aulas"}
                          <span className="font-normal text-muted-foreground"> de {data.total_lessons}</span>
                        </p>
                      </div>
                      <div role="progressbar" aria-label={`Aluno ${i + 1} concluiu ${pct}% das aulas`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(pct, 100)} className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <p className="mt-1.5 text-[12.5px] text-muted-foreground">Última atividade em {formatDate(s.last_activity)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </StudioPanel>
      </main>
    </div>
  );
}
