import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { FieldHint, FieldLabel } from "@/components/seller-ui/form";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { friendlyError } from "@/lib/friendlyError";
import { PremiumEmpty } from "@/pages/admin/tabs/AdminPremium";
import { NOTES_KEY, callRpc, useRefreshTools } from "./toolsApi";
import { LIMITS, dateLabel, noteAuthor, parseNotes } from "./toolsModel";

/**
 * Notas internas de UM seller, dentro do Sellers 360. Mesmas regras da aba Ferramentas: o seller nunca vê,
 * não se edita nem se apaga, e a equipe com acesso ao seller lê as notas feitas depois do vínculo.
 */
export function SellerNotesSection({ userId }: { userId: string }) {
  const refresh = useRefreshTools();
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const field = `seller-note-${userId}`;

  const list = useQuery({
    queryKey: [...NOTES_KEY, userId],
    queryFn: async () => parseNotes(await callRpc("get_admin_seller_notes", { _seller_id: userId, _limit: 30 })),
  });

  const save = useMutation({
    mutationFn: (content: string) => callRpc("admin_add_seller_note", { _seller_id: userId, _content: content }),
    onSuccess: (raw) => {
      const dup = typeof raw === "object" && raw !== null && (raw as { duplicate?: unknown }).duplicate === true;
      toast.success(dup ? "Essa nota já estava salva." : "Nota salva.");
      setText("");
      refresh();
    },
    onError: (e) => setFieldError(friendlyError(e, "Não foi possível salvar a nota.")),
  });

  const clean = text.trim();
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setFieldError(null);
    if (clean.length < LIMITS.noteMin) return setFieldError(`Escreva pelo menos ${LIMITS.noteMin} caracteres.`);
    save.mutate(clean);
  };

  const items = list.data?.items ?? [];

  return (
    <div className="space-y-4">
      {list.isError && !list.data ? (
        <ErrorBlock title="Não foi possível carregar as notas." error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <p className="flex items-center gap-2 py-4 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando as notas…</p>
      ) : items.length === 0 ? (
        <PremiumEmpty icon={StickyNote} title="Nenhuma nota sobre este seller" subtitle="O que a equipe precisa lembrar sobre ele fica aqui." />
      ) : (
        <ul className="divide-y divide-border/50 overflow-hidden rounded-[12px] border border-border/60" aria-label="Notas sobre o seller">
          {items.map((n) => (
            <li key={n.id} className="space-y-1 px-4 py-3">
              <p className="text-[12.5px] text-muted-foreground">{dateLabel(n.created_at)}, {noteAuthor(n)}</p>
              <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-foreground/90">{n.content}</p>
            </li>
          ))}
        </ul>
      )}
      {list.data && list.data.total > items.length && (
        <p className="text-[12.5px] text-muted-foreground">Mostrando as {items.length.toLocaleString("pt-BR")} mais recentes de {list.data.total.toLocaleString("pt-BR")}. As outras estão em Ferramentas → Notas sobre sellers.</p>
      )}

      <form onSubmit={submit} noValidate className="space-y-3">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <FieldLabel htmlFor={field}>Nova nota</FieldLabel>
            <span className="text-[12.5px] tabular-nums text-muted-foreground">{text.length.toLocaleString("pt-BR")}/{LIMITS.note.toLocaleString("pt-BR")}</span>
          </div>
          <textarea id={field} className="vp-field min-h-[88px] resize-y py-3 leading-relaxed" value={text} maxLength={LIMITS.note}
            onChange={(e) => { setText(e.target.value); setFieldError(null); }} aria-describedby={`${field}-hint`} />
          <div id={`${field}-hint`}>
            <FieldHint>O seller não vê esta nota, e ela não pode ser editada nem apagada depois.</FieldHint>
          </div>
        </div>
        {fieldError && <p role="alert" className="rounded-[12px] bg-destructive/10 px-4 py-3 text-[13.5px] font-medium text-destructive">{fieldError}</p>}
        <button type="submit" className="vp-cta !h-11 gap-2 !px-5" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <StickyNote className="h-4 w-4" aria-hidden />}
          Salvar nota
        </button>
      </form>
    </div>
  );
}
