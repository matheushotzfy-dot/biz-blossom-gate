import { AnimatePresence, motion, useReducedMotion, type PanInfo, type Variants } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Gift, Lock, Share2, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Dust } from "./Dust";
import { PieceArt } from "./PieceArt";
import type { AwardItem } from "./awards-data";
import { claimHeadline, goalFraction, goalPercent, maskedBRL, spokenBRL, type PieceState } from "./awardMeta";

export interface StageProps {
  awards: AwardItem[];
  index: number;
  dir: 1 | -1;
  onSelect: (index: number) => void;
  revenue: number;
  revenueKnown: boolean;
  claimsKnown: boolean;
  hidden: boolean;
  unlocked: number;
  next: AwardItem | null;
  states: PieceState[];
  /** O palco só aparece depois que a abertura começa a abrir (ou de cara, sem abertura). */
  show: boolean;
  onClaim: (award: AwardItem) => void;
  onShare: (award: AwardItem, state: PieceState) => void;
  onTrack: () => void;
}

const slide: Variants = {
  enter: (d: number) => ({ opacity: 0, x: d * 48, scale: 0.96 }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (d: number) => ({ opacity: 0, x: d * -48, scale: 0.97 }),
};
const flat: Variants = { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } };

function Chip({ children, tone }: { children: ReactNode; tone: "glow" | "dim" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13.5px] font-semibold ${tone === "glow" ? "" : "vw-dim"}`} style={tone === "glow" ? { color: "hsl(var(--glow))" } : undefined}>
      {children}
    </span>
  );
}

function stateChip(state: PieceState) {
  switch (state.kind) {
    case "ready": return <Chip tone="glow"><Gift className="h-4 w-4" />Pronta para resgate</Chip>;
    case "active": return <Chip tone="glow"><Truck className="h-4 w-4" />Resgate em andamento</Chip>;
    case "delivered": return <Chip tone="glow"><Check className="h-4 w-4" />Entregue</Chip>;
    case "cancelled": return <Chip tone="dim">Resgate cancelado</Chip>;
    default: return <Chip tone="dim"><Lock className="h-4 w-4" />Selada</Chip>;
  }
}

function PieceInfo({ award, state, revenue, revenueKnown, claimsKnown, hidden, onClaim, onShare, onTrack }: {
  award: AwardItem; state: PieceState; revenue: number; revenueKnown: boolean; claimsKnown: boolean; hidden: boolean;
  onClaim: () => void; onShare: () => void; onTrack: () => void;
}) {
  const missing = Math.max(award.value - revenue, 0);
  const pct = goalPercent(award.value, revenue);
  const canClaim = state.kind === "ready" && revenueKnown && claimsKnown;
  const delivered = state.claim?.delivered_at ? new Date(state.claim.delivered_at).toLocaleDateString("pt-BR") : null;
  const hasAction = state.kind === "ready" || state.kind === "active" || state.kind === "delivered" || state.kind === "cancelled";

  return (
    <div className="mx-auto w-full max-w-[520px] lg:mx-0">
      <div className="flex items-center gap-3">
        <span className="vw-dim text-[13.5px] font-medium">Nível {award.roman}</span>
        <span className="vw-rule flex-1" aria-hidden />
        {stateChip(state)}
        <button type="button" className="vw-orb !h-10 !w-10" onClick={onShare} aria-label={state.unlocked ? "Compartilhar conquista" : "Compartilhar meta"}><Share2 className="h-4 w-4" /></button>
      </div>

      <h2 className="vw-ink mt-4 font-heading text-[34px] font-extrabold leading-[1.04] tracking-[-0.04em] sm:text-[44px]">{award.title}</h2>
      <p className="vw-dim mt-2 text-[15px]">{award.tier ? `${award.tier}, a` : "A"} partir de {spokenBRL(award.value)} em vendas</p>

      {/* O que importa agora vem primeiro: quanto falta, o botão de resgatar ou o andamento do pedido. */}
      <div className="mt-6">
        {state.kind === "sealed" && (
          revenueKnown ? (
            <>
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="vw-dim text-[13.5px] font-medium">Faltam</p>
                  <p className="vw-ink vp-num mt-0.5 truncate font-heading text-[36px] font-extrabold leading-none tracking-[-0.04em] sm:text-[44px]">{maskedBRL(missing, hidden)}</p>
                </div>
                <p className="vw-dim vp-num shrink-0 pb-1 text-[15px] font-semibold">{pct}%</p>
              </div>
              <div className="vw-meter mt-3.5" role="progressbar" aria-label={`Progresso até ${award.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                <span style={{ width: `${pct}%` }} />
              </div>
              <p className="vw-dim mt-2 text-[13px]">Você tem {maskedBRL(revenue, hidden)} de {maskedBRL(award.value, hidden)}.</p>
            </>
          ) : (
            <p className="vw-dim text-[14px] leading-relaxed">Não foi possível conferir seu faturamento agora, então não dá para dizer quanto falta.</p>
          )
        )}
        {state.kind === "ready" && (
          <p className="vw-ink text-[15px] font-medium leading-relaxed">
            {claimsKnown && revenueKnown ? "Peça liberada. Informe o endereço de entrega para pedir a sua." : "Peça liberada, mas não conseguimos conferir seus resgates agora. Tente de novo em instantes."}
          </p>
        )}
        {state.claim && (state.kind === "active" || state.kind === "delivered") && (
          <>
            <p className="vw-ink text-[16px] font-semibold">{claimHeadline(state.claim)}</p>
            <p className="vw-dim mt-1 text-[13.5px]">
              {state.kind === "delivered" && delivered ? `Entregue em ${delivered}.` : state.claim.tracking_code ? `Rastreio ${state.claim.tracking_carrier ? `${state.claim.tracking_carrier} ` : ""}${state.claim.tracking_code}.` : "Você acompanha cada etapa em Seus resgates, aqui embaixo."}
            </p>
          </>
        )}
        {state.kind === "cancelled" && (
          <p className="vw-dim text-[14px] leading-relaxed">
            O resgate desta peça foi cancelado e não dá para pedir de novo pela plataforma. Fale com o suporte para entender o motivo ou reabrir.
          </p>
        )}
        {hasAction && (
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            {state.kind === "ready" && <button type="button" className="vp-cta" disabled={!canClaim} onClick={onClaim}><Gift className="h-[18px] w-[18px]" />Resgatar esta peça</button>}
            {(state.kind === "active" || state.kind === "delivered") && <button type="button" className="vw-ghost" onClick={onTrack}><Truck className="h-[18px] w-[18px]" />Acompanhar resgate</button>}
            {state.kind === "cancelled" && <Link to="/suporte" className="vw-ghost">Falar com o suporte</Link>}
          </div>
        )}
      </div>

      {(award.description || award.rewards.length > 0 || award.phrase) && <div className="vw-rule mt-7" aria-hidden />}

      {award.description && <p className="vw-ink mt-5 max-w-[46ch] text-[15px] leading-relaxed opacity-90">{award.description}</p>}

      {award.rewards.length > 0 && (
        <div className="mt-5">
          <p className="vw-dim text-[13.5px] font-semibold">O que você recebe</p>
          <ul className="mt-2 space-y-1.5">
            {award.rewards.map((r) => (
              <li key={r} className="vw-ink flex items-start gap-2 text-[14.5px] leading-snug">
                <Check className="mt-[3px] h-4 w-4 shrink-0" style={{ color: "hsl(var(--glow))" }} aria-hidden />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {award.phrase && <p className="vw-ink mt-5 max-w-[42ch] font-heading text-[16px] font-semibold leading-snug opacity-80">“{award.phrase}”</p>}
    </div>
  );
}

export function Stage(p: StageProps) {
  const reduce = useReducedMotion();
  const award = p.awards[p.index];
  const state = p.states[p.index];
  const sealed = state.kind === "sealed";
  const go = (delta: number) => { const i = p.index + delta; if (i >= 0 && i < p.awards.length) p.onSelect(i); };

  const onPanEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) < 56 || Math.abs(info.offset.x) < Math.abs(info.offset.y) * 1.4) return;
    go(info.offset.x < 0 ? 1 : -1);
  };

  return (
    <section
      className="vw-stage"
      aria-roledescription="carrossel"
      aria-label="Sala de conquistas"
      onKeyDown={(e) => {
        if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        if (e.key === "ArrowLeft") go(-1);
        if (e.key === "ArrowRight") go(1);
      }}
    >
      <div aria-hidden className="vw-floor" />
      <AnimatePresence initial={false}>
        <motion.div
          key={award.id}
          aria-hidden
          className="vw-lights"
          style={{ ["--glow" as string]: award.glow }}
          initial={{ opacity: 0 }}
          animate={{ opacity: sealed ? 0.55 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
        >
          <div className="vw-halo" />
          <div className="vw-cone" />
          <div className="vw-beam" style={{ left: "30%", transform: "rotate(9deg)" }} />
          <div className="vw-beam" style={{ left: "58%", transform: "rotate(-8deg)", width: "8%", opacity: 0.8 }} />
          <div className="vw-pool" />
        </motion.div>
      </AnimatePresence>
      <Dust glow={award.glow} active={p.show && !reduce} />

      <motion.div
        className="relative z-[3]"
        initial={false}
        animate={{ opacity: p.show ? 1 : 0, scale: p.show || reduce ? 1 : 1.035 }}
        transition={{ duration: reduce ? 0 : 0.9, delay: p.show && !reduce ? 0.55 : 0, ease: [0.16, 1, 0.3, 1] }}
        style={{ ["--glow" as string]: award.glow }}
      >
        <p className="sr-only" aria-live="polite">Peça {p.index + 1} de {p.awards.length}: {award.title}</p>
        <div className="grid items-center gap-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <motion.div className="relative px-4 pb-2 pt-10 sm:px-10 lg:py-12 lg:pl-12 lg:pr-2" style={{ touchAction: "pan-y" }} onPanEnd={onPanEnd}>
            <div className="relative mx-auto w-full max-w-[340px] sm:max-w-[420px] lg:max-w-[480px] 2xl:max-w-[520px]">
              <AnimatePresence mode="wait" custom={p.dir} initial={false}>
                <motion.div
                  key={award.id}
                  custom={p.dir}
                  variants={reduce ? flat : slide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                >
                  <PieceArt award={award} sealed={sealed} progress={sealed && p.revenueKnown ? goalFraction(award.value, p.revenue) : 0} />
                </motion.div>
              </AnimatePresence>
              <div aria-hidden style={{ paddingBottom: "19%" }} />
            </div>
            <button type="button" className="vw-orb absolute left-2 top-[38%] sm:left-5" aria-label="Peça anterior" disabled={p.index === 0} onClick={() => go(-1)}><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" className="vw-orb absolute right-2 top-[38%] sm:right-5" aria-label="Próxima peça" disabled={p.index === p.awards.length - 1} onClick={() => go(1)}><ChevronRight className="h-5 w-5" /></button>
          </motion.div>

          <div className="px-6 pb-8 pt-1 sm:px-10 lg:py-12 lg:pl-4 lg:pr-12">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={award.id}
                initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduce ? 0 : -6 }}
                transition={{ duration: 0.24 }}
              >
                <PieceInfo
                  award={award}
                  state={state}
                  revenue={p.revenue}
                  revenueKnown={p.revenueKnown}
                  claimsKnown={p.claimsKnown}
                  hidden={p.hidden}
                  onClaim={() => p.onClaim(award)}
                  onShare={() => p.onShare(award, state)}
                  onTrack={p.onTrack}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <dl className="grid grid-cols-[repeat(3,minmax(0,1fr))]" style={{ boxShadow: "inset 0 1px 0 hsl(150 30% 92% / .1)" }}>
          <div className="min-w-0 px-4 py-4 sm:px-10 sm:py-5">
            <dt className="vw-dim text-[12.5px] font-medium sm:text-[13.5px]">Faturamento contado</dt>
            <dd className="vw-ink vp-num mt-1 truncate font-heading text-[17px] font-extrabold tracking-[-0.03em] sm:text-[22px]">{p.revenueKnown ? maskedBRL(p.revenue, p.hidden) : "Indisponível"}</dd>
          </div>
          <div className="min-w-0 px-4 py-4 sm:px-6 sm:py-5" style={{ boxShadow: "inset 1px 0 0 hsl(150 30% 92% / .08)" }}>
            <dt className="vw-dim text-[12.5px] font-medium sm:text-[13.5px]">Peças conquistadas</dt>
            <dd className="vw-ink vp-num mt-1 font-heading text-[17px] font-extrabold tracking-[-0.03em] sm:text-[22px]">{p.unlocked} de {p.awards.length}</dd>
          </div>
          <div className="min-w-0 px-4 py-4 sm:px-6 sm:py-5" style={{ boxShadow: "inset 1px 0 0 hsl(150 30% 92% / .08)" }}>
            <dt className="vw-dim text-[12.5px] font-medium sm:text-[13.5px]">{p.next ? "Próxima peça" : "Jornada"}</dt>
            <dd className="vw-ink mt-1 truncate font-heading text-[17px] font-extrabold tracking-[-0.03em] sm:text-[22px]">{p.next ? (<><span className="sm:hidden">{p.next.label}</span><span className="hidden sm:inline">{p.next.title}</span></>) : "Completa"}</dd>
          </div>
        </dl>
      </motion.div>

      <div aria-hidden className="vw-vignette" />
      <div aria-hidden className="vw-grain" />
    </section>
  );
}
