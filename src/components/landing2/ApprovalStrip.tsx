/**
 * ApprovalStrip — tira horizontal contínua de notificações de venda aprovada,
 * no formato de push do iOS, com a marca VENXPAY. Conteúdo ilustrativo.
 */
import { VenxpayLogo } from "@/components/VenxpayLogo";

const PUSHES = [
  { value: "R$ 297,00", label: "Método Tráfego Direto", time: "agora" },
  { value: "R$ 1.497,00", label: "Mentoria Escala 6 em 7", time: "1 min" },
  { value: "R$ 47,90", label: "Pack de Templates Pro", time: "2 min" },
  { value: "R$ 897,00", label: "Formação Copy Avançada", time: "3 min" },
  { value: "R$ 197,00", label: "Comunidade Builders", time: "4 min" },
  { value: "R$ 2.490,00", label: "Consultoria Individual", time: "6 min" },
];

function Push({ value, label, time }: (typeof PUSHES)[number]) {
  return (
    <div className="flex w-[298px] items-center gap-3 rounded-[14px] border border-border bg-card px-4 py-3.5">
      <VenxpayLogo size={30} plate animated={false} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Venda aprovada</span>
          <span className="vx-mono text-[9px]">{time}</span>
        </div>
        <p className="vx-num mt-1 text-[17px] font-extrabold text-foreground">{value}</p>
        <p className="truncate text-[11.5px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function ApprovalStrip() {
  return (
    <section className="vx-cv relative border-y border-border py-9">
      <div className="vx-strip-wrap relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent sm:w-44"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent sm:w-44"
        />
        <div className="vx-strip">
          {[...PUSHES, ...PUSHES].map((p, i) => (
            <Push key={`${p.label}-${i}`} {...p} />
          ))}
        </div>
      </div>
      <p className="mx-auto mt-7 max-w-[1280px] px-5 text-[12px] text-muted-foreground">
        Notificações ilustrativas do aplicativo — cada aprovação chega no seu celular no instante
        em que o antifraude libera a transação.
      </p>
    </section>
  );
}
