import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Copy, Loader2, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogFoot, DialogHead, dialogBox } from "@/components/seller-ui/form";
import { copyText } from "@/components/seller-ui/copy";
import { Info } from "@/features/admin-disputes/parts";
import { fmtDateTime } from "@/features/admin-finance/format";
import { Block, ToneTag } from "@/features/admin-products/parts";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { AUDIT_ENTRY_KEY, callRpc } from "./auditApi";
import {
  actionLabel, actorName, agoLabel, deviceLabel, fieldLabel, isEmptyDetail, isHidden, parseAuditEntry, reportText, roleLabel, sortedEntries, sourceLabel, targetLine, valueText,
  type AuditDetail, type AuditEntry, type AuditItem, type SourceKey,
} from "./auditModel";

export interface AuditTarget { source: SourceKey; id: string }

function Loading() {
  return <p className="flex items-center gap-2 py-8 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando o registro…</p>;
}
function Failed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <p role="alert" className="py-6 text-[14px] font-medium text-destructive">
      {friendlyError(error, "Não foi possível carregar o registro.")} <button type="button" className="underline" onClick={onRetry}>Tentar de novo</button>
    </p>
  );
}

/** Um registro por inteiro: quem fez, em quê, de onde, o que mudou (sem segredos) e as últimas ações no mesmo alvo. */
export function AuditSheet({ target, seed, onClose, onJump }: { target: AuditTarget | null; seed: AuditItem | null; onClose: () => void; onJump: (t: AuditTarget) => void }) {
  // guarda o último registro para o texto não sumir durante a animação de fechar
  const [last, setLast] = useState<{ t: AuditTarget; seed: AuditItem | null } | null>(target ? { t: target, seed } : null);
  useEffect(() => { if (target) setLast({ t: target, seed }); }, [target, seed]);
  const cur = target ? { t: target, seed } : last;
  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={dialogBox("xl")}>{cur && <Body key={`${cur.t.source}:${cur.t.id}`} t={cur.t} seed={cur.seed} onClose={onClose} onJump={onJump} />}</DialogContent>
    </Dialog>
  );
}

function Body({ t, seed, onClose, onJump }: { t: AuditTarget; seed: AuditItem | null; onClose: () => void; onJump: (t: AuditTarget) => void }) {
  const q = useQuery({
    queryKey: [...AUDIT_ENTRY_KEY, t.source, t.id],
    queryFn: async () => parseAuditEntry(await callRpc("get_admin_audit_entry", { _source: t.source, _id: t.id })),
    retry: false,
  });
  const e = q.data;
  const head = e ?? seed;
  return (
    <>
      <DialogHead icon={head?.sensitive ? <ShieldAlert className="h-5 w-5" /> : <Activity className="h-5 w-5" />}
        title={head ? actionLabel(head.action, head.entity_type) : "Registro da auditoria"}
        subtitle={head ? `${sourceLabel(head.source)} · ${fmtDateTime(head.at)}` : "Carregando…"}
        aside={head?.sensitive ? <ToneTag tone="warning">Sensível</ToneTag> : undefined} />
      <div className="flex min-h-0 flex-1 flex-col">
        <DialogBody>
          {q.isPending ? <Loading /> : q.isError || !e ? <Failed error={q.error} onRetry={() => void q.refetch()} /> : <View e={e} onJump={onJump} />}
        </DialogBody>
        <DialogFoot>
          <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose}>Fechar</button>
          <button type="button" className="vp-ghost !h-12 justify-center gap-2" disabled={!e} onClick={() => e && void copyText(reportText(e), "Relatório copiado.")}>
            <Copy className="h-4 w-4" aria-hidden /> Copiar relatório
          </button>
        </DialogFoot>
      </div>
    </>
  );
}

const Val = ({ k, v }: { k: string; v: unknown }) => (
  <span className={cn("break-words", isHidden(v) || v === null || v === "" ? "italic text-muted-foreground" : "font-semibold text-foreground")}>{valueText(k, v)}</span>
);

function Changes({ d }: { d: AuditDetail }) {
  const changes = sortedEntries(d.changes);
  const fields = sortedEntries(d.fields);
  const snap = sortedEntries(d.snapshot);
  return (
    <div className="space-y-4">
      {changes.length > 0 && (
        <ul aria-label="Campos que mudaram" className="divide-y divide-border/40 rounded-[14px] bg-muted/30">
          {changes.map(([k, c]) => (
            <li key={k} className="grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-1 px-4 py-3 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)_minmax(0,1fr)]">
              <p className="text-[13.5px] font-semibold text-foreground">{fieldLabel(k)}</p>
              {isHidden(c.from) && isHidden(c.to)
                ? <p className="text-[13.5px] italic text-muted-foreground md:col-span-2">Mudou, mas o valor não é mostrado aqui.</p>
                : <>
                    <p className="min-w-0 text-[13.5px]"><span className="text-muted-foreground">Antes: </span><Val k={k} v={c.from} /></p>
                    <p className="min-w-0 text-[13.5px]"><span className="text-muted-foreground">Depois: </span><Val k={k} v={c.to} /></p>
                  </>}
            </li>
          ))}
        </ul>
      )}
      {snap.length > 0 && (
        <div>
          <p className="mb-2 text-[13px] text-muted-foreground">
            {d.snapshot_of === "before" ? "Como o registro estava antes de a ação acontecer." : "Como o registro ficou depois da ação."}
          </p>
          <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
            {snap.map(([k, v]) => <Info key={k} label={fieldLabel(k)}><Val k={k} v={v} /></Info>)}
          </dl>
        </div>
      )}
      {fields.length > 0 && (
        <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
          {fields.map(([k, v]) => <Info key={k} label={fieldLabel(k)}><Val k={k} v={v} /></Info>)}
        </dl>
      )}
    </div>
  );
}

function View({ e, onJump }: { e: AuditEntry; onJump: (t: AuditTarget) => void }) {
  const tl = targetLine(e);
  const empty = isEmptyDetail(e.detail);
  return (
    <>
      {e.sensitive && (
        <div className="rounded-[14px] bg-warning/10 px-4 py-3 text-[14px] font-medium text-warning">
          Ação sensível: mexe com dinheiro, acesso ou dados pessoais de alguém.
        </div>
      )}

      <Block title="Quem fez">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
          <Info label="Nome">{actorName(e.actor)}</Info>
          <Info label="Função">{roleLabel(e.actor.role)}</Info>
          <Info label="E-mail">{e.actor.email ?? "Não registrado"}</Info>
          <Info label="Quando">{fmtDateTime(e.at)} <span className="font-normal text-muted-foreground">({agoLabel(e.at)})</span></Info>
          {e.source === "admin" && <Info label="IP">{e.ip ?? "Não registrado"}</Info>}
          {e.source === "admin" && <Info label="Navegador">{deviceLabel(e.user_agent)}</Info>}
        </div>
        {!e.actor.name && e.actor.id && <p className="mt-3 text-[12.5px] text-muted-foreground">A conta de quem fez não existe mais no cadastro (código {e.actor.id.slice(0, 8)}).</p>}
      </Block>

      <Block title="Em quê">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
          <Info label="Alvo">{tl.title}</Info>
          <Info label="Tipo">{tl.sub ?? "—"}</Info>
          {e.entity_id && <Info label="Código" className="md:col-span-2"><span className="break-all font-mono text-[13px] font-medium">{e.entity_id}</span></Info>}
          <Info label="Código da ação" className="md:col-span-2"><span className="break-all font-mono text-[13px] font-medium">{e.action}</span></Info>
        </div>
      </Block>

      <Block title="O que mudou" aside={!empty ? "senhas, chaves e documentos nunca aparecem" : undefined}>
        {empty || !e.detail
          ? <p className="text-[13.5px] text-muted-foreground">{e.detail?.changes ? "Nenhum campo relevante mudou." : "Esta ação não gravou mais detalhes."}</p>
          : <Changes d={e.detail} />}
      </Block>

      {e.related.length > 0 && (
        <Block title="Outras ações neste alvo" aside="as mais recentes">
          <ul className="divide-y divide-border/40 rounded-[14px] bg-muted/30">
            {e.related.map((r) => (
              <li key={`${r.source}:${r.id}`}>
                <button type="button" onClick={() => onJump({ source: r.source, id: r.id })}
                  className="vp-r12 flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-foreground">{actionLabel(r.action, e.entity_type)}</span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">{r.actor_name ?? "Conta removida"}</span>
                  </span>
                  <span className="shrink-0 text-[12.5px] text-muted-foreground">{agoLabel(r.at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Block>
      )}
    </>
  );
}
