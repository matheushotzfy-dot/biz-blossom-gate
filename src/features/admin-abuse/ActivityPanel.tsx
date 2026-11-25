import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { PremiumEmpty, PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import { endpointLabel, eventLabel, hourLabel, lastLabel, peakOf, share, type HourBucket, type Overview } from "./abuseModel";

/** Barras por hora (horário de Brasília). Altura = quantidade; a hora mais movimentada fica mais escura. */
function HourlyChart({ hourly }: { hourly: HourBucket[] }) {
  const peak = peakOf(hourly);
  const max = Math.max(1, ...hourly.map((h) => h.count));
  const first = hourly[0]; const lastB = hourly[hourly.length - 1];
  return (
    <figure className="m-0">
      <figcaption className="mb-3 text-[13px] text-muted-foreground">
        {peak ? <>Hora mais movimentada: <span className="font-semibold text-foreground">{peak.count.toLocaleString("pt-BR")} {peak.count === 1 ? "evento" : "eventos"}</span> em {hourLabel(peak.bucket)}.</> : "Sem eventos nesta janela."}
      </figcaption>
      <div role="img" aria-label={`Eventos por hora, de ${first ? hourLabel(first.bucket) : "—"} até ${lastB ? hourLabel(lastB.bucket) : "—"}`}
        className="flex h-36 items-end gap-[2px] rounded-[12px] bg-muted/20 px-3 pb-2 pt-3">
        {hourly.map((h) => (
          <div key={h.bucket} title={`${hourLabel(h.bucket)}: ${h.count.toLocaleString("pt-BR")} ${h.count === 1 ? "evento" : "eventos"}`}
            className={cn("min-w-[2px] flex-1 rounded-t-[2px]", h.count === 0 ? "bg-border" : peak && h.bucket === peak.bucket ? "bg-primary" : "bg-primary/45")}
            style={{ height: h.count === 0 ? 2 : `${Math.max(6, (h.count / max) * 100)}%` }} />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between px-1 text-[12px] text-muted-foreground">
        <span>{first ? hourLabel(first.bucket) : ""}</span><span>{lastB ? hourLabel(lastB.bucket) : ""}</span>
      </div>
    </figure>
  );
}

function Bars({ rows, total }: { rows: { key: string; label: string; count: number }[]; total: number }) {
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.key} className="relative flex items-center justify-between gap-3 overflow-hidden rounded-[10px] bg-muted/25 px-3 py-2">
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${share(r.count, total)}%` }} />
          <span className="relative min-w-0 truncate text-[13px] text-foreground">{r.label}</span>
          <span className="relative shrink-0 text-[13px] font-semibold tabular-nums text-foreground">{r.count.toLocaleString("pt-BR")} <span className="font-normal text-muted-foreground">({share(r.count, total)}%)</span></span>
        </li>
      ))}
    </ul>
  );
}

export function ActivityPanel({ o, hours }: { o: Overview; hours: number }) {
  return (
    <PremiumPanel title="Atividade" icon={Activity}>
      <p className="mb-4 max-w-3xl text-[13px] text-muted-foreground">
        Tentativas de login com erro {lastLabel(hours)}, contadas pelo banco inteiro. Só o login de vendedores e alunos registra aqui: o login do painel admin, a recuperação de senha e o cadastro têm limites próprios e não aparecem nesta tela.
      </p>
      {o.total === 0 ? (
        <PremiumEmpty icon={Activity} title="Nenhuma tentativa com erro" subtitle="Quando alguém errar a senha no login de vendedores ou alunos, aparece aqui." />
      ) : (
        <div className="space-y-6">
          <HourlyChart hourly={o.hourly} />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
            <div>
              <h3 className="mb-2 text-[13px] font-semibold text-foreground">O que aconteceu</h3>
              <Bars total={o.total} rows={o.by_type.map((t) => ({ key: t.event_type, label: eventLabel(t.event_type), count: t.count }))} />
            </div>
            <div>
              <h3 className="mb-2 text-[13px] font-semibold text-foreground">Onde aconteceu</h3>
              <Bars total={o.total} rows={o.by_endpoint.map((t) => ({ key: t.endpoint, label: endpointLabel(t.endpoint), count: t.count }))} />
            </div>
          </div>
        </div>
      )}
    </PremiumPanel>
  );
}
