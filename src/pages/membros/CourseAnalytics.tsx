/**
 * CourseAnalytics — Producer dashboard with engagement metrics for a course.
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Users, Activity, Award, MessageSquare, Brain, BookOpen, TrendingUp } from "lucide-react";
import { toast } from "sonner";

type Analytics = {
  total_lessons: number;
  total_students: number;
  active_7d: number;
  completions: number;
  total_comments: number;
  avg_quiz_score: number;
};

type StudentRow = { user_id: string; lessons_completed: number; last_activity: string };

export default function CourseAnalytics() {
  const { courseId } = useParams();
  const [course, setCourse] = useState<{ title: string } | null>(null);
  const [data, setData] = useState<Analytics | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (courseId) load(); /* eslint-disable-next-line */ }, [courseId]);

  async function load() {
    setLoading(true);
    const { data: c } = await supabase.from("courses").select("title").eq("id", courseId!).maybeSingle();
    setCourse(c);

    const { data: analytics, error } = await supabase.rpc("get_course_analytics", { _course_id: courseId! });
    if (error) { toast.error("Acesso negado ou erro"); setLoading(false); return; }
    setData(analytics as unknown as Analytics);

    // Top students
    const { data: lessonIds } = await supabase
      .from("lessons")
      .select("id, modules!inner(course_id)")
      .eq("modules.course_id", courseId!);
    const ids = (lessonIds || []).map((l) => l.id);
    if (ids.length > 0) {
      const { data: prog } = await supabase
        .from("user_progress")
        .select("user_id, completed, updated_at")
        .in("lesson_id", ids)
        .eq("completed", true);
      const map = new Map<string, StudentRow>();
      (prog || []).forEach((p: any) => {
        const r = map.get(p.user_id) || { user_id: p.user_id, lessons_completed: 0, last_activity: p.updated_at };
        r.lessons_completed += 1;
        if (p.updated_at > r.last_activity) r.last_activity = p.updated_at;
        map.set(p.user_id, r);
      });
      setStudents(Array.from(map.values()).sort((a, b) => b.lessons_completed - a.lessons_completed).slice(0, 10));
    }
    setLoading(false);
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground font-display">Carregando…</div>;
  if (!data) return <div className="p-8 text-center text-muted-foreground font-display">Sem acesso a este curso.</div>;

  const completionRate = data.total_students > 0 ? Math.round((data.completions / data.total_students) * 100) : 0;
  const engagementRate = data.total_students > 0 ? Math.round((data.active_7d / data.total_students) * 100) : 0;

  const cards = [
    { label: "Alunos totais", value: data.total_students, icon: Users, color: "text-info" },
    { label: "Ativos (7 dias)", value: data.active_7d, icon: Activity, color: "text-success", sub: `${engagementRate}% engajamento` },
    { label: "Aulas no curso", value: data.total_lessons, icon: BookOpen, color: "text-primary" },
    { label: "Certificados emitidos", value: data.completions, icon: Award, color: "text-warning", sub: `${completionRate}% conclusão` },
    { label: "Comentários", value: data.total_comments, icon: MessageSquare, color: "text-muted-foreground" },
    { label: "Média em quizzes", value: `${data.avg_quiz_score}%`, icon: Brain, color: "text-primary" },
  ];

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-6xl mx-auto p-4 lg:p-8">
        <Link to="/membros-area" className="inline-flex items-center gap-2 text-xs font-display font-bold text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Link>

        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-xs font-display font-bold text-muted-foreground/60 uppercase tracking-wider mb-1">Analytics do curso</p>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">{course?.title || "Curso"}</h1>
          </div>
          <TrendingUp className="h-8 w-8 text-primary/60" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
          {cards.map(c => (
            <div key={c.label} className="rounded-xl border border-border/15 bg-card/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-display font-bold text-muted-foreground uppercase tracking-wider">{c.label}</span>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <p className="text-2xl font-display font-bold text-foreground tabular-nums">{c.value}</p>
              {c.sub && <p className="text-[11px] text-muted-foreground/70 font-display mt-0.5">{c.sub}</p>}
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border/15 bg-card/30 p-5">
          <h2 className="font-display font-bold text-foreground text-sm tracking-tight mb-3">Top 10 alunos</h2>
          {students.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 font-display italic py-3 text-center">Sem dados de progresso ainda.</p>
          ) : (
            <ul className="divide-y divide-border/10">
              {students.map((s, i) => (
                <li key={s.user_id} className="py-2.5 flex items-center gap-3">
                  <span className="h-7 w-7 rounded-md bg-primary/10 text-primary text-xs font-display font-bold flex items-center justify-center shrink-0">#{i + 1}</span>
                  <span className="flex-1 font-mono text-xs text-muted-foreground truncate">{s.user_id.slice(0, 8)}…</span>
                  <span className="font-display font-bold text-xs text-foreground tabular-nums">{s.lessons_completed} aulas</span>
                  <span className="text-[10px] text-muted-foreground/60 font-mono">{new Date(s.last_activity).toLocaleDateString("pt-BR")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
