import { CountUp, Reveal, SpotCard } from "./bits";

export function StatsBand() {
  return (
    <section className="vx3-stats" aria-label="Números da VENXPAY">
      <div className="vx3-shell vx3-stats-grid">
        <Reveal><SpotCard className="vx3-stat">
          <strong><CountUp to={75} suffix="%+" /></strong>
          <span>Aprovação em PIX e cartão</span>
        </SpotCard></Reveal>
        <Reveal delay={0.08}><SpotCard className="vx3-stat">
          <strong className="vx3-grad-text">Instantâneo</strong>
          <span>Saque direto para sua conta via PIX</span>
        </SpotCard></Reveal>
        <Reveal delay={0.16}><SpotCard className="vx3-stat">
          <strong>Segundos</strong>
          <span>Para o PIX ser confirmado</span>
        </SpotCard></Reveal>
        <Reveal delay={0.24}><SpotCard className="vx3-stat">
          <strong><CountUp to={0} prefix="R$ " /></strong>
          <span>Mensalidade e adesão</span>
        </SpotCard></Reveal>
      </div>
    </section>
  );
}
