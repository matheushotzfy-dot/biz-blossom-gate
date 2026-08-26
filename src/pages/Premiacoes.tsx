import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clock, Package, Truck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AwardsRail } from "@/features/awards/AwardsRail";
import { AwardsStage } from "@/features/awards/AwardsStage";
import { ClaimDialog } from "@/features/awards/ClaimDialog";
import { AWARDS, formatMoney } from "@/features/awards/awards-data";
import { useAwards } from "@/features/awards/use-awards";
import { cn } from "@/lib/utils";
import "@/features/awards/awards-theme.css";

const claimStatus = {
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
  const userSelectedAward = useRef(false);
  const reduceMotion = useReducedMotion();
  const award = AWARDS[activeIndex];
  const claimed = claims.some((claim) => claim.tier_id === award.id && claim.status !== "cancelled");

  useEffect(() => {
    if (loading || userSelectedAward.current) return;
    setActiveIndex(Math.max(AWARDS.findIndex((item) => item.id === next.id), 0));
  }, [loading, next.id]);

  const selectAward = (index: number) => {
    userSelectedAward.current = true;
    setActiveIndex(index);
  };

  const share = async () => {
    const text = revenue >= award.value ? `Conquistei ${award.title} na VENXPAY.` : `Minha próxima meta na VENXPAY é ${award.label}.`;
    try {
      if (navigator.share) await navigator.share({ title: `VENXPAY · ${award.title}`, text });
      else { await navigator.clipboard.writeText(text); toast.success("Marco copiado"); }
    } catch { return; }
  };

  return (
    <main className="awards-theme -mx-3 -mt-1 space-y-4 pb-12 sm:mx-0">
      <header className="flex flex-col justify-between gap-4 px-1 sm:flex-row sm:items-end">
        <div><p className="font-mono text-[10px] uppercase text-primary">VENXPAY / Recognition System</p><h1 className="mt-2 font-display text-2xl font-bold tracking-normal text-foreground sm:text-3xl">Arquivo de conquistas</h1></div>
        <div className="flex items-end gap-6 border-l border-border pl-4"><div><p className="font-mono text-[9px] uppercase text-muted-foreground">Volume validado</p><p className="mt-1 font-display text-lg font-bold tabular-nums text-foreground">{loading ? "—" : formatMoney(revenue)}</p></div><div><p className="font-mono text-[9px] uppercase text-muted-foreground">Artefatos</p><p className="mt-1 font-display text-lg font-bold tabular-nums text-foreground">{unlocked}/{AWARDS.length}</p></div></div>
      </header>

      {failed && <div role="alert" className="flex items-center gap-2 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4" /> Alguns dados não puderam ser sincronizados.</div>}

      <motion.div initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .36 }}>
        <AwardsStage activeIndex={activeIndex} revenue={revenue} claimed={claimed} onSelect={selectAward} onClaim={() => setClaimOpen(true)} onShare={share} />
        <AwardsRail activeIndex={activeIndex} revenue={revenue} onSelect={selectAward} />
      </motion.div>

      <section className="grid gap-px border border-border bg-border md:grid-cols-[1.2fr_.8fr]">
        <div className="bg-card p-5 sm:p-6"><div className="flex items-end justify-between"><div><p className="font-mono text-[9px] uppercase text-muted-foreground">Próxima ruptura</p><h2 className="mt-2 font-display text-xl font-bold text-foreground">{next.title}</h2></div><span className="font-display text-2xl font-bold tabular-nums text-primary">{targetProgress.toFixed(0)}%</span></div><progress className="awards-progress mt-5 h-1 w-full" value={targetProgress} max={100} /><p className="mt-3 font-mono text-[10px] uppercase text-muted-foreground">{revenue >= next.value ? "Jornada máxima concluída" : `Faltam ${formatMoney(Math.max(next.value - revenue, 0))}`}</p></div>
        <div className="bg-card p-5 sm:p-6"><p className="font-mono text-[9px] uppercase text-muted-foreground">Registro logístico</p>{claims.length === 0 ? <p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">Nenhuma peça solicitada. O registro é aberto quando um marco conquistado é resgatado.</p> : <div className="mt-4 space-y-3"><AnimatePresence initial={false}>{claims.slice(0, 3).map((claim) => { const status = claimStatus[claim.status as keyof typeof claimStatus] ?? claimStatus.pending; const StatusIcon = status.icon; return <motion.div key={claim.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 border-t border-border pt-3"><Package className="h-4 w-4 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{claim.tier_label}</p><p className="font-mono text-[9px] text-muted-foreground">{new Date(claim.created_at).toLocaleDateString("pt-BR")}</p></div><span className={cn("flex items-center gap-1 font-mono text-[9px] uppercase", status.tone)}><StatusIcon className="h-3 w-3" />{status.label}</span></motion.div>; })}</AnimatePresence></div>}</div>
      </section>

      <ClaimDialog open={claimOpen} userId={user?.id} award={award} onOpenChange={setClaimOpen} onCreated={(claim) => setClaims((current) => [claim, ...current])} />
    </main>
  );
}