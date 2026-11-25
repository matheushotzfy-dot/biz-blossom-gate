import { Link } from "react-router-dom";
import { Barcode, CreditCard, Landmark, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useFees } from "@/hooks/useQueryData";
import { PixLogoMark } from "@/components/icons/PixLogoMark";
import { StatusPill } from "@/components/seller-ui/tx";
import { PanelHead } from "./parts";
import { useCardReleaseDays, useCustomFees } from "./useAccountData";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/**
 * Resumo das taxas desta conta. A conta completa (com prazos) fica em Taxas e prazos; aqui a regra é a mesma:
 * valor combinado com a conta ganha do padrão da plataforma.
 */
export function FeesPanel() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const platform = useFees();
  const custom = useCustomFees(user?.id);
  const cardDays = useCardReleaseDays(user?.id).data;

  const loading = platform.isLoading || custom.isLoading;
  const failed = platform.isError || custom.isError;
  const base = (name: string, def = 0) => { const f = platform.data?.find((x) => x.name === name); return f ? Number(f.value) : def; };
  const c = custom.data;

  const rows: { key: string; label: string; icon: LucideIcon; value: string | null; extra?: string; off?: boolean; release?: string }[] = [
    { key: "pix", label: "Pix", icon: PixLogoMark as unknown as LucideIcon, off: profile?.pix_enabled === false, release: "Cai na hora", value: pct(c?.pix_percentage ?? base("Taxa PIX")), extra: brl(c?.pix_fixed ?? base("Taxa Fixa PIX")) },
    { key: "card", label: "Cartão", icon: CreditCard, off: profile?.credit_card_enabled === false, release: cardDays ? `Cai em ${cardDays} ${cardDays === 1 ? "dia" : "dias"}` : undefined, value: pct(c?.card_percentage ?? base("Taxa Cartão")), extra: brl(c?.card_fixed ?? base("Taxa Fixa Cartão")) },
    { key: "boleto", label: "Boleto", icon: Barcode, off: profile?.boleto_enabled === false, release: "Cai 1 dia depois de compensar", value: pct(c?.boleto_percentage ?? base("Taxa Boleto Percentual")), extra: brl(c?.boleto_fixed ?? base("Taxa Fixa Boleto", base("Taxa Boleto"))) },
    { key: "withdraw", label: "Saque", icon: Landmark, release: "Cobrado a cada saque", value: brl(c?.withdrawal_fee ?? base("Taxa de Saque", 5)) },
  ];

  return (
    <section className="vp-sheet flex flex-col p-5 sm:p-7" aria-labelledby="account-fees">
      <PanelHead
        id="account-fees"
        title="Suas taxas"
        subtitle="O que você paga em cada venda e em cada saque."
        aside={!loading && !failed ? <StatusPill tone={c ? "ok" : "idle"} label={c ? "Personalizadas" : "Padrão"} /> : undefined}
      />

      {failed ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-destructive/10 px-4 py-3.5 text-[14px] text-destructive">
          <span>Não conseguimos carregar suas taxas.</span>
          <button type="button" className="vp-ghost h-9 text-[13px] text-destructive" onClick={() => { void platform.refetch(); void custom.refetch(); }}>Tentar de novo</button>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[16px] border border-border">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-3.5 bg-card px-4 py-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><r.icon className="h-[18px] w-[18px]" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-foreground">{r.label}</span>
                {r.release && !r.off && <span className="mt-0.5 block text-[13px] text-muted-foreground">{r.release}</span>}
              </span>
              {loading ? <span className="vp-skel block h-5 w-24" /> : r.off ? (
                <span className="text-[14px] text-muted-foreground">Desativado na sua conta</span>
              ) : (
                <span className="vp-num text-right text-[15px] font-bold tabular-nums text-foreground">
                  {r.value}{r.extra && <span className="font-medium text-muted-foreground"> + {r.extra}</span>}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-5">
        <Link to="/financeiro/taxas" className="text-[14px] font-semibold text-primary underline-offset-2 hover:underline">Ver taxas e prazos de liberação</Link>
      </div>
    </section>
  );
}
