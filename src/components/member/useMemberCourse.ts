import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { orderedLessons, progressOf, sortCourse, type LessonLite, type ModuleLite } from "@/components/member/courseModel";

export type MemberLesson = LessonLite & {
  description: string | null;
  video_url: string | null;
  duration_minutes: number | null;
  is_free: boolean | null;
};

export type MemberCourseData = {
  course: { id: string; title: string; description: string | null; thumbnail_url: string | null; user_id: string };
  modules: ModuleLite<MemberLesson>[];
  done: Record<string, boolean>;
};

const key = (courseId: string, userId: string) => ["member-course", courseId, userId] as const;

async function fetchCourse(courseId: string, userId: string): Promise<MemberCourseData | null> {
  const { data: course, error } = await supabase
    .from("courses")
    .select("id, title, description, thumbnail_url, user_id")
    .eq("id", courseId)
    .maybeSingle();
  if (error) throw error;
  // Sem linha = não existe, não está publicado ou o aluno não tem acesso (a política do banco decide).
  if (!course) return null;

  const { data: mods, error: modErr } = await supabase
    .from("modules")
    .select("id, title, description, sort_order")
    .eq("course_id", courseId);
  if (modErr) throw modErr;

  const ids = (mods ?? []).map((m) => m.id);
  let lessons: MemberLesson[] = [];
  if (ids.length > 0) {
    const { data, error: lessonErr } = await supabase
      .from("lessons")
      .select("id, module_id, title, description, video_url, duration_minutes, is_free, sort_order")
      .in("module_id", ids);
    if (lessonErr) throw lessonErr;
    lessons = (data ?? []) as MemberLesson[];
  }

  const modules = sortCourse((mods ?? []).map((m) => ({ ...m, lessons: lessons.filter((l) => l.module_id === m.id) })));

  const done: Record<string, boolean> = {};
  const lessonIds = lessons.map((l) => l.id);
  if (lessonIds.length > 0) {
    const { data, error: progErr } = await supabase
      .from("user_progress")
      .select("lesson_id, completed")
      .eq("user_id", userId)
      .in("lesson_id", lessonIds);
    if (progErr) throw progErr;
    for (const p of data ?? []) if (p.completed) done[p.lesson_id] = true;
  }
  return { course, modules, done };
}

/**
 * Curso do aluno: árvore de módulos/aulas + o que ele já concluiu.
 * Marcar/desmarcar aula é otimista e volta atrás (com aviso) se o banco recusar.
 * O dono do curso só vê uma prévia: nada é gravado (a política de progresso exige matrícula).
 */
export function useMemberCourse(courseId: string | undefined, userId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: key(courseId ?? "", userId),
    queryFn: () => fetchCourse(courseId as string, userId),
    enabled: !!courseId,
    staleTime: 30_000,
    retry: 1,
  });
  const data = query.data ?? null;
  const preview = !!data && data.course.user_id === userId;
  const [pendingId, setPendingId] = useState<string | null>(null);

  const setDone = useMutation({
    mutationFn: async ({ lessonId, done }: { lessonId: string; done: boolean }) => {
      if (preview) return;
      const { error } = await supabase
        .from("user_progress")
        .upsert(
          { user_id: userId, lesson_id: lessonId, completed: done, completed_at: done ? new Date().toISOString() : null },
          { onConflict: "user_id,lesson_id" },
        );
      if (error) throw error;
    },
    onMutate: async ({ lessonId, done }) => {
      setPendingId(lessonId);
      await qc.cancelQueries({ queryKey: key(courseId ?? "", userId) });
      const before = qc.getQueryData<MemberCourseData | null>(key(courseId ?? "", userId));
      qc.setQueryData<MemberCourseData | null>(key(courseId ?? "", userId), (d) => {
        if (!d) return d;
        const next = { ...d.done };
        if (done) next[lessonId] = true; else delete next[lessonId];
        return { ...d, done: next };
      });
      return { before };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(key(courseId ?? "", userId), ctx.before);
      toast.error("Não foi possível salvar. Confira sua conexão e tente de novo.");
    },
    onSettled: (_d, _e, v) => {
      setPendingId((id) => (id === v.lessonId ? null : id));
      if (!preview) void qc.invalidateQueries({ queryKey: ["member-cert", courseId, userId] });
      if (!preview) void qc.invalidateQueries({ queryKey: ["member-home", userId] });
    },
  });

  const toggle = useCallback((lessonId: string, done: boolean) => setDone.mutate({ lessonId, done }), [setDone]);

  const lessons = data ? orderedLessons(data.modules) : [];
  return {
    ...query,
    data,
    lessons,
    progress: progressOf(lessons, data?.done ?? {}),
    preview,
    toggle,
    pendingId,
  };
}

/** Certificado do curso (emitido pelo banco quando a última aula é concluída). */
export function useCourseCertificate(courseId: string | undefined, userId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["member-cert", courseId, userId],
    enabled: !!courseId && enabled,
    staleTime: 10_000,
    // O trigger do banco emite logo depois do upsert; tenta de novo uma vez antes de desistir.
    retry: 1,
    retryDelay: 1200,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificates")
        .select("code")
        .eq("user_id", userId)
        .eq("course_id", courseId as string)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("certificado ainda não emitido");
      return data.code as string;
    },
  });
}
