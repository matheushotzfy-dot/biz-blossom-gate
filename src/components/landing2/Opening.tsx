import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { Button } from "@/components/ui/button";
import { CutLines } from "./bits";

export interface OpeningProps {
  onSignup: () => void;
  onLogin: () => void;
}

const SIGNALS = ["Checkout", "Antifraude", "Split", "Liquidação"];

export function Opening({ onSignup, onLogin }: OpeningProps) {
  const reduce = useReducedMotion();

  return (
    <section className="vx-opening">
      <div className="vx-hero-grid" aria-hidden />
      <div className="vx-hero-rail" aria-hidden>
        <span>BR / 2026</span><span>INFRAESTRUTURA FINANCEIRA</span><span>ONLINE</span>
      </div>

      <div className="vx-shell vx-opening-inner">
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="vx-opening-brand"
        >
          <VenxpayLogo size={34} plate={false} animated={false} />
          <span>VENXPAY</span>
        </motion.div>

        <CutLines
          className="vx-opening-title"
          lines={[<>CONTROLE</>, <><span>PARA QUEM</span></>, <><em>VENDE.</em></>]}
        />

        <div className="vx-opening-bottom">
          <p>
            Uma infraestrutura de pagamentos desenhada para transformar cada venda em uma operação
            clara — do primeiro clique à liquidação.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={onSignup}>Abrir minha conta <ArrowUpRight /></Button>
            <Button size="lg" variant="outline" onClick={onLogin}>Já tenho conta</Button>
          </div>
        </div>

        <div className="vx-signal-line">
          {SIGNALS.map((signal, index) => (
            <span key={signal}><b>{String(index + 1).padStart(2, "0")}</b>{signal}</span>
          ))}
          <a href="#fluxo" aria-label="Continuar para o fluxo"><ArrowDown /></a>
        </div>
      </div>
    </section>
  );
}