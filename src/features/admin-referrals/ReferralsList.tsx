import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToneTag } from "@/features/admin-products/parts";
import { brl } from "@/features/admin-finance/types";
import { cn } from "@/lib/utils";
import { dayLabel, referredNote, refStatus, type RefItem } from "./referralsModel";

const TH = "whitespace-nowrap px-3 py-3";

const Referred = ({ r }: { r: RefItem }) => {
  const note = referredNote(r);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-muted text-muted-foreground"><Share2 className="h-[18px] w-[18px]" /></span>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold text-foreground" title={r.referred_email}>{r.referred_email}</p>
        <p className={cn("truncate text-[12.5px]", note.tone === "warning" ? "font-medium text-warning" : "text-muted-foreground")} title={note.text}>{note.text}</p>
      </div>
    </div>
  );
};

const Referrer = ({ r }: { r: RefItem }) => (
  <>
    <p className="truncate text-[14px] font-semibold text-foreground" title={r.referrer_name}>{r.referrer_name}</p>
    <p className="truncate text-[12.5px] text-muted-foreground" title={r.referrer_email ?? undefined}>{r.referrer_email ?? "Sem e-mail"}</p>
  </>
);

const Reward = ({ r }: { r: RefItem }) => (
  <>
    <p className="text-[14px] font-semibold tabular-nums text-foreground">{brl(r.reward_amount)}</p>
    <p className="text-[12.5px] text-muted-foreground">{r.status === "paid" && r.paid_at ? `Paga em ${dayLabel(r.paid_at)}` : r.status === "qualified" ? "A pagar" : r.status === "pending" ? "Prevista" : "Sem pagamento"}</p>
  </>
);

const State = ({ r }: { r: RefItem }) => {
  const st = refStatus(r.status);
  return (
    <div className="space-y-1.5">
      <ToneTag tone={st.tone}>{st.label}</ToneTag>
      <p className="text-[12.5px] text-muted-foreground">Indicada em {dayLabel(r.created_at)}</p>
    </div>
  );
};

const Action = ({ r, onOpen }: { r: RefItem; onOpen: (r: RefItem) => void }) => (
  <Button type="button" size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => onOpen(r)} aria-label={`Ver indicação de ${r.referred_email}`}>Detalhes</Button>
);

export function ReferralsTable({ rows, onOpen }: { rows: RefItem[]; onOpen: (r: RefItem) => void }) {
  return (
    <div className="hidden overflow-x-auto rounded-[12px] border border-border/60 xl:block">
      <table className="w-full border-collapse text-left">
        <thead><tr className="border-b border-border bg-muted/25 text-[12px] font-medium text-muted-foreground">
          {["Indicado", "Quem indicou", "Recompensa", "Situação", ""].map((h, i) => <th key={h + i} className={TH}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/40 align-middle last:border-b-0">
              <td className="max-w-[280px] px-3 py-3"><Referred r={r} /></td>
              <td className="max-w-[220px] px-3 py-3"><Referrer r={r} /></td>
              <td className="whitespace-nowrap px-3 py-3"><Reward r={r} /></td>
              <td className="whitespace-nowrap px-3 py-3"><State r={r} /></td>
              <td className="px-3 py-3 text-right"><Action r={r} onOpen={onOpen} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReferralsCards({ rows, onOpen }: { rows: RefItem[]; onOpen: (r: RefItem) => void }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))] xl:hidden">
      {rows.map((r) => (
        <li key={r.id} className="flex min-w-0 flex-col gap-3 rounded-[12px] border border-border/60 p-4">
          <Referred r={r} />
          <State r={r} />
          <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 border-t border-border/40 pt-3">
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Quem indicou</dt><dd><Referrer r={r} /></dd></div>
            <div className="min-w-0"><dt className="text-[12px] text-muted-foreground">Recompensa</dt><dd><Reward r={r} /></dd></div>
          </dl>
          <div className="flex justify-end"><Action r={r} onOpen={onOpen} /></div>
        </li>
      ))}
    </ul>
  );
}
