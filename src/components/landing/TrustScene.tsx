/**
 * TrustScene — infraestrutura apresentada como diagrama vivo: nós conectados
 * por linhas que se desenham conforme a seção entra em cena.
 */
import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Activity, DatabaseZap, Fingerprint, KeyRound, Scale, ServerCog } from "lucide-react";
import { SectionHead } from "./parts";

const NODES = [
  { icon: KeyRound, title: "Criptografia ponta a ponta", copy: "TLS em trânsito e AES-256 nos campos sensíveis em repouso.", x: 12, y: 22 },
  { icon: Fingerprint, title: "Antifraude em camadas", copy: "Identidade, dispositivo, IP e velocidade avaliados antes da autorização.", x: 50, y: 8 },
  { icon: ServerCog, title: "Roteamento redundante", copy: "Mais de uma adquirente ativa; queda em uma não derruba sua venda.", x: 86, y: 26 },
  { icon: DatabaseZap, title: "Isolamento por conta", copy: "Cada consulta é filtrada no banco pelo dono do dado, sem exceção.", x: 20, y: 74 },
  { icon: Activity, title: "Trilha imutável", copy: "Todo evento financeiro é registrado com autor, valor e horário.", x: 56, y: 88 },
  { icon: Scale, title: "Conformidade LGPD", copy: "Consentimento, retenção e direito de exclusão tratados por padrão.", x: 88, y: 70 },
];

const LINKS: [number, number][] = [[0, 1], [1, 2], [0, 3], [3, 4], [4, 5], [2, 5], [1, 4]];

export function TrustScene() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  const reduce = useReducedMotion();

  return (
    <section id="seguranca" ref={ref} className="venx-cv relative overflow-hidden py-28 sm:py-36">
      <div className="mx-auto max-w-7xl px-5">
        <SectionHead
          kicker="Infraestrutura"
          title={<>Confiança não é selo na página. É arquitetura.</>}
          copy="A malha abaixo é o desenho real de como o dinheiro trafega dentro da VENXPAY — cada nó é um serviço com responsabilidade própria."
        />

        {/* diagrama (desktop) */}
        <div className="relative mt-16 hidden h-[520px] lg:block">
          <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {LINKS.map(([a, b], i) => (
              <motion.line
                key={i}
                x1={NODES[a].x}
                y1={NODES[a].y}
                x2={NODES[b].x}
                y2={NODES[b].y}
                stroke="hsl(var(--primary))"
                strokeOpacity={0.28}
                strokeWidth={0.15}
                vectorEffect="non-scaling-stroke"
                initial={reduce ? false : { pathLength: 0 }}
                animate={inView ? { pathLength: 1 } : undefined}
                transition={{ duration: 1.1, delay: 0.15 + i * 0.09, ease: [0.16, 1, 0.3, 1] }}
              />
            ))}
          </svg>

          {NODES.map((node, i) => (
            <motion.article
              key={node.title}
              initial={reduce ? false : { opacity: 0, scale: 0.9 }}
              animate={inView ? { opacity: 1, scale: 1 } : undefined}
              transition={{ duration: 0.6, delay: 0.25 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              className="venx-panel absolute w-[248px] -translate-x-1/2 -translate-y-1/2 p-4 transition-colors duration-300 hover:border-primary/50"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <node.icon className="h-4 w-4" />
              </span>
              <h3 className="mt-3 text-[13.5px] font-bold text-foreground">{node.title}</h3>
              <p className="mt-1.5 text-[12px] leading-[1.6] text-muted-foreground">{node.copy}</p>
            </motion.article>
          ))}
        </div>

        {/* lista (mobile/tablet) */}
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:hidden">
          {NODES.map((node) => (
            <article key={node.title} className="venx-panel p-4">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <node.icon className="h-4 w-4" />
              </span>
              <h3 className="mt-3 text-[13.5px] font-bold text-foreground">{node.title}</h3>
              <p className="mt-1.5 text-[12.5px] leading-[1.6] text-muted-foreground">{node.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
