import { useEffect, useState } from "react";
import { useFees } from "@/hooks/useQueryData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Info, DollarSign, CreditCard, Banknote, Clock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
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

  // Match by exact platform fee name set in admin panel
  const platformFee = (exactName: string, def = 0) => {
    const f = fees.find((f) => f.name === exactName);
    return f ? Number(f.value) : def;
  };

  // Resolution order: per-seller custom → platform default (admin panel) → 0
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
      icon: Banknote,
      tone: "warning" as const,
      percent: boletoPct,
      fixed: boletoFix,
      sub: "Compensação em 24h",
    },
  ];

  const deadlines = [
    { label: "Pix", value: "Instantâneo", sub: "Disponível após aprovação", tone: "success" as const },
    { label: "Cartão (D+1)", value: "24 horas", sub: "Padrão da plataforma", tone: "info" as const },
    { label: "Boleto", value: "D+1", sub: "Após a compensação", tone: "warning" as const },
  ];

  const toneCls: Record<string, string> = {
    success: "bg-success/10 text-success",
    info: "bg-info/10 text-info",
    warning: "bg-warning/10 text-warning",
    primary: "bg-primary/10 text-primary",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Estrutura de custos transparente"
        title="Taxas e Tarifas"
        subtitle="Veja o percentual e a taxa fixa aplicados por método de pagamento, e o prazo de liberação dos recebíveis."
        status={{ tone: "info", label: custom ? "Plano personalizado" : "Plano vigente" }}
      />

      {/* Method cards — percentual + fixa juntos */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 animate-fade-in stagger-1">
        {methodCards.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="group relative isolate bg-card rounded-[20px] border border-border/70 overflow-hidden p-5 transition-[transform,border-color,box-shadow,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-primary/55 hover:bg-primary/[0.035] hover:shadow-[0_22px_50px_-22px_hsl(var(--primary)/0.45)]"
            >
              {/* top sheen */}
              <span className="pointer-events-none absolute inset-x-4 top-0 z-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              {/* left rail */}
              <span className="pointer-events-none absolute left-0 top-5 bottom-5 z-0 w-[3px] origin-center scale-y-50 rounded-r-full bg-primary opacity-0 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100 group-hover:opacity-100" />
              {/* diagonal sweep */}
              <span className="pointer-events-none absolute inset-0 z-0 -translate-x-[120%] bg-[linear-gradient(115deg,transparent_0%,hsl(var(--primary)/0.10)_44%,transparent_72%)] opacity-0 transition-[transform,opacity] duration-700 ease-out group-hover:translate-x-[120%] group-hover:opacity-100" />

              <div className="relative z-10 flex items-center justify-between mb-4">
                <div
                  className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110 group-hover:-rotate-6",
                    toneCls[m.tone],
                  )}
                >
                  <Icon className="h-4.5 w-4.5" strokeWidth={2.25} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/60">
                  por transação
                </span>
              </div>

              <p className="relative z-10 text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Taxa {m.label}
              </p>

              <div className="relative z-10 flex items-baseline gap-1.5 flex-wrap">
                <span className="font-display text-[26px] sm:text-[28px] font-black text-foreground tabular-nums leading-none tracking-[-0.02em] transition-colors duration-300 group-hover:text-primary">
                  {pct(m.percent)}
                </span>
                <span className="text-base font-black text-muted-foreground/70 leading-none">+</span>
                <span className="font-display text-[20px] sm:text-[22px] font-black text-foreground tabular-nums leading-none tracking-[-0.02em]">
                  {fmt(m.fixed)}
                </span>
              </div>

              <div className="relative z-10 mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">{m.sub}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
                  % + fixa
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {/* Withdrawal fee — destacada */}
      <section className="group relative isolate bg-card rounded-[20px] border border-border/70 overflow-hidden p-5 flex items-center gap-3 sm:gap-4 animate-fade-in transition-[transform,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-primary/55 hover:shadow-[0_18px_44px_-22px_hsl(var(--primary)/0.45)]">
        <span className="pointer-events-none absolute inset-0 z-0 -translate-x-[120%] bg-[linear-gradient(115deg,transparent_0%,hsl(var(--primary)/0.08)_44%,transparent_72%)] opacity-0 transition-[transform,opacity] duration-700 ease-out group-hover:translate-x-[120%] group-hover:opacity-100" />
        <div className={cn("relative z-10 h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6", toneCls.primary)}>
          <DollarSign className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <div className="relative z-10 flex-1 min-w-0">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Tarifa de Saque</p>
          <p className="text-[11px] text-muted-foreground/70 font-medium truncate">Fixo por solicitação de saque (Pix)</p>
        </div>
        <span className="relative z-10 font-display text-[22px] sm:text-[26px] font-black text-foreground tabular-nums leading-none tracking-[-0.02em] transition-colors duration-300 group-hover:text-primary">
          {fmt(withdrawFee)}
        </span>
      </section>

      {/* Prazos de liberação */}
      <section className="bg-card rounded-[24px] border border-border shadow-sm overflow-hidden animate-fade-in stagger-2">
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border/50">
          <div className="h-7 w-7 rounded-md bg-warning/10 text-warning flex items-center justify-center">
            <Clock className="h-3.5 w-3.5" strokeWidth={2.25} />
          </div>
          <div>
            <h2 className="text-[14px] font-display font-black text-foreground tracking-[-0.01em]">Prazos de liberação</h2>
            <p className="text-[11px] text-muted-foreground/70 font-medium">Quando seu saldo fica disponível para saque.</p>
          </div>
        </div>
        <div className="divide-y divide-border/40">
          {deadlines.map((p) => (
            <div key={p.label} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn("h-9 w-9 rounded-md flex items-center justify-center shrink-0", toneCls[p.tone])}>
                  <Clock className="h-3.5 w-3.5" strokeWidth={2.25} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-display font-black text-foreground tracking-tight">{p.label}</p>
                  <p className="text-[11px] text-muted-foreground/70 font-medium truncate">{p.sub}</p>
                </div>
              </div>
              <span className="text-[13px] font-display font-black text-foreground tabular-nums tracking-tight shrink-0">
                {p.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Info footer */}
      <section className="bg-card rounded-[24px] border border-border shadow-sm overflow-hidden animate-fade-in stagger-3">
        <div className="flex items-start gap-3 px-5 py-4">
          <div className="h-7 w-7 rounded-md bg-info/10 text-info flex items-center justify-center shrink-0">
            <Info className="h-3.5 w-3.5" strokeWidth={2.25} />
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed font-medium">
            O custo total de cada venda é <span className="font-black text-foreground">percentual + taxa fixa</span> sobre o valor da transação.
            As taxas exibidas refletem o seu plano atual. Para volumes superiores a{" "}
            <span className="font-black text-foreground tabular-nums">R$ 100.000/mês</span>, fale com seu gerente de conta
            para uma proposta personalizada.
          </p>
        </div>
      </section>
    </div>
  );
}
