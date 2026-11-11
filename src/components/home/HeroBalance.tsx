import { ArrowDownToLine, ArrowRight, Eye, EyeOff, MoreHorizontal, QrCode, Share2, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import cardImg from "@/assets/vp-card-3d.webp";
import { Money } from "./Money";
import { cn } from "@/lib/utils";

export interface HeroAction { label: string; hint: string; icon: typeof QrCode; onClick: () => void; main?: boolean }

export interface HeroBalanceProps {
  available: number;
  pending: number;
  disputed: number;
  trend?: number;
  hidden: boolean;
  onTogglePrivacy: () => void;
  onPix: () => void;
  onWithdraw: () => void;
  onCharge: () => void;
  onMore: () => void;
}

/** Topo do Início: cartão 3D da marca, saldo protagonista, ações redondas e cartão de destaque. */
export function HeroBalance(p: HeroBalanceProps) {
  const actions: HeroAction[] = [
    { label: "Pix", hint: "Cobrar via Pix", icon: QrCode, onClick: p.onPix, main: true },
    { label: "Sacar", hint: "Para sua conta", icon: ArrowDownToLine, onClick: p.onWithdraw },
    { label: "Cobrar", hint: "Link de pagamento", icon: Share2, onClick: p.onCharge },
    { label: "Mais", hint: "Ver todos", icon: MoreHorizontal, onClick: p.onMore },
  ];
  const up = (p.trend ?? 0) >= 0;

  return (
    <section className="grid items-center gap-6 xl:grid-cols-[minmax(0,1fr)_340px]" aria-label="Saldo">
      <div className="grid items-center gap-4 md:grid-cols-[minmax(240px,0.9fr)_minmax(0,1.1fr)]">
        <div className="relative mx-auto w-full max-w-[420px]">
          <div className="vp-card-plinth absolute inset-x-6 bottom-0 h-16" aria-hidden />
          <img src={cardImg} alt="Cartão Vemprapay" width={900} height={630} className="vp-card-float relative w-full select-none" draggable={false} />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Saldo disponível</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <Money value={Math.max(p.available, 0)} hidden={p.hidden} className="text-[42px] font-extrabold leading-none text-foreground sm:text-[54px]" centsClassName="opacity-100" />
            <button onClick={p.onTogglePrivacy} aria-label={p.hidden ? "Mostrar valores" : "Ocultar valores"} className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              {p.hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px]">
            {p.trend !== undefined && (
              <span className={cn("inline-flex items-center gap-1 font-semibold", up ? "vp-glow-text" : "text-destructive")}>
                {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}{up ? "+" : "−"}{Math.abs(p.trend)}% no período
              </span>
            )}
            <span className="text-muted-foreground">A liberar <Money value={p.pending} hidden={p.hidden} className="font-semibold text-foreground" /></span>
            {p.disputed > 0 && <span className="text-warning">Em análise <Money value={p.disputed} hidden={p.hidden} className="font-semibold" /></span>}
          </p>

          <ul className="mt-7 flex gap-5 sm:gap-7">
            {actions.map((a) => (
              <li key={a.label} className="text-center">
                <button onClick={a.onClick} className={cn("vp-orb mx-auto", a.main && "vp-orb-main")} aria-label={a.hint}>
                  <a.icon className="h-6 w-6" strokeWidth={2.1} />
                </button>
                <span className="mt-2.5 block text-[13.5px] font-semibold text-foreground">{a.label}</span>
                <span className="hidden max-w-[84px] text-[11.5px] leading-tight text-muted-foreground 2xl:block">{a.hint}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Link to="/premiacoes" className="vp-promo group relative hidden min-h-[230px] flex-col justify-between overflow-hidden p-6 xl:flex">
        <div>
          <p className="text-[21px] font-semibold leading-snug text-foreground">Grandes conquistas começam com a primeira venda.</p>
          <p className="mt-3 text-[13px] text-muted-foreground">Acompanhe suas placas e metas de faturamento.</p>
        </div>
        <span className="grid h-11 w-11 place-items-center self-end rounded-full border border-border text-foreground transition-transform group-hover:translate-x-1">
          <ArrowRight className="h-5 w-5" />
        </span>
      </Link>
    </section>
  );
}
