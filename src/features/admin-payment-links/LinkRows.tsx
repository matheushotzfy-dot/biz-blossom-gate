import { ExternalLink, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brl } from "@/features/admin-finance/types";
import { fmtDateTime } from "@/features/admin-finance/format";
import { cn } from "@/lib/utils";
import { ACTION_LABEL, linkSituation, moderationActions, publicLinkUrl, type LinkRow, type ModerationAction } from "./linksModel";

export interface LinkContext {
  busy: boolean;
  onEvents: (l: LinkRow) => void;
  onAction: (l: LinkRow, a: ModerationAction) => void;
}

const TONE: Record<string, string> = {
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  destructive: "border-destructive/25 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted/40 text-muted-foreground",
};

export function SituationBadges({ l }: { l: LinkRow }) {
  const s = linkSituation(l);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={cn("rounded-full border px-2.5 py-0.5 text-[12px] font-semibold", TONE[s.tone])}>{s.label}</span>
      {l.admin_status === "review" && <span className={cn("rounded-full border px-2.5 py-0.5 text-[12px] font-semibold", TONE.warning)}>Em revisão</span>}
    </span>
  );
}

function Actions({ l, ctx }: { l: LinkRow; ctx: LinkContext }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]" onClick={() => ctx.onEvents(l)} aria-label={`Ver histórico do link ${l.title}`}>
        <History className="h-3.5 w-3.5" /> Histórico
      </Button>
      <a href={publicLinkUrl(l.slug)} target="_blank" rel="noopener noreferrer" aria-label={`Abrir o link ${l.title} em outra aba`}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[12px] font-medium text-foreground/80 hover:bg-muted/40">
        <ExternalLink className="h-3.5 w-3.5" /> Abrir
      </a>
      {moderationActions(l).map((a) => (
        <Button key={a} type="button" size="sm" variant="outline" disabled={ctx.busy}
          className={cn("h-8 text-[12px]", a === "block" && "border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive")} onClick={() => ctx.onAction(l, a)} aria-label={`${ACTION_LABEL[a]}: ${l.title}`}>
          {ACTION_LABEL[a]}
        </Button>
      ))}
    </div>
  );
}

const Seller = ({ l }: { l: LinkRow }) => (
  <>
    <p className="truncate text-[13px] text-foreground/90">{l.seller_name || l.seller_email || `Conta ${l.user_id.slice(0, 8)}`}</p>
    {l.seller_name && <p className="truncate text-[12px] text-muted-foreground">{l.seller_email}</p>}
  </>
);

const Revenue = ({ l }: { l: LinkRow }) => (
  <>
    <p className="text-[13.5px] font-bold tabular-nums text-foreground">{brl(l.net_revenue)}</p>
    <p className="text-[12px] text-muted-foreground">{l.pending_count > 0 ? `${l.pending_count} ${l.pending_count === 1 ? "pagamento pendente" : "pagamentos pendentes"}` : "Nenhum pagamento pendente"}</p>
  </>
);

const BlockReason = ({ l }: { l: LinkRow }) => (l.admin_status === "blocked" && l.admin_block_reason
  ? <p className="mt-1 max-w-[320px] text-[12px] text-destructive/90">Motivo: {l.admin_block_reason}</p> : null);

export function LinkTable({ rows, ctx }: { rows: LinkRow[]; ctx: LinkContext }) {
  return (
    <div className="hidden overflow-x-auto rounded-[12px] border border-border/60 xl:block">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-muted/25 text-[12px] font-medium text-muted-foreground">
            {["Link", "Vendedor", "Situação", "Receita líquida", "Ações"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} className="border-b border-border/40 align-top last:border-b-0">
              <td className="max-w-[300px] px-4 py-3.5">
                <p className="truncate text-[13px] font-semibold text-foreground">{l.title}</p>
                <p className="truncate font-mono text-[11.5px] text-muted-foreground">/pl/{l.slug}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">Criado em {fmtDateTime(l.created_at)}</p>
                <BlockReason l={l} />
              </td>
              <td className="max-w-[220px] px-4 py-3.5"><Seller l={l} /></td>
              <td className="px-4 py-3.5"><SituationBadges l={l} /></td>
              <td className="whitespace-nowrap px-4 py-3.5"><Revenue l={l} /></td>
              <td className="min-w-[250px] px-4 py-3.5"><Actions l={l} ctx={ctx} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LinkCards({ rows, ctx }: { rows: LinkRow[]; ctx: LinkContext }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))] xl:hidden">
      {rows.map((l) => (
        <li key={l.id} className="flex min-w-0 flex-col gap-3 rounded-[12px] border border-border/60 p-4">
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold text-foreground">{l.title}</p>
            <p className="truncate font-mono text-[11.5px] text-muted-foreground">/pl/{l.slug}</p>
          </div>
          <SituationBadges l={l} />
          <BlockReason l={l} />
          <div className="min-w-0"><Seller l={l} /></div>
          <div><Revenue l={l} /></div>
          <p className="text-[12px] text-muted-foreground">Criado em {fmtDateTime(l.created_at)}</p>
          <div className="border-t border-border/40 pt-3"><Actions l={l} ctx={ctx} /></div>
        </li>
      ))}
    </ul>
  );
}
