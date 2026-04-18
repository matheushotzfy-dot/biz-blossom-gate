import { useMemo, useState } from "react";
import { Eye, EyeOff, Monitor, Smartphone, Layers, BookOpen, PlayCircle } from "lucide-react";
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

 const totalLessons = previewModules.reduce((sum, module) => sum + (module.lessonCount ?? module.lessons?.length ?? 0), 0);
 const configuredLessons = previewModules.reduce(
 (sum, module) => sum + (module.lessons?.filter((lesson) => !!lesson.video_url).length ?? 0),
 0,
 );
 const isMobile = viewMode === "mobile";

 return (
 <>
 <AnimatePresence>
 {!open && (
 <motion.button
 initial={{ opacity: 0, x: 10 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: 10 }}
 onClick={() => setOpen(true)}
 className="absolute right-3 top-3 z-40 inline-flex h-10 items-center gap-2 rounded-xl border border-border/20 bg-card/90 px-4 text-xs font-display font-bold text-muted-foreground/60 shadow-lg shadow-foreground/[0.03] backdrop-blur-xl transition-all hover:border-primary/20 hover:bg-primary/5 hover:text-primary active:scale-[0.985]"
 >
 <Eye className="h-3.5 w-3.5" /> Preview
 </motion.button>
 )}
 </AnimatePresence>

 <AnimatePresence initial={false}>
 {open && (
 <motion.aside
 initial={{ width: 0, opacity: 0 }}
 animate={{ width: 392, opacity: 1 }}
 exit={{ width: 0, opacity: 0 }}
 transition={{ duration: 0.4, ease }}
 className="flex shrink-0 flex-col overflow-hidden border-l border-border/15 bg-card/30 backdrop-blur-xl"
 >
 <div className="border-b border-border/15 px-4 py-3">
 <div className="mb-3 flex items-start justify-between gap-3">
 <div className="flex items-center gap-2.5">
 <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
 <Eye className="h-4 w-4 text-primary" />
 </div>
 <div>
 <p className="text-xs font-display font-black tracking-[-0.02em] text-foreground/80">Experiência do aluno</p>
 <p className="text-[10px] font-display text-muted-foreground/40">Preview vivo do catálogo e do player</p>
 </div>
 </div>
 <div className="flex items-center gap-1">
 <div className="flex items-center gap-0.5 rounded-xl border border-border/10 bg-muted/10 p-0.5">
 {[
 { id: "desktop" as const, icon: Monitor },
 { id: "mobile" as const, icon: Smartphone },
 ].map((item) => (
 <button
 key={item.id}
 type="button"
 onClick={() => setViewMode(item.id)}
 className={cn(
 "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
 viewMode === item.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground/35 hover:text-foreground/70",
 )}
 >
 <item.icon className="h-4 w-4" />
 </button>
 ))}
 </div>
 <button
 type="button"
 onClick={() => setOpen(false)}
 className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/35 transition-colors hover:bg-muted/10 hover:text-foreground/70"
 >
 <EyeOff className="h-4 w-4" />
 </button>
 </div>
 </div>

 <div className="grid grid-cols-3 gap-2">
 <div className="rounded-xl border border-border/10 bg-card/70 p-2.5">
 <p className="text-[9px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground/35">Módulos</p>
 <p className="mt-1 text-sm font-display font-black text-foreground/80">{modules.length}</p>
 </div>
 <div className="rounded-xl border border-border/10 bg-card/70 p-2.5">
 <p className="text-[9px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground/35">Aulas</p>
 <p className="mt-1 text-sm font-display font-black text-foreground/80">{totalLessons}</p>
 </div>
 <div className="rounded-xl border border-border/10 bg-card/70 p-2.5">
 <p className="text-[9px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground/35">Setup</p>
 <p className="mt-1 text-sm font-display font-black text-primary">{totalLessons > 0 ? Math.round((configuredLessons / totalLessons) * 100) : 0}%</p>
 </div>
 </div>
 </div>

 <div className="flex-1 overflow-y-auto p-4">
 <MemberExperiencePreview
 course={{
 ...course,
 progressPct: totalLessons > 0 ? Math.round((configuredLessons / totalLessons) * 100) : 0,
 completedLessons: configuredLessons,
 totalLessons,
 }}
 modules={previewModules}
 selectedLessonId={selectedLessonId}
 viewMode={viewMode}
 />
 </div>

 <div className="border-t border-border/10 bg-card/20 px-4 py-3">
 <div className="flex items-center justify-between gap-3">
 <div className="flex items-center gap-2 text-[10px] font-display font-bold text-muted-foreground/40">
 <Layers className="h-3.5 w-3.5 text-primary/60" /> {modules.length} módulo{modules.length !== 1 ? "s" : ""}
 </div>
 <div className="flex items-center gap-2 text-[10px] font-display font-bold text-muted-foreground/40">
 <BookOpen className="h-3.5 w-3.5 text-info/60" /> {totalLessons} aula{totalLessons !== 1 ? "s" : ""}
 </div>
 <div className="flex items-center gap-2 text-[10px] font-display font-bold text-muted-foreground/40">
 <PlayCircle className="h-3.5 w-3.5 text-warning/60" /> {selectedLessonId ? "Player" : isMobile ? "Mobile" : "Home"}
 </div>
 </div>
 </div>
 </motion.aside>
 )}
 </AnimatePresence>
 </>
 );
}
