/**
 * CheckoutScene — checkout jogável dentro da página.
 * O visitante troca o método, vê o layout responder, o QR se montar e a
 * aprovação acontecer. Tudo local: nenhuma cobrança real é criada aqui.
 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Barcode, Check, CreditCard, Loader2, LockKeyhole, QrCode, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, SectionHead } from "./parts";

type Method = "pix" | "card" | "boleto";

const METHODS: { id: Method; label: string; icon: typeof QrCode; note: string }[] = [
  { id: "pix", label: "Pix", icon: QrCode, note: "Aprovação em segundos · liquidação D+0" },
  { id: "card", label: "Cartão", icon: CreditCard, note: "Até 12x com antecipação · D+2" },
  { id: "boleto", label: "Boleto", icon: Barcode, note: "Compensação automática · D+1" },
];

const BENEFITS = [
  "Order bump e upsell em um clique",
  "Recuperação automática de Pix não pago",
  "Cupons, banners e prova social nativos",
  "Pixels de Meta, Google e TikTok integrados",
  "Renderização em menos de 1 segundo no 4G",
];

/** QR fake determinístico — apenas textura visual, sem payload real. */
function useQrCells(seed: number) {
  return useMemo(() => {
    const cells: boolean[] = [];
    let s = seed;
    for (let i = 0; i < 144; i++) {
      s = (s * 1103515245 + 12345) % 2147483648;
      cells.push((s >> 8) % 3 !== 0);
    }
    return cells;
  }, [seed]);
}

export function CheckoutScene() {
  const reduce = useReducedMotion();
  const [method, setMethod] = useState<Method>("pix");
  const [state, setState] = useState<"idle" | "processing" | "approved">("idle");
  const cells = useQrCells(method === "pix" ? 7 : method === "card" ? 13 : 21);

  useEffect(() => {
    setState("idle");
  }, [method]);

  useEffect(() => {
    if (state !== "processing") return;
    const t = window.setTimeout(() => setState("approved"), 1500);
    return () => window.clearTimeout(t);
  }, [state]);

  useEffect(() => {
    if (state !== "approved") return;
    const t = window.setTimeout(() => setState("idle"), 4200);
    return () => window.clearTimeout(t);
  }, [state]);

  return (
    <section id="checkout" className="venx-cv relative py-28 sm:py-36">
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <SectionHead
            kicker="Checkout"
            title={<>Experimente o checkout antes de vender por ele</>}
            copy="Este é o checkout real da plataforma, rodando aqui na página. Troque o método de pagamento e veja como o comprador enxerga a sua oferta."
          />
          <ul className="mt-9 space-y-3.5">
            {BENEFITS.map((item, i) => (
              <Reveal key={item} delay={i * 0.06}>
                <li className="flex items-start gap-3 text-[14.5px] text-muted-foreground">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-primary/40 text-primary">
                    <Check className="h-3 w-3" />
                  </span>
                  {item}
                </li>
              </Reveal>
            ))}
          </ul>
        </div>

        <Reveal y={34}>
          <div className="venx-glass relative mx-auto max-w-[460px] overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <span className="font-heading text-[13px] font-extrabold text-foreground">
                VENX<span className="text-primary">PAY</span>
              </span>
              <span className="num flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.15em] text-muted-foreground">
                <LockKeyhole className="h-3 w-3" /> ambiente seguro
              </span>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Você está comprando</p>
                  <p className="font-heading text-[15px] font-bold text-foreground">Mentoria Alta Performance</p>
                </div>
              </div>

              {/* método */}
              <div className="mt-6 grid grid-cols-3 gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-[12px] font-bold transition-all duration-300",
                      method === m.id
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                    )}
                  >
                    <m.icon className="h-4 w-4" />
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
                {METHODS.find((m) => m.id === method)?.note}
              </p>

              {/* corpo do método */}
              <div className="mt-5 min-h-[186px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={method}
                    initial={reduce ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, y: -10 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {method === "pix" && (
                      <div className="flex flex-col items-center">
                        <div className="grid grid-cols-12 gap-[3px] rounded-xl border border-border bg-background p-3">
                          {cells.map((on, i) => (
                            <motion.span
                              key={i}
                              initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                              animate={{ opacity: on ? 1 : 0.08, scale: 1 }}
                              transition={{ duration: 0.25, delay: reduce ? 0 : i * 0.0035 }}
                              className="h-[7px] w-[7px] rounded-[2px] bg-primary"
                            />
                          ))}
                        </div>
                        <p className="num mt-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          expira em 09:58
                        </p>
                      </div>
                    )}

                    {method === "card" && (
                      <div className="space-y-2.5">
                        <div className="flex h-11 items-center rounded-xl border border-border bg-background px-3 text-[12px] text-muted-foreground">
                          Número do cartão
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="flex h-11 items-center rounded-xl border border-border bg-background px-3 text-[12px] text-muted-foreground">
                            Validade
                          </div>
                          <div className="flex h-11 items-center rounded-xl border border-border bg-background px-3 text-[12px] text-muted-foreground">
                            CVV
                          </div>
                        </div>
                        <div className="flex h-11 items-center justify-between rounded-xl border border-primary/30 bg-primary/[0.06] px-3 text-[12px] font-bold text-foreground">
                          12x de <span className="num text-primary">R$ 174,58</span>
                        </div>
                      </div>
                    )}

                    {method === "boleto" && (
                      <div className="rounded-xl border border-border bg-background p-4">
                        <div className="flex h-14 items-end gap-[2px]">
                          {Array.from({ length: 46 }).map((_, i) => (
                            <span
                              key={i}
                              className="w-[3px] bg-foreground/80"
                              style={{ height: `${30 + ((i * 37) % 70)}%` }}
                            />
                          ))}
                        </div>
                        <p className="num mt-3 text-center text-[10px] text-muted-foreground">
                          34191.79001 01043.510047 91020.150008 9 98770000209700
                        </p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-5 flex items-end justify-between border-t border-border pt-4">
                <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Total</span>
                <span className="num text-[26px] font-bold text-foreground">R$ 1.997,00</span>
              </div>

              <button
                type="button"
                disabled={state !== "idle"}
                onClick={() => setState("processing")}
                className={cn(
                  "venx-cta mt-4 h-13 w-full",
                  state === "approved" && "bg-primary",
                  state !== "idle" && "cursor-default",
                )}
              >
                {state === "idle" && <>Finalizar compra</>}
                {state === "processing" && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Autorizando…
                  </>
                )}
                {state === "approved" && (
                  <>
                    <Check className="h-4 w-4" /> Pagamento aprovado
                  </>
                )}
              </button>

              <p className="num mt-4 text-center text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                criptografado · lgpd · antifraude ativo
              </p>
            </div>

            <AnimatePresence>
              {state === "approved" && !reduce && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_80%,hsl(var(--primary)/0.18),transparent_60%)]"
                />
              )}
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
