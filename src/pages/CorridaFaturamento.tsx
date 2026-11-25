/**
 * Corrida de faturamento: a temporada ativa, o seu lugar nela, a classificação e os prêmios.
 * Dados e regras ficam em `src/features/race/` (`useRace`, `raceMeta`); aqui só a montagem da tela.
 */
import { useMemo } from "react";
import { Bell, Eye, Flag, RefreshCw, ReceiptText, Gift } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHead } from "@/components/seller-ui/PageHead";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { Notice } from "@/components/seller-ui/studio";
import { useAuth } from "@/hooks/useAuth";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { Arena } from "@/features/race/Arena";
import { Prizes } from "@/features/race/Prizes";
import { Ranking } from "@/features/race/Ranking";
import { Standing } from "@/features/race/Standing";
import { findMine, formatRaceDate, prizeStatus } from "@/features/race/raceMeta";
import { useRace } from "@/features/race/useRace";
import { useRacePhase } from "@/features/race/useRacePhase";
import "@/features/awards/awards.css";
import "@/features/race/race.css";

function Skeleton() {
  return (
    <div className="space-y-5 md:space-y-6" aria-busy="true" aria-label="Carregando a corrida de faturamento">
      <div className="vw-stage min-h-[520px]" aria-hidden />
      <div className="vp-sheet h-[132px]"><div className="vp-skel m-6 h-8 w-48" /></div>
      <div className="vp-sheet h-[320px]"><div className="vp-skel m-6 h-8 w-64" /></div>
    </div>
  );
}

export default function CorridaFaturamento() {
  const { user } = useAuth();
  const { hidden } = usePrivacyMode();
  const { data, loading, failed, stale, retry, own } = useRace(user?.id);
  const race = data?.race ?? null;
  const phase = useRacePhase(race);

  const leaders = useMemo(() => data?.leaders ?? [], [data?.leaders]);
  const mine = useMemo(() => findMine(leaders, user?.id), [leaders, user?.id]);
  const ctx = useMemo(() => ({ phase, mine, leaders, ownCents: own ? own.cents : null }), [phase, mine, leaders, own]);

  const wonPrizes = useMemo(
    () => (phase === "ended" ? (data?.prizes ?? []).filter((p) => prizeStatus(p, ctx).label === "Conquistado").map((p) => p.title) : []),
    [phase, data?.prizes, ctx],
  );

  const head = (
    <PageHead
      title="Corrida de faturamento"
      subtitle="Quem mais fatura na temporada leva os prêmios. Acompanhe o ranking, a sua posição e o que falta."
    />
  );

  if (loading && !data) return <div className="space-y-5 md:space-y-6">{head}<Skeleton /></div>;

  if (failed) {
    return (
      <div className="space-y-5 md:space-y-6">
        {head}
        <section className="vp-sheet">
          <EmptyPanel
            icon={<RefreshCw className="h-7 w-7" aria-hidden />}
            title="Não foi possível carregar a corrida"
            text="Confira a sua conexão e tente de novo. Nada do seu faturamento foi alterado."
            action={<button type="button" className="vp-cta vp-r16" onClick={retry}>Tentar de novo</button>}
          />
        </section>
      </div>
    );
  }

  if (!race || !data) {
    return (
      <div className="space-y-5 md:space-y-6">
        {head}
        <section className="vp-sheet">
          <EmptyPanel
            icon={<Flag className="h-7 w-7" aria-hidden />}
            title="Nenhuma corrida ativa agora"
            text="Quando a próxima temporada abrir, o ranking e os prêmios aparecem aqui sozinhos. Enquanto isso, as suas peças continuam em Premiações."
            action={<Link to="/premiacoes" className="vp-ghost vp-r16">Ver as peças</Link>}
          />
        </section>
      </div>
    );
  }

  const how = [
    { icon: ReceiptText, title: "O que conta", text: `O valor líquido das vendas aprovadas entre ${formatRaceDate(race.starts_at)} e ${formatRaceDate(race.ends_at)}, já descontadas as taxas.` },
    { icon: Gift, title: "Como se ganha", text: "Cada prêmio é de uma colocação (1º, 2º, 3º) ou de uma meta de faturamento. Em colocação, vale a posição em que a temporada termina; em meta, quem bater o valor leva." },
    { icon: Eye, title: "Quem vê o quê", text: "Os participantes aparecem pelo nome, com valores arredondados para baixo em milhares de reais. Só você vê o seu valor exato." },
    { icon: Bell, title: "Atualização", text: "O ranking atualiza a cada minuto e na hora em que a Vemprapay muda algo na temporada. Dúvidas sobre a entrega do prêmio?" },
  ];

  return (
    <div className="space-y-5 md:space-y-6">
      {head}

      {stale && (
        <Notice tone="warn" icon={<RefreshCw className="h-4 w-4" aria-hidden />} title="Não conseguimos atualizar agora">
          O que está na tela é a última versão que carregou. Tentamos de novo em instantes.
          {" "}<button type="button" className="font-semibold text-primary hover:underline" onClick={retry}>Tentar agora</button>
        </Notice>
      )}

      <Arena
        race={race}
        phase={phase}
        leaders={leaders}
        userId={user?.id}
        hidden={hidden}
        logo={data.assetUrls.logo || race.logo_url}
        participants={leaders.length}
      />

      <Standing race={race} phase={phase} mine={mine} leaders={leaders} own={own} hidden={hidden} wonPrizes={wonPrizes} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] xl:items-start">
        <Ranking leaders={leaders} userId={user?.id} phase={phase} hidden={hidden} />
        <Prizes prizes={data.prizes} ctx={ctx} assetUrls={data.assetUrls} />
      </div>

      <section className="vp-sheet p-5 sm:p-7" aria-labelledby="como-corrida">
        <h2 id="como-corrida" className="font-heading text-[22px] font-extrabold tracking-[-0.03em] text-foreground">Como funciona</h2>
        <dl className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-6 md:grid-cols-[repeat(2,minmax(0,1fr))]">
          {how.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Icon className="h-5 w-5" aria-hidden /></span>
              <div className="min-w-0">
                <dt className="text-[15.5px] font-bold text-foreground">{title}</dt>
                <dd className="mt-1 text-[14.5px] leading-relaxed text-muted-foreground">
                  {text}
                  {title === "Atualização" && <> <Link to="/suporte" className="font-semibold text-primary hover:underline">Fale com o suporte.</Link></>}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
