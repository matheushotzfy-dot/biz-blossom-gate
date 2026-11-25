import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Flag, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/seller-ui/confirm";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { ToneTag } from "@/features/admin-products/parts";
import { friendlyError } from "@/lib/friendlyError";
import { PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { AssetThumb } from "./AssetField";
import { HistoryPanel } from "./HistoryPanel";
import { PrizesPanel } from "./PrizesPanel";
import { RaceDialog } from "./RaceDialog";
import { RankingPanel } from "./RankingPanel";
import { WinnersPanel } from "./WinnersPanel";
import { DETAIL_KEY, callRpc, removeRaceFiles, useRefreshRace } from "./raceApi";
import { parseRaceDetail, phaseLine, phaseOf, plural, raceTag, shortDate, brl2, type RaceDetail as Detail } from "./raceModel";

type View = "ranking" | "premios" | "premiados" | "historico";

/** Uma corrida por inteiro: situação, avisos, ações e as quatro abas. */
export function RaceDetail({ id, onDeleted, onSaved }: { id: string; onDeleted: () => void; onSaved: (id: string) => void }) {
  const refresh = useRefreshRace();
  const [view, setView] = useState<View>("ranking");

  const q = useQuery({
    queryKey: [...DETAIL_KEY, id],
    queryFn: async () => parseRaceDetail(await callRpc("get_admin_race_detail", { _id: id })),
    refetchInterval: 60_000,
  });

  if (q.isError && !q.data) return <PremiumPanel><ErrorBlock title="Não foi possível carregar a corrida." error={q.error} onRetry={() => void q.refetch()} /></PremiumPanel>;
  if (!q.data) return <PremiumPanel><p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando a corrida…</p></PremiumPanel>;

  return <Loaded detail={q.data} view={view} setView={setView} stale={q.isError} onRetry={() => void q.refetch()} refresh={refresh} onDeleted={onDeleted} onSaved={onSaved} />;
}

function Loaded({ detail, view, setView, stale, onRetry, refresh, onDeleted, onSaved }: {
  detail: Detail; view: View; setView: (v: View) => void; stale: boolean; onRetry: () => void; refresh: () => void; onDeleted: () => void; onSaved: (id: string) => void;
}) {
  const { race, prizes, entries, history } = detail;
  const { ask, dialog: confirmDialog } = useConfirm();
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  const [editOpen, setEditOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const tag = raceTag(race);
  const phase = phaseOf(race);
  const fictional = entries.filter((e) => !e.seller_id).length;
  const otherLive = detail.live_title && !race.is_live ? detail.live_title : null;
  const hasSales = detail.totals.sales > 0;

  const setActive = useMutation({
    mutationFn: (a: { active: boolean; replace: boolean }) => callRpc("admin_set_race_active", { _id: race.id, _active: a.active, _replace: a.replace }),
    onSuccess: (_d, a) => { toast.success(a.active ? "Corrida no ar. Os sellers já veem." : "Corrida tirada do ar."); refresh(); },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível mudar a situação da corrida. Nada mudou.")),
  });

  const remove = useMutation({
    mutationFn: () => callRpc("admin_delete_race", { _id: race.id }),
    onSuccess: () => { toast.success(`“${race.title}” foi apagada.`); void removeRaceFiles(race.id); refresh(); onDeleted(); },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível apagar a corrida. Nada mudou.")),
  });

  const putLive = async () => {
    setServerError(null);
    const warnings = [
      otherLive ? `Já existe uma corrida no ar: “${otherLive}”. Ela sai do ar para esta entrar, porque os sellers só veem uma por vez.` : "Os sellers passam a ver esta corrida, com ranking e prêmios.",
      phase === "ended" ? ` Atenção: esta corrida já terminou em ${shortDate(race.ends_at)}.` : phase === "upcoming" ? ` Ela começa em ${shortDate(race.starts_at)}; até lá o ranking fica zerado.` : "",
      prizes.length === 0 ? " Ela ainda não tem prêmios." : "",
      fictional > 0 ? ` O ranking tem ${plural(fictional, "participante sem conta", "participantes sem conta")} que os sellers verão como pessoas reais.` : "",
    ].join("");
    const ok = await ask({ title: otherLive ? `Trocar a corrida no ar por “${race.title}”?` : `Colocar “${race.title}” no ar?`, tone: "warning", confirmLabel: otherLive ? "Trocar corrida" : "Colocar no ar", icon: <Eye className="h-5 w-5" />, description: warnings });
    if (ok) setActive.mutate({ active: true, replace: otherLive !== null });
  };

  const takeDown = async () => {
    setServerError(null);
    const ok = await ask({ title: `Tirar “${race.title}” do ar?`, tone: "warning", confirmLabel: "Tirar do ar", icon: <EyeOff className="h-5 w-5" />,
      description: "Os sellers deixam de ver esta corrida. Ranking, prêmios e valores fixos ficam guardados; dá para colocar no ar de novo." });
    if (ok) setActive.mutate({ active: false, replace: false });
  };

  const onDelete = () => {
    setServerError(null);
    sensitive.confirm(`Apagar “${race.title}” de vez, com ${plural(prizes.length, "prêmio", "prêmios")} e ${plural(entries.length, "valor fixo", "valores fixos")}. Isso não pode ser desfeito.`, async () => { await remove.mutateAsync().catch(() => undefined); });
  };

  const deleteBlock = race.is_active ? "Tire a corrida do ar antes de apagar." : hasSales ? `Tem ${plural(detail.totals.sales, "venda real", "vendas reais")} no período: oculte em vez de apagar.` : null;
  const busy = setActive.isPending || remove.isPending;

  return (
    <PremiumPanel>
      <div className="space-y-5">
        <header className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <AssetThumb url={race.banner_url} alt={`Banner de ${race.title}`} className="h-24 w-full sm:w-40" icon={<Flag className="h-6 w-6 text-muted-foreground" aria-hidden />} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h2 className="break-words font-display text-[19px] font-bold leading-tight tracking-tight text-foreground">{race.title}</h2>
                <ToneTag tone={tag.tone}>{tag.label}</ToneTag>
              </div>
              <p className="mt-1 text-[13.5px] text-muted-foreground">{shortDate(race.starts_at)} a {shortDate(race.ends_at)}, horário de Brasília</p>
              <p className="text-[13.5px] text-muted-foreground">{phaseLine(race)}</p>
              {race.description && <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-foreground/80">{race.description}</p>}
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                {plural(detail.totals.participants, "participante real", "participantes reais")} · {brl2(detail.totals.revenue_cents)} em {plural(detail.totals.sales, "venda", "vendas")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {race.is_active
              ? <button type="button" className="vp-ghost !h-10 gap-1.5 !px-3.5 !text-[13.5px]" disabled={busy} onClick={() => void takeDown()}><EyeOff className="h-4 w-4" aria-hidden /> Tirar do ar</button>
              : <button type="button" className="vp-cta !h-10 gap-1.5 !px-4 !text-[13.5px]" disabled={busy} onClick={() => void putLive()}>{setActive.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" aria-hidden />} Colocar no ar</button>}
            <button type="button" className="vp-ghost !h-10 gap-1.5 !px-3.5 !text-[13.5px]" disabled={busy} onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" aria-hidden /> Editar</button>
            <button type="button" className="vp-ghost !h-10 gap-1.5 !px-3.5 !text-[13.5px] !text-destructive" disabled={busy || deleteBlock !== null} title={deleteBlock ?? undefined} onClick={onDelete} aria-label={`Apagar ${race.title}`}><Trash2 className="h-4 w-4" aria-hidden /> Apagar</button>
            {deleteBlock && <span className="text-[12.5px] text-muted-foreground">{deleteBlock}</span>}
          </div>
        </header>

        {serverError && <p role="alert" className="rounded-[12px] bg-destructive/10 px-4 py-3 text-[13.5px] font-medium text-destructive">{serverError}</p>}
        {stale && <p role="status" className="flex flex-wrap items-center gap-3 rounded-[12px] bg-warning/10 px-4 py-3 text-[13.5px] text-foreground">Não conseguimos atualizar agora; o que está na tela pode estar desatualizado. <button type="button" className="font-semibold underline underline-offset-2" onClick={onRetry}>Tentar de novo</button></p>}

        <Notices detail={detail} fictional={fictional} />

        <PremiumSegmented<View> value={view} onChange={setView} options={[
          { value: "ranking", label: "Ranking" }, { value: "premios", label: `Prêmios${prizes.length ? ` · ${prizes.length}` : ""}` },
          { value: "premiados", label: "Quem leva" }, { value: "historico", label: "Histórico" },
        ]} />

        {view === "ranking" && <RankingPanel detail={detail} onChanged={refresh} />}
        {view === "premios" && <PrizesPanel detail={detail} onChanged={refresh} />}
        {view === "premiados" && <WinnersPanel detail={detail} />}
        {view === "historico" && <HistoryPanel history={history} />}
      </div>

      <RaceDialog race={race} open={editOpen} onClose={() => setEditOpen(false)} onDone={onSaved} />
      {confirmDialog}
      {sensitive.dialog}
    </PremiumPanel>
  );
}

/** Avisos do que está errado agora, só quando a corrida está visível para os sellers. */
function Notices({ detail, fictional }: { detail: Detail; fictional: number }) {
  const { race, prizes } = detail;
  const items: string[] = [];
  if (race.is_live) {
    if (phaseOf(race) === "ended") items.push(`Esta corrida terminou em ${shortDate(race.ends_at)} e continua visível para os sellers. Tire do ar ou coloque a próxima.`);
    if (fictional > 0) items.push(`${plural(fictional, "participante sem conta aparece", "participantes sem conta aparecem")} no ranking como pessoas reais. Sellers de verdade estão disputando contra quem não existe.`);
    if (prizes.length === 0) items.push("A corrida está no ar sem nenhum prêmio cadastrado.");
  } else if (fictional > 0 && race.is_active === false) {
    items.push(`${plural(fictional, "participante sem conta", "participantes sem conta")} no ranking. Se a corrida for ao ar assim, os sellers verão como pessoas reais.`);
  }
  if (items.length === 0) return null;
  return (
    <ul role="alert" className="space-y-1.5 rounded-[12px] bg-warning/10 px-4 py-3 text-[13.5px] leading-relaxed text-foreground">
      {items.map((t) => <li key={t}>{t}</li>)}
    </ul>
  );
}

