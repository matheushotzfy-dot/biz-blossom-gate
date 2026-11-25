import { useEffect, useState } from "react";
import { Check, ChevronDown, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMinutes, progressOf, type ModuleLite } from "@/components/member/courseModel";

type Props = {
  modules: ModuleLite[];
  done: Readonly<Record<string, boolean>>;
  activeId: string | null;
  onSelect: (lessonId: string) => void;
};

/** Grade do curso: módulos que abrem e fecham, com a aula atual e as concluídas marcadas. */
export function Curriculum({ modules, done, activeId, onSelect }: Props) {
  const activeModule = modules.find((m) => m.lessons.some((l) => l.id === activeId))?.id ?? modules[0]?.id ?? null;
  const [open, setOpen] = useState<Record<string, boolean>>(() => (activeModule ? { [activeModule]: true } : {}));

  // Ao trocar de aula, abre o módulo dela sem fechar os que o aluno abriu.
  useEffect(() => {
    if (activeModule) setOpen((o) => (o[activeModule] ? o : { ...o, [activeModule]: true }));
  }, [activeModule]);

  if (modules.length === 0) {
    return <p className="px-5 py-8 text-center text-[14px] text-muted-foreground">Este curso ainda não tem aulas.</p>;
  }

  return (
    <ul className="divide-y divide-white/[0.06]">
      {modules.map((mod, i) => {
        const prog = progressOf(mod.lessons, done);
        const isOpen = !!open[mod.id];
        return (
          <li key={mod.id}>
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [mod.id]: !o[mod.id] }))}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.04] focus-visible:outline-none"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium text-muted-foreground">Módulo {i + 1}</span>
                <span className="mt-0.5 block text-[15px] font-bold leading-snug text-foreground">{mod.title}</span>
              </span>
              <span className={cn("shrink-0 text-[12.5px] font-semibold tabular-nums", prog.total > 0 && prog.done === prog.total ? "text-primary" : "text-muted-foreground")}>
                {prog.done}/{prog.total}
              </span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none", isOpen && "rotate-180")} aria-hidden />
            </button>
            {isOpen && (
              <ul className="pb-2">
                {mod.lessons.length === 0 && <li className="px-5 pb-3 text-[13.5px] text-muted-foreground">Sem aulas neste módulo.</li>}
                {mod.lessons.map((lesson) => {
                  const active = lesson.id === activeId;
                  const isDone = !!done[lesson.id];
                  const dur = formatMinutes(lesson.duration_minutes);
                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(lesson.id)}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "relative flex w-full items-start gap-3 py-3 pl-5 pr-5 text-left transition-colors focus-visible:outline-none focus-visible:bg-white/[0.05]",
                          active ? "bg-primary/10" : "hover:bg-white/[0.03]",
                        )}
                      >
                        {active && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-primary" />}
                        <span
                          aria-hidden
                          className={cn(
                            "mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full",
                            isDone ? "bg-primary text-primary-foreground" : active ? "bg-primary/20 text-primary" : "bg-white/[0.07] text-muted-foreground",
                          )}
                        >
                          {isDone ? <Check className="h-3 w-3" strokeWidth={3.5} /> : <Play className="ml-px h-2.5 w-2.5 fill-current" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-[14.5px] leading-snug", active ? "font-bold text-foreground" : "font-medium text-foreground/85")}>{lesson.title}</span>
                          {(dur || isDone) && (
                            <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
                              {isDone ? "Concluída" : ""}{isDone && dur ? " · " : ""}{dur}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
