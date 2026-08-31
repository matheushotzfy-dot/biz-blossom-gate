/**
 * RealScreen — a janela do gateway em composição frontal, sem rotação 3D.
 * As legendas ficam em rodapé de imagem, no estilo de ficha técnica.
 */
import { ConsoleReplica } from "./device/ConsoleReplica";
import { CutLines, Rise } from "./bits";

const CAPTIONS = [
  { k: "tempo real", v: "Faturamento, aprovação e ticket recalculados sem recarregar a página." },
  { k: "financeiro", v: "Disponível, a liberar, reembolsos e MEDs no mesmo extrato." },
  { k: "operação", v: "Produtos, afiliados, membros, API e webhooks no mesmo núcleo." },
];

export function RealScreen() {
  return (
    <section id="painel" className="vx-cv relative overflow-hidden py-28 sm:py-36">
      <div className="pointer-events-none absolute inset-0 vx-grid-fine vx-fade-edges opacity-40" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[820px] -translate-x-1/2 vx-halo" />

      <div className="relative mx-auto max-w-[1280px] px-5">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <CutLines
            as="h2"
            className="max-w-[15ch] text-[38px] font-extrabold text-foreground sm:text-[58px]"
            lines={[<>Essa é a tela.</>, <>Sem maquiagem.</>]}
          />
          <p className="max-w-[38ch] text-[14.5px] leading-[1.75] text-muted-foreground">
            O painel que você usa todo dia — mesma densidade, mesma leitura, mesmos controles.
          </p>
        </div>

        <Rise className="mt-14" delay={0.05}>
          <ConsoleReplica />
        </Rise>

        <div className="mt-8 grid gap-x-10 gap-y-5 border-t border-border pt-7 sm:grid-cols-3">
          {CAPTIONS.map((c) => (
            <div key={c.k}>
              <p className="vx-mono vx-mono-on">{c.k}</p>
              <p className="mt-2.5 text-[13.5px] leading-[1.7] text-muted-foreground">{c.v}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
