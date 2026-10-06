import { useEffect, useRef, useState } from "react";
import { Check, Copy, LockKeyhole, QrCode } from "lucide-react";
import { useInView, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function CheckoutDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-25%" });
  const reduce = useReducedMotion();
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!inView) return;
    if (reduce) { setConfirmed(true); return; }
    const timeout = window.setTimeout(() => setConfirmed(true), 1600);
    return () => window.clearTimeout(timeout);
  }, [inView, reduce]);

  return (
    <section id="checkout" className="vx-section vx-checkout">
      <div className="vx-shell vx-checkout-layout">
        <div className="vx-checkout-copy">
          <span className="vx-kicker">03 / A CONVERSÃO</span>
          <h2>Menos atrito entre querer e comprar.</h2>
          <p>Uma experiência direta, reconhecível e pronta para qualquer tela.</p>
          <div className="vx-checkout-methods">
            <span className="is-active">PIX <small>instantâneo</small></span>
            <span>CARTÃO <small>até 12x</small></span>
          </div>
        </div>

        <div ref={ref} className="vx-checkout-scene">
          <div className="vx-order-meta"><span>PEDIDO #VX-80419</span><span>AMBIENTE SEGURO <LockKeyhole /></span></div>
          <div className="vx-order-product">
            <div className="vx-order-monogram">M</div>
            <div><p>Mentoria Escala</p><span>Acesso digital imediato</span></div>
            <strong>R$ 1.497,00</strong>
          </div>
          <div className="vx-pix-area">
            <div className="vx-qr"><QrCode /></div>
            <div>
              <span>{confirmed ? "PAGAMENTO CONFIRMADO" : "PIX GERADO"}</span>
              <h3>{confirmed ? "Tudo certo." : "Escaneie ou copie."}</h3>
              <p>{confirmed ? "O acesso foi liberado e o pedido registrado." : "A cobrança expira automaticamente em 30 minutos."}</p>
            </div>
          </div>
          <Button className="w-full" variant={confirmed ? "default" : "outline"}>
            {confirmed ? <><Check /> Compra aprovada</> : <><Copy /> Copiar código PIX</>}
          </Button>
        </div>
      </div>
    </section>
  );
}