import { useEffect, useState } from "react";
import { useFees } from "@/hooks/useQueryData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Info, DollarSign, CreditCard, Zap, Barcode, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PixLogoMark } from "@/components/icons/PixLogoMark";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

type CustomFees = {
  pix_percentage: number | null;
  pix_fixed: number | null;
  card_percentage: number | null;
  card_fixed: number | null;
  boleto_percentage: number | null;
  boleto_fixed: number | null;
  transaction_percentage: number | null;
  transaction_fixed: number | null;
  withdrawal_fee: number | null;
};

export default function Taxas() {
  const { user } = useAuth();
  const { data: fees = [] } = useFees();
  const [custom, setCustom] = useState<CustomFees | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("custom_user_fees")
      .select("pix_percentage, pix_fixed, card_percentage, card_fixed, boleto_percentage, boleto_fixed, transaction_percentage, transaction_fixed, withdrawal_fee")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setCustom(data ?? null));
  }, [user?.id]);

  const platformFee = (exactName: string, def = 0) => {
    const f = fees.find((f) => f.name === exactName);
    return f ? Number(f.value) : def;
  };

  const pixPct    = custom?.pix_percentage    ?? platformFee("Taxa PIX", 0);
  const pixFix    = custom?.pix_fixed         ?? platformFee("Taxa Fixa PIX", 0);
  const cardPct   = custom?.card_percentage   ?? platformFee("Taxa Cartão", 0);
  const cardFix   = custom?.card_fixed        ?? platformFee("Taxa Fixa Cartão", 0);
  const boletoPct = custom?.boleto_percentage ?? platformFee("Taxa Boleto Percentual", 0);
  const boletoFix = custom?.boleto_fixed      ?? platformFee("Taxa Fixa Boleto", platformFee("Taxa Boleto", 0));
  const withdrawFee = custom?.withdrawal_fee  ?? platformFee("Taxa de Saque", 5);

  const methodCards = [
    {
      label: "Pix",
      icon: PixLogoMark as unknown as LucideIcon,
      tone: "success" as const,
      percent: pixPct,
      fixed: pixFix,
      sub: "Receba na hora",
    },
    {
      label: "Cartão",
      icon: CreditCard,
      tone: "info" as const,
      percent: cardPct,
      fixed: cardFix,
      sub: "Até 12x parcelado",
    },
    {
      label: "Boleto",
      icon: Barcode,
      tone: "warning" as const,
      percent: boletoPct,
      fixed: boletoFix,
      sub: "Compensação em 24h",
    },
  ];

  const deadlines: Array<{ label: string; value: string; sub: string; tone: "success" | "info" | "warning"; icon: LucideIcon }> = [
    { label: "Pix", value: "Instantâneo", sub: "Disponível após aprovação", tone: "success", icon: Zap },
    { label: "Cartão (D+7)", value: "24 horas", sub: "Padrão da plataforma", tone: "info", icon: CreditCard },
    { label: "Boleto", value: "D+1", sub: "Após a compensação", tone: "warning", icon: Barcode },
  ];

  return <TaxasView methods={methodCards} withdrawFee={withdrawFee} deadlines={deadlines} personalized={Boolean(custom)} />;
}

type Method = { label: string; icon: LucideIcon; percent: number; fixed: number; sub: string };

function TaxasView({ methods, withdrawFee, deadlines, personalized }: {
  methods: Method[]; withdrawFee: number; personalized: boolean;
  deadlines: Array<{ label: string; value: string; sub: string; icon: LucideIcon }>;
}) {
  const [amount, setAmount] = useState(197);
  const [method, setMethod] = useState(0);
  const m = methods[method];
  const fee = Math.max(amount, 0) * (m.percent / 100) + m.fixed;
  const net = Math.max(amount - fee, 0);
  const effective = amount > 0 ? (fee / amount) * 100 : 0;

  return (
    <div className="mx-auto grid w-full max-w-[1180px] gap-4 pb-14">
      <header className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Financeiro · custos</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Taxas e tarifas</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">O que você paga em cada venda, quando o dinheiro fica disponível e quanto custa sacar.</p>
        </div>
        <span className={cn("inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold", personalized ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
          <span className={cn("h-1.5 w-1.5 rounded-full", personalized ? "bg-primary" : "bg-muted-foreground")} />
          {personalized ? "Taxas personalizadas" : "Taxas padrão da plataforma"}
        </span>
      </header>

      {/* Rate cards */}
      <section className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {methods.map((x) => (
          <div key={x.label} className="bg-card p-5 transition-colors hover:bg-muted/40">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><x.icon className="h-4 w-4 text-primary" />{x.label}</div>
            <p className="mt-4 font-display text-[2rem] font-bold leading-none tabular-nums text-foreground">{pct(x.percent)}</p>
            <p className="mt-2 font-numbers text-sm tabular-nums text-muted-foreground">+ {fmt(x.fixed)} por venda</p>
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">{x.sub}</p>
          </div>
        ))}
        <div className="bg-card p-5 transition-colors hover:bg-muted/40">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><DollarSign className="h-4 w-4 text-primary" />Saque</div>
          <p className="mt-4 font-display text-[2rem] font-bold leading-none tabular-nums text-foreground">{fmt(withdrawFee)}</p>
          <p className="mt-2 text-sm text-muted-foreground">fixo por saque</p>
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">Transferência via Pix</p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        {/* Simulator */}
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Simulador</p>
          <h2 className="mt-1 font-display text-lg font-bold text-foreground">Quanto você recebe</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Valor da venda</span>
              <div className="flex h-12 items-center rounded-lg border border-input bg-background px-3 focus-within:border-primary">
                <span className="text-sm text-muted-foreground">R$</span>
                <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} className="ml-2 w-full bg-transparent font-numbers text-lg font-semibold tabular-nums text-foreground outline-none" aria-label="Valor da venda" />
              </div>
            </label>
            <div role="radiogroup" aria-label="Método" className="flex h-12 rounded-lg border border-border bg-background p-1">
              {methods.map((x, i) => (
                <button key={x.label} type="button" role="radio" aria-checked={i === method} onClick={() => setMethod(i)}
                  className={cn("rounded-md px-3 text-xs font-semibold transition-colors", i === method ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{x.label}</button>
              ))}
            </div>
          </div>
          <dl className="mt-6 grid gap-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Valor bruto</dt><dd className="font-numbers tabular-nums text-foreground">{fmt(amount)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Taxa {m.label} ({pct(m.percent)} + {fmt(m.fixed)})</dt><dd className="font-numbers tabular-nums text-destructive">− {fmt(fee)}</dd></div>
            <div className="flex items-end justify-between border-t border-border pt-4">
              <dt className="font-semibold text-foreground">Você recebe</dt>
              <dd className="font-display text-3xl font-bold tabular-nums text-primary">{fmt(net)}</dd>
            </div>
            <p className="text-right font-mono text-[10px] uppercase text-muted-foreground">Custo efetivo {pct(effective)}</p>
          </dl>
        </section>

        {/* Deadlines */}
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Liberação</p>
          <h2 className="mt-1 font-display text-lg font-bold text-foreground">Prazos de recebimento</h2>
          <ul className="mt-4">
            {deadlines.map((d) => (
              <li key={d.label} className="flex items-center gap-3 border-t border-border py-3.5 first:border-t-0">
                <span className="grid h-9 w-9 place-items-center rounded-md border border-border bg-muted"><d.icon className="h-4 w-4 text-primary" /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">{d.label}</p><p className="text-xs text-muted-foreground">{d.sub}</p></div>
                <span className="font-numbers text-sm font-semibold tabular-nums text-foreground">{d.value}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2 rounded-lg border border-border bg-background p-3 text-xs leading-5 text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            Custo por venda = percentual + taxa fixa. Acima de R$ 100.000/mês, fale com seu gerente para uma proposta personalizada.
          </div>
        </section>
      </div>
    </div>
  );
}
