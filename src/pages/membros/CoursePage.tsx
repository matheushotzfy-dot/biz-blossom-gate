import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Play, CheckCircle2, ChevronLeft, ChevronDown, ChevronRight, BookOpen, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Course = { id: string; title: string; description: string | null; thumbnail_url: string | null };
type Module = { id: string; title: string; description: string | null; sort_order: number; lessons: Lesson[] };
type Lesson = { id: string; title: string; description: string | null; video_url: string | null; duration_minutes: number; is_free: boolean; sort_order: number };
type Progress = { lesson_id: string; completed: boolean; progress_seconds: number };

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
  return m ? m[1] : null;
}

export default function CoursePage() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<Map<string, Progress>>(new Map());
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId || !user) return;
    loadCourse();
  }, [courseId, user]);

  const loadCourse = async () => {
    if (!courseId || !user) return;

    const { data: courseData } = await supabase
      .from("courses")
      .select("id, title, description, thumbnail_url")
      .eq("id", courseId)
      .single();

    if (!courseData) { setLoading(false); return; }
    setCourse(courseData);

    const { data: modulesData } = await supabase
      .from("modules")
      .select("id, title, description, sort_order")
      .eq("course_id", courseId)
      .order("sort_order");

    if (!modulesData) { setLoading(false); return; }

    // Get lessons for each module
    const moduleIds = modulesData.map(m => m.id);
    const { data: lessonsData } = await supabase
      .from("lessons")
      .select("id, title, description, video_url, duration_minutes, is_free, sort_order, module_id")
      .in("module_id", moduleIds)
      .order("sort_order");

    const enrichedModules: Module[] = modulesData.map(m => ({
      ...m,
      lessons: (lessonsData?.filter((l: any) => l.module_id === m.id) || []) as Lesson[],
    }));

    setModules(enrichedModules);

    // Expand first module
    if (enrichedModules.length > 0) {
      setExpandedModules(new Set([enrichedModules[0].id]));
    }

    // Load progress
    const allLessonIds = lessonsData?.map((l: any) => l.id) || [];
    if (allLessonIds.length > 0) {
      const { data: progressData } = await supabase
        .from("user_progress")
        .select("lesson_id, completed, progress_seconds")
        .eq("user_id", user!.id)
        .in("lesson_id", allLessonIds);

      const pMap = new Map<string, Progress>();
      progressData?.forEach(p => pMap.set(p.lesson_id, p));
      setProgress(pMap);

      // Find last watched or first unwatched
      const lastWatched = progressData?.filter(p => !p.completed).sort((a, b) => b.progress_seconds - a.progress_seconds)[0];
      const targetId = lastWatched?.lesson_id || allLessonIds[0];
      const targetLesson = lessonsData?.find((l: any) => l.id === targetId) as Lesson | undefined;
      if (targetLesson) setActiveLesson(targetLesson);
    }

    setLoading(false);
  };

  const toggleModule = (id: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const markComplete = async (lessonId: string) => {
    if (!user) return;
    await supabase.from("user_progress").upsert({
      user_id: user.id,
      lesson_id: lessonId,
      completed: true,
      completed_at: new Date().toISOString(),
    }, { onConflict: "user_id,lesson_id" });

    setProgress(prev => {
      const next = new Map(prev);
      next.set(lessonId, { lesson_id: lessonId, completed: true, progress_seconds: 0 });
      return next;
    });
    toast.success("Aula concluída!");

    // Auto-advance to next lesson
    const allLessons = modules.flatMap(m => m.lessons);
    const idx = allLessons.findIndex(l => l.id === lessonId);
    if (idx < allLessons.length - 1) {
      setActiveLesson(allLessons[idx + 1]);
    }
  };

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const completedLessons = [...progress.values()].filter(p => p.completed).length;
  const overallPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-20">
        <h1 className="text-xl font-bold mb-2">Curso não encontrado</h1>
        <Link to="/membros" className="text-primary text-sm hover:underline">Voltar</Link>
      </div>
    );
  }

  return (
    <div className="dark">
      {/* Back + title */}
      <div className="mb-6">
        <Link to="/membros" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Link>
        <h1 className="text-2xl font-bold">{course.title}</h1>
        {course.description && <p className="text-sm text-muted-foreground mt-1">{course.description}</p>}
        
        {/* Progress bar */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-muted/20 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${overallPct}%` }} />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{completedLessons}/{totalLessons} aulas • {overallPct}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Player */}
        <div className="lg:col-span-2">
          {activeLesson ? (
            <div>
              <div className="aspect-video rounded-2xl overflow-hidden bg-black mb-4">
                {activeLesson.video_url ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${extractYouTubeId(activeLesson.video_url)}?rel=0&modestbranding=1`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <p>Vídeo não disponível</p>
                  </div>
                )}
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{activeLesson.title}</h2>
                  {activeLesson.description && (
                    <p className="text-sm text-muted-foreground mt-1">{activeLesson.description}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={progress.get(activeLesson.id)?.completed ? "outline" : "default"}
                  className="shrink-0 gap-1"
                  onClick={() => markComplete(activeLesson.id)}
                  disabled={progress.get(activeLesson.id)?.completed}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {progress.get(activeLesson.id)?.completed ? "Concluída" : "Concluir"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="aspect-video rounded-2xl bg-card/60 border border-border/30 flex items-center justify-center">
              <p className="text-muted-foreground">Selecione uma aula</p>
            </div>
          )}
        </div>

        {/* Lesson List */}
        <div className="space-y-2">
          {modules.map(mod => (
            <div key={mod.id} className="rounded-xl overflow-hidden bg-card/60 border border-border/30 backdrop-blur-sm">
              <button
                onClick={() => toggleModule(mod.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/10 transition-colors"
              >
                <div className="text-left">
                  <h3 className="text-sm font-semibold">{mod.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {mod.lessons.length} aulas • {mod.lessons.filter(l => progress.get(l.id)?.completed).length} concluídas
                  </p>
                </div>
                {expandedModules.has(mod.id) ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {expandedModules.has(mod.id) && (
                <div className="border-t border-border/20">
                  {mod.lessons.map(lesson => {
                    const isActive = activeLesson?.id === lesson.id;
                    const isCompleted = progress.get(lesson.id)?.completed;
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => setActiveLesson(lesson)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors text-sm ${
                          isActive
                            ? "bg-primary/10 border-l-2 border-primary"
                            : "hover:bg-muted/10 border-l-2 border-transparent"
                        }`}
                      >
                        <div className="shrink-0">
                          {isCompleted ? (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          ) : (
                            <Play className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`truncate ${isCompleted ? "text-muted-foreground" : ""}`}>{lesson.title}</p>
                          {lesson.duration_minutes > 0 && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3" /> {lesson.duration_minutes} min
                            </p>
                          )}
                        </div>
                        {lesson.is_free && (
                          <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">FREE</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
