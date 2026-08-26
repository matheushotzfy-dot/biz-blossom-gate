import { useEffect, useState } from "react";
import { useFees } from "@/hooks/useQueryData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Info, DollarSign, CreditCard, Clock, ChevronDown, Zap, Barcode, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HDShell, HDHeader, HDStat, HDStatGrid } from "@/components/hd/HDPage";
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
    <HDShell>
      <HDHeader
        eyebrow="Estrutura de custos transparente"
        title="Taxas e Tarifas"
        subtitle="Percentual e taxa fixa por método de pagamento, e o prazo de liberação dos recebíveis."
        actions={
          <span className="inline-flex items-center rounded-xl border border-border/50 bg-card px-3.5 py-2 text-[12px] font-medium text-muted-foreground">
            {custom ? "Plano personalizado" : "Plano vigente"}
          </span>
        }
      />

      {/* Method cards — high-density */}
      <HDStatGrid className="lg:grid-cols-3">
        {methodCards.map((m) => (
          <HDStat
            key={m.label}
            label={`Taxa ${m.label}`}
            value={
              <span className="flex items-baseline gap-1.5 flex-wrap">
                {pct(m.percent)}
                <span className="text-sm font-bold text-muted-foreground/60">+</span>
                <span className="text-[20px]">{fmt(m.fixed)}</span>
              </span>
            }
            sub={m.sub}
            icon={m.icon}
            tone={m.tone === "success" ? "success" : m.tone === "warning" ? "warning" : "info"}
          />
        ))}
      </HDStatGrid>


      {/* Withdrawal fee — clean row */}
      <section className="group relative overflow-hidden rounded-[12px] border border-border/50 bg-card px-4 py-4 sm:px-6 sm:py-5 flex items-center gap-4 transition-colors hover:border-border">
        <DollarSign className={cn("h-5 w-5 shrink-0 text-muted-foreground", toneIcon.primary)} strokeWidth={1.75} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">Tarifa de saque</p>
          <p className="mt-1 text-[12px] text-muted-foreground/55 truncate">Fixo por solicitação de saque (Pix)</p>
        </div>
        <span className="font-display text-[26px] font-bold text-foreground tabular-nums leading-none tracking-[-0.03em]">
          {fmt(withdrawFee)}
        </span>
      </section>

      {/* Prazos de liberação — collapsible */}
      <section className="overflow-hidden rounded-[12px] border border-border/50 bg-card">
        <button
          type="button"
          onClick={() => setDeadlinesOpen((v) => !v)}
          aria-expanded={deadlinesOpen}
          className="group w-full flex items-center gap-4 px-4 py-4 sm:px-6 sm:py-5 text-left transition-colors hover:bg-muted/10"
        >
          <Clock className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-[16px] tracking-[-0.01em] text-foreground">Prazos de liberação</p>
            <p className="mt-1 text-[12px] text-muted-foreground/55 truncate">Quando seu saldo fica disponível para saque</p>
          </div>
          <span className="hidden sm:inline text-[12px] text-muted-foreground/60">{deadlines.length} métodos</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground/50 transition-transform duration-300", deadlinesOpen && "rotate-180 text-foreground/70")} strokeWidth={2} />
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
                    className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 transition-colors hover:bg-muted/10"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={cn("h-4 w-4 shrink-0 text-muted-foreground/70", toneIcon[p.tone])} strokeWidth={1.75} />
                      <div className="min-w-0">
                        <p className="text-[14px] font-display font-bold text-foreground tracking-[-0.01em]">{p.label}</p>
                        <p className="text-[12px] text-muted-foreground/55 truncate">{p.sub}</p>
                      </div>
                    </div>
                    <span className="text-[14px] font-display font-bold text-foreground tabular-nums tracking-[-0.01em] shrink-0">
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
      <section className="rounded-[12px] border border-border/50 bg-card px-4 py-4 sm:px-6 sm:py-5 flex items-start gap-3">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground/60" strokeWidth={1.75} />
        <p className="text-[13px] text-muted-foreground/80 leading-relaxed">
          O custo total de cada venda é <span className="font-semibold text-foreground">percentual + taxa fixa</span> sobre o valor da transação.
          As taxas exibidas refletem o seu plano atual. Para volumes superiores a{" "}
          <span className="font-semibold text-foreground tabular-nums">R$ 100.000/mês</span>, fale com seu gerente de conta
          para uma proposta personalizada.
        </p>
      </section>

    </HDShell>
  );
}
