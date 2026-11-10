import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhoneMockup } from "./PhoneMockup";

export function HeroSection({ onSignup }: { onSignup: () => void }) {
  return (
    <section className="relative overflow-hidden bg-background">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-14 md:grid-cols-[1.1fr_1fr] md:pb-24 md:pt-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-[12px] font-bold text-accent-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Gateway de pagamentos para quem vende online
          </span>
          <h1 className="mt-5 font-heading text-[40px] font-extrabold leading-[1.05] tracking-[-0.04em] text-foreground sm:text-[54px]">
            Venda mais. <span className="text-primary">Receba na hora.</span>
          </h1>
          <p className="mt-5 max-w-[520px] text-[17px] leading-relaxed text-muted-foreground">
            Pix e cartão com aprovação acima de 75%, checkout que converte e saque instantâneo para a sua conta. Tudo num painel simples, como o app do seu banco.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={onSignup} className="h-12 rounded-full px-7 text-[15px] font-bold">
              Abrir minha conta grátis <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <a href="#como-funciona" className="text-[15px] font-bold text-foreground underline-offset-4 hover:underline">Ver como funciona</a>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[14px] font-semibold text-foreground">
            {["Sem mensalidade", "Cadastro em minutos", "Suporte humano"].map((t) => (
              <li key={t} className="flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" strokeWidth={3} /> {t}</li>
            ))}
          </ul>
        </div>
        <div className="relative">
          <div aria-hidden className="absolute inset-x-6 bottom-6 top-10 -z-0 rounded-[40px] bg-primary" />
          <div className="relative py-6"><PhoneMockup /></div>
        </div>
      </div>
    </section>
  );
}
