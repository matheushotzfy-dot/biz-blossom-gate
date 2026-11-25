import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Gift, LifeBuoy, Play, ReceiptText, Trophy } from "lucide-react";
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
import { pieceState, type PieceState } from "@/features/awards/awardMeta";
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
  { icon: ReceiptText, title: "O que conta", text: "O valor líquido das suas vendas aprovadas, já descontadas as taxas. Vendas de teste não entram na conta." },
  { icon: Gift, title: "Como pedir", text: "Quando uma peça é liberada, o botão de resgate aparece no palco. Você informa o endereço, revisa e confirma. Cada peça pode ser pedida uma vez por conta." },
  { icon: Bell, title: "Acompanhamento", text: "Cada mudança de etapa chega como notificação, e o rastreio aparece em Seus resgates assim que a equipe informar." },
  { icon: LifeBuoy, title: "Endereço errado?", text: "Depois do pedido, só o suporte consegue alterar o endereço. Fale com a gente antes do envio." },
] as const;

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
        <dl className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-6 md:grid-cols-[repeat(2,minmax(0,1fr))]">
          {HOW.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Icon className="h-5 w-5" aria-hidden /></span>
              <div className="min-w-0">
                <dt className="text-[15.5px] font-bold text-foreground">{title}</dt>
                <dd className="mt-1 text-[14.5px] leading-relaxed text-muted-foreground">
                  {text}
                  {title === "Endereço errado?" && <> <Link to="/suporte" className="font-semibold text-primary hover:underline">Abrir o suporte</Link></>}
                </dd>
              </div>
            </div>
          ))}
        </dl>
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
