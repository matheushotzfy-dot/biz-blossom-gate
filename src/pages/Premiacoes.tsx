import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Play, Sparkles, Trophy, X } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PageHead } from "@/components/seller-ui/PageHead";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { Notice } from "@/components/seller-ui/studio";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { ClaimDialog } from "@/features/awards/ClaimDialog";
import { ClaimsList } from "@/features/awards/ClaimsList";
import { Journey } from "@/features/awards/Journey";
import { Stage } from "@/features/awards/Stage";
import { VaultIntro } from "@/features/awards/VaultIntro";
import type { AwardItem } from "@/features/awards/awards-data";
import { newlyUnlocked, pieceState, type PieceState } from "@/features/awards/awardMeta";
import { useAwards } from "@/features/awards/use-awards";
import "@/features/awards/awards.css";

const INTRO_KEY = "vp-awards-intro";

/** A abertura toca uma vez por sessão e nunca com movimento reduzido. */
function introEligible(): boolean {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return sessionStorage.getItem(INTRO_KEY) !== "1";
  } catch { return false; }
}

const reducedMotion = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};

const HOW = [
  { title: "O que conta", text: "O valor líquido das suas vendas aprovadas, já descontadas as taxas. Vendas de teste não entram na conta." },
  { title: "Como pedir", text: "Quando uma peça é liberada, o botão de resgate aparece no palco. Você informa o endereço, revisa e confirma. Cada peça pode ser pedida uma vez por conta." },
  { title: "Acompanhamento", text: "Cada mudança de etapa chega como notificação, e o rastreio aparece em Seus resgates assim que a equipe informar." },
  { title: "Endereço errado?", text: "Depois do pedido, só o suporte consegue alterar o endereço. Fale com a gente antes do envio." },
] as const;

const SEEN_KEY = (userId: string) => `vp-awards-seen:${userId}`;

function StageSkeleton() {
  return (
    <div className="vw-stage flex min-h-[560px] items-center justify-center" aria-hidden>
      <div className="h-[300px] w-[min(420px,80%)] animate-pulse rounded-[28px] bg-white/[0.05] motion-reduce:animate-none" />
    </div>
  );
}

export default function Premiacoes() {
  const a = useAwards();
  const { hidden } = usePrivacyMode();
  const { awards, claims, revenue, loading, errors } = a;

  const states: PieceState[] = useMemo(() => awards.map((x) => pieceState(x, revenue, claims)), [awards, revenue, claims]);
  const revenueKnown = !errors.revenue;
  const claimsKnown = !errors.claims;

  const [index, setIndex] = useState(0);
  const dir = useRef<1 | -1>(1);
  const touched = useRef(false);
  const [claimFor, setClaimFor] = useState<AwardItem | null>(null);

  // Peças que passaram a valer desde a última visita ganham um aviso (uma vez). Na primeira visita só registra o estado.
  const [fresh, setFresh] = useState<AwardItem[]>([]);
  const userId = a.user?.id;
  const unlockedKey = awards.filter((_, i) => states[i]?.unlocked).map((x) => x.id).join(",");
  useEffect(() => {
    if (loading || !userId || errors.revenue || awards.length === 0) return;
    try {
      const ids = unlockedKey ? unlockedKey.split(",") : [];
      const raw = localStorage.getItem(SEEN_KEY(userId));
      const added = newlyUnlocked(raw, ids);
      // Só acumula: uma peça já comemorada não volta a ser novidade se o faturamento oscilar (estorno, por exemplo).
      localStorage.setItem(SEEN_KEY(userId), [...new Set([...(raw ? raw.split(",") : []), ...ids])].filter(Boolean).join(","));
      if (added && added.length > 0) setFresh(awards.filter((x) => added.includes(x.id)));
    } catch { /* sem armazenamento: sem aviso, o palco continua igual */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, userId, errors.revenue, unlockedKey]);

  // Abre na peça que pede ação: a que dá para resgatar, senão a próxima da jornada.
  useEffect(() => {
    if (loading || touched.current || awards.length === 0) return;
    const ready = states.findIndex((s) => s.kind === "ready");
    const next = a.next ? awards.findIndex((x) => x.id === a.next?.id) : awards.length - 1;
    setIndex(ready >= 0 ? ready : Math.max(next, 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, awards, a.next?.id, states.map((s) => s.kind).join(",")]);

  const safeIndex = Math.min(index, Math.max(awards.length - 1, 0));
  const select = useCallback((i: number) => {
    if (i < 0 || i >= awards.length) return;
    touched.current = true;
    dir.current = i >= safeIndex ? 1 : -1;
    setIndex(i);
  }, [awards.length, safeIndex]);

  // Abertura: portas fechadas enquanto carrega, abrem quando os dados chegam.
  const [intro, setIntro] = useState<"off" | "wait" | "open">(() => (introEligible() ? "wait" : "off"));
  const fast = useRef(false);
  useEffect(() => {
    if (intro !== "wait" || loading) return;
    const t = setTimeout(() => setIntro("open"), fast.current ? 150 : 650);
    return () => clearTimeout(t);
  }, [intro, loading]);
  const finishIntro = useCallback(() => {
    setIntro("off");
    try { sessionStorage.setItem(INTRO_KEY, "1"); } catch { /* sem armazenamento: toca de novo, sem problema */ }
  }, []);
  const replay = () => {
    if (reducedMotion()) { toast.message("A abertura fica desligada porque seu dispositivo pede menos movimento."); return; }
    fast.current = true;
    setIntro("wait");
  };

  const scrollToClaims = useCallback(() => {
    document.getElementById("resgates")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  }, []);

  const share = async (award: AwardItem, state: PieceState) => {
    const text = state.unlocked ? `Conquistei a peça ${award.title} na Vemprapay.` : `Minha próxima meta na Vemprapay: ${award.title}.`;
    try {
      if (navigator.share) { await navigator.share({ title: `Vemprapay: ${award.title}`, text }); return; }
      await navigator.clipboard.writeText(text);
      toast.success("Texto copiado");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error("Não foi possível compartilhar. Copie o texto manualmente.");
    }
  };

  const stageVisible = intro === "off" || intro === "open";
  const hasProblem = errors.revenue || errors.tiers || a.revenueCapped;

  return (
    <div className="vp-fade space-y-5 pb-6 md:space-y-6">
      <PageHead
        title="Premiações"
        subtitle="Peças físicas que marcam o tamanho da sua operação. Cada marco de faturamento libera uma."
        actions={
          <button type="button" className="vp-ghost" onClick={replay} disabled={loading || awards.length === 0 || intro !== "off"}>
            <Play className="h-[18px] w-[18px]" />Rever abertura
          </button>
        }
      />

      {hasProblem && (
        <Notice tone="warn" title={errors.revenue ? "Não foi possível conferir seu faturamento" : errors.tiers ? "Mostrando as peças padrão" : "Parte do seu histórico ficou de fora da soma"}>
          <p>
            {errors.revenue
              ? "Enquanto isso, os resgates ficam bloqueados para não mostrar um valor errado."
              : errors.tiers
                ? "Não conseguimos carregar as peças atualizadas agora. O valor e a imagem de alguma peça podem estar diferentes do combinado."
                : "Seu histórico é maior do que conseguimos somar aqui, então o total pode estar abaixo do real. Fale com o suporte para conferir."}
          </p>
          {(errors.revenue || errors.tiers) && <button type="button" className="vp-ghost mt-3 !h-10" onClick={() => { void a.reload(); }}>Tentar de novo</button>}
        </Notice>
      )}

      {fresh.length > 0 && stageVisible && (
        <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[22px] bg-accent px-5 py-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card text-accent-foreground"><Sparkles className="h-[18px] w-[18px]" aria-hidden /></span>
          <p className="min-w-0 flex-1 basis-56 text-[14.5px] font-medium leading-snug text-accent-foreground">
            <span className="font-bold">{fresh.length === 1 ? "Peça liberada desde a sua última visita:" : "Peças liberadas desde a sua última visita:"}</span>{" "}
            {fresh.map((x) => x.title).join(", ")}.
          </p>
          <div className="flex items-center gap-2">
            <button type="button" className="vp-cta !h-10" onClick={() => { select(awards.findIndex((x) => x.id === fresh[0].id)); setFresh([]); }}>Ver no palco</button>
            <button type="button" className="vp-orb h-10 w-10" aria-label="Dispensar aviso" onClick={() => setFresh([])}><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      <div className="relative rounded-[28px]">
        {loading ? (
          <StageSkeleton />
        ) : awards.length === 0 ? (
          <div className="vp-sheet">
            <EmptyPanel icon={<Trophy className="h-7 w-7" />} title="Nenhuma premiação disponível" text="As peças estão em preparação. Assim que forem abertas, elas aparecem aqui." />
          </div>
        ) : (
          <Stage
            awards={awards}
            index={safeIndex}
            dir={dir.current}
            onSelect={select}
            revenue={revenue}
            revenueKnown={revenueKnown}
            claimsKnown={claimsKnown}
            hidden={hidden}
            unlocked={a.unlocked}
            next={a.next}
            states={states}
            show={stageVisible && !loading}
            onClaim={setClaimFor}
            onShare={(x, s) => { void share(x, s); }}
            onTrack={scrollToClaims}
          />
        )}
        {intro !== "off" && <VaultIntro open={intro === "open" && !loading} onFinish={finishIntro} />}
      </div>

      {!loading && awards.length > 0 && (
        <Journey
          awards={awards}
          states={states}
          index={safeIndex}
          revenue={revenue}
          revenueKnown={revenueKnown}
          hidden={hidden}
          unlocked={a.unlocked}
          onSelect={select}
        />
      )}

      <ClaimsList claims={claims} awards={awards} loading={loading} failed={errors.claims} onRetry={() => { void a.reload(); }} />

      <section className="vp-sheet p-5 sm:p-7" aria-labelledby="como-funciona">
        <h2 id="como-funciona" className="font-heading text-[22px] font-extrabold tracking-[-0.03em] text-foreground">Como funciona</h2>
        <div className="mt-2 divide-y divide-border">
          {HOW.map(({ title, text }, i) => (
            <details key={title} className="group py-4" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[12px] text-[15.5px] font-bold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                {title}
                <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
              </summary>
              <p className="mt-2 max-w-[70ch] text-[14.5px] leading-relaxed text-muted-foreground">
                {text}
                {title === "Endereço errado?" && <> <Link to="/suporte" className="font-semibold text-primary hover:underline">Abrir o suporte</Link></>}
              </p>
            </details>
          ))}
        </div>
      </section>

      <ClaimDialog
        award={claimFor}
        onOpenChange={(o) => { if (!o) setClaimFor(null); }}
        onCreated={(claim) => { a.setClaims((cur) => [claim, ...cur.filter((c) => c.id !== claim.id)]); setTimeout(scrollToClaims, 350); }}
        onConflict={() => { void a.reload(); }}
      />
    </div>
  );
}
