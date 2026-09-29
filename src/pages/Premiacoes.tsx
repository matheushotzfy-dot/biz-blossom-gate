import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, ExternalLink, Package, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArtifactViewer } from "@/features/awards/ArtifactViewer";
import { AwardGallery } from "@/features/awards/AwardGallery";
import { ClaimDialog } from "@/features/awards/ClaimDialog";
import { formatMoney } from "@/features/awards/awards-data";
import { useAwards, type RewardClaim } from "@/features/awards/use-awards";
import { cn } from "@/lib/utils";
import "@/features/awards/vault.css";

const STEPS = [
  { id: "pending", label: "Análise" },
  { id: "approved", label: "Aprovado" },
  { id: "shipped", label: "Enviado" },
  { id: "delivered", label: "Entregue" },
] as const;

/** Linha de rastreio de um resgate: 4 etapas espelhando o status definido no admin. */
function ClaimRow({ claim }: { claim: RewardClaim }) {
  const cancelled = claim.status === "cancelled";
  const current = Math.max(STEPS.findIndex((s) => s.id === claim.status), 0);
  return (
    <li className="grid gap-4 border-t border-border py-4 first:border-t-0 md:grid-cols-[minmax(180px,1fr)_2fr_auto] md:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-muted"><Package className="h-4 w-4 text-primary" /></span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{claim.tier_label}</p>
          <p className="font-mono text-[10px] text-muted-foreground">{new Date(claim.created_at).toLocaleDateString("pt-BR")}</p>
        </div>
      </div>
      {cancelled ? (
        <p className="text-xs font-semibold text-destructive">Resgate cancelado</p>
      ) : (
        <ol className="flex items-center" aria-label="Etapas do resgate">
          {STEPS.map((step, i) => {
            const done = i <= current;
            return (
              <li key={step.id} className="flex flex-1 items-center last:flex-none">
                <span className="flex flex-col items-center gap-1">
                  <span className={cn("grid h-5 w-5 place-items-center rounded-full border text-[9px]", done ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className={cn("text-[10px] font-medium", done ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
                </span>
                {i < STEPS.length - 1 && <span className={cn("mx-1 mb-4 h-px flex-1", i < current ? "bg-primary" : "bg-border")} />}
              </li>
            );
          })}
        </ol>
      )}
      <div className="text-left md:text-right">
        {claim.tracking_code ? (
          <a href={claim.tracking_url || undefined} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[11px] text-primary hover:underline">
            {claim.tracking_carrier ? `${claim.tracking_carrier} · ` : ""}{claim.tracking_code}{claim.tracking_url && <ExternalLink className="h-3 w-3" />}
          </a>
        ) : <span className="font-mono text-[10px] text-muted-foreground">Sem rastreio ainda</span>}
        {claim.admin_notes && <p className="mt-1 max-w-[260px] text-[11px] text-muted-foreground md:ml-auto">{claim.admin_notes}</p>}
      </div>
    </li>
  );
}

export default function Premiacoes() {
  const { user, revenue, claims, setClaims, loading, failed, reload, unlocked, next, targetProgress, awards } = useAwards();
  const [activeIndex, setActiveIndex] = useState(0);
  const [claimOpen, setClaimOpen] = useState(false);
  const touched = useRef(false);
  const reduceMotion = useReducedMotion();

  const safeIndex = Math.min(activeIndex, awards.length - 1);
  const award = awards[safeIndex];
  const claimed = claims.some((c) => c.tier_id === award.id && c.status !== "cancelled");
  const top = awards[awards.length - 1]?.value || 1;

  useEffect(() => {
    if (loading || touched.current) return;
    setActiveIndex(Math.max(awards.findIndex((a) => a.id === next.id), 0));
  }, [loading, next.id, awards]);

  const select = (index: number) => {
    if (index < 0 || index >= awards.length) return;
    touched.current = true;
    setActiveIndex(index);
  };

  const share = async () => {
    const text = revenue >= award.value ? `Conquistei ${award.title} na VENXPAY.` : `Minha próxima meta na VENXPAY é ${award.label}.`;
    try {
      if (navigator.share) await navigator.share({ title: `VENXPAY · ${award.title}`, text });
      else { await navigator.clipboard.writeText(text); toast.success("Marco copiado"); }
    } catch { /* cancelado */ }
  };

  return (
    <main
      className="venx-vault -mx-3 min-h-[calc(100dvh-5rem)] pb-14 sm:-mx-5 lg:-mx-8"
      onKeyDown={(e) => { if (e.key === "ArrowLeft") select(safeIndex - 1); if (e.key === "ArrowRight") select(safeIndex + 1); }}
    >
      <section className="venx-vault-bg relative isolate min-h-[calc(100dvh-5rem)] overflow-hidden border-y border-border">
        <header className="relative z-10 grid gap-4 border-b border-border px-6 py-5 sm:px-10 lg:grid-cols-[1fr_auto] lg:items-end lg:px-14 lg:py-6">
          <div>
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-primary"><Trophy className="h-3.5 w-3.5" /> Hall de conquistas</p>
            <h1 className="mt-2 max-w-4xl font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl lg:text-5xl">Sua operação merece ser vista.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Cada marco libera uma peça física VENXPAY, produzida para registrar o tamanho da sua operação.</p>
          </div>
          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border">
            {[
              ["Faturamento", loading ? "—" : formatMoney(revenue)],
              ["Conquistadas", `${unlocked}/${awards.length}`],
              ["Resgates", String(claims.filter((c) => c.status !== "cancelled").length)],
            ].map(([k, v]) => (
              <div key={k} className="bg-card px-4 py-4">
                <dt className="font-mono text-[9px] uppercase text-muted-foreground">{k}</dt>
                <dd className="mt-1 font-display text-lg font-bold tabular-nums text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </header>

        {/* Linha do tempo dos marcos com a posição atual */}
        <div className="relative z-10 border-b border-border px-6 py-4 sm:px-10 lg:px-14">
          <div className="flex justify-between font-mono text-[10px] uppercase text-muted-foreground">
            <span>{Math.round(targetProgress)}% até {next.label}</span>
            <span>{revenue >= next.value ? "Jornada concluída" : `Faltam ${formatMoney(Math.max(next.value - revenue, 0))}`}</span>
          </div>
          <div className="relative mt-3 h-1 rounded-full bg-muted">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-primary"
              initial={reduceMotion ? false : { width: 0 }}
              animate={{ width: `${Math.min((Math.log10(Math.max(revenue, 1)) / Math.log10(Math.max(top, 10))) * 100, 100)}%` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
            {awards.map((a, i) => {
              const denominator = Math.log10(Math.max(top, 10));
              const left = (Math.log10(Math.max(a.value, 1)) / denominator) * 100;
              const done = revenue >= a.value;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => select(i)}
                  aria-label={`Marco ${a.label}`}
                  style={{ left: `${left}%` }}
                  className={cn(
                    "absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-transform hover:scale-125",
                    done ? "border-primary bg-primary" : "border-border bg-background",
                    i === safeIndex && "ring-4 ring-primary/25",
                  )}
                />
              );
            })}
          </div>
          <div className="relative mt-3 hidden h-4 sm:block">
            {awards.map((a) => (
              <span key={a.id} style={{ left: `${(Math.log10(Math.max(a.value, 1)) / Math.log10(Math.max(top, 10))) * 100}%` }} className="absolute max-w-24 -translate-x-1/2 truncate font-mono text-[10px] text-muted-foreground">{a.label}</span>
            ))}
          </div>
        </div>

        <div className="relative z-10 border-b border-border">
          <ArtifactViewer award={award} revenue={revenue} claimed={claimed} onClaim={() => setClaimOpen(true)} onShare={share} />
          <div className="absolute left-3 top-1/2 z-20 -translate-y-1/2 sm:left-5">
            <Button variant="outline" size="icon" aria-label="Marco anterior" disabled={safeIndex === 0} onClick={() => select(safeIndex - 1)} className="h-10 w-10 rounded-full"><ChevronLeft /></Button>
          </div>
          <div className="absolute right-3 top-1/2 z-20 -translate-y-1/2 sm:right-5">
            <Button variant="outline" size="icon" aria-label="Próximo marco" disabled={safeIndex === awards.length - 1} onClick={() => select(safeIndex + 1)} className="h-10 w-10 rounded-full"><ChevronRight /></Button>
          </div>
        </div>

        <div className="relative z-10 px-6 py-5 sm:px-10 lg:px-14">
          <p className="mb-3 font-mono text-[10px] uppercase text-muted-foreground">Coleção VENXPAY · selecione uma peça</p>
          <AwardGallery awards={awards} activeIndex={safeIndex} revenue={revenue} onSelect={select} />
        </div>
      </section>

      {failed && (
        <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Alguns dados não puderam ser sincronizados.</span>
          <Button variant="outline" size="sm" onClick={() => void reload()} className="h-7 shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10">Tentar novamente</Button>
        </div>
      )}

      <section className="mt-4 border-y border-border bg-card px-6 py-7 sm:px-10 lg:px-14">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase text-muted-foreground">Registro logístico</p>
            <h2 className="mt-1 font-display text-lg font-bold text-foreground">Seus resgates</h2>
          </div>
          <span className="font-mono text-[10px] uppercase text-muted-foreground">Atualiza em tempo real</span>
        </div>
        {claims.length === 0 ? (
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">Nenhuma peça solicitada ainda. Ao conquistar um marco, o resgate aparece aqui com rastreio completo.</p>
        ) : (
          <ul className="mt-2">{claims.map((c) => <ClaimRow key={c.id} claim={c} />)}</ul>
        )}
      </section>

      <ClaimDialog open={claimOpen} userId={user?.id} award={award} onOpenChange={setClaimOpen} onCreated={(claim) => setClaims((cur) => [claim, ...cur])} />
    </main>
  );
}
