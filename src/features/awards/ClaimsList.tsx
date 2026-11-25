import { safeNavigationUrl } from "@/lib/safeUrl";
import { Check, Copy, ExternalLink, Package, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/seller-ui/tx";
import type { TxTone } from "@/components/seller-ui/txMeta";
import { copyText } from "@/components/seller-ui/copy";
import type { AwardItem } from "./awards-data";
import { CLAIM_STEPS, claimHeadline, claimStepIndex, isCancelled, type RewardClaim } from "./awardMeta";

const safeUrl = (u?: string | null) => (u && /^https?:\/\//i.test(u.trim()) ? safeNavigationUrl(u) : null);

function statusPill(claim: RewardClaim): { label: string; tone: TxTone } {
  if (isCancelled(claim.status)) return { label: "Cancelado", tone: "alert" };
  const i = claimStepIndex(claim.status);
  return { label: CLAIM_STEPS[i].label, tone: i === 3 ? "ok" : i === 0 ? "wait" : "info" };
}

function Steps({ claim }: { claim: RewardClaim }) {
  if (isCancelled(claim.status)) {
    return <p className="text-[14px] text-muted-foreground">Este resgate foi cancelado. Fale com o suporte para saber o motivo.</p>;
  }
  const current = claimStepIndex(claim.status);
  return (
    <ol className="flex items-start" aria-label="Etapas do resgate">
      {CLAIM_STEPS.map((step, i) => {
        const done = i < current || current === CLAIM_STEPS.length - 1;
        const here = i === current && !done;
        return (
          <li key={step.id} className="flex min-w-0 flex-1 flex-col items-center last:flex-none" aria-current={here ? "step" : undefined}>
            <span className="flex w-full items-center">
              <span className={cn("h-[2px] flex-1", i === 0 ? "opacity-0" : i <= current ? "bg-primary" : "bg-muted")} aria-hidden />
              <span
                aria-hidden
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                  done ? "bg-primary text-primary-foreground" : here ? "bg-accent text-accent-foreground shadow-[0_0_0_4px_hsl(var(--primary)/0.18)]" : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn("h-[2px] flex-1", i === CLAIM_STEPS.length - 1 ? "opacity-0" : i < current ? "bg-primary" : "bg-muted")} aria-hidden />
            </span>
            <span className={cn("mt-2 text-center text-[12.5px] leading-tight", done || here ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {step.label}
              <span className="sr-only">{done ? ", concluída" : here ? ", etapa atual" : ", pendente"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Row({ claim, award }: { claim: RewardClaim; award?: AwardItem }) {
  const pill = statusPill(claim);
  const url = safeUrl(claim.tracking_url);
  const place = [claim.shipping_city, claim.shipping_state].filter(Boolean).join("/");
  return (
    <li className="grid gap-5 py-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1.5fr)_minmax(0,1fr)] md:items-center md:gap-7">
      <div className="flex min-w-0 items-center gap-4">
        <span className="vw-thumb !aspect-square !w-[72px] shrink-0 !rounded-[16px]" style={{ ["--glow" as string]: award?.glow }} data-sealed={isCancelled(claim.status)}>
          {award?.image ? <img src={award.image} alt="" loading="lazy" decoding="async" draggable={false} /> : <Package className="absolute inset-0 m-auto h-6 w-6 text-white/70" aria-hidden />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15.5px] font-bold text-foreground">{claim.tier_label ?? award?.title ?? "Peça"}</p>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">Pedido em {new Date(claim.created_at).toLocaleDateString("pt-BR")}</p>
          {(claim.recipient_name || place) && (
            <p className="mt-0.5 truncate text-[13.5px] text-muted-foreground">Para {claim.recipient_name ?? "você"}{place ? `, ${place}` : ""}</p>
          )}
          <StatusPill label={pill.label} tone={pill.tone} className="mt-2 md:hidden" />
        </div>
      </div>

      <div className="min-w-0"><Steps claim={claim} /></div>

      <div className="min-w-0 md:text-right">
        <StatusPill label={pill.label} tone={pill.tone} className="mb-2 hidden md:inline-flex" />
        <p className="text-[14px] font-semibold text-foreground">{claimHeadline(claim)}</p>
        {claim.tracking_code ? (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13.5px] text-muted-foreground md:justify-end">
            <Truck className="h-4 w-4 shrink-0" aria-hidden />
            <span className="vp-num break-all">{claim.tracking_carrier ? `${claim.tracking_carrier} ` : ""}{claim.tracking_code}</span>
            <button type="button" aria-label="Copiar código de rastreio" onClick={() => { void copyText(claim.tracking_code ?? "", "Código copiado"); }} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><Copy className="h-4 w-4" /></button>
            {url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">Rastrear<ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>}
          </p>
        ) : (
          !isCancelled(claim.status) && <p className="mt-1 text-[13.5px] text-muted-foreground">Rastreio ainda não informado.</p>
        )}
        {claim.admin_notes && <p className="mt-2 rounded-[12px] bg-muted px-3 py-2 text-left text-[13px] leading-snug text-muted-foreground">{claim.admin_notes}</p>}
      </div>
    </li>
  );
}

interface ClaimsListProps {
  claims: RewardClaim[];
  awards: AwardItem[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}

/** Seus resgates: cada pedido com as quatro etapas que o time atualiza no admin e o rastreio. */
export function ClaimsList({ claims, awards, loading, failed, onRetry }: ClaimsListProps) {
  return (
    <section id="resgates" className="vp-sheet scroll-mt-24 p-5 sm:p-7" aria-labelledby="resgates-titulo">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div>
          <h2 id="resgates-titulo" className="font-heading text-[22px] font-extrabold tracking-[-0.03em] text-foreground">Seus resgates</h2>
          <p className="mt-1 text-[14.5px] text-muted-foreground">O andamento muda sozinho quando a equipe atualiza o pedido.</p>
        </div>
        {!failed && !loading && claims.length > 0 && <p className="vp-num text-[14.5px] font-semibold text-muted-foreground">{claims.length} {claims.length === 1 ? "pedido" : "pedidos"}</p>}
      </div>

      {loading ? (
        <div className="mt-5 space-y-4" aria-hidden>
          {[0, 1].map((k) => <div key={k} className="vp-skel h-[88px] w-full !rounded-[16px]" />)}
        </div>
      ) : failed ? (
        <div role="alert" className="mt-5 flex flex-col items-start gap-3 rounded-[16px] bg-destructive/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14.5px] font-medium text-destructive">Não foi possível carregar seus resgates agora.</p>
          <button type="button" className="vp-ghost !h-10" onClick={onRetry}>Tentar de novo</button>
        </div>
      ) : claims.length === 0 ? (
        <div className="mt-5 flex items-center gap-4 rounded-[18px] bg-muted/60 px-5 py-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Package className="h-5 w-5" aria-hidden /></span>
          <p className="min-w-0 text-[14.5px] leading-snug text-muted-foreground">
            <span className="font-bold text-foreground">Nenhum resgate ainda.</span> Quando você conquistar uma peça, peça o resgate no palco acima. O pedido e o rastreio aparecem aqui.
          </p>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {claims.map((c) => <Row key={c.id} claim={c} award={awards.find((a) => a.id === c.tier_id)} />)}
        </ul>
      )}
    </section>
  );
}
