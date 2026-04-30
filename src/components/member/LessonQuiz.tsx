/**
 * LessonQuiz — Interactive quiz for a lesson
 * Students answer; producers see read-only when no quiz exists.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Award, RotateCcw, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

type Quiz = { id: string; title: string; description: string | null; passing_score: number; max_attempts: number };
type Question = { id: string; question: string; options: string[]; correct_index: number; explanation: string | null; sort_order: number };
type Attempt = { id: string; score: number; passed: boolean; created_at: string };

interface Props {
  lessonId: string;
  userId: string;
}

export function LessonQuiz({ lessonId, userId }: Props) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState<{ score: number; passed: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [lessonId]);

  async function load() {
    setLoading(true);
    setSubmitted(null);
    setAnswers({});
    const { data: q } = await supabase.from("quizzes").select("*").eq("lesson_id", lessonId).maybeSingle();
    if (!q) { setQuiz(null); setLoading(false); return; }
    setQuiz(q as Quiz);
    const [{ data: qs }, { data: at }] = await Promise.all([
      supabase.from("quiz_questions").select("*").eq("quiz_id", q.id).order("sort_order"),
      supabase.from("quiz_attempts").select("id, score, passed, created_at").eq("quiz_id", q.id).eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    setQuestions((qs || []) as Question[]);
    setAttempts((at || []) as Attempt[]);
    setLoading(false);
  }

  async function submit() {
    if (!quiz) return;
    if (Object.keys(answers).length !== questions.length) {
      toast.error("Responda todas as perguntas");
      return;
    }
    setSubmitting(true);
    const correct = questions.filter(q => answers[q.id] === q.correct_index).length;
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= quiz.passing_score;
    const { error } = await supabase.from("quiz_attempts").insert({
      quiz_id: quiz.id, user_id: userId, answers, score, passed,
    });
    setSubmitting(false);
    if (error) { toast.error("Erro ao enviar"); return; }
    setSubmitted({ score, passed });
    if (passed) toast.success(`Aprovado com ${score}%!`);
    else toast.error(`Você obteve ${score}%. Mínimo: ${quiz.passing_score}%`);
    load();
  }

  if (loading) return null;
  if (!quiz) return null;

  const bestAttempt = attempts.length ? Math.max(...attempts.map(a => a.score)) : 0;
  const reachedLimit = quiz.max_attempts > 0 && attempts.length >= quiz.max_attempts;
  const showResults = submitted !== null;

  return (
    <div className="mt-6 rounded-xl border border-border/15 bg-card/30 p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-black text-foreground text-base tracking-tight">{quiz.title}</h3>
          {quiz.description && <p className="text-xs text-muted-foreground/70 mt-0.5">{quiz.description}</p>}
          <div className="flex items-center gap-3 mt-2 text-[11px] font-display font-bold">
            <span className="text-muted-foreground/60">Aprovação: <span className="text-foreground">{quiz.passing_score}%</span></span>
            {attempts.length > 0 && <span className="text-muted-foreground/60">Tentativas: <span className="text-foreground">{attempts.length}{quiz.max_attempts > 0 && `/${quiz.max_attempts}`}</span></span>}
            {bestAttempt > 0 && <span className="text-muted-foreground/60">Melhor: <span className="text-success">{bestAttempt}%</span></span>}
          </div>
        </div>
      </div>

      {showResults && submitted && (
        <div className={cn("mb-4 p-4 rounded-lg border flex items-center gap-3", submitted.passed ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30")}>
          {submitted.passed ? <Award className="h-6 w-6 text-success" /> : <XCircle className="h-6 w-6 text-destructive" />}
          <div className="flex-1">
            <p className="font-display font-black text-sm text-foreground">{submitted.passed ? "Aprovado!" : "Não foi dessa vez"}</p>
            <p className="text-xs text-muted-foreground/80">Score: {submitted.score}% · Mínimo: {quiz.passing_score}%</p>
          </div>
          {!submitted.passed && !reachedLimit && (
            <button onClick={() => { setSubmitted(null); setAnswers({}); }} className="text-xs font-display font-bold flex items-center gap-1.5 text-primary hover:text-primary/80">
              <RotateCcw className="h-3.5 w-3.5" /> Tentar de novo
            </button>
          )}
        </div>
      )}

      <div className="space-y-4">
        {questions.map((q, qi) => {
          const userAns = answers[q.id];
          return (
            <div key={q.id} className="rounded-lg border border-border/10 p-4">
              <p className="font-display font-bold text-sm text-foreground mb-3">{qi + 1}. {q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const selected = userAns === oi;
                  const isCorrect = showResults && oi === q.correct_index;
                  const isWrong = showResults && selected && oi !== q.correct_index;
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={showResults || submitting}
                      onClick={() => setAnswers(a => ({ ...a, [q.id]: oi }))}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-md border text-sm font-display transition-colors flex items-center gap-2.5",
                        !showResults && selected && "border-primary bg-primary/10 text-foreground font-bold",
                        !showResults && !selected && "border-border/15 hover:border-border/40 text-muted-foreground",
                        isCorrect && "border-success bg-success/10 text-success font-bold",
                        isWrong && "border-destructive bg-destructive/10 text-destructive font-bold",
                      )}
                    >
                      <span className="h-5 w-5 rounded border border-current/40 flex items-center justify-center text-[10px] shrink-0">{String.fromCharCode(65 + oi)}</span>
                      <span className="flex-1">{opt}</span>
                      {isCorrect && <CheckCircle2 className="h-4 w-4" />}
                      {isWrong && <XCircle className="h-4 w-4" />}
                    </button>
                  );
                })}
              </div>
              {showResults && q.explanation && (
                <p className="mt-2 text-xs text-muted-foreground/80 italic px-1">💡 {q.explanation}</p>
              )}
            </div>
          );
        })}
      </div>

      {!showResults && (
        <button
          onClick={submit}
          disabled={submitting || reachedLimit || questions.length === 0}
          className="mt-4 w-full py-3 rounded-lg bg-primary text-primary-foreground font-display font-black text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {reachedLimit ? "Limite de tentativas atingido" : submitting ? "Enviando..." : "Enviar respostas"}
        </button>
      )}
    </div>
  );
}
