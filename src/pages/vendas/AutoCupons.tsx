import { useState } from "react";
import { PageShell, PageTitle, Panel } from "@/components/PageShell";
import { Ticket, Plus, Clock, Percent, ShoppingCart, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AutoCouponRule = {
  id: string;
  name: string;
  trigger: string;
  discountType: string;
  discountValue: number;
  maxUses: number;
  isActive: boolean;
};

const TRIGGER_OPTIONS = [
  { value: "abandoned_cart", label: "Carrinho Abandonado (30min)" },
  { value: "first_purchase", label: "Primeira Compra" },
  { value: "birthday", label: "Aniversário do Cliente" },
  { value: "inactive_30d", label: "Inativo há 30 dias" },
  { value: "referral", label: "Indicação de Amigo" },
];

const DEMO_RULES: AutoCouponRule[] = [
  { id: "1", name: "Resgate Carrinho", trigger: "abandoned_cart", discountType: "percentage", discountValue: 10, maxUses: 1, isActive: true },
  { id: "2", name: "Boas-vindas", trigger: "first_purchase", discountType: "percentage", discountValue: 15, maxUses: 1, isActive: true },
];

export default function AutoCupons() {
  const [rules] = useState<AutoCouponRule[]>(DEMO_RULES);
  const [showForm, setShowForm] = useState(false);

  return (
    <PageShell>
      <div className="flex items-center justify-between">
        <PageTitle icon={<Ticket className="h-6 w-6" />} title="Cupons Automáticos" subtitle="Gere cupons inteligentes baseados em comportamento" />
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nova Regra
        </button>
      </div>

      {showForm && (
        <Panel className="space-y-4 animate-in slide-in-from-top-2">
          <h3 className="text-base font-bold text-foreground">Nova Regra de Cupom Automático</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <input placeholder="Nome da regra" className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none" />
            <select className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm text-foreground focus:border-primary/50 focus:outline-none">
              {TRIGGER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <select className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm text-foreground focus:border-primary/50 focus:outline-none">
                <option value="percentage">Porcentagem (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </select>
              <input type="number" placeholder="Valor" className="w-24 rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm text-foreground focus:border-primary/50 focus:outline-none" />
            </div>
            <input type="number" placeholder="Uso máximo por cliente" className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none" />
          </div>
          <button className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90">
            Criar Regra
          </button>
        </Panel>
      )}

      <div className="space-y-3">
        {rules.map((rule) => {
          const trigger = TRIGGER_OPTIONS.find((t) => t.value === rule.trigger);
          return (
            <Panel key={rule.id} className="flex items-center gap-4">
              <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", rule.isActive ? "bg-primary/10" : "bg-muted/30")}>
                <Ticket className={cn("h-6 w-6", rule.isActive ? "text-primary" : "text-muted-foreground")} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-foreground">{rule.name}</h4>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                    rule.isActive ? "bg-success/10 text-success" : "bg-muted/30 text-muted-foreground"
                  )}>
                    {rule.isActive ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{trigger?.label}</span>
                  <span className="flex items-center gap-1">
                    <Percent className="h-3 w-3" />
                    {rule.discountType === "percentage" ? `${rule.discountValue}%` : `R$ ${rule.discountValue}`} off
                  </span>
                  <span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3" />Max {rule.maxUses}x</span>
                </div>
              </div>
              <button className="rounded-xl bg-muted/30 p-2 hover:bg-destructive/10 transition">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </button>
            </Panel>
          );
        })}
      </div>
    </PageShell>
  );
}
