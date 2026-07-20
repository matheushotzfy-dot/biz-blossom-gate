import { useEffect, useState } from "react";
import { useFees } from "@/hooks/useQueryData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Info, DollarSign, CreditCard, Clock, ChevronDown, Zap, Barcode, type LucideIcon } from "lucide-react";
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
  const [deadlinesOpen, setDeadlinesOpen] = useState(false);

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

  const toneIcon: Record<string, string> = {
    success: "text-success",
    info: "text-info",
    warning: "text-warning",
    primary: "text-primary",
  };
  const toneBar: Record<string, string> = {
    success: "bg-success",
    info: "bg-info",
    warning: "bg-warning",
    primary: "bg-primary",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Estrutura de custos transparente"
        title="Taxas e Tarifas"
        subtitle="Veja o percentual e a taxa fixa aplicados por método de pagamento, e o prazo de liberação dos recebíveis."
        status={{ tone: "info", label: custom ? "Plano personalizado" : "Plano vigente" }}
      />

      {/* Method cards — clean strip */}
      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 sm:grid-cols-3 animate-fade-in stagger-1">
        {methodCards.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="group relative bg-card px-5 py-4 transition-colors hover:bg-muted/20">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/70">Taxa {m.label}</p>
                <Icon className={cn("h-3.5 w-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-90", toneIcon[m.tone])} strokeWidth={2.2} />
              </div>
              <div className="mt-4 flex items-baseline gap-1.5 flex-wrap">
                <span className="font-display text-[26px] font-black text-foreground tabular-nums leading-none tracking-tight">
                  {pct(m.percent)}
                </span>
                <span className="text-sm font-bold text-muted-foreground/60 leading-none">+</span>
                <span className="font-display text-[20px] font-black text-foreground tabular-nums leading-none tracking-tight">
                  {fmt(m.fixed)}
                </span>
              </div>
              <p className="mt-2 truncate text-[11px] font-medium text-muted-foreground/75">{m.sub}</p>
              <span className={cn("pointer-events-none absolute inset-x-0 bottom-0 h-[1.5px] origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100", toneBar[m.tone])} />
            </div>
          );
        })}
      </section>

      {/* Withdrawal fee — clean row */}
      <section className="group relative overflow-hidden rounded-xl border border-border/60 bg-card px-5 py-4 flex items-center gap-3 transition-colors hover:bg-muted/20">
        <DollarSign className={cn("h-3.5 w-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-90", toneIcon.primary)} strokeWidth={2.2} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/70">Tarifa de Saque</p>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground/75 truncate">Fixo por solicitação de saque (Pix)</p>
        </div>
        <span className="font-display text-[24px] font-black text-foreground tabular-nums leading-none tracking-tight">
          {fmt(withdrawFee)}
        </span>
        <span className={cn("pointer-events-none absolute inset-x-0 bottom-0 h-[1.5px] origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100", toneBar.primary)} />
      </section>

      {/* Prazos de liberação — collapsible */}
      <section className="overflow-hidden rounded-xl border border-border/60 bg-card animate-fade-in stagger-2">
        <button
          type="button"
          onClick={() => setDeadlinesOpen((v) => !v)}
          aria-expanded={deadlinesOpen}
          className="group w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/20"
        >
          <Clock className={cn("h-3.5 w-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-90", toneIcon.warning)} strokeWidth={2.2} />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/70">Prazos de liberação</p>
            <p className="mt-1 text-[11px] font-medium text-muted-foreground/75 truncate">Quando seu saldo fica disponível para saque</p>
          </div>
          <span className="hidden sm:inline-flex items-center rounded-md border border-border/60 bg-secondary/40 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground/80">
            {deadlines.length} métodos
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground/70 transition-transform duration-300", deadlinesOpen && "rotate-180 text-primary")} strokeWidth={2.5} />
        </button>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            deadlinesOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="overflow-hidden">
            <div className="border-t border-border/40 divide-y divide-border/40">
              {deadlines.map((p) => {
                const Icon = p.icon;
                return (
                  <div
                    key={p.label}
                    className="group/row flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-muted/20"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={cn("h-3.5 w-3.5 shrink-0 opacity-50", toneIcon[p.tone])} strokeWidth={2.2} />
                      <div className="min-w-0">
                        <p className="text-[13px] font-display font-black text-foreground tracking-tight">{p.label}</p>
                        <p className="text-[11px] text-muted-foreground/75 font-medium truncate">{p.sub}</p>
                      </div>
                    </div>
                    <span className="text-[13px] font-display font-black text-foreground tabular-nums tracking-tight shrink-0">
                      {p.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Info footer */}
      <section className="rounded-xl border border-border/60 bg-card px-5 py-4 flex items-start gap-3 animate-fade-in stagger-3">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-50 text-info" strokeWidth={2.2} />
        <p className="text-[12px] text-muted-foreground leading-relaxed font-medium">
          O custo total de cada venda é <span className="font-black text-foreground">percentual + taxa fixa</span> sobre o valor da transação.
          As taxas exibidas refletem o seu plano atual. Para volumes superiores a{" "}
          <span className="font-black text-foreground tabular-nums">R$ 100.000/mês</span>, fale com seu gerente de conta
          para uma proposta personalizada.
        </p>
      </section>
    </div>
  );
}
