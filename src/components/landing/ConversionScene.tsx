import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronRight, LockKeyhole, QrCode, Sparkles } from "lucide-react";

export function ConversionScene() {
  const reduce = useReducedMotion();
  return (
    <div className="conversion-scene relative mx-auto aspect-[4/5] w-full max-w-[540px]">
      <motion.div
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 38, repeat: Infinity, ease: "linear" }}
        className="orbit orbit-outer absolute inset-[3%]"
      />
      <motion.div
        animate={reduce ? undefined : { rotate: -360 }}
        transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
        className="orbit orbit-inner absolute inset-[15%]"
      />

      <motion.div
        initial={reduce ? false : { opacity: 0, rotateY: -18, y: 30 }}
        whileInView={{ opacity: 1, rotateY: 0, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="checkout-device absolute inset-x-[16%] top-[7%] overflow-hidden border border-border bg-card"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-heading text-xs font-bold text-foreground">HOTZ<span className="text-primary">FY</span></span>
          <span className="flex items-center gap-1 font-mono text-[8px] text-muted-foreground"><LockKeyhole className="h-2.5 w-2.5" /> AMBIENTE SEGURO</span>
        </div>
        <div className="p-5 sm:p-7">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center border border-primary/30 bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></div>
            <div><p className="text-[10px] text-muted-foreground">Você está comprando</p><p className="font-heading text-sm font-semibold text-foreground">Método Escala 10X</p></div>
          </div>
          <div className="space-y-3">
            <div className="h-10 border border-border bg-background px-3 py-2 text-[10px] text-muted-foreground">Nome completo</div>
            <div className="h-10 border border-border bg-background px-3 py-2 text-[10px] text-muted-foreground">E-mail profissional</div>
          </div>
          <div className="mt-5 border border-primary/25 bg-primary/[0.04] p-4">
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-semibold text-foreground"><QrCode className="h-4 w-4 text-primary" /> PIX</span><Check className="h-4 w-4 text-primary" /></div>
            <p className="mt-3 font-heading text-2xl font-bold text-foreground">R$ 497,00</p>
          </div>
          <div className="mt-4 flex h-12 items-center justify-center gap-2 bg-primary text-xs font-bold text-primary-foreground">Finalizar compra <ChevronRight className="h-4 w-4" /></div>
          <p className="mt-4 text-center font-mono text-[8px] text-muted-foreground">CRIPTOGRAFADO · LGPD · ANTIFRAUDE ATIVO</p>
        </div>
      </motion.div>

      <motion.div
        animate={reduce ? undefined : { y: [0, -8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="scene-ticket absolute bottom-[12%] left-[2%] border border-border bg-background p-3"
      >
        <p className="font-mono text-[8px] text-muted-foreground">CONVERSÃO AO VIVO</p>
        <p className="mt-1 font-heading text-lg font-bold text-foreground">+24,8%</p>
        <p className="mt-1 text-[9px] text-primary">vs. checkout anterior</p>
      </motion.div>
      <motion.div
        animate={reduce ? undefined : { y: [0, 7, 0] }}
        transition={{ duration: 5.8, repeat: Infinity, ease: "easeInOut" }}
        className="scene-ticket absolute right-0 top-[28%] border border-primary/30 bg-background p-3"
      >
        <p className="font-mono text-[8px] text-primary">PAGAMENTO APROVADO</p>
        <p className="mt-1 text-[10px] text-muted-foreground">em 412 milissegundos</p>
      </motion.div>
    </div>
  );
}