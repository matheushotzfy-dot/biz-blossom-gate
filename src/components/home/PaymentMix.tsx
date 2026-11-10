import { PixLogoMark } from "@/components/icons/PixLogoMark";
import { CreditCard } from "lucide-react";

export interface PaymentMixProps {
  total: number; approved: number; customers: number;
  pixTotal: number; pixApproved: number; cardTotal: number; cardApproved: number;
}

const pct = (a: number, t: number) => (t > 0 ? Math.round((a / t) * 100) : 0);

/** Funil de cobranças e divisão Pix x cartão com taxa de aprovação. */
export function PaymentMix(p: PaymentMixProps) {
  const steps = [
    { label: "Cobranças geradas", value: p.total },
    { label: "Pagas", value: p.approved },
    { label: "Clientes únicos", value: p.customers },
  ];
  const max = Math.max(1, p.total);
  const paid = p.pixApproved + p.cardApproved;
  const pixShare = paid > 0 ? (p.pixApproved / paid) * 100 : 50;

  return (
    <section className="vp-panel p-5" aria-label="Conversão e meios de pagamento">
      <div className="flex items-baseline justify-between">
        <p className="vp-label">Conversão</p>
        <span className="text-[22px] font-extrabold text-foreground vp-num">{pct(p.approved, p.total)}%</span>
      </div>
      <ol className="mt-3 space-y-2">
        {steps.map((s, i) => (
          <li key={s.label}>
            <div className="flex justify-between text-[12px]"><span className="text-muted-foreground">{s.label}</span><span className="font-bold text-foreground vp-num">{s.value}</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(s.value / max) * 100}%`, opacity: 1 - i * 0.25 }} />
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-5 border-t border-border pt-4">
        <p className="vp-label">Meios de pagamento</p>
        <div className="mt-2.5 flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          {paid > 0 && <><span className="h-full bg-primary" style={{ width: `${pixShare}%` }} /><span className="h-full bg-info" style={{ width: `${100 - pixShare}%` }} /></>}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Method icon={<PixLogoMark className="h-4 w-4" />} label="Pix" approved={p.pixApproved} total={p.pixTotal} dot="bg-primary" />
          <Method icon={<CreditCard className="h-4 w-4 text-info" />} label="Cartão" approved={p.cardApproved} total={p.cardTotal} dot="bg-info" />
        </div>
      </div>
    </section>
  );
}

function Method({ icon, label, approved, total, dot }: { icon: React.ReactNode; label: string; approved: number; total: number; dot: string }) {
  return (
    <div className="vp-panel-soft p-3">
      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-foreground">{icon}{label}<span className={`ml-auto h-2 w-2 rounded-full ${dot}`} /></div>
      <p className="mt-1.5 text-[18px] font-extrabold text-foreground vp-num">{pct(approved, total)}%</p>
      <p className="text-[11px] text-muted-foreground">{approved} de {total} aprovadas</p>
    </div>
  );
}
