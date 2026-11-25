import { useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { FieldHint, FieldLabel } from "@/components/seller-ui/form";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { SellerPicker } from "@/features/admin-settings/SellerPicker";
import type { SellerHit } from "@/features/admin-referrals/referralsModel";
import { friendlyError } from "@/lib/friendlyError";
import { PremiumEmpty } from "@/pages/admin/tabs/AdminPremium";
import { NOTES_KEY, callRpc, useRefreshTools } from "./toolsApi";
import { LIMITS, dateLabel, noteAuthor, parseNotes, plural } from "./toolsModel";

/** Nota interna sobre um seller: nunca aparece para ele. Não se edita nem se apaga, e o texto não vai para a auditoria. */
export function NotesPanel() {
  const refresh = useRefreshTools();
  const [seller, setSeller] = useState<SellerHit | null>(null);
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: [...NOTES_KEY, seller?.user_id ?? "all"],
    queryFn: async () => parseNotes(await callRpc("get_admin_seller_notes", { _seller_id: seller?.user_id ?? null, _limit: 30 })),
    placeholderData: keepPreviousData,
  });

  const save = useMutation({
    mutationFn: (a: { seller: SellerHit; content: string }) => callRpc("admin_add_seller_note", { _seller_id: a.seller.user_id, _content: a.content }),
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
    if (!seller) return setFieldError("Escolha o seller da nota.");
    if (clean.length < LIMITS.noteMin) return setFieldError(`Escreva pelo menos ${LIMITS.noteMin} caracteres.`);
    save.mutate({ seller, content: clean });
  };

  const items = list.data?.items ?? [];

  return (
    <div className="space-y-5">
      <form onSubmit={submit} noValidate className="space-y-3.5">
        <SellerPicker id="tools-note-seller" value={seller} onChange={(s) => { setSeller(s); setFieldError(null); }} />
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <FieldLabel htmlFor="tools-note-text">Nota</FieldLabel>
            <span className="text-[12.5px] tabular-nums text-muted-foreground">{text.length.toLocaleString("pt-BR")}/{LIMITS.note.toLocaleString("pt-BR")}</span>
          </div>
          <textarea id="tools-note-text" className="vp-field min-h-[104px] resize-y py-3 leading-relaxed" value={text} maxLength={LIMITS.note}
            onChange={(e) => { setText(e.target.value); setFieldError(null); }} placeholder="Ex.: pediu para adiar a análise de documentos até segunda-feira" aria-describedby="tools-note-hint" />
          <div id="tools-note-hint">
            <FieldHint>O seller não vê esta nota. Quem tem acesso ao seller na equipe vê as notas feitas depois que recebeu o acesso.</FieldHint>
          </div>
        </div>
        {fieldError && <p role="alert" className="rounded-[12px] bg-destructive/10 px-4 py-3 text-[13.5px] font-medium text-destructive">{fieldError}</p>}
        <button type="submit" className="vp-cta !h-11 gap-2 !px-5" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <StickyNote className="h-4 w-4" aria-hidden />}
          Salvar nota
        </button>
      </form>

      <div className="space-y-2.5">
        <p className="text-[13.5px] font-semibold text-foreground">
          {seller ? `Notas de ${seller.name}` : "Notas mais recentes"}
          {list.data && <span className="font-normal text-muted-foreground">{` · ${plural(list.data.total, "nota", "notas")}`}</span>}
        </p>
        {list.isError && !list.data ? (
          <ErrorBlock title="Não foi possível carregar as notas." error={list.error} onRetry={() => void list.refetch()} />
        ) : list.isPending ? (
          <p className="flex items-center gap-2 py-4 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando as notas…</p>
        ) : items.length === 0 ? (
          <PremiumEmpty icon={StickyNote} title={seller ? "Nenhuma nota sobre este seller" : "Nenhuma nota ainda"} subtitle="O que a equipe precisa lembrar sobre um seller fica aqui." />
        ) : (
          <ul className="divide-y divide-border/50 overflow-hidden rounded-[12px] border border-border/60" aria-label="Notas">
            {items.map((n) => (
              <li key={n.id} className="space-y-1 px-4 py-3">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="min-w-0 truncate text-[14px] font-semibold text-foreground">{n.seller_name}</span>
                  <span className="text-[12.5px] text-muted-foreground">{dateLabel(n.created_at)}, {noteAuthor(n)}</span>
                </p>
                <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-foreground/90">{n.content}</p>
              </li>
            ))}
          </ul>
        )}
        {list.data && list.data.total > items.length && <p className="text-[12.5px] text-muted-foreground">Mostrando as {items.length.toLocaleString("pt-BR")} mais recentes de {list.data.total.toLocaleString("pt-BR")}.</p>}
      </div>
    </div>
  );
}
