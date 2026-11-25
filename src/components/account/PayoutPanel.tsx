import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBankAccounts, usePixKeys } from "@/hooks/useQueryData";
import { StatusPill } from "@/components/seller-ui/tx";
import { hasAddress, payoutChecklist, type KycKey } from "./accountMeta";
import { PanelHead } from "./parts";

/** O que ainda falta para conseguir sacar. Cada linha leva à tela onde se resolve. */
export function PayoutPanel({ kyc, address }: { kyc: KycKey; address: Parameters<typeof hasAddress>[0] }) {
  const pix = usePixKeys();
  const banks = useBankAccounts();
  const { items, ready } = payoutChecklist({ approved: kyc === "approved", kyc, hasAddress: hasAddress(address), pixCount: pix.data?.length ?? 0, bankCount: banks.data?.length ?? 0 });
  const missing = items.filter((i) => !i.optional && !i.done).length;

  return (
    <section className="vp-sheet p-5 sm:p-7" aria-labelledby="account-payout">
      <PanelHead
        id="account-payout"
        title="Para sacar"
        subtitle={ready ? "Tudo certo. Você já pode pedir saques." : `Falta${missing === 1 ? "" : "m"} ${missing} ${missing === 1 ? "passo" : "passos"} para liberar os saques.`}
        aside={ready ? <StatusPill tone="ok" label="Pronto" /> : undefined}
      />
      <ul className="divide-y divide-border overflow-hidden rounded-[16px] border border-border">
        {items.map((i) => {
          const unknown = (i.key === "pix" && pix.isError) || (i.key === "bank" && banks.isError);
          return (
            <li key={i.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-card px-4 py-3.5">
              <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", i.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")} aria-hidden>
                {i.done ? <Check className="h-4 w-4" strokeWidth={3} /> : <span className="h-2 w-2 rounded-full bg-current opacity-60" />}
              </span>
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-[15px] font-semibold text-foreground">{i.label}{i.optional && <span className="ml-2 text-[12.5px] font-medium text-muted-foreground">opcional</span>}<span className="sr-only">{i.done ? ", concluído" : ", pendente"}</span></p>
                <p className="mt-0.5 text-[13.5px] text-muted-foreground">{unknown ? "Não conseguimos conferir agora." : i.text}</p>
              </div>
              {unknown ? (
                <button type="button" className="vp-ghost h-9 px-4 text-[13px]" onClick={() => { void pix.refetch(); void banks.refetch(); }}>Tentar de novo</button>
              ) : i.cta && (
                <Link to={i.to} className={cn(i.done ? "vp-ghost" : "vp-cta", "h-9 px-4 text-[13px]")}>{i.cta}</Link>
              )}
            </li>
          );
        })}
      </ul>
      {ready && <div className="mt-5"><Link to="/financeiro/saques" className="vp-cta h-11">Pedir um saque</Link></div>}
    </section>
  );
}
