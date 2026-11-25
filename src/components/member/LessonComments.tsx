import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { shortName, timeAgo } from "@/components/member/courseModel";

type Comment = { id: string; lesson_id: string; user_id: string; parent_id: string | null; content: string; created_at: string };
type Author = { name: string; producer: boolean };

const MAX = 2000;

function Avatar({ name, producer, size = 40 }: { name: string; producer: boolean; size?: number }) {
  const initial = (name.trim()[0] ?? "A").toUpperCase();
  return (
    <span
      aria-hidden
      style={{ height: size, width: size }}
      className={cn("grid shrink-0 place-items-center rounded-full text-[14px] font-extrabold", producer ? "bg-primary text-primary-foreground" : "bg-white/[0.09] text-foreground")}
    >
      {initial}
    </span>
  );
}

function Composer({ value, onChange, onSubmit, busy, placeholder, submitLabel, autoFocus, onCancel }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; busy: boolean; placeholder: string; submitLabel: string; autoFocus?: boolean; onCancel?: () => void;
}) {
  const empty = value.trim().length === 0;
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX))}
        rows={autoFocus ? 2 : 3}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full resize-y rounded-[14px] border border-white/10 bg-background px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      />
      <div className="mt-2.5 flex items-center justify-end gap-2">
        {value.length > MAX - 200 && <span className="mr-auto text-[13px] tabular-nums text-muted-foreground">{value.length}/{MAX}</span>}
        {onCancel && <button type="button" onClick={onCancel} className="h-10 rounded-full px-4 text-[14px] font-semibold text-muted-foreground hover:text-foreground">Cancelar</button>}
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy || empty}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-[14px] font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * Dúvidas e respostas da aula. Os nomes vêm de get_lesson_comment_authors (primeiro nome e inicial,
 * com o selo "Produtor"); sem a função no banco, só o nome do próprio aluno aparece e os outros viram "Aluno".
 */
export function LessonComments({ lessonId, currentUserId, ownerId, ownName }: { lessonId: string; currentUserId: string; ownerId?: string; ownName?: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [authors, setAuthors] = useState<Record<string, Author>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    const { data, error } = await supabase
      .from("lesson_comments")
      .select("id, lesson_id, user_id, parent_id, content, created_at")
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: true })
      .limit(300);
    if (error) { setFailed(true); setLoading(false); return; }
    setComments((data ?? []) as Comment[]);
    const { data: people, error: peopleErr } = await supabase.rpc("get_lesson_comment_authors", { _lesson_id: lessonId });
    if (!peopleErr && Array.isArray(people)) {
      const map: Record<string, Author> = {};
      for (const p of people as { user_id: string; display_name: string | null; is_producer: boolean }[]) map[p.user_id] = { name: shortName(p.display_name), producer: !!p.is_producer };
      setAuthors(map);
    }
    setLoading(false);
  }, [lessonId]);

  useEffect(() => { setComments([]); setContent(""); setReplyTo(null); void load(); }, [load]);

  const author = (uid: string): Author => {
    if (authors[uid]) return authors[uid];
    if (uid === currentUserId) return { name: ownName || "Você", producer: uid === ownerId };
    return { name: uid === ownerId ? "Produtor" : "Aluno", producer: uid === ownerId };
  };

  const submit = async (parent: string | null, body: string) => {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    const { error } = await supabase.from("lesson_comments").insert({ lesson_id: lessonId, user_id: currentUserId, parent_id: parent, content: text });
    setBusy(false);
    if (error) { toast.error("Não foi possível publicar. Tente de novo."); return; }
    if (parent) { setReplyTo(null); setReplyContent(""); } else setContent("");
    void load();
  };

  const remove = async (id: string) => {
    const before = comments;
    setComments((c) => c.filter((x) => x.id !== id && x.parent_id !== id));
    const { error } = await supabase.from("lesson_comments").delete().eq("id", id).eq("user_id", currentUserId);
    if (error) { setComments(before); toast.error("Não foi possível excluir o comentário."); }
  };

  const roots = useMemo(() => comments.filter((c) => !c.parent_id), [comments]);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  const Item = ({ c, small }: { c: Comment; small?: boolean }) => {
    const a = author(c.user_id);
    return (
      <div className="flex gap-3">
        <Avatar name={a.name} producer={a.producer} size={small ? 32 : 40} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[15px] font-bold text-foreground">{a.name}</span>
            {a.producer && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[12px] font-bold text-primary">Produtor</span>}
            <span className="text-[13px] text-muted-foreground">{timeAgo(c.created_at)}</span>
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground/90">{c.content}</p>
          <div className="mt-1.5 flex items-center gap-4">
            {!small && (
              <button type="button" onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyContent(""); }} className="text-[13.5px] font-semibold text-muted-foreground hover:text-foreground">
                Responder
              </button>
            )}
            {c.user_id === currentUserId && (
              <button type="button" onClick={() => void remove(c.id)} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Excluir
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section aria-label="Comentários da aula" className="max-w-[760px]">
      <div className="rounded-[16px] bg-white/[0.05] p-4 sm:p-5">
        <p className="text-[15px] font-bold text-foreground">Tem uma dúvida?</p>
        <p className="mb-3 mt-0.5 text-[13.5px] text-muted-foreground">Pergunte aqui. O produtor e os outros alunos veem e podem responder.</p>
        <Composer value={content} onChange={setContent} onSubmit={() => void submit(null, content)} busy={busy && replyTo === null} placeholder="Escreva sua dúvida ou comentário" submitLabel="Publicar" />
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-4" aria-busy="true">{[0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-[14px] bg-white/[0.05] motion-reduce:animate-none" />)}</div>
        ) : failed ? (
          <div role="alert" className="rounded-[16px] bg-white/[0.04] px-6 py-8 text-center">
            <p className="text-[15px] font-semibold text-foreground">Não foi possível carregar os comentários.</p>
            <button type="button" onClick={() => void load()} className="mt-3 inline-flex h-10 items-center rounded-full bg-white/10 px-5 text-[14px] font-semibold hover:bg-white/15">Tentar de novo</button>
          </div>
        ) : roots.length === 0 ? (
          <div className="flex items-center gap-3 px-1 text-muted-foreground">
            <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
            <p className="text-[14.5px]">Ninguém comentou ainda. Seja o primeiro.</p>
          </div>
        ) : (
          <ul className="space-y-7">
            {roots.map((c) => {
              const replies = repliesOf(c.id);
              return (
                <li key={c.id}>
                  <Item c={c} />
                  {(replies.length > 0 || replyTo === c.id) && (
                    <div className="ml-5 mt-4 space-y-5 border-l border-white/[0.08] pl-5 sm:ml-5">
                      {replies.map((r) => <Item key={r.id} c={r} small />)}
                      {replyTo === c.id && (
                        <Composer value={replyContent} onChange={setReplyContent} onSubmit={() => void submit(c.id, replyContent)} busy={busy} placeholder="Escreva uma resposta" submitLabel="Responder" autoFocus onCancel={() => { setReplyTo(null); setReplyContent(""); }} />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
