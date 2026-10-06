import { Blocks, GraduationCap, Link2, ShieldAlert, ShoppingCart, Users } from "lucide-react";
import { Reveal, SectionHead, SpotCard } from "./bits";

const ITEMS = [
  { icon: ShoppingCart, title: "Checkout que converte", text: "Uma página, validação de CPF, CEP automático e tema do seu produto." },
  { icon: Link2, title: "Links de pagamento", text: "Cobre por WhatsApp, direct ou e-mail em poucos cliques." },
  { icon: GraduationCap, title: "Área de membros", text: "Módulos, aulas e certificados liberados após a confirmação do pagamento." },
  { icon: Users, title: "Afiliados e coprodução", text: "Split automático: cada parte recebe no saldo certo." },
  { icon: Blocks, title: "Webhooks e API", text: "Eventos assinados e integrações nativas com as ferramentas que você já usa." },
  { icon: ShieldAlert, title: "Antifraude", text: "Regras de velocidade, bloqueios e análise para proteger sua operação." },
];

export function Included() {
  return (
    <section id="incluso" className="vx3-section">
      <div className="vx3-shell">
        <SectionHead
          kicker="06 · Tudo incluso"
          title={<>Uma plataforma <em>inteira</em>, sem mensalidade.</>}
          text="Tudo o que a sua operação precisa para vender, entregar e receber."
        />
        <div className="vx3-feature-grid">
          {ITEMS.map((item, i) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.title} delay={(i % 3) * 0.08}>
                <SpotCard tilt={6} className="vx3-feature">
                  <span className="vx3-icon"><Icon aria-hidden /></span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <span className="vx3-feature-index vx3-num" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                </SpotCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
