import { useMemo, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { MemberExperiencePreview, type PreviewModule } from "@/components/course/MemberExperiencePreview";

interface Module {
  id: string;
  title: string;
  banner_url?: string | null;
  lessons: { id: string; title: string; video_url: string | null; is_free: boolean; duration_minutes: number | null }[];
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
  productName?: string | null;
  className?: string;
}

/** Conteúdo do painel "Prévia do aluno". Quem usa decide onde ele vive (coluna fixa ou gaveta). */
export default function StudentPreviewPanel({ course, modules, selectedLessonId, productName, className }: Props) {
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");

  const previewModules = useMemo<PreviewModule[]>(
    () => modules.map((m) => ({ id: m.id, title: m.title, banner_url: m.banner_url, lessonCount: m.lessons.length, lessons: m.lessons })),
    [modules],
  );

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border py-4 pl-5 pr-14">
        <div className="min-w-0">
          <h2 className="font-heading text-[17px] font-extrabold leading-tight tracking-[-0.02em] text-foreground">Prévia do aluno</h2>
          <p className="text-[13px] text-muted-foreground">{course.is_published ? "Publicada" : "Rascunho, só você vê"}</p>
        </div>
        <div role="group" aria-label="Tamanho da prévia" className="flex shrink-0 items-center gap-1 rounded-full bg-muted p-1">
          {([
            { id: "desktop" as const, icon: Monitor, label: "Computador" },
            { id: "mobile" as const, icon: Smartphone, label: "Celular" },
          ]).map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={viewMode === item.id}
              aria-label={item.label}
              title={item.label}
              onClick={() => setViewMode(item.id)}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                viewMode === item.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" strokeWidth={2} />
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-muted/40 p-4">
        <MemberExperiencePreview
          course={{ id: course.id, title: course.title, description: course.description, category: course.category, thumbnail_url: course.thumbnail_url, is_published: course.is_published, productName }}
          modules={previewModules}
          selectedLessonId={selectedLessonId}
          viewMode={viewMode}
        />
      </div>

      <p className="border-t border-border px-5 py-3 text-[12.5px] leading-snug text-muted-foreground">Prévia aproximada. Para ver a versão real, publique a área e use Ver como aluno.</p>
    </div>
  );
}
