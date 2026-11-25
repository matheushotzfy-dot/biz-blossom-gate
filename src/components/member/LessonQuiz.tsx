/**
 * Quiz da aula (aba "Sobre"). Não aparece se a aula não tem quiz.
 * O aluno responde, o servidor corrige (`grade_quiz_attempt`) e só então devolve o gabarito.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Quiz = { id: string; title: string; description: string | null; passing_score: number; max_attempts: number };
type Question = { id: string; question: string; options: string[]; explanation: string | null; sort_order: number };
type Attempt = { id: string; score: number; passed: boolean; created_at: string };
type GradeResult = { score: number; passed: boolean; results: { question_id: string; correct_index: number; is_correct: boolean }[] };
type QuizData = { quiz: Quiz; questions: Question[]; attempts: Attempt[] } | null;

const toOptions = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") { try { const v = JSON.parse(raw); return Array.isArray(v) ? v.map(String) : []; } catch { return []; } }
  return [];
};

async function fetchQuiz(lessonId: string, userId: string): Promise<QuizData> {
  const { data: quiz, error } = await supabase.from("quizzes").select("id, title, description, passing_score, max_attempts").eq("lesson_id", lessonId).maybeSingle();
  if (error) throw error;
  if (!quiz) return null;
  const [qs, at] = await Promise.all([
    supabase.rpc("get_quiz_questions_for_student", { _quiz_id: quiz.id }),
    supabase.from("quiz_attempts").select("id, score, passed, created_at").eq("quiz_id", quiz.id).eq("user_id", userId).order("created_at", { ascending: false }),
  ]);
  if (qs.error) throw qs.error;
  if (at.error) throw at.error;
  const questions = ((qs.data ?? []) as unknown as Array<Record<string, unknown>>)
    .map((r) => ({ id: String(r.id), question: String(r.question ?? ""), options: toOptions(r.options), explanation: (r.explanation as string | null) ?? null, sort_order: Number(r.sort_order ?? 0) }))
    .sort((a, b) => a.sort_order - b.sort_order);
  return { quiz: quiz as Quiz, questions, attempts: (at.data ?? []) as Attempt[] };
}

const submitError = (msg: string) =>
  /attempt|tentativa|limit/i.test(msg) ? "Você já usou todas as tentativas deste quiz."
  : /access|permission|denied/i.test(msg) ? "Você não tem acesso a este quiz."
  : "Não foi possível enviar suas respostas. Tente de novo.";

export function LessonQuiz({ lessonId, userId }: { lessonId: string; userId: string }) {
  const qc = useQueryClient();
  const key = ["lesson-quiz", lessonId, userId];
  const q = useQuery({ queryKey: key, queryFn: () => fetchQuiz(lessonId, userId), staleTime: 30_000, retry: 1 });
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; passed: boolean; correct: Record<string, number> } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (q.isPending || (q.isSuccess && !q.data)) return null;
  if (q.isError) {
    return (
      <p className="mt-8 rounded-[16px] bg-white/[0.05] px-5 py-4 text-[14.5px] text-muted-foreground">
        Não foi possível carregar o quiz desta aula.{" "}
        <button type="button" onClick={() => void q.refetch()} className="font-semibold text-primary underline-offset-4 hover:underline">Tentar de novo</button>
      </p>
    );
  }

  const { quiz, questions, attempts } = q.data!;
  if (questions.length === 0) return null;
  const best = attempts.length ? Math.max(...attempts.map((a) => a.score)) : null;
  const usedAll = quiz.max_attempts > 0 && attempts.length >= quiz.max_attempts;
  const answered = Object.keys(answers).length;
  const finished = result !== null;

  const submit = async () => {
    if (answered !== questions.length || submitting) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("grade_quiz_attempt", { _quiz_id: quiz.id, _answers: answers });
    setSubmitting(false);
    if (error || !data) { toast.error(submitError(error?.message ?? "")); return; }
    const r = data as unknown as GradeResult;
    setResult({ score: r.score, passed: r.passed, correct: Object.fromEntries(r.results.map((x) => [x.question_id, x.correct_index])) });
    await qc.invalidateQueries({ queryKey: key });
  };

  const retry = () => { setAnswers({}); setResult(null); };

  return (
    <section aria-labelledby="quiz-title" className="mt-10 rounded-[22px] bg-white/[0.05] p-5 sm:p-7">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"><Brain className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0">
          <h3 id="quiz-title" className="text-[19px] font-extrabold tracking-[-0.02em]">{quiz.title}</h3>
          {quiz.description && <p className="mt-1 text-[15px] text-muted-foreground">{quiz.description}</p>}
          <p className="mt-2 text-[13.5px] text-muted-foreground">
            Nota mínima {quiz.passing_score}%
            {quiz.max_attempts > 0 && <> · {attempts.length} de {quiz.max_attempts} tentativas</>}
            {best !== null && <> · Melhor nota {best}%</>}
          </p>
        </div>
      </div>

      {finished && (
        <div role="status" className={cn("mt-6 rounded-[16px] px-5 py-4 sm:flex sm:items-center sm:gap-4", result.passed ? "bg-primary/15" : "bg-destructive/15")}>
          <div className="flex min-w-0 flex-1 items-center gap-4">
            {result.passed ? <CheckCircle2 className="h-6 w-6 shrink-0 text-primary" aria-hidden /> : <XCircle className="h-6 w-6 shrink-0 text-destructive" aria-hidden />}
            <div className="min-w-0">
              <p className="text-[16px] font-bold">{result.passed ? "Você passou!" : "Ainda não foi dessa vez"}</p>
              <p className="text-[14px] text-muted-foreground">Sua nota: {result.score}% (mínimo {quiz.passing_score}%)</p>
            </div>
          </div>
          {!result.passed && !usedAll && (
            <button type="button" onClick={retry} className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-[14px] font-bold hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:mt-0">
              <RotateCcw className="h-4 w-4" aria-hidden /> Tentar de novo
            </button>
          )}
        </div>
      )}

      <ol className="mt-6 space-y-6">
        {questions.map((qu, qi) => {
          const chosen = answers[qu.id];
          return (
            <li key={qu.id}>
              <fieldset disabled={finished || submitting || usedAll} className="min-w-0">
                <legend className="mb-3 text-[16px] font-bold leading-snug"><span className="text-muted-foreground">{qi + 1}.</span> {qu.question}</legend>
                <div className="space-y-2">
                  {qu.options.map((opt, oi) => {
                    const isChosen = chosen === oi;
                    const right = finished && oi === result.correct[qu.id];
                    const wrong = finished && isChosen && oi !== result.correct[qu.id];
                    return (
                      <label
                        key={oi}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-[14px] px-4 py-3 text-[15px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary",
                          !finished && (isChosen ? "bg-primary/15 ring-1 ring-primary" : "bg-white/[0.05] hover:bg-white/[0.09]"),
                          right && "bg-primary/15 ring-1 ring-primary",
                          wrong && "bg-destructive/15 ring-1 ring-destructive",
                          finished && !right && !wrong && "bg-white/[0.04] text-muted-foreground",
                          (finished || usedAll) && "cursor-default",
                        )}
                      >
                        <input type="radio" name={`q-${qu.id}`} checked={isChosen} onChange={() => setAnswers((a) => ({ ...a, [qu.id]: oi }))} className="sr-only" />
                        <span aria-hidden className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold", isChosen || right ? "bg-primary text-primary-foreground" : "bg-white/10 text-muted-foreground", wrong && "bg-destructive text-destructive-foreground")}>
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <span className="min-w-0 flex-1">{opt}</span>
                        {right && <><CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-primary" aria-hidden /><span className="sr-only">Resposta correta</span></>}
                        {wrong && <><XCircle className="h-[18px] w-[18px] shrink-0 text-destructive" aria-hidden /><span className="sr-only">Sua resposta, incorreta</span></>}
                      </label>
                    );
                  })}
                </div>
                {finished && qu.explanation && <p className="mt-2.5 px-1 text-[14px] leading-relaxed text-muted-foreground">{qu.explanation}</p>}
              </fieldset>
            </li>
          );
        })}
      </ol>

      {!finished && (
        <div className="mt-7 flex flex-wrap items-center gap-4">
          <button
            type="button" onClick={() => void submit()} disabled={answered !== questions.length || submitting || usedAll}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 text-[15px] font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-[18px] w-[18px] animate-spin motion-reduce:animate-none" aria-hidden />}
            {usedAll ? "Tentativas esgotadas" : submitting ? "Enviando" : "Enviar respostas"}
          </button>
          {!usedAll && answered !== questions.length && <p className="text-[14px] text-muted-foreground">Responda todas as perguntas ({answered} de {questions.length}).</p>}
        </div>
      )}
    </section>
  );
}
