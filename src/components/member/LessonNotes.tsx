/**
 * LessonNotes — Personal student notes per lesson.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StickyNote, Trash2, Clock, Plus } from "lucide-react";

type Note = { id: string; content: string; timestamp_seconds: number; created_at: string };

interface Props {
  lessonId: string;
  userId: string;
}

function formatTs(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function LessonNotes({ lessonId, userId }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [content, setContent] = useState("");
  const [ts, setTs] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load();   }, [lessonId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("lesson_notes")
      .select("id, content, timestamp_seconds, created_at")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .order("timestamp_seconds", { ascending: true });
    setNotes((data || []) as Note[]);
    setLoading(false);
  }

  async function add() {
    const trimmed = content.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("lesson_notes").insert({
      user_id: userId, lesson_id: lessonId, content: trimmed, timestamp_seconds: ts,
    });
    if (error) { toast.error("Erro ao salvar nota"); return; }
    setContent("");
    setTs(0);
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("lesson_notes").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    setNotes(n => n.filter(x => x.id !== id));
  }

  return (
    <div className="mt-6 rounded-xl border border-border/15 bg-card/30 p-5">
      <div className="flex items-center gap-2 mb-3">
        <StickyNote className="h-4 w-4 text-warning" />
        <h3 className="font-display font-black text-foreground text-sm tracking-tight">Minhas anotações</h3>
        <span className="text-[11px] text-muted-foreground/60 font-display font-bold">({notes.length})</span>
      </div>

      <div className="flex gap-2 mb-3">
        <div className="flex items-center gap-1.5 px-2.5 rounded-md border border-border/15 bg-background/50">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="number"
            min={0}
            value={ts}
            onChange={e => setTs(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-14 bg-transparent text-xs font-mono text-foreground outline-none py-2"
            placeholder="0"
          />
          <span className="text-[10px] text-muted-foreground/60 font-mono">s</span>
        </div>
        <input
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") add(); }}
          placeholder="Escreva uma anotação para revisitar depois..."
          className="flex-1 px-3 rounded-md border border-border/15 bg-background/50 text-sm font-display text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50"
        />
        <button onClick={add} disabled={!content.trim()} className="px-3 rounded-md bg-primary text-primary-foreground font-display font-black text-xs hover:bg-primary/90 disabled:opacity-40 flex items-center gap-1">
          <Plus className="h-3.5 w-3.5" /> Salvar
        </button>
      </div>

      {loading ? null : notes.length === 0 ? (
        <p className="text-xs text-muted-foreground/50 italic font-display py-3 text-center">Nenhuma anotação ainda. Marque os pontos importantes da aula.</p>
      ) : (
        <ul className="space-y-1.5">
          {notes.map(n => (
            <li key={n.id} className="group flex items-start gap-2 px-3 py-2 rounded-md bg-background/40 border border-border/10 hover:border-border/30 transition-colors">
              <span className="text-[10px] font-mono text-primary font-bold mt-0.5 shrink-0">{formatTs(n.timestamp_seconds)}</span>
              <p className="flex-1 text-xs font-display text-foreground/90 break-words">{n.content}</p>
              <button onClick={() => remove(n.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
