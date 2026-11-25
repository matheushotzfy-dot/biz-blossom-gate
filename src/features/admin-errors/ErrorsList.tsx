import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToneTag } from "@/features/admin-disputes/parts";
import { cn } from "@/lib/utils";
import { agoLabel, areaInfo, dayLabel, kindLabel, timesLabel, userLabel, type ErrItem } from "./errorsModel";

const TH = "whitespace-nowrap px-3 py-3";

const What = ({ r, withTimes = false }: { r: ErrItem; withTimes?: boolean }) => (
  <div className="flex min-w-0 items-start gap-3">
    <span aria-hidden className={cn("mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-[14px]", r.resolved ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
      {r.resolved ? <CheckCircle2 className="h-[18px] w-[18px]" /> : <AlertTriangle className="h-[18px] w-[18px]" />}
    </span>
    <div className="min-w-0">
      <p className="line-clamp-2 break-words text-[14px] font-semibold leading-snug text-foreground" title={r.message}>{r.message}</p>
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <p className="truncate text-[12.5px] text-muted-foreground">{kindLabel(r.context, r.error_type)}</p>
        {withTimes && <Times r={r} />}
      </div>
    </div>
  </div>
);

const Where = ({ r }: { r: ErrItem }) => (
  <>
    <p className="truncate text-[14px] font-semibold text-foreground">{areaInfo(r.area).label}</p>
    <p className="truncate text-[12.5px] text-muted-foreground" title={r.route ?? undefined}>{r.route ?? "Página não registrada"}</p>
  </>
);

const Who = ({ r }: { r: ErrItem }) => (
  <>
    <p className={cn("truncate text-[14px]", r.user_id ? "font-semibold text-foreground" : "text-muted-foreground")} title={userLabel(r)}>{userLabel(r)}</p>
    {r.user_name && r.user_email && <p className="truncate text-[12.5px] text-muted-foreground" title={r.user_email}>{r.user_email}</p>}
  </>
);

const Seen = ({ r }: { r: ErrItem }) => (
  <>
    <p className="text-[14px] font-semibold text-foreground">{agoLabel(r.last_seen_at)}</p>
    <p className="text-[12.5px] text-muted-foreground">Desde {dayLabel(r.created_at)}</p>
  </>
);

const Times = ({ r }: { r: ErrItem }) => (
  <ToneTag tone={r.occurrences >= 10 && !r.resolved ? "warning" : "neutral"}>{timesLabel(r.occurrences)}</ToneTag>
);

interface Actions { onOpen: (r: ErrItem) => void; onToggle: (r: ErrItem) => void; busyId: string | null }

const Buttons = ({ r, onOpen, onToggle, busyId, compact = false }: { r: ErrItem; compact?: boolean } & Actions) => {
  const busy = busyId === r.id;
  const label = r.resolved ? "Reabrir" : "Resolver";
  return (
    <div className="flex items-center justify-end gap-2">
      <Button type="button" size="sm" variant="outline" className={cn("h-8 gap-1.5 text-[12px]", compact && "w-8 px-0")} disabled={busy} onClick={() => onToggle(r)}
        aria-label={r.resolved ? "Reabrir este erro" : "Marcar este erro como resolvido"} title={compact ? label : undefined}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : r.resolved ? <RotateCcw className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        {!compact && label}
      </Button>
      <Button type="button" size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => onOpen(r)} aria-label={`Ver detalhes do erro: ${r.message.slice(0, 60)}`}>Detalhes</Button>
    </div>
  );
};

export function ErrorsTable({ rows, ...a }: { rows: ErrItem[] } & Actions) {
  return (
    <div className="hidden overflow-x-auto rounded-[12px] border border-border/60 min-[1400px]:block">
      <table className="w-full border-collapse text-left">
        <thead><tr className="border-b border-border bg-muted/25 text-[12px] font-medium text-muted-foreground">
          {["Erro", "Onde", "Quem viu", "Último registro", ""].map((h, i) => <th key={h + i} className={TH}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/40 align-middle last:border-b-0">
              <td className="max-w-[340px] px-3 py-3"><What r={r} withTimes /></td>
              <td className="max-w-[190px] px-3 py-3"><Where r={r} /></td>
              <td className="max-w-[190px] px-3 py-3"><Who r={r} /></td>
              <td className="whitespace-nowrap px-3 py-3"><Seen r={r} /></td>
              <td className="px-3 py-3"><Buttons r={r} compact {...a} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ErrorsCards({ rows, ...a }: { rows: ErrItem[] } & Actions) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))] min-[1400px]:hidden">
      {rows.map((r) => (
        <li key={r.id} className="flex min-w-0 flex-col gap-3 rounded-[12px] border border-border/60 p-4">
          <What r={r} />
          <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 border-t border-border/40 pt-3">
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Onde</dt><dd><Where r={r} /></dd></div>
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Quem viu</dt><dd><Who r={r} /></dd></div>
            <div className="min-w-0"><dt className="mb-0.5 text-[12px] text-muted-foreground">Vezes</dt><dd><Times r={r} /></dd></div>
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Último registro</dt><dd><Seen r={r} /></dd></div>
          </dl>
          <Buttons r={r} {...a} />
        </li>
      ))}
    </ul>
  );
}
