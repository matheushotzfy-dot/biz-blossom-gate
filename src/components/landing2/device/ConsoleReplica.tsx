/**
 * ConsoleReplica — recriação apresentacional da janela do gateway VENXPAY.
 * Todos os números são sintéticos e locais: nenhum acesso a banco ou API.
 */
import { useEffect, useMemo, useState } from "react";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { cn } from "@/lib/utils";

const NAV = ["Visão geral", "Vendas", "Produtos", "Financeiro", "Afiliados", "Integrações"];

const ROWS = [
  { id: "TX 9F2C", produto: "Mentoria Escala 6 em 7", valor: "R$ 1.497,00", metodo: "Pix" },
  { id: "TX 7B4A", produto: "Método Tráfego Direto", valor: "R$ 297,00", metodo: "Cartão" },
  { id: "TX 5E19", produto: "Pack de Templates Pro", valor: "R$ 47,90", metodo: "Pix" },
  { id: "TX 41D8", produto: "Comunidade Builders", valor: "R$ 197,00", metodo: "Pix" },
  { id: "TX 2A66", produto: "Formação Copy Avançada", valor: "R$ 897,00", metodo: "Cartão" },
];

const BARS = ["h-[38%]", "h-[52%]", "h-[44%]", "h-[66%]", "h-[58%]", "h-[74%]", "h-[62%]", "h-[86%]", "h-[71%]", "h-[94%]", "h-[82%]", "h-full"];

export function ConsoleReplica() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 3200);
    return () => window.clearInterval(id);
  }, []);

  const rows = useMemo(() => {
    const shift = tick % ROWS.length;
    return [...ROWS.slice(shift), ...ROWS.slice(0, shift)];
  }, [tick]);

  return (
    <div className="vx-frame overflow-hidden rounded-[10px]">
      {/* barra de janela */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-muted" />
        <span className="h-2.5 w-2.5 rounded-full bg-muted" />
        <span className="h-2.5 w-2.5 rounded-full bg-muted" />
        <span className="vx-mono ml-3 truncate text-[9px]">app.venxpay.com / visão geral</span>
      </div>

      <div className="grid grid-cols-[132px_1fr] sm:grid-cols-[168px_1fr]">
        {/* sidebar */}
        <aside className="border-r border-border p-3.5">
          <div className="flex items-center gap-2">
            <VenxpayLogo size={20} plate={false} animated={false} />
            <span className="font-heading text-[12px] font-extrabold text-foreground">venxpay</span>
          </div>
          <nav className="mt-5 space-y-0.5">
            {NAV.map((item, i) => (
              <div
                key={item}
                className={cn(
                  "rounded-[3px] px-2.5 py-2 text-[11.5px] font-semibold transition-colors",
                  i === 0 ? "bg-primary/12 text-primary" : "text-muted-foreground",
                )}
              >
                {item}
              </div>
            ))}
          </nav>
          <div className="mt-6 border-t border-border pt-4">
            <p className="vx-mono text-[8.5px]">saldo disponível</p>
            <p className="vx-num mt-1.5 text-[15px] font-extrabold text-primary">R$ 84.219,40</p>
          </div>
        </aside>

        {/* conteúdo */}
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { k: "Faturamento hoje", v: "R$ 128.940,00" },
              { k: "Aprovação", v: "93,4%" },
              { k: "Ticket médio", v: "R$ 312,70" },
            ].map((m) => (
              <div key={m.k} className="border border-border p-3">
                <p className="truncate text-[10px] text-muted-foreground">{m.k}</p>
                <p className="vx-num mt-1.5 text-[15px] font-extrabold text-foreground sm:text-[19px]">{m.v}</p>
              </div>
            ))}
          </div>

          {/* gráfico */}
          <div className="mt-4 flex h-[104px] items-end gap-[5px] border border-border p-3">
            {BARS.map((heightClass, barIndex) => (
              <span
                key={heightClass}
                className={cn(
                  "flex-1 rounded-t-[2px] transition-[height] duration-700",
                  heightClass,
                  barIndex > 8 ? "bg-primary" : "bg-primary/35",
                )}
              />
            ))}
          </div>

          {/* transações */}
          <div className="mt-4 border border-border">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="vx-mono text-[9px]">últimas transações</span>
              <span className="flex items-center gap-1.5 text-[9.5px] font-bold text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> ao vivo
              </span>
            </div>
            <div className="divide-y divide-border">
              {rows.slice(0, 4).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[11.5px] font-semibold text-foreground">{r.produto}</p>
                    <p className="vx-mono text-[8.5px]">
                      {r.id} · {r.metodo}
                    </p>
                  </div>
                  <p className="vx-num shrink-0 text-[12px] font-bold text-primary">{r.valor}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
