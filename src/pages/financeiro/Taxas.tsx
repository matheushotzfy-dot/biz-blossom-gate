import { useFees } from "@/hooks/useQueryData";
import { Percent, Info, DollarSign, Calculator, Receipt, ShieldCheck, TrendingDown, Zap, CreditCard, Banknote, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/StatCard";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function Taxas() {
  const { data: fees = [] } = useFees();

  // Find standard fee values (fallback if not in DB yet)
  const getFee = (name: string, def: number) => {
    const f = fees.find(f => f.name.toLowerCase().includes(name.toLowerCase()));
    return f ? f.value : def;
  };

  const pixRate = getFee("pix", 1.99);
  const cardRate = getFee("cartão", 4.99);
  const boletoRate = getFee("boleto", 3.49);
  const withdrawFee = getFee("saque", 5.00);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-foreground tracking-tight uppercase">Taxas e Tarifas</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
            <Percent className="h-3.5 w-3.5 text-primary" />
            Estrutura de custos simplificada e transparente
          </p>
        </div>
      </div>

      {/* Main Rates Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Taxa Pix" 
          value={`${pixRate}%`} 
          icon={Zap} 
          color="success" 
          description="Receba na hora"
        />
        <StatCard 
          title="Taxa Cartão" 
          value={`${cardRate}%`} 
          icon={CreditCard} 
          color="info" 
          description="Até 12x"
        />
        <StatCard 
          title="Taxa Boleto" 
          value={`${boletoRate}%`} 
          icon={Banknote} 
          color="warning" 
          description="Compensação 24h"
        />
        <StatCard 
          title="Tarifa de Saque" 
          value={fmt(withdrawFee)} 
          icon={DollarSign} 
          color="primary" 
          description="Fixo por pedido"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Simulation */}
        <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-border/40">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
                <Calculator size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="font-black text-foreground tracking-tight uppercase">Simulação</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Exemplo de venda (R$ 1.000,00)</p>
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-4 flex-1">
            {[
              { label: "Valor Bruto", value: "R$ 1.000,00", cls: "text-foreground" },
              { label: `Taxa Média (4,5%)`, value: "- R$ 45,00", cls: "text-red-500" },
              { label: "Tarifa Fixa", value: "- R$ 1,00", cls: "text-red-500" },
            ].map((row) => (
              <div key={row.label} className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest">{row.label}</span>
                <span className={cn("text-sm font-black tabular-nums", row.cls)}>{row.value}</span>
              </div>
            ))}
            <div className="pt-4 border-t border-border/40 flex justify-between items-center">
              <span className="text-[12px] font-black text-foreground uppercase tracking-widest">Líquido Estimado</span>
              <span className="text-3xl font-black text-emerald-500 tabular-nums tracking-tighter">R$ 954,00</span>
            </div>
          </div>
        </div>

        {/* Retentions & Deadlines */}
        <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-border/40">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                <Clock size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="font-black text-foreground tracking-tight uppercase">Prazos</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Liberação de recebíveis</p>
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-4 flex-1">
            {[
              { label: "Pix", value: "Instantâneo", sub: "Disponível após aprovação", tone: "success" },
              { label: "Cartão (D+1)", value: "24 horas", sub: "Padrão da plataforma", tone: "info" },
              { label: "Boleto", value: "D+1", sub: "Após a compensação", tone: "warning" },
            ].map((p) => (
              <div key={p.label} className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/60">
                <div>
                  <p className="text-[11px] font-black text-foreground uppercase tracking-widest">{p.label}</p>
                  <p className="text-[10px] font-medium text-muted-foreground/60">{p.sub}</p>
                </div>
                <div className="text-right">
                   <p className="text-xs font-black text-foreground uppercase">{p.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 flex items-start gap-3">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="text-[11px] font-medium text-muted-foreground/80 leading-relaxed">
          As taxas exibidas são baseadas no seu plano atual. Para volumes superiores a R$ 100k/mês, entre em contato com seu gerente de conta para uma proposta personalizada.
        </p>
      </div>
    </div>
  );
}