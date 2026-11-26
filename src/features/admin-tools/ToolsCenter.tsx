import { useEffect, useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download, History, Loader2, StickyNote, Wrench, CreditCard, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { uniqueChannelName } from "@/lib/realtime";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import { ExportPanel } from "./ExportPanel";
import { NotesPanel } from "./NotesPanel";
import { PausePanel } from "./PausePanel";
import { ToolsHistory } from "./ToolsHistory";
import { OVERVIEW_KEY, callRpc, useRefreshTools } from "./toolsApi";
import { SWITCH_COPY, heroStatus, parseTools, type Period } from "./toolsModel";

/** Ferramentas de emergência e de apoio da equipe: pausar pagamentos e saques, exportar dados e anotar sobre sellers. Só administrador. */
export default function ToolsCenter({ isAdmin = true, dateRange }: { isAdmin?: boolean; dateRange: Period }) {
  if (!isAdmin) return <PremiumEmpty icon={Wrench} title="As ferramentas são do administrador" subtitle="Peça ao administrador para pausar operações, exportar dados ou registrar notas." />;
  return <Center dateRange={dateRange} />;
}

function Center({ dateRange }: { dateRange: Period }) {
  const refresh = useRefreshTools();
  const q = useQuery({
    queryKey: [...OVERVIEW_KEY],
    queryFn: async () => parseTools(await callRpc("get_admin_tools")),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  // outra pessoa da equipe pausou ou liberou: atualiza, mas espera a rajada passar
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bump = () => { clearTimeout(timer); timer = setTimeout(refresh, 800); };
    const ch = supabase.channel(uniqueChannelName("admin-tools-center"))
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_settings" }, bump)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "seller_notes" }, bump)
      .subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data = q.data;
  const status = useMemo(() => heroStatus(data, q.isError), [data, q.isError]);
  const loaded = !!data;
  const pending = q.isError ? "Indisponível" : "Carregando…";
  const n = (v: number) => (loaded ? v.toLocaleString("pt-BR") : "—");
  const pay = data?.switches.payments;
  const wd = data?.switches.withdrawals;

  return (
    <div className="space-y-5 animate-fade-in">
      <AdminPageHeader eyebrow="Sistema" title="Ferramentas" status={status}
        subtitle="Pause pagamentos ou saques numa emergência, exporte dados com registro na auditoria e deixe notas internas sobre sellers." />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={CreditCard} label="Pagamentos" value={loaded && pay ? (pay.paused ? SWITCH_COPY.payments.pausedWord : SWITCH_COPY.payments.openWord) : "—"}
          tone={pay?.paused ? "destructive" : undefined} sub={loaded ? (pay?.paused ? "nenhuma venda real é registrada" : "vendas reais liberadas") : pending} />
        <PremiumMetric icon={Landmark} label="Saques" value={loaded && wd ? (wd.paused ? SWITCH_COPY.withdrawals.pausedWord : SWITCH_COPY.withdrawals.openWord) : "—"}
          tone={wd?.paused ? "destructive" : undefined} sub={loaded ? (wd?.paused ? "novos pedidos bloqueados" : "pedidos liberados") : pending} />
        <PremiumMetric icon={StickyNote} label="Notas" value={n(data?.program.notes ?? 0)} sub={loaded ? "sobre sellers, só a equipe vê" : pending} />
        <PremiumMetric icon={Download} label="Exportações" value={n(data?.program.exports30d ?? 0)} sub={loaded ? "nos últimos 30 dias" : pending} />
      </PremiumMetricGrid>

      {q.isError && !data ? (
        <PremiumPanel><ErrorBlock title="Não foi possível carregar as ferramentas." error={q.error} onRetry={() => void q.refetch()} /></PremiumPanel>
      ) : q.isPending || !data ? (
        <PremiumPanel><p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando as ferramentas…</p></PremiumPanel>
      ) : (
        <>
          <PremiumPanel title="Pausas de emergência" icon={Wrench}>
            <PausePanel data={data} onChanged={refresh} />
          </PremiumPanel>

          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[repeat(2,minmax(0,1fr))]">
            <PremiumPanel title="Exportar dados" icon={Download}>
              <ExportPanel period={dateRange} />
            </PremiumPanel>
            <PremiumPanel title="Notas sobre sellers" icon={StickyNote}>
              <NotesPanel />
            </PremiumPanel>
          </div>

          <PremiumPanel title="Histórico" icon={History}>
            <p className="mb-4 text-[13.5px] text-muted-foreground">
              Toda pausa, nota e exportação é gravada na auditoria no momento em que acontece. Aqui ficam as últimas 25.
            </p>
            <ToolsHistory history={data.history} />
          </PremiumPanel>
        </>
      )}
    </div>
  );
}
