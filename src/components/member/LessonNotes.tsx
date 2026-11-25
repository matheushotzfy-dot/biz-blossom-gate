import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, StickyNote, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatClock, parseClock } from "@/components/member/courseModel";

type Note = { id: string; content: string; timestamp_seconds: number; created_at: string };

const MAX = 1000;

/** Anotações pessoais do aluno em cada aula (só ele as vê), com o minuto do vídeo se quiser. */
export function LessonNotes({ lessonId, userId }: { lessonId: string; userId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [content, setContent] = useState("");
  const [clock, setClock] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    const { data, error } = await supabase
      .from("lesson_notes")
      .select("id, content, timestamp_seconds, created_at")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .order("timestamp_seconds", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) setFailed(true); else setNotes((data ?? []) as Note[]);
    setLoading(false);
  }, [lessonId, userId]);

  useEffect(() => { setNotes([]); setContent(""); setClock(""); void load(); }, [load]);

  const seconds = parseClock(clock);
  const clockInvalid = seconds === null;
  const canSave = content.trim().length > 0 && !clockInvalid && !saving;

  const add = async () => {
    if (!canSave || seconds === null) return;
    setSaving(true);
    const { error } = await supabase.from("lesson_notes").insert({ user_id: userId, lesson_id: lessonId, content: content.trim().slice(0, MAX), timestamp_seconds: seconds });
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar a anotação. Tente de novo."); return; }
    setContent("");
    setClock("");
    void load();
  };

  const remove = async (id: string) => {
    const before = notes;
    setNotes((n) => n.filter((x) => x.id !== id));
    const { error } = await supabase.from("lesson_notes").delete().eq("id", id).eq("user_id", userId);
    if (error) { setNotes(before); toast.error("Não foi possível excluir a anotação."); }
  };

  return (
    <section aria-label="Minhas anotações" className="max-w-[760px]">
      <div className="rounded-[16px] bg-white/[0.05] p-4 sm:p-5">
        <label htmlFor="note-text" className="text-[15px] font-bold text-foreground">Nova anotação</label>
        <p className="mt-0.5 text-[13.5px] text-muted-foreground">Só você vê. Marque o minuto do vídeo se quiser voltar nele depois.</p>
        <textarea
          id="note-text"
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX))}
          rows={3}
          placeholder="O que você quer lembrar desta aula?"
          className="mt-3 w-full resize-y rounded-[14px] border border-white/10 bg-background px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        />
        <div className="mt-3 flex flex-wrap items-start gap-3">
          <div>
            <label htmlFor="note-clock" className="sr-only">Minuto do vídeo (opcional)</label>
            <input
              id="note-clock"
              value={clock}
              onChange={(e) => setClock(e.target.value.replace(/[^\d:]/g, "").slice(0, 8))}
              inputMode="numeric"
              placeholder="Minuto (ex.: 4:30)"
              aria-invalid={clockInvalid}
              aria-describedby={clockInvalid ? "note-clock-err" : undefined}
              className="h-11 w-[170px] rounded-full border border-white/10 bg-background px-4 text-[14.5px] tabular-nums text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            {clockInvalid && <p id="note-clock-err" className="mt-1 text-[13px] text-destructive">Use o formato 4:30.</p>}
          </div>
          <button
            type="button"
            onClick={() => void add()}
            disabled={!canSave}
            className="ml-auto inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-[14.5px] font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            Salvar anotação
          </button>
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3" aria-busy="true">{[0, 1].map((i) => <div key={i} className="h-16 animate-pulse rounded-[14px] bg-white/[0.05] motion-reduce:animate-none" />)}</div>
        ) : failed ? (
          <div role="alert" className="rounded-[16px] bg-white/[0.04] px-6 py-8 text-center">
            <p className="text-[15px] font-semibold text-foreground">Não foi possível carregar suas anotações.</p>
            <button type="button" onClick={() => void load()} className="mt-3 inline-flex h-10 items-center rounded-full bg-white/10 px-5 text-[14px] font-semibold hover:bg-white/15">Tentar de novo</button>
          </div>
        ) : notes.length === 0 ? (
          <div className="flex items-center gap-3 px-1 text-muted-foreground">
            <StickyNote className="h-5 w-5 shrink-0" aria-hidden />
            <p className="text-[14.5px]">Você ainda não anotou nada nesta aula.</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {notes.map((n) => (
              <li key={n.id} className="flex items-start gap-3 rounded-[14px] bg-white/[0.04] py-3.5 pl-4 pr-2">
                {n.timestamp_seconds > 0 && <span className="mt-px shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-[12.5px] font-bold tabular-nums text-primary">{formatClock(n.timestamp_seconds)}</span>}
                <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground/90">{n.content}</p>
                <button type="button" onClick={() => void remove(n.id)} aria-label="Excluir anotação" title="Excluir" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-[17px] w-[17px]" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
