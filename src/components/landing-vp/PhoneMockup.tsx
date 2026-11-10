import { ArrowDownLeft, ArrowUpRight, QrCode, Receipt, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/** Mockup ilustrativo do app — valores de exemplo, nunca dados reais. */
const ROWS = [
  { t: "Pix recebido", m: "Curso completo · agora", v: "+ R$ 197,00", inbound: true },
  { t: "Cartão aprovado · 3x", m: "Mentoria · 4 min", v: "+ R$ 497,00", inbound: true },
  { t: "Pix recebido", m: "E-book · 11 min", v: "+ R$ 47,00", inbound: true },
  { t: "Saque via Pix", m: "Conta pessoal · 18 min", v: "− R$ 1.200,00", inbound: false },
] as const;

export function PhoneMockup({ className }: { className?: string }) {
  return (
    <div className={cn("vp-phone mx-auto", className)} aria-label="Exemplo do aplicativo Vemprapay" role="img">
      <div className="vp-phone-notch" aria-hidden />
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold text-muted-foreground">Olá, Ana</span>
        <span className="rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent-foreground">Exemplo</span>
      </div>
      <div className="mt-3 rounded-2xl bg-primary p-4 text-primary-foreground">
        <p className="text-[11px] font-medium opacity-80">Saldo disponível</p>
        <p className="mt-1 font-heading text-[25px] font-extrabold tracking-[-0.03em] tabular-nums">R$ 12.480,90</p>
        <p className="mt-0.5 text-[10px] opacity-75">Hoje: + R$ 2.341,00</p>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {[{ i: QrCode, l: "Pix" }, { i: ArrowUpRight, l: "Sacar" }, { i: Receipt, l: "Vendas" }, { i: Zap, l: "Links" }].map(({ i: I, l }) => (
          <div key={l} className="flex flex-col items-center gap-1 rounded-xl border border-border py-2">
            <I className="h-4 w-4 text-primary" />
            <span className="text-[9.5px] font-semibold text-foreground">{l}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 px-1 text-[11px] font-bold text-foreground">Movimentações</p>
      <ul className="mt-1 divide-y divide-border">
        {ROWS.map((r, i) => (
          <li key={i} className="flex items-center gap-2.5 py-2">
            <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", r.inbound ? "bg-accent text-primary" : "bg-muted text-muted-foreground")}>
              {r.inbound ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-semibold text-foreground">{r.t}</span>
              <span className="block truncate text-[9.5px] text-muted-foreground">{r.m}</span>
            </span>
            <span className={cn("text-[11px] font-bold tabular-nums", r.inbound ? "text-primary" : "text-foreground")}>{r.v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
