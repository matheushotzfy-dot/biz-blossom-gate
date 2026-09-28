import { useEffect, useMemo, useState } from "react";
import { BadgePercent, Barcode, CreditCard, Wallet, type LucideIcon } from "lucide-react";
import { useFees } from "@/hooks/useQueryData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PixLogoMark } from "@/components/icons/PixLogoMark";
import { cn } from "@/lib/utils";

/** Compact fees card sized to one profile grid cell. Read-only; mirrors Taxas fee resolution. */
type CustomFees = Record<
  "pix_percentage" | "pix_fixed" | "card_percentage" | "card_fixed" | "boleto_percentage" | "boleto_fixed" | "withdrawal_fee",
  number | null
>;

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export function ProfileFeesCard() {
  const { user } = useAuth();
  const { data: fees = [] } = useFees();
  const [custom, setCustom] = useState<CustomFees | null>(null);
  const [amount, setAmount] = useState("100");

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("custom_user_fees")
      .select("pix_percentage, pix_fixed, card_percentage, card_fixed, boleto_percentage, boleto_fixed, withdrawal_fee")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setCustom((data as CustomFees) ?? null));
  }, [user?.id]);

  const pf = (name: string, def = 0) => {
    const f = fees.find((x) => x.name === name);
    return f ? Number(f.value) : def;
  };

  const rows: { label: string; icon: LucideIcon; p: number; f: number; tone: string }[] = [
    { label: "Pix", icon: PixLogoMark as unknown as LucideIcon, p: custom?.pix_percentage ?? pf("Taxa PIX"), f: custom?.pix_fixed ?? pf("Taxa Fixa PIX"), tone: "text-success bg-success/10" },
    { label: "Cartão", icon: CreditCard, p: custom?.card_percentage ?? pf("Taxa Cartão"), f: custom?.card_fixed ?? pf("Taxa Fixa Cartão"), tone: "text-info bg-info/10" },
    { label: "Boleto", icon: Barcode, p: custom?.boleto_percentage ?? pf("Taxa Boleto Percentual"), f: custom?.boleto_fixed ?? pf("Taxa Fixa Boleto", pf("Taxa Boleto")), tone: "text-warning bg-warning/10" },
  ];
  const withdraw = custom?.withdrawal_fee ?? pf("Taxa de Saque", 5);
  const isCustom = !!custom;

  const value = Math.max(0, Number(amount.replace(",", ".")) || 0);
  const pixNet = useMemo(() => Math.max(0, value - (value * rows[0].p) / 100 - rows[0].f), [value, rows[0].p, rows[0].f]);

  return (
    <section className="flex h-full flex-col rounded-2xl border border-border bg-card p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
            <BadgePercent className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground">Suas taxas</h3>
            <p className="text-[11.5px] text-muted-foreground">Custos vigentes da sua conta</p>
          </div>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", isCustom ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
          {isCustom ? "Personalizada" : "Padrão"}
        </span>
      </header>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5 transition-colors hover:border-primary/40">
            <span className={cn("grid h-8 w-8 place-items-center rounded-lg", r.tone)}>
              <r.icon className="h-4 w-4" />
            </span>
            <span className="flex-1 text-[13px] font-semibold text-foreground">{r.label}</span>
            <span className="text-right font-mono text-[13px] font-bold tabular-nums text-foreground">
              {pct(r.p)}
              {r.f > 0 && <span className="text-muted-foreground"> + {brl(r.f)}</span>}
            </span>
          </li>
        ))}
        <li className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><Wallet className="h-4 w-4" /></span>
          <span className="flex-1 text-[13px] font-semibold text-foreground">Saque</span>
          <span className="font-mono text-[13px] font-bold tabular-nums text-foreground">{brl(withdraw)}</span>
        </li>
      </ul>

      <div className="mt-auto pt-4">
        <div className="flex items-center gap-3 rounded-xl bg-secondary/60 p-3">
          <label className="flex flex-1 items-center gap-1.5 text-[12px] text-muted-foreground">
            Venda Pix de
            <span className="font-semibold text-foreground">R$</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, "").slice(0, 10))}
              aria-label="Valor da venda"
              className="w-20 rounded-md border border-border bg-background px-2 py-1 font-mono text-[12px] text-foreground outline-none focus-visible:border-primary"
            />
          </label>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Você recebe</p>
            <p className="font-mono text-sm font-bold tabular-nums text-success">{brl(pixNet)}</p>
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">Pix disponível na hora · Cartão D+30 · Boleto D+1</p>
      </div>
    </section>
  );
}
