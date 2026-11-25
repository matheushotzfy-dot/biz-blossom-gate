import { Bell, CheckCircle2, Megaphone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dateLabel } from "@/features/admin-disputes/disputesModel";
import { ToneTag } from "@/features/admin-products/parts";
import { agoLabel } from "@/features/admin-errors/errorsModel";
import { cn } from "@/lib/utils";
import { readPct, readText, recipientsLabel, typeInfo, type AvisoItem, type NotifItem, type Tone } from "./notificationsModel";

const TONE_DOT: Record<Tone, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  info: "bg-info/15 text-info",
  neutral: "bg-muted text-muted-foreground",
  destructive: "bg-destructive/15 text-destructive",
};

function Dot({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span aria-hidden className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", TONE_DOT[tone])}>{children}</span>;
}

/** Avisos que a equipe mandou: um por linha, com quantos já abriram. */
export function AvisosList({ rows, onOpen }: { rows: AvisoItem[]; onOpen: (a: AvisoItem) => void }) {
  return (
    <ul className="divide-y divide-border/50 rounded-[12px] border border-border/60">
      {rows.map((a) => {
        const t = typeInfo(a.type);
        const pct = readPct(a.read, a.recipients);
        const all = a.recipients > 0 && a.read >= a.recipients;
        return (
          <li key={a.batch_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Dot tone={t.tone}><Megaphone className="h-[18px] w-[18px]" /></Dot>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-semibold text-foreground">{a.title}</p>
                <p className="mt-0.5 line-clamp-2 break-words text-[13px] leading-relaxed text-muted-foreground" title={a.message}>{a.message}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-muted-foreground">
                  <ToneTag tone={t.tone}>{t.label}</ToneTag>
                  <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden /> {recipientsLabel(a)}</span>
                  <span title={dateLabel(a.sent_at)}>{agoLabel(a.sent_at)}{a.sent_by_name ? ` · ${a.sent_by_name}` : ""}</span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-4 sm:w-[260px] sm:justify-end">
              <div className="min-w-0 sm:w-[140px]">
                <p className={cn("flex items-center gap-1 text-[13px] font-semibold", all ? "text-success" : "text-foreground")}>
                  {all && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}{readText(a.read, a.recipients)}
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${pct}% leram`}>
                  <div className={cn("h-full rounded-full", all ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 text-[12px]" onClick={() => onOpen(a)} aria-label={`Ver detalhes do aviso: ${a.title.slice(0, 60)}`}>Detalhes</Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Todas as notificações, de qualquer origem, uma por linha. Só leitura. */
export function AllList({ rows }: { rows: NotifItem[] }) {
  return (
    <ul className="divide-y divide-border/50 rounded-[12px] border border-border/60">
      {rows.map((n) => {
        const t = typeInfo(n.type);
        const who = n.user_id ? (n.user_name ?? "Conta sem nome") : "Sem destinatário (registro antigo)";
        return (
          <li key={n.id} className="flex items-start gap-3 p-4">
            <Dot tone={t.tone}><Bell className="h-[18px] w-[18px]" /></Dot>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="min-w-0 truncate text-[14px] font-semibold text-foreground">{n.title}</p>
                {n.batch_id && <ToneTag tone="info">Aviso da equipe</ToneTag>}
              </div>
              <p className="mt-0.5 line-clamp-3 break-words text-[13px] leading-relaxed text-muted-foreground" title={n.message}>{n.message}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-muted-foreground">
                <ToneTag tone={t.tone}>{t.label}</ToneTag>
                <span className="min-w-0 truncate">Para {who}{n.user_email && n.user_name ? ` · ${n.user_email}` : ""}</span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <ToneTag tone={n.is_read ? "neutral" : "warning"}>{n.is_read ? "Lida" : "Não lida"}</ToneTag>
              <p className="mt-1.5 whitespace-nowrap text-[12.5px] text-muted-foreground" title={dateLabel(n.created_at)}>{agoLabel(n.created_at)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
