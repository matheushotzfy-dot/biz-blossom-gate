import { useMemo, useState } from "react";
import { Eye, EyeOff, Monitor, Smartphone, Radio, Video, Lock, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
 MemberExperiencePreview,
 type PreviewModule,
} from "@/components/course/MemberExperiencePreview";

const ease = [0.16, 1, 0.3, 1] as const;

interface Module {
 id: string;
 title: string;
 banner_url?: string | null;
 lessons: {
  id: string;
  title: string;
  video_url: string | null;
  is_free: boolean;
  duration_minutes: number | null;
 }[];
}

interface Course {
 id: string;
 title: string;
 description: string | null;
 is_published: boolean;
 thumbnail_url?: string | null;
 category?: string | null;
}

interface Props {
 course: Course;
 modules: Module[];
 selectedLessonId: string | null;
}

export default function StudentPreviewPanel({ course, modules, selectedLessonId }: Props) {
 const [open, setOpen] = useState(true);
 const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");

 const previewModules = useMemo<PreviewModule[]>(() => (
  modules.map((module) => ({
   id: module.id,
   title: module.title,
   banner_url: module.banner_url,
   lessonCount: module.lessons.length,
   lessons: module.lessons.map((lesson, index) => ({
    ...lesson,
    completed: index === 0 && !!lesson.video_url,
   })),
  }))
 ), [modules]);

 const totalLessons = previewModules.reduce((sum, m) => sum + (m.lessonCount ?? m.lessons?.length ?? 0), 0);
 const configuredLessons = previewModules.reduce(
  (sum, m) => sum + (m.lessons?.filter((l) => !!l.video_url).length ?? 0),
  0,
 );
 const setupPct = totalLessons > 0 ? Math.round((configuredLessons / totalLessons) * 100) : 0;

 // Find currently selected lesson context
 const editingContext = useMemo(() => {
  if (!selectedLessonId) return null;
  for (const mod of modules) {
   const idx = mod.lessons.findIndex((l) => l.id === selectedLessonId);
   if (idx !== -1) {
    return { module: mod, lesson: mod.lessons[idx], lessonIndex: idx };
   }
  }
  return null;
 }, [selectedLessonId, modules]);

 return (
  <>
   <AnimatePresence>
    {!open && (
     <motion.button
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      onClick={() => setOpen(true)}
      className="absolute right-4 top-4 z-40 inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-display font-semibold text-foreground shadow-sm transition-all hover:bg-muted active:scale-[0.98]"
     >
      <Eye className="h-3.5 w-3.5" /> Mostrar preview
     </motion.button>
    )}
   </AnimatePresence>

   <AnimatePresence initial={false}>
    {open && (
     <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 420, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.35, ease }}
      className="flex shrink-0 flex-col overflow-hidden border-l border-border bg-background"
     >
      {/* Header — operational, not decorative */}
      <div className="border-b border-border bg-card/40 px-4 py-3">
       <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
         <div className="flex h-1.5 w-1.5 items-center justify-center">
          <span className="absolute h-2 w-2 animate-ping rounded-full bg-success/60" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-success" />
         </div>
         <p className="text-xs font-display font-bold uppercase tracking-[0.12em] text-foreground">
          Live Preview
         </p>
        </div>
        <div className="flex items-center gap-1">
         <div className="flex items-center gap-0.5 rounded-md border border-border bg-muted/30 p-0.5">
          {[
           { id: "desktop" as const, icon: Monitor, label: "Desktop" },
           { id: "mobile" as const, icon: Smartphone, label: "Mobile" },
          ].map((item) => (
           <button
            key={item.id}
            type="button"
            onClick={() => setViewMode(item.id)}
            title={item.label}
            className={cn(
             "flex h-7 w-7 items-center justify-center rounded transition-all",
             viewMode === item.id
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
            )}
           >
            <item.icon className="h-3.5 w-3.5" />
           </button>
          ))}
         </div>
         <button
          type="button"
          onClick={() => setOpen(false)}
          title="Ocultar preview"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
         >
          <EyeOff className="h-3.5 w-3.5" />
         </button>
        </div>
       </div>

       {/* Editing context — what the user is editing right now */}
       {editingContext ? (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/[0.04] p-2.5">
         <div className="flex items-center gap-1.5 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-primary">
          <Radio className="h-3 w-3" />
          Editando agora
         </div>
         <p className="mt-1 truncate text-sm font-display font-bold text-foreground">
          {editingContext.lesson.title || "Aula sem título"}
         </p>
         <div className="mt-1.5 flex items-center gap-2 text-[11px] font-display text-muted-foreground">
          <span className="truncate">{editingContext.module.title}</span>
          <span className="text-border">·</span>
          <span>Aula {editingContext.lessonIndex + 1}</span>
          {editingContext.lesson.duration_minutes ? (
           <>
            <span className="text-border">·</span>
            <span className="inline-flex items-center gap-1">
             <Clock className="h-2.5 w-2.5" />
             {editingContext.lesson.duration_minutes}min
            </span>
           </>
          ) : null}
         </div>
         <div className="mt-2 flex items-center gap-1.5">
          {editingContext.lesson.video_url ? (
           <span className="inline-flex items-center gap-1 rounded border border-success/20 bg-success/10 px-1.5 py-0.5 text-[10px] font-display font-bold text-success">
            <Video className="h-2.5 w-2.5" /> Vídeo OK
           </span>
          ) : (
           <span className="inline-flex items-center gap-1 rounded border border-warning/20 bg-warning/10 px-1.5 py-0.5 text-[10px] font-display font-bold text-warning">
            <Video className="h-2.5 w-2.5" /> Sem vídeo
           </span>
          )}
          {editingContext.lesson.is_free ? (
           <span className="rounded border border-info/20 bg-info/10 px-1.5 py-0.5 text-[10px] font-display font-bold text-info">
            Grátis
           </span>
          ) : (
           <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/30 px-1.5 py-0.5 text-[10px] font-display font-bold text-muted-foreground">
            <Lock className="h-2.5 w-2.5" /> Bloqueada
           </span>
          )}
         </div>
        </div>
       ) : (
        <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/20 p-2.5">
         <p className="text-[11px] font-display text-muted-foreground">
          Selecione uma aula para ver o player do aluno
         </p>
        </div>
       )}

       {/* Compact metrics row */}
       <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-display">
        <div className="flex items-center gap-3">
         <div>
          <span className="font-bold text-foreground">{modules.length}</span>
          <span className="ml-1 text-muted-foreground">módulos</span>
         </div>
         <div className="h-3 w-px bg-border" />
         <div>
          <span className="font-bold text-foreground">{totalLessons}</span>
          <span className="ml-1 text-muted-foreground">aulas</span>
         </div>
        </div>
        <div className="flex items-center gap-2">
         <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
          <div
           className={cn(
            "h-full rounded-full transition-all",
            setupPct === 100 ? "bg-success" : "bg-primary",
           )}
           style={{ width: `${setupPct}%` }}
          />
         </div>
         <span className={cn("font-bold tabular-nums", setupPct === 100 ? "text-success" : "text-foreground")}>
          {setupPct}%
         </span>
        </div>
       </div>
      </div>

      {/* Preview surface */}
      <div className="flex-1 overflow-y-auto bg-muted/[0.02] p-3">
       <MemberExperiencePreview
        course={{
         ...course,
         progressPct: setupPct,
         completedLessons: configuredLessons,
         totalLessons,
        }}
        modules={previewModules}
        selectedLessonId={selectedLessonId}
        viewMode={viewMode}
       />
      </div>

      {/* Footer status bar */}
      <div className="flex items-center justify-between border-t border-border bg-card/40 px-4 py-2">
       <div className="flex items-center gap-1.5 text-[10px] font-display font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        {course.is_published ? "Publicado" : "Rascunho"}
       </div>
       <div className="text-[10px] font-display font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {selectedLessonId ? "Visão player" : viewMode === "mobile" ? "Catálogo · Mobile" : "Catálogo · Desktop"}
       </div>
      </div>
     </motion.aside>
    )}
   </AnimatePresence>
  </>
 );
}
