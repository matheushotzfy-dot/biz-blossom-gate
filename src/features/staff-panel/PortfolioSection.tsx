import { AlertTriangle, ArrowRight, BadgeCheck, Coins, CreditCard, Hourglass, IdCard, Receipt, Users } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import { waitingLabel } from "@/features/kyc/kycReviewModel";
import { ROLE_LABEL, int, money, type Portfolio, type SectionId } from "./staffPanelModel";

/** "2 reembolsos"; zero some da frase. */
const plural = (n: number, one: string, many: string) => (n <= 0 ? "" : `${int(n)} ${n === 1 ? one : many}`);
const day = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Início do painel da equipe: números da carteira no período, verificações esperando e os sellers que mais venderam. */
export function PortfolioSection({ data, loading, range, onOpenSeller, onGo }: {
  data: Portfolio | null;
  loading: boolean;
  range: { from: Date; to: Date };
  onOpenSeller: (id: string) => void;
  onGo: (id: SectionId) => void;
}) {
  const m = data?.metrics;
  const pending = loading ? "Carregando…" : "Indisponível";
  const v = (n: number | undefined, f: (x: number) => string = int) => (n === undefined ? "—" : f(n));
  const risk = m ? m.refunds + m.chargebacks + m.med : 0;
  const canReview = !!data && (data.flags.approveKyc || data.flags.rejectKyc);
  const top = (data?.sellers ?? []).filter((s) => s.sales > 0).slice(0, 5);

  return (
    <div className="space-y-5 animate-fade-in">
      <AdminPageHeader
        title="Sua carteira"
        subtitle={`Sellers ligados a você e o que fizeram de ${day(range.from)} a ${day(range.to)}. Só conta o que aconteceu depois que cada seller entrou na sua carteira.`}
        status={data ? { tone: "neutral", label: ROLE_LABEL[data.role] } : undefined}
      />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={Users} label="Sellers" value={v(m?.sellers)} sub={m ? (m.kycPending > 0 ? `${int(m.kycPending)} esperando verificação` : "todos na carteira") : pending} onClick={data ? () => onGo("sellers") : undefined} />
        <PremiumMetric icon={CreditCard} label="Vendas pagas" value={v(m?.sales)} sub={m ? (m.sales > 0 ? `ticket médio ${money(m.ticket)}` : "nenhuma no período") : pending} onClick={data?.flags.viewTransactions ? () => onGo("vendas") : undefined} />
        <PremiumMetric icon={Receipt} label="Volume pago" value={v(m?.volume, money)} sub={m ? "valor bruto das vendas pagas" : pending} />
        <PremiumMetric icon={AlertTriangle} label="Contestações" value={v(m ? risk : undefined)} tone={risk > 0 ? "warning" : undefined}
          sub={m ? (risk > 0 ? [plural(m.refunds, "reembolso", "reembolsos"), plural(m.chargebacks, "chargeback", "chargebacks"), plural(m.med, "MED", "MED")].filter(Boolean).join(", ") : "nenhuma no período") : pending} />
      </PremiumMetricGrid>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <PremiumPanel title="Verificações esperando" icon={IdCard}
          description={canReview ? "Sellers da carteira que enviaram documentos. Abra para conferir e decidir." : "Sellers da carteira que enviaram documentos. Quem decide é o dono, a não ser que ele libere a verificação para você."}>
          {!data ? (
            <p className="py-6 text-[13px] text-muted-foreground">{pending}</p>
          ) : data.kycQueue.length === 0 ? (
            <PremiumEmpty icon={BadgeCheck} title="Nenhuma verificação esperando" subtitle="Quando um seller da carteira enviar os documentos, ele aparece aqui." />
          ) : (
            <ul className="m-0 space-y-2 p-0" style={{ listStyle: "none" }}>
              {data.kycQueue.map((k) => (
                <li key={k.id}>
                  <button type="button" onClick={() => onOpenSeller(k.id)} className="flex w-full items-center gap-3 rounded-[12px] px-3.5 py-3 text-left hover:bg-muted/50" style={{ border: "1px solid hsl(var(--border) / .7)" }}>
                    <Hourglass className="h-4 w-4 shrink-0 text-warning" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-foreground">{k.name}</span>
                      <span className="block truncate text-[12.5px] text-muted-foreground">{k.email ?? "Sem e-mail"}</span>
                    </span>
                    <span className="shrink-0 text-[12.5px] text-muted-foreground">{k.submittedAt ? `enviado ${waitingLabel(k.submittedAt)}` : "em análise"}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PremiumPanel>

        <PremiumPanel title="Quem mais vendeu" icon={CreditCard} description="Volume pago no período, entre os sellers da carteira."
          action={data ? <button type="button" onClick={() => onGo("sellers")} className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">Ver todos<ArrowRight className="h-3.5 w-3.5" /></button> : undefined}>
          {!data ? (
            <p className="py-6 text-[13px] text-muted-foreground">{pending}</p>
          ) : top.length === 0 ? (
            <PremiumEmpty icon={CreditCard} title="Sem vendas pagas no período" subtitle={data.metrics.sellers === 0 ? "Sua carteira ainda não tem sellers. O dono é quem liga sellers a você." : "Troque o período no topo para ver outros dias."} />
          ) : (
            <ol className="m-0 space-y-1 p-0" style={{ listStyle: "none" }}>
              {top.map((s, i) => (
                <li key={s.id}>
                  <button type="button" onClick={() => onOpenSeller(s.id)} className="flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-left hover:bg-muted/50">
                    <span className="w-5 shrink-0 text-center text-[13px] font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">{s.name}</span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[14px] font-semibold tabular-nums text-foreground">{money(s.volume)}</span>
                      <span className="block text-[12px] tabular-nums text-muted-foreground">{int(s.sales)} {s.sales === 1 ? "venda" : "vendas"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </PremiumPanel>
      </div>

      {data?.role === "manager" && (
        <PremiumPanel title="Sua comissão" icon={Coins} description={data.commissionPct !== null ? `${data.commissionPct.toLocaleString("pt-BR")}% sobre o líquido das vendas pagas da carteira.` : "O dono ainda não definiu o seu percentual de comissão."}
          action={<button type="button" onClick={() => onGo("comissao")} className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">Abrir<ArrowRight className="h-3.5 w-3.5" /></button>}>
          <dl className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3">
            <div><dt className="text-[12.5px] text-muted-foreground">Disponível</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums text-foreground">{money(data.metrics.commissionBalance)}</dd></div>
            <div><dt className="text-[12.5px] text-muted-foreground">Gerada no período</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums text-foreground">{money(data.metrics.commissionGenerated)}</dd></div>
            <div><dt className="text-[12.5px] text-muted-foreground">Estornada no período</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums text-foreground">{money(data.metrics.commissionReversed)}</dd></div>
          </dl>
        </PremiumPanel>
      )}
    </div>
  );
}
