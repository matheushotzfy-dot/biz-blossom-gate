import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, Copy, GripVertical, Layers, MoreHorizontal, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { Reorder, useDragControls } from "framer-motion";

import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SellerMenuItem as BuilderMenuItem, sellerMenuContent as builderMenuContent } from "@/components/seller-ui/menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { BuilderLesson, BuilderModule } from "@/components/course/builder/types";


export interface CurriculumPanelProps {
  modules: BuilderModule[];
  selectedLessonId: string | null;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelectLesson: (lesson: BuilderLesson) => void;
  onCreateModule: (title: string) => Promise<boolean>;
  onRenameModule: (id: string, title: string) => void;
  onDeleteModule: (id: string) => void;
  onMoveModule: (id: string, dir: -1 | 1) => void;
  onCreateLesson: (moduleId: string) => void;
  onDuplicateLesson: (lesson: BuilderLesson) => void;
  onDeleteLesson: (id: string) => void;
  onMoveLesson: (moduleId: string, lessonId: string, dir: -1 | 1) => void;
  onReorderLessons: (moduleId: string, order: BuilderLesson[]) => void;
  onCommitLessonOrder: (moduleId: string) => void;
  creatingModule: boolean;
  setCreatingModule: (v: boolean) => void;
}

function LessonRow({ lesson, index, total, active, onSelect, onDuplicate, onDelete, onMove, onCommit }: {
  lesson: BuilderLesson; index: number; total: number; active: boolean;
  onSelect: () => void; onDuplicate: () => void; onDelete: () => void; onMove: (dir: -1 | 1) => void; onCommit: () => void;
}) {
  const controls = useDragControls();
  const hasVideo = !!lesson.video_url;
  return (
    <Reorder.Item
      value={lesson}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onCommit}
      as="li"
      className={cn("relative flex items-center gap-1 rounded-[16px] pr-1 transition-colors", active ? "bg-accent" : "hover:bg-muted/70")}
    >
      <span
        onPointerDown={(e) => controls.start(e)}
        style={{ touchAction: "none" }}
        aria-hidden
        title="Arraste para reordenar"
        className="grid h-10 w-7 shrink-0 cursor-grab place-items-center text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[14px] py-2.5 pr-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold tabular-nums", active ? "bg-primary text-primary-foreground" : hasVideo ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>
          {hasVideo ? <Play className="h-3 w-3 fill-current" /> : index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("line-clamp-2 break-words text-[14.5px] font-semibold leading-tight", active ? "text-accent-foreground" : "text-foreground")}>{lesson.title || "Aula sem título"}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] leading-tight text-muted-foreground">
            {!hasVideo && <span>Sem vídeo</span>}
            {lesson.is_free && <span className="font-semibold text-primary">Grátis</span>}
            {hasVideo && !lesson.is_free && lesson.duration_minutes ? <span>{lesson.duration_minutes} min</span> : null}
          </span>
        </span>
      </button>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`Mais ações da aula ${lesson.title || index + 1}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <MoreHorizontal className="h-[18px] w-[18px]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" collisionPadding={16} sideOffset={6} className={builderMenuContent}>
          <BuilderMenuItem icon={Copy} label="Duplicar aula" onSelect={onDuplicate} />
          <BuilderMenuItem icon={ArrowUp} label="Subir" disabled={index === 0} onSelect={() => onMove(-1)} />
          <BuilderMenuItem icon={ArrowDown} label="Descer" disabled={index === total - 1} onSelect={() => onMove(1)} />
          <DropdownMenuSeparator className="my-1 bg-border" />
          <BuilderMenuItem icon={Trash2} label="Excluir aula" destructive onSelect={onDelete} />
        </DropdownMenuContent>
      </DropdownMenu>
    </Reorder.Item>
  );
}

export function CurriculumPanel(p: CurriculumPanelProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const renameDone = useRef(false);

  const startRename = (id: string, title: string) => { renameDone.current = false; setRenamingId(id); setRenameValue(title); };
  const finishRename = (id: string, save: boolean) => {
    if (renameDone.current) return;
    renameDone.current = true;
    setRenamingId(null);
    if (save && renameValue.trim()) p.onRenameModule(id, renameValue.trim());
  };

  const submitNew = async () => {
    const title = newTitle.trim();
    if (!title) return;
    const ok = await p.onCreateModule(title);
    if (ok) { setNewTitle(""); p.setCreatingModule(false); }
  };

  return (
    <div className="space-y-3 p-4 sm:p-5">
      {p.modules.length === 0 && !p.creatingModule && (
        <div className="vp-sheet grid place-items-center px-6 py-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-foreground"><Layers className="h-6 w-6" /></span>
          <p className="mt-4 text-[16px] font-extrabold tracking-[-0.02em] text-foreground">Comece pelo primeiro módulo</p>
          <p className="mt-1 max-w-[280px] text-[14px] leading-relaxed text-muted-foreground">Módulos agrupam as aulas. Depois de criar um, adicione as aulas dentro dele.</p>
          <button type="button" onClick={() => p.setCreatingModule(true)} className="vp-cta mt-5"><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Criar módulo</button>
        </div>
      )}

      {p.modules.map((mod, mi) => {
        const isOpen = p.expanded.has(mod.id);
        const withVideo = mod.lessons.filter((l) => l.video_url).length;
        const containsActive = mod.lessons.some((l) => l.id === p.selectedLessonId);
        return (
          <section key={mod.id} className={cn("vp-sheet overflow-hidden", containsActive && "border-primary/40")} aria-label={`Módulo ${mi + 1}: ${mod.title}`}>
            <div className="flex items-center gap-1 pr-2">
              {renamingId === mod.id ? (
                <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-bold tabular-nums text-accent-foreground">{mi + 1}</span>
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value.slice(0, 80))}
                    onBlur={() => finishRename(mod.id, true)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); finishRename(mod.id, true); } if (e.key === "Escape") finishRename(mod.id, false); }}
                    aria-label="Nome do módulo"
                    className="vp-field !h-10 min-w-0 flex-1 font-semibold"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => p.onToggleExpand(mod.id)}
                  aria-expanded={isOpen}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-[16px] px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-bold tabular-nums text-accent-foreground">{mi + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 break-words font-heading text-[16px] font-extrabold leading-tight tracking-[-0.02em] text-foreground">{mod.title}</span>
                    <span className="mt-0.5 block text-[13px] text-muted-foreground">
                      {mod.lessons.length === 0 ? "Nenhuma aula" : `${mod.lessons.length} ${mod.lessons.length === 1 ? "aula" : "aulas"}, ${withVideo} com vídeo`}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", isOpen && "rotate-90")} />
                </button>
              )}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label={`Mais ações do módulo ${mod.title}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <MoreHorizontal className="h-[18px] w-[18px]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" collisionPadding={16} sideOffset={6} className={builderMenuContent}>
                  <BuilderMenuItem icon={Plus} label="Nova aula" onSelect={() => p.onCreateLesson(mod.id)} />
                  <BuilderMenuItem icon={Pencil} label="Renomear" onSelect={() => startRename(mod.id, mod.title)} />
                  <BuilderMenuItem icon={ArrowUp} label="Subir módulo" disabled={mi === 0} onSelect={() => p.onMoveModule(mod.id, -1)} />
                  <BuilderMenuItem icon={ArrowDown} label="Descer módulo" disabled={mi === p.modules.length - 1} onSelect={() => p.onMoveModule(mod.id, 1)} />
                  <DropdownMenuSeparator className="my-1 bg-border" />
                  <BuilderMenuItem icon={Trash2} label="Excluir módulo" destructive onSelect={() => p.onDeleteModule(mod.id)} />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {isOpen && (
              <div className="border-t border-border px-2 pb-2 pt-1.5">
                {mod.lessons.length > 0 && (
                  <Reorder.Group axis="y" values={mod.lessons} onReorder={(order) => p.onReorderLessons(mod.id, order)} as="ul" className="space-y-0.5">
                    {mod.lessons.map((lesson, li) => (
                      <LessonRow
                        key={lesson.id}
                        lesson={lesson}
                        index={li}
                        total={mod.lessons.length}
                        active={p.selectedLessonId === lesson.id}
                        onSelect={() => p.onSelectLesson(lesson)}
                        onDuplicate={() => p.onDuplicateLesson(lesson)}
                        onDelete={() => p.onDeleteLesson(lesson.id)}
                        onMove={(dir) => p.onMoveLesson(mod.id, lesson.id, dir)}
                        onCommit={() => p.onCommitLessonOrder(mod.id)}
                      />
                    ))}
                  </Reorder.Group>
                )}
                <button
                  type="button"
                  onClick={() => p.onCreateLesson(mod.id)}
                  className="vp-r16 mt-1.5 flex h-11 w-full items-center justify-center gap-2 border border-dashed border-border text-[14px] font-semibold text-muted-foreground transition-colors hover:border-primary/60 hover:bg-accent/60 hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.4} />
                  Nova aula
                </button>
              </div>
            )}
          </section>
        );
      })}

      {p.creatingModule ? (
        <form className="vp-sheet space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); void submitNew(); }}>
          <label htmlFor="new-module" className="text-[14px] font-semibold text-foreground">Nome do novo módulo</label>
          <Input
            id="new-module"
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value.slice(0, 80))}
            onKeyDown={(e) => { if (e.key === "Escape") { setNewTitle(""); p.setCreatingModule(false); } }}
            placeholder="Ex.: Introdução ao curso"
            autoComplete="off"
            className="vp-field"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={!newTitle.trim()} className="vp-cta h-11 flex-1 px-5">Criar módulo</button>
            <button type="button" onClick={() => { setNewTitle(""); p.setCreatingModule(false); }} className="vp-ghost h-11 px-5">Cancelar</button>
          </div>
        </form>
      ) : (
        p.modules.length > 0 && (
          <button
            type="button"
            onClick={() => p.setCreatingModule(true)}
            className="vp-r16 flex h-12 w-full items-center justify-center gap-2 border border-dashed border-border text-[14.5px] font-semibold text-muted-foreground transition-colors hover:border-primary/60 hover:bg-accent/60 hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            Novo módulo
          </button>
        )
      )}
    </div>
  );
}
