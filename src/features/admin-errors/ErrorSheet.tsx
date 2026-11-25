import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Copy, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogFoot, DialogHead, dialogBox } from "@/components/seller-ui/form";
import { dateLabel } from "@/features/admin-disputes/disputesModel";
import { Info } from "@/features/admin-disputes/parts";
import { accountLabel } from "@/features/admin-referrals/referralsModel";
import { Block, Figure, ToneTag } from "@/features/admin-products/parts";
import { friendlyError } from "@/lib/friendlyError";
import { ERROR_DETAIL_KEY, callRpc, useSetResolved } from "./errorsApi";
import { agoLabel, areaInfo, dayLabel, deviceLabel, firstFrame, kindLabel, parseErrorDetail, reportText, timesLabel, type ErrDetail, type ErrItem } from "./errorsModel";

function Loading() {
  return <p className="flex items-center gap-2 py-8 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando o erro…</p>;
}
function Failed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <p role="alert" className="py-6 text-[14px] font-medium text-destructive">
      {friendlyError(error, "Não foi possível carregar o erro.")} <button type="button" className="underline" onClick={onRetry}>Tentar de novo</button>
    </p>
  );
}

/** Um erro por inteiro: o que aconteceu, onde, quantas vezes, quem viu e a pilha para quem for consertar. */
export function ErrorSheet({ id, seed, onClose }: { id: string | null; seed: ErrItem | null; onClose: () => void }) {
  // guarda o último erro para o texto não sumir durante a animação de fechar
  const [last, setLast] = useState<{ id: string; seed: ErrItem | null } | null>(id ? { id, seed } : null);
  useEffect(() => { if (id) setLast({ id, seed }); }, [id, seed]);
  const cur = id ? { id, seed } : last;
  return (
    <Dialog open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={dialogBox("xl")}>{cur && <Body key={cur.id} id={cur.id} seed={cur.seed} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function Body({ id, seed, onClose }: { id: string; seed: ErrItem | null; onClose: () => void }) {
  const set = useSetResolved();
  const q = useQuery({
    queryKey: [...ERROR_DETAIL_KEY, id],
    queryFn: async () => parseErrorDetail(await callRpc("get_admin_error_log_detail", { _id: id })),
  });
  const d = q.data;
  const resolved = d?.resolved ?? seed?.resolved ?? false;
  const context = d ? (typeof d.metadata.context === "string" ? d.metadata.context : null) : seed?.context ?? null;

  const copy = async () => {
    if (!d) return;
    try { await navigator.clipboard.writeText(reportText(d)); toast.success("Relatório copiado."); }
    catch { toast.error("Não foi possível copiar. Selecione o texto e copie à mão."); }
  };

  return (
    <>
      <DialogHead icon={<AlertTriangle className="h-5 w-5" />} title={kindLabel(context, d?.error_type ?? seed?.error_type)}
        subtitle={d ? `${areaInfo(d.area).label} · ${timesLabel(d.occurrences)}` : seed ? `${areaInfo(seed.area).label} · ${timesLabel(seed.occurrences)}` : "Erro registrado"}
        aside={<ToneTag tone={resolved ? "success" : "destructive"}>{resolved ? "Resolvido" : "Aberto"}</ToneTag>} />
      <div className="flex min-h-0 flex-1 flex-col">
        <DialogBody>
          {q.isPending ? <Loading /> : q.isError || !d ? <Failed error={q.error} onRetry={() => void q.refetch()} /> : <DetailView d={d} />}
        </DialogBody>
        <DialogFoot>
          <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose}>Fechar</button>
          <button type="button" className="vp-ghost !h-12 justify-center gap-2" onClick={() => void copy()} disabled={!d}><Copy className="h-4 w-4" /> Copiar relatório</button>
          <button type="button" className="vp-cta !h-12 justify-center gap-2 sm:min-w-[170px]" disabled={!d || set.isPending} onClick={() => d && set.mutate({ id: d.id, resolved: !d.resolved })}>
            {set.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : d?.resolved ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {d?.resolved ? "Reabrir" : "Marcar como resolvido"}
          </button>
        </DialogFoot>
      </div>
    </>
  );
}

function DetailView({ d }: { d: ErrDetail }) {
  const ua = typeof d.metadata.ua === "string" ? d.metadata.ua : null;
  const context = typeof d.metadata.context === "string" ? d.metadata.context : null;
  const frame = firstFrame(d.stack_trace);
  const extra = Object.entries(d.metadata).filter(([k]) => k !== "ua");

  return (
    <>
      {d.resolved ? (
        <div className="rounded-[14px] bg-success/10 px-4 py-3 text-[14px] font-medium text-success">
          Resolvido{d.resolved_by ? ` por ${d.resolved_by}` : ""}{d.resolved_at ? ` em ${dateLabel(d.resolved_at)}` : ""}. Se o mesmo erro voltar, ele reabre sozinho e soma mais uma vez.
        </div>
      ) : d.occurrences >= 10 ? (
        <div className="rounded-[14px] bg-warning/10 px-4 py-3 text-[14px] font-medium text-warning">Este erro já aconteceu {timesLabel(d.occurrences)}. Vale olhar antes dos outros.</div>
      ) : null}

      <Block title="O que aconteceu">
        <p className="whitespace-pre-wrap break-words rounded-[14px] bg-muted/40 px-4 py-3 text-[14px] font-semibold leading-relaxed text-foreground">{d.message}</p>
        {frame && <p className="mt-2 break-words text-[12.5px] text-muted-foreground">Estourou em: {frame}</p>}
      </Block>

      <Block title="Quantas vezes">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
          <Figure label="Vezes" value={d.occurrences.toLocaleString("pt-BR")} sub={d.occurrences === 1 ? "só esta" : "repetições somadas"} tone={d.occurrences >= 10 && !d.resolved ? "warning" : undefined} />
          <Figure label="Primeira vez" value={dayLabel(d.created_at)} sub={agoLabel(d.created_at)} />
          <Figure label="Última vez" value={agoLabel(d.last_seen_at)} sub={dateLabel(d.last_seen_at)} />
        </div>
      </Block>

      <Block title="Onde aconteceu">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
          <Info label="Página">{d.route ?? "Não registrada"}</Info>
          <Info label="Parte do site">{areaInfo(d.area).long}</Info>
          <Info label="Origem">{kindLabel(context, d.error_type)}</Info>
          <Info label="Navegador">{deviceLabel(ua)}</Info>
        </div>
      </Block>

      <Block title="Quem viu" aside={d.occurrences > 1 ? "conta do 1º registro" : undefined}>
        {d.user ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
            <Info label="Conta">{d.user.name}</Info>
            <Info label="E-mail">{d.user.email ?? "—"}</Info>
            <Info label="Situação da conta">{accountLabel(d.user.account_status)}</Info>
          </div>
        ) : <p className="text-[13.5px] text-muted-foreground">Visitante sem login: o erro aconteceu numa página aberta sem conta.</p>}
        {d.user && d.occurrences > 1 && <p className="mt-3 text-[12.5px] text-muted-foreground">As outras {(d.occurrences - 1).toLocaleString("pt-BR")} {d.occurrences - 1 === 1 ? "vez pode" : "vezes podem"} ter sido com outras pessoas.</p>}
      </Block>

      <Block title="Pilha do erro" aside={d.stack_trace ? "onde o código estourou" : undefined}>
        {d.stack_trace
          ? <pre tabIndex={0} aria-label="Pilha do erro" className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-[14px] bg-muted/40 px-4 py-3 font-mono text-[12px] leading-relaxed text-foreground/90">{d.stack_trace}</pre>
          : <p className="text-[13.5px] text-muted-foreground">O navegador não enviou a pilha deste erro.</p>}
      </Block>

      {extra.length > 0 && (
        <details className="group rounded-[14px] bg-muted/30 px-4 py-3">
          <summary className="cursor-pointer text-[13.5px] font-semibold text-foreground">Dados técnicos gravados</summary>
          <pre tabIndex={0} aria-label="Dados técnicos" className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-muted-foreground">{JSON.stringify(Object.fromEntries(extra), null, 2)}</pre>
        </details>
      )}
    </>
  );
}
