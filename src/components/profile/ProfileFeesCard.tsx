import { useEffect, useState } from "react";
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
  const [methods, setMethods] = useState({ pix: true, card: true, boleto: false });

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("custom_user_fees")
      .select("pix_percentage, pix_fixed, card_percentage, card_fixed, boleto_percentage, boleto_fixed, withdrawal_fee")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setCustom((data as CustomFees) ?? null));
    supabase.from("profiles").select("pix_enabled, credit_card_enabled, boleto_enabled").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => data && setMethods({ pix: data.pix_enabled, card: data.credit_card_enabled, boleto: data.boleto_enabled }));
  }, [user?.id]);

  const pf = (name: string, def = 0) => {
    const f = fees.find((x) => x.name === name);
    return f ? Number(f.value) : def;
  };

  const rows: { label: string; icon: LucideIcon; p: number; f: number; tone: string; enabled: boolean }[] = [
    { label: "Pix", icon: PixLogoMark as unknown as LucideIcon, p: custom?.pix_percentage ?? pf("Taxa PIX"), f: custom?.pix_fixed ?? pf("Taxa Fixa PIX"), tone: "text-success bg-success/10", enabled: methods.pix },
    { label: "Cartão", icon: CreditCard, p: custom?.card_percentage ?? pf("Taxa Cartão"), f: custom?.card_fixed ?? pf("Taxa Fixa Cartão"), tone: "text-info bg-info/10", enabled: methods.card },
    { label: "Boleto", icon: Barcode, p: custom?.boleto_percentage ?? pf("Taxa Boleto Percentual"), f: custom?.boleto_fixed ?? pf("Taxa Fixa Boleto", pf("Taxa Boleto")), tone: "text-warning bg-warning/10", enabled: methods.boleto },
  ];
  const withdraw = custom?.withdrawal_fee ?? pf("Taxa de Saque", 5);
  const isCustom = !!custom;

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
            <span className={cn("text-right font-mono text-[13px] font-bold tabular-nums", r.enabled ? "text-foreground" : "text-muted-foreground")}>
              {r.enabled ? <>{pct(r.p)}{r.f > 0 && <span className="text-muted-foreground"> + {brl(r.f)}</span>}</> : "Desabilitado"}
            </span>
          </li>
        ))}
        <li className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><Wallet className="h-4 w-4" /></span>
          <span className="flex-1 text-[13px] font-semibold text-foreground">Saque</span>
          <span className="font-mono text-[13px] font-bold tabular-nums text-foreground">{brl(withdraw)}</span>
        </li>
      </ul>

    </section>
  );
}
