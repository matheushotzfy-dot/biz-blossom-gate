import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Barcode, CreditCard, Info, Landmark, type LucideIcon } from "lucide-react";
import { useFees } from "@/hooks/useQueryData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PixLogoMark } from "@/components/icons/PixLogoMark";
import { Money } from "@/components/home/Money";
import { PageHead } from "@/components/seller-ui/PageHead";
import { SectionTabs } from "@/components/seller-ui/SectionTabs";
import { StatusPill } from "@/components/seller-ui/tx";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const pctParts = (v: number) => {
  const [int, dec] = v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split(",");
  return { int, dec };
};

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

type Column = {
  key: string;
  label: string;
  icon: LucideIcon;
  sub: string;
  /** Percentual por venda. Ausente na coluna de saque, que cobra um valor fixo. */
  percent?: number;
  fixed: number;
  /** Quando o dinheiro fica disponível. */
  release?: { value: string | null; note: string };
};

export default function Taxas() {
  const { user } = useAuth();
  const { data: fees = [], isLoading: feesLoading, isError: feesError } = useFees();
  const [custom, setCustom] = useState<CustomFees | null>(null);
  const [customLoading, setCustomLoading] = useState(true);
  const [customError, setCustomError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // undefined = carregando, null = não deu para ler
  const [cardDays, setCardDays] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    if (!user?.id) return;
    let ignore = false;
    setCustomError(false);
    setCustomLoading(true);
    supabase
      .from("custom_user_fees")
      .select("pix_percentage, pix_fixed, card_percentage, card_fixed, boleto_percentage, boleto_fixed, transaction_percentage, transaction_fixed, withdrawal_fee")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (ignore) return;
        setCustomLoading(false);
        if (error) { setCustomError(true); return; }
        setCustom(data ?? null);
      });
    return () => { ignore = true; };
  }, [user?.id, reloadKey]);

  // Prazo do cartão: o que vale para a sua conta (ajuste individual, senão o da plataforma).
  useEffect(() => {
    if (!user?.id) return;
    let ignore = false;
    supabase.rpc("get_card_release_days", { _user_id: user.id }).then(({ data, error }) => {
      if (ignore) return;
      setCardDays(!error && typeof data === "number" ? data : null);
    });
    return () => { ignore = true; };
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

  const columns: Column[] = [
    { key: "pix", label: "Pix", icon: PixLogoMark as unknown as LucideIcon, sub: "Receba na hora", percent: pixPct, fixed: pixFix, release: { value: "Na hora", note: "Assim que for aprovado" } },
    {
      key: "card", label: "Cartão", icon: CreditCard, sub: "Até 12x parcelado", percent: cardPct, fixed: cardFix,
      release: { value: cardDays ? `D+${cardDays}` : null, note: cardDays === null ? "Não foi possível carregar o prazo" : "Contado a partir da venda" },
    },
    { key: "boleto", label: "Boleto", icon: Barcode, sub: "Compensação em 24h", percent: boletoPct, fixed: boletoFix, release: { value: "D+1", note: "Depois da compensação" } },
    { key: "withdraw", label: "Saque", icon: Landmark, sub: "Transferência via Pix", fixed: withdrawFee },
  ];

  const loading = feesLoading || customLoading;
  const personalized = Boolean(custom);

  return (
    <div className="space-y-6 pb-10">
      <SectionTabs section="money" />
      <PageHead
        title="Taxas e prazos"
        subtitle="O que você paga em cada venda, quando o dinheiro fica disponível e quanto custa sacar."
        actions={!loading && !customError && !feesError && <StatusPill tone={personalized ? "ok" : "idle"} label={personalized ? "Taxas personalizadas" : "Taxas padrão da plataforma"} className="h-9 px-4 text-[13.5px]" />}
      />

      {(customError || feesError) && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-destructive/10 px-5 py-4 text-[14px] text-destructive">
          <span>{customError ? "Não conseguimos carregar suas taxas personalizadas. Os valores abaixo podem não ser os seus." : "Não conseguimos carregar as taxas da plataforma. Os valores abaixo podem estar incompletos."}</span>
          {customError && <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="vp-ghost h-9 text-[13px] text-destructive">Tentar de novo</button>}
        </div>
      )}

      <section className="vp-sheet overflow-hidden" aria-label="Tabela de taxas">
        <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x [&>*:nth-child(n+3)]:sm:border-t [&>*:nth-child(n+3)]:sm:border-border lg:[&>*:nth-child(n+3)]:border-t-0 sm:[&>*:nth-child(even)]:border-l sm:[&>*:nth-child(even)]:border-border lg:[&>*:nth-child(even)]:border-l-0">
          {columns.map((c) => {
            const p = c.percent !== undefined ? pctParts(c.percent) : null;
            return (
              <article key={c.key} className="flex flex-col p-6 sm:p-7">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><c.icon className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-extrabold tracking-[-0.02em] text-foreground">{c.label}</h2>
                    <p className="text-[13px] text-muted-foreground">{c.sub}</p>
                  </div>
                </div>

                {loading ? (
                  <span className="vp-skel mt-7 block h-[50px] w-36" />
                ) : p ? (
                  <p className="vp-num mt-7 text-[48px] font-extrabold leading-none tracking-[-0.05em] text-foreground">
                    {p.int}<span className="text-[0.55em] font-bold opacity-60">,{p.dec}%</span>
                  </p>
                ) : (
                  <Money value={c.fixed} className="mt-7 block text-[48px] font-extrabold leading-none tracking-[-0.05em] text-foreground" centsClassName="opacity-60" />
                )}
                {p && !loading && <p className="mt-2.5 text-[14.5px] tabular-nums text-muted-foreground">+ {fmt(c.fixed)} por venda</p>}
                {!p && !loading && <p className="mt-2.5 text-[14.5px] text-muted-foreground">fixo por saque</p>}

                {c.release && (
                  <div className="mt-auto pt-7">
                    <div className="border-t border-border pt-4">
                      <p className="text-[13px] text-muted-foreground">Dinheiro disponível</p>
                      {c.release.value === null && cardDays === undefined ? (
                        <span className="vp-skel mt-1 block h-6 w-16" />
                      ) : (
                        <p className="mt-0.5 text-[19px] font-extrabold tracking-[-0.02em] text-foreground">{c.release.value ?? "—"}</p>
                      )}
                      <p className="mt-0.5 text-[13px] text-muted-foreground">{c.release.note}</p>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <aside className="flex items-start gap-3.5 rounded-2xl bg-muted/60 p-4 sm:p-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Info className="h-[18px] w-[18px]" /></span>
        <p className="text-[14.5px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Como o custo é calculado:</span> em cada venda você paga o percentual mais a taxa fixa. Vendendo acima de R$ 100.000 por mês, <Link to="/suporte" className="font-semibold text-primary underline-offset-2 hover:underline">fale com o suporte</Link> para pedir uma proposta personalizada.
        </p>
      </aside>
    </div>
  );
}
