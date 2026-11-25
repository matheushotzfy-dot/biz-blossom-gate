import { Copy, Gift } from "lucide-react";
import { copyText } from "@/components/seller-ui/copy";
import { ToneTag } from "@/features/admin-products/parts";
import { PremiumEmpty } from "@/pages/admin/tabs/AdminPremium";
import { brl2, phaseOf, prizeHolders, prizeLabel, shortDate, winnersText, type RaceDetail } from "./raceModel";

const SHOWN = 8;

/** Quem leva cada prêmio pelo ranking de agora, com e-mail para entrar em contato e aviso de quem não tem conta. */
export function WinnersPanel({ detail }: { detail: RaceDetail }) {
  const { race, prizes, board } = detail;
  const rows = prizeHolders(prizes, board);
  const ended = phaseOf(race) === "ended";
  const orphan = rows.filter((r) => r.holders.some((h) => !h.has_account));

  if (prizes.length === 0) return <PremiumEmpty icon={Gift} title="Nenhum prêmio cadastrado" subtitle="Crie os prêmios na aba Prêmios para ver quem leva cada um." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
          {ended ? `Resultado final: a corrida terminou em ${shortDate(race.ends_at)}.` : `Resultado parcial, pelo ranking de agora. A corrida vai até ${shortDate(race.ends_at)}.`}
        </p>
        <button type="button" className="vp-ghost !h-10 gap-1.5 !px-4 !text-[13.5px]" onClick={() => void copyText(winnersText(race.title, rows), "Lista copiada.")}>
          <Copy className="h-4 w-4" aria-hidden /> Copiar lista
        </button>
      </div>

      {orphan.length > 0 && (
        <p role="alert" className="rounded-[12px] bg-warning/10 px-4 py-3 text-[13.5px] leading-relaxed text-foreground">
          {orphan.length === 1 ? "Um prêmio está" : `${orphan.length} prêmios estão`} com alguém sem conta na plataforma: não existe e-mail nem endereço para entregar.
          Ajuste o ranking em “Valores fixos” antes de encerrar.
        </p>
      )}

      <ul className="divide-y divide-border/50 overflow-hidden rounded-[12px] border border-border/60" aria-label="Quem leva cada prêmio">
        {rows.map(({ prize, holders }) => (
          <li key={prize.id} className="p-4">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[15px] font-bold text-foreground">{prize.title}</span>
              <ToneTag tone="neutral">{prizeLabel(prize)}</ToneTag>
            </p>
            {holders.length === 0 ? (
              <p className="mt-1.5 text-[13.5px] text-muted-foreground">{prize.kind === "place" ? "Ninguém nesta posição ainda." : "Ninguém bateu a meta ainda."}</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {holders.slice(0, SHOWN).map((h) => (
                  <li key={`${h.rank}-${h.seller_id ?? h.name}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px]">
                    <span className="w-8 shrink-0 font-semibold tabular-nums text-foreground">{h.rank}º</span>
                    <span className="min-w-0 font-medium text-foreground">{h.name}</span>
                    {h.email && <span className="min-w-0 truncate text-muted-foreground">{h.email}</span>}
                    {!h.has_account && <ToneTag tone="warning">Sem conta, ninguém para receber</ToneTag>}
                    <span className="ml-auto tabular-nums text-muted-foreground">{brl2(h.revenue_cents)}</span>
                  </li>
                ))}
                {holders.length > SHOWN && <li className="text-[13px] text-muted-foreground">e mais {(holders.length - SHOWN).toLocaleString("pt-BR")}. A lista copiada traz todos.</li>}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
