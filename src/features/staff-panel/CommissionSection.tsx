import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, History, Loader2, Send, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ToneTag } from "@/features/admin-disputes/parts";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import {
  PAYOUT_STATUS, availableForPayout, checkPayout, dayTime, ledgerLabel, money, staffError, type LedgerRow, type Payout, type Portfolio,
} from "./staffPanelModel";

/** Comissão do gerente: saldo, o que entrou e saiu, e o pedido de pagamento (o dono paga por fora e marca como pago). */
export default function CommissionSection({ data, range }: { data: Portfolio; range: { from: Date; to: Date } }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const uid = user?.id ?? "";
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payouts = useQuery({
    queryKey: ["staff-commission", "payouts", uid],
    enabled: !!uid,
    queryFn: async (): Promise<Payout[]> => {
      const { data: rows, error: e } = await supabase.from("staff_commission_payouts").select("id,amount,status,method,notes,created_at,processed_at").eq("staff_user_id", uid).order("created_at", { ascending: false }).limit(30);
      if (e) throw e;
      return (rows ?? []).map((r) => ({ id: r.id, amount: Number(r.amount) || 0, status: r.status ?? "pending", method: r.method, notes: r.notes, createdAt: r.created_at, processedAt: r.processed_at }));
    },
  });
  const ledger = useQuery({
    queryKey: ["staff-commission", "ledger", uid, range.from.toISOString(), range.to.toISOString()],
    enabled: !!uid,
    queryFn: async (): Promise<LedgerRow[]> => {
      const { data: rows, error: e } = await supabase.from("staff_commissions_ledger").select("id,type,amount,balance_after,description,created_at")
        .eq("staff_user_id", uid).gte("created_at", range.from.toISOString()).lte("created_at", range.to.toISOString())
        .order("created_at", { ascending: false }).limit(100);
      if (e) throw e;
      return (rows ?? []).map((r) => ({ id: r.id, type: r.type ?? "", amount: Number(r.amount) || 0, balanceAfter: Number(r.balance_after) || 0, description: r.description, createdAt: r.created_at }));
    },
  });

  const m = data.metrics;
  const available = availableForPayout(m.commissionBalance, payouts.data ?? []);
  const pendingTotal = (payouts.data ?? []).filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const check = checkPayout(amount, available);

  const request = async () => {
    setTried(true); setError(null);
    if (busy || !check.amount || !uid) return;
    setBusy(true);
    try {
      const { error: e } = await supabase.from("staff_commission_payouts").insert({ staff_user_id: uid, amount: check.amount, method: "pix", notes: note.trim() || null });
      if (e) { setError(staffError(e)); return; }
      toast.success("Pedido de pagamento enviado ao dono.");
      setAmount(""); setNote(""); setTried(false);
      void qc.invalidateQueries({ queryKey: ["staff-commission"] });
      void qc.invalidateQueries({ queryKey: ["staff-portfolio"] });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <AdminPageHeader title="Comissão"
        subtitle={data.commissionPct !== null ? `Você recebe ${data.commissionPct.toLocaleString("pt-BR")}% do líquido de cada venda paga da carteira. Reembolso e chargeback estornam a comissão daquela venda.` : "O dono ainda não definiu o seu percentual de comissão."} />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={Wallet} label="Saldo" value={money(m.commissionBalance)} sub="comissão acumulada menos o já pago" />
        <PremiumMetric icon={Send} label="Pode pedir" value={money(available)} tone={available > 0 ? "success" : undefined} sub={pendingTotal > 0 ? `${money(pendingTotal)} já pedidos` : "nada pedido em aberto"} />
        <PremiumMetric icon={Coins} label="Gerada no período" value={money(m.commissionGenerated)} />
        <PremiumMetric icon={History} label="Estornada no período" value={money(m.commissionReversed)} tone={m.commissionReversed > 0 ? "warning" : undefined} />
      </PremiumMetricGrid>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <PremiumPanel title="Pedir pagamento" icon={Send} description="O dono recebe o pedido, paga por Pix e marca como pago. O valor sai do seu saldo quando ele marcar.">
          <div className="space-y-4">
            <div>
              <label htmlFor="payout-amount" className="text-[13.5px] font-semibold text-foreground">Valor</label>
              <div className="relative mt-2">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[14px] text-muted-foreground">R$</span>
                <input id="payout-amount" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setError(null); }} placeholder="0,00"
                  aria-invalid={(tried && !!check.error) || undefined} aria-describedby="payout-amount-hint"
                  className="h-12 w-full rounded-[12px] bg-background pr-4 text-[16px] tabular-nums text-foreground focus:outline-none" style={{ paddingLeft: 44, border: `1px solid hsl(var(--${tried && check.error ? "destructive" : "border"}))` }} />
              </div>
              <p id="payout-amount-hint" className={tried && check.error ? "mt-1.5 text-[12.5px] font-medium text-destructive" : "mt-1.5 text-[12.5px] text-muted-foreground"}>
                {tried && check.error ? check.error : `Até ${money(available)}.`}
                {available > 0 && <button type="button" className="ml-2 font-semibold text-primary underline-offset-2 hover:underline" onClick={() => setAmount(available.toLocaleString("pt-BR", { minimumFractionDigits: 2 }))}>Pedir tudo</button>}
              </p>
            </div>
            <div>
              <label htmlFor="payout-note" className="text-[13.5px] font-semibold text-foreground">Recado para o dono <span className="font-normal text-muted-foreground">(opcional)</span></label>
              <input id="payout-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Ex.: chave Pix de sempre"
                className="mt-2 h-11 w-full rounded-[12px] bg-background px-4 text-[14px] text-foreground focus:outline-none" style={{ border: "1px solid hsl(var(--border))" }} />
            </div>
            {error && <p role="alert" className="text-[13px] font-medium text-destructive">{error}</p>}
            <button type="button" onClick={() => void request()} disabled={busy || available <= 0} className="vp-cta vp-r12 h-11 w-full justify-center px-5 sm:w-auto">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar pedido
            </button>
          </div>
        </PremiumPanel>

        <PremiumPanel title="Pedidos de pagamento" icon={Wallet}>
          {payouts.isError ? <ErrorBlock title="Não foi possível carregar os pedidos." error={payouts.error} onRetry={() => void payouts.refetch()} />
            : payouts.isPending ? <p className="py-6 text-[13px] text-muted-foreground">Carregando…</p>
              : (payouts.data ?? []).length === 0 ? <PremiumEmpty icon={Wallet} title="Nenhum pedido ainda" subtitle="Quando houver saldo, peça o pagamento ao lado." />
                : (
                  <ul className="m-0 space-y-1.5 p-0" style={{ listStyle: "none" }}>
                    {(payouts.data ?? []).map((p) => {
                      const st = PAYOUT_STATUS[p.status] ?? { label: p.status, tone: "neutral" as const };
                      return (
                        <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] px-3 py-2.5" style={{ border: "1px solid hsl(var(--border) / .7)" }}>
                          <span className="min-w-0">
                            <span className="block text-[14px] font-semibold tabular-nums text-foreground">{money(p.amount)}</span>
                            <span className="block text-[12.5px] text-muted-foreground">Pedido em {dayTime(p.createdAt)}{p.processedAt ? `, pago em ${dayTime(p.processedAt)}` : ""}</span>
                            {p.notes && <span className="block truncate text-[12.5px] text-muted-foreground">Recado: {p.notes}</span>}
                          </span>
                          <ToneTag tone={st.tone}>{st.label}</ToneTag>
                        </li>
                      );
                    })}
                  </ul>
                )}
        </PremiumPanel>
      </div>

      <PremiumPanel title="Movimentos no período" icon={History} description="Cada comissão, estorno e pagamento, com o saldo depois de cada um.">
        {ledger.isError ? <ErrorBlock title="Não foi possível carregar os movimentos." error={ledger.error} onRetry={() => void ledger.refetch()} />
          : ledger.isPending ? <p className="py-6 text-[13px] text-muted-foreground">Carregando…</p>
            : (ledger.data ?? []).length === 0 ? <PremiumEmpty icon={History} title="Nenhum movimento no período" subtitle="Troque o período no topo para ver outros dias." />
              : (
                <ul className="m-0 space-y-1 p-0" style={{ listStyle: "none" }}>
                  {(ledger.data ?? []).map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 hover:bg-muted/40">
                      <span className="min-w-0">
                        <span className="block text-[14px] font-medium text-foreground">{ledgerLabel(r.type)}</span>
                        <span className="block truncate text-[12.5px] text-muted-foreground">{dayTime(r.createdAt)}{r.description ? `, ${r.description}` : ""}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={r.amount < 0 ? "block text-[14px] font-semibold tabular-nums text-destructive" : "block text-[14px] font-semibold tabular-nums text-success"}>{r.amount < 0 ? "−" : "+"}{money(Math.abs(r.amount))}</span>
                        <span className="block text-[12px] tabular-nums text-muted-foreground">saldo {money(r.balanceAfter)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
      </PremiumPanel>
    </div>
  );
}
