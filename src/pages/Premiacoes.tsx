import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock, Package, Trophy, Truck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArtifactViewer } from "@/features/awards/ArtifactViewer";
import { AwardGallery } from "@/features/awards/AwardGallery";
import { ClaimDialog } from "@/features/awards/ClaimDialog";
import { AWARDS, formatMoney } from "@/features/awards/awards-data";
import { useAwards } from "@/features/awards/use-awards";
import { cn } from "@/lib/utils";
import "@/features/awards/vault.css";

const CLAIM_STATUS = {
  pending: { label: "Em análise", icon: Clock, tone: "text-warning" },
  approved: { label: "Aprovado", icon: CheckCircle2, tone: "text-info" },
  shipped: { label: "Em trânsito", icon: Truck, tone: "text-primary" },
  delivered: { label: "Entregue", icon: CheckCircle2, tone: "text-success" },
  cancelled: { label: "Cancelado", icon: XCircle, tone: "text-destructive" },
} as const;

export default function Premiacoes() {
  const { user, revenue, claims, setClaims, loading, failed, unlocked, next, targetProgress } = useAwards();
  const [activeIndex, setActiveIndex] = useState(() => Math.max(AWARDS.findIndex((award) => award.id === next.id), 0));
  const [claimOpen, setClaimOpen] = useState(false);
  const touched = useRef(false);
  const reduceMotion = useReducedMotion();

  const award = AWARDS[activeIndex];
  const claimed = claims.some((claim) => claim.tier_id === award.id && claim.status !== "cancelled");

  useEffect(() => {
    if (loading || touched.current) return;
    setActiveIndex(Math.max(AWARDS.findIndex((item) => item.id === next.id), 0));
  }, [loading, next.id]);

  const select = (index: number) => {
    if (index < 0 || index >= AWARDS.length) return;
    touched.current = true;
    setActiveIndex(index);
  };

  const share = async () => {
    const text = revenue >= award.value
      ? `Conquistei ${award.title} na VENXPAY.`
      : `Minha próxima meta na VENXPAY é ${award.label}.`;
    try {
      if (navigator.share) await navigator.share({ title: `VENXPAY · ${award.title}`, text });
      else { await navigator.clipboard.writeText(text); toast.success("Marco copiado"); }
    } catch { /* usuário cancelou o compartilhamento */ }
  };

  return (
    <main
      className="venx-vault -mx-3 -mt-1 pb-14 sm:mx-0"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") select(activeIndex - 1);
        if (event.key === "ArrowRight") select(activeIndex + 1);
      }}
    >
      <section className="venx-vault-bg relative isolate overflow-hidden rounded-none border border-awards-steel/12 sm:rounded-lg">
        <header className="relative z-10 grid gap-5 border-b border-awards-steel/12 px-4 py-5 sm:px-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-awards-accent"><Trophy className="h-3.5 w-3.5" /> Hall de conquistas</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-awards-ink sm:text-4xl">Sua operação merece ser vista.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-awards-steel">Cada marco libera uma peça física VENXPAY, produzida para registrar o tamanho da sua operação.</p>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-awards-steel/15 bg-awards-steel/15">
            <div className="bg-awards-obsidian px-4 py-3 sm:min-w-[170px]">
              <p className="font-mono text-[9px] uppercase text-awards-steel">Faturamento validado</p>
              <p className="mt-1 font-display text-lg font-bold tabular-nums text-awards-ink">{loading ? "—" : formatMoney(revenue)}</p>
            </div>
            <div className="bg-awards-obsidian px-4 py-3 sm:min-w-[120px]">
              <p className="font-mono text-[9px] uppercase text-awards-steel">Conquistadas</p>
              <p className="mt-1 font-display text-lg font-bold tabular-nums text-awards-ink">{unlocked} <span className="text-xs text-awards-steel">/ {AWARDS.length}</span></p>
            </div>
          </div>
        </header>

        <div className="relative z-10 border-b border-awards-steel/12">
          <ArtifactViewer index={activeIndex} revenue={revenue} claimed={claimed} onClaim={() => setClaimOpen(true)} onShare={share} />
          <div className="absolute left-3 top-1/2 z-20 -translate-y-1/2 sm:left-5">
            <Button variant="outline" size="icon" aria-label="Marco anterior" disabled={activeIndex === 0} onClick={() => select(activeIndex - 1)} className="h-10 w-10 rounded-full border-awards-steel/25 bg-awards-obsidian text-awards-ink hover:bg-awards-accent/10"><ChevronLeft /></Button>
          </div>
          <div className="absolute right-3 top-1/2 z-20 -translate-y-1/2 sm:right-5">
            <Button variant="outline" size="icon" aria-label="Próximo marco" disabled={activeIndex === AWARDS.length - 1} onClick={() => select(activeIndex + 1)} className="h-10 w-10 rounded-full border-awards-steel/25 bg-awards-obsidian text-awards-ink hover:bg-awards-accent/10"><ChevronRight /></Button>
          </div>
        </div>

        <motion.div initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="relative z-10 px-4 py-5 sm:px-7">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[9px] uppercase text-awards-steel">Coleção VENXPAY · selecione uma peça</p>
              <p className="mt-1 font-display text-base font-bold text-awards-ink">{next.title} é sua próxima conquista</p>
            </div>
            <div className="min-w-0 sm:w-[310px]">
              <div className="flex justify-between gap-3 font-mono text-[9px] uppercase text-awards-steel">
                <span>{Math.round(targetProgress)}% concluído</span>
                <span>{revenue >= next.value ? "Jornada concluída" : `Faltam ${formatMoney(Math.max(next.value - revenue, 0))}`}</span>
              </div>
              <progress className="venx-meter mt-2 h-1.5 w-full rounded-full" value={targetProgress} max={100} aria-label={`Progresso até ${next.label}`} />
            </div>
          </div>
          <AwardGallery activeIndex={activeIndex} revenue={revenue} onSelect={select} />
        </motion.div>
      </section>

      {failed && (
        <div role="alert" className="mt-4 flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> Alguns dados não puderam ser sincronizados.
        </div>
      )}

      <section className="mt-4 rounded-none border border-border bg-card p-5 sm:rounded-lg sm:p-6">
        <p className="font-mono text-[9px] uppercase text-muted-foreground">Registro logístico</p>
        {claims.length === 0 ? (
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            Nenhuma peça solicitada ainda. Ao conquistar um marco, o resgate abre aqui com rastreio completo.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {claims.slice(0, 4).map((claim) => {
              const status = CLAIM_STATUS[claim.status as keyof typeof CLAIM_STATUS] ?? CLAIM_STATUS.pending;
              const StatusIcon = status.icon;
              return (
                <li key={claim.id} className="flex items-center gap-3 border-t border-border pt-3">
                  <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{claim.tier_label}</p>
                    <p className="font-mono text-[9px] text-muted-foreground">{new Date(claim.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <span className={cn("flex items-center gap-1 font-mono text-[9px] uppercase", status.tone)}>
                    <StatusIcon className="h-3 w-3" />{status.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ClaimDialog open={claimOpen} userId={user?.id} award={award} onOpenChange={setClaimOpen} onCreated={(claim) => setClaims((current) => [claim, ...current])} />
    </main>
  );
}
