import { Link } from "react-router-dom";
import { BadgeCheck, Ban, Clock3, ShieldAlert, ShieldX, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Notice } from "@/components/seller-ui/studio";
import { TONE_SHELL, kycSteps, type KycInfo, type KycKey } from "./accountMeta";

const ICON: Record<KycKey, LucideIcon> = { approved: BadgeCheck, pending: ShieldAlert, pending_review: Clock3, rejected: ShieldX, blocked: Ban };

/** Situação da verificação: o que está acontecendo, em que etapa estamos e o que fazer agora. */
export function KycHero({ info, reason, sent, required, checking }: { info: KycInfo; reason: string | null; sent: number; required: number; checking: boolean }) {
  const Icon = ICON[info.key];
  const showSteps = info.key !== "approved" && info.key !== "blocked";
  const steps = kycSteps(info.key, sent, required);

  return (
    <section className="vp-sheet p-5 sm:p-7" aria-labelledby="account-kyc">
      <div className="flex flex-wrap items-start gap-4 sm:flex-nowrap sm:gap-5">
        <span className={cn("grid h-14 w-14 shrink-0 place-items-center rounded-full", TONE_SHELL[info.tone])}><Icon className="h-7 w-7" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 id="account-kyc" className="font-heading text-[24px] font-extrabold leading-tight tracking-[-0.035em] text-foreground sm:text-[26px]">{info.title}</h2>
          <p className="mt-1 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">{info.text}</p>
        </div>
      </div>

      {info.key === "rejected" && (
        <Notice tone="warn" className="mt-5" icon={<ShieldX className="h-[18px] w-[18px]" />} title="O que a equipe apontou">
          {reason?.trim() ? <span className="whitespace-pre-line">{reason.trim()}</span> : "A equipe não deixou um motivo. Confira se as fotos estão nítidas, inteiras e sem reflexo, e envie de novo."}
        </Notice>
      )}

      {info.key === "blocked" && (
        <div className="mt-5"><Link to="/suporte" className="vp-cta h-11">Falar com o suporte</Link></div>
      )}

      {showSteps && (
        <ol className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3" aria-label="Etapas da verificação">
          {steps.map((s, i) => (
            <li key={s.key} className="min-w-0" aria-current={s.state === "current" ? "step" : undefined}>
              <span className="va-rule block" data-state={s.state} aria-hidden />
              <p className="mt-3 text-[14.5px] font-bold text-foreground"><span className="tabular-nums text-muted-foreground">{i + 1}. </span>{s.label}</p>
              <p className={cn("mt-0.5 text-[13.5px]", s.state === "alert" ? "font-medium text-destructive" : "text-muted-foreground")}>{s.key === "docs" && s.state === "current" && checking ? "Conferindo…" : s.note}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
