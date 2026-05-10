/**
 * LessonComments — Q&A panel for lessons
 * Students post questions, replies, and the lesson owner can moderate.
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Send, Trash2, CornerDownRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;

type Comment = {
  id: string;
  lesson_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  author_name?: string;
};

type Profile = { user_id: string; full_name: string | null; nickname: string | null };

export function LessonComments({ lessonId, currentUserId }: { lessonId: string; currentUserId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("lesson_comments")
      .select("id, lesson_id, user_id, parent_id, content, created_at")
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: true });
    const list = (data || []) as Comment[];
    setComments(list);
    const userIds = [...new Set(list.map((c) => c.user_id))];
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, nickname")
        .in("user_id", userIds);
      const map = new Map<string, Profile>();
      (profs || []).forEach((p) => map.set(p.user_id, p as Profile));
      setProfiles(map);
    }
    setLoading(false);
  }, [lessonId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (parent: string | null, body: string) => {
    const trimmed = body.trim();
    if (trimmed.length < 1) return;
    setSubmitting(true);
    const { error } = await supabase.from("lesson_comments").insert({
      lesson_id: lessonId,
      user_id: currentUserId,
      parent_id: parent,
      content: trimmed,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível enviar seu comentário.");
      return;
    }
    if (parent) {
      setReplyTo(null);
      setReplyContent("");
    } else {
      setContent("");
    }
    toast.success("Comentário publicado.");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("lesson_comments").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir.");
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== id && c.parent_id !== id));
  };

  const nameOf = (uid: string) => {
    const p = profiles.get(uid);
    return (p?.full_name?.trim() || p?.nickname?.trim() || "Aluno").slice(0, 60);
  };

  const initials = (uid: string) =>
    nameOf(uid)
      .split(" ")
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "agora";
    if (m < 60) return `${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d`;
    return new Date(iso).toLocaleDateString("pt-BR");
  };

  const roots = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  return (
    <div className="rounded-[2rem] bg-zinc-900/50 border border-white/5 overflow-hidden">
      <div className="px-10 py-8 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-emerald-500" />
          </div>
          <h4 className="text-sm font-black text-white uppercase tracking-widest">
            Comunidade & Suporte
          </h4>
        </div>
        <span className="text-xs text-zinc-600 font-mono font-bold tracking-tight">
          {comments.length} interações
        </span>
      </div>

      {/* New comment box */}
      <div className="p-10 border-b border-white/5 bg-white/[0.01]">
        <div className="flex gap-6">
          <div className="h-12 w-12 rounded-2xl bg-zinc-800 border border-white/5 text-zinc-400 text-xs font-black flex items-center justify-center shrink-0">
            VOCÊ
          </div>
          <div className="flex-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Alguma dúvida sobre o conteúdo desta aula? Pergunte aqui..."
              rows={3}
              className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-[15px] text-zinc-100 placeholder:text-zinc-700 font-medium focus:outline-none focus:border-emerald-500/50 resize-none transition-all"
            />
            <div className="flex items-center justify-between mt-4">
              <span className="text-[10px] text-zinc-700 font-mono font-bold tracking-widest">
                {content.length} / 2000
              </span>
              <button
                onClick={() => submit(null, content)}
                disabled={submitting || content.trim().length < 1}
                className={cn(
                  "flex items-center gap-2.5 px-8 py-3 rounded-xl text-sm font-black transition-all active:scale-95",
                  content.trim().length < 1
                    ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                    : "bg-white text-black hover:bg-zinc-200",
                )}
              >
                {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Publicar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Comments list */}
      <div className="p-5 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 text-muted-foreground/30 animate-spin" />
          </div>
        ) : roots.length === 0 ? (
          <div className="text-center py-8">
            <div className="h-10 w-10 rounded-xl bg-foreground/[0.03] flex items-center justify-center mx-auto mb-2">
              <MessageCircle className="h-4 w-4 text-muted-foreground/20" />
            </div>
            <p className="text-xs text-muted-foreground/40 font-display">
              Seja o primeiro a comentar nesta aula.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {roots.map((c) => {
                const replies = repliesOf(c.id);
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease }}
                    className="space-y-3"
                  >
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary text-[10px] font-display font-black flex items-center justify-center shrink-0">
                        {initials(c.user_id)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-display font-bold text-foreground">
                            {nameOf(c.user_id)}
                          </span>
                          <span className="text-[10px] text-muted-foreground/30 font-display tabular-nums">
                            {timeAgo(c.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/70 font-display whitespace-pre-wrap mt-0.5 break-words">
                          {c.content}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <button
                            onClick={() => {
                              setReplyTo(replyTo === c.id ? null : c.id);
                              setReplyContent("");
                            }}
                            className="text-[10px] font-display font-bold text-muted-foreground/40 hover:text-primary transition-colors"
                          >
                            Responder
                          </button>
                          {c.user_id === currentUserId && (
                            <button
                              onClick={() => remove(c.id)}
                              className="text-[10px] font-display font-bold text-muted-foreground/40 hover:text-destructive transition-colors flex items-center gap-1"
                            >
                              <Trash2 className="h-2.5 w-2.5" /> Excluir
                            </button>
                          )}
                        </div>

                        {replyTo === c.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-2 overflow-hidden"
                          >
                            <textarea
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              placeholder="Escreva uma resposta…"
                              rows={2}
                              autoFocus
                              className="w-full bg-foreground/[0.03] border border-border/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/30 font-display focus:outline-none focus:border-primary/30 resize-none"
                            />
                            <div className="flex items-center justify-end gap-2 mt-1.5">
                              <button
                                onClick={() => {
                                  setReplyTo(null);
                                  setReplyContent("");
                                }}
                                className="text-[10px] font-display font-bold text-muted-foreground/40 hover:text-foreground px-2 py-1"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => submit(c.id, replyContent)}
                                disabled={submitting || replyContent.trim().length < 1}
                                className={cn(
                                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-display font-bold transition-all active:scale-95",
                                  replyContent.trim().length < 1
                                    ? "bg-foreground/5 text-muted-foreground/30"
                                    : "bg-foreground text-background hover:bg-foreground/90",
                                )}
                              >
                                {submitting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Send className="h-2.5 w-2.5" />}
                                Responder
                              </button>
                            </div>
                          </motion.div>
                        )}

                        {/* Replies */}
                        {replies.length > 0 && (
                          <div className="mt-3 pl-3 border-l border-border/10 space-y-2.5">
                            {replies.map((r) => (
                              <div key={r.id} className="flex gap-2">
                                <CornerDownRight className="h-3 w-3 text-muted-foreground/20 mt-1 shrink-0" />
                                <div className="h-6 w-6 rounded-md bg-primary/8 text-primary text-[9px] font-display font-black flex items-center justify-center shrink-0">
                                  {initials(r.user_id)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-[11px] font-display font-bold text-foreground">
                                      {nameOf(r.user_id)}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground/30 font-display tabular-nums">
                                      {timeAgo(r.created_at)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-foreground/65 font-display whitespace-pre-wrap mt-0.5 break-words">
                                    {r.content}
                                  </p>
                                  {r.user_id === currentUserId && (
                                    <button
                                      onClick={() => remove(r.id)}
                                      className="text-[9px] font-display font-bold text-muted-foreground/40 hover:text-destructive transition-colors flex items-center gap-1 mt-1"
                                    >
                                      <Trash2 className="h-2.5 w-2.5" /> Excluir
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
