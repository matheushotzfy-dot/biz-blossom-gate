import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { Link } from "react-router-dom";
import { SectionTitle } from "./Sections";

export const FAQ = [
  { q: "Quanto custa para usar a Vemprapay?", a: "Abrir a conta é grátis e não há mensalidade. Você paga apenas uma taxa por venda aprovada, mostrada no seu painel antes de vender." },
  { q: "Em quanto tempo recebo minhas vendas?", a: "Vendas no Pix ficam disponíveis assim que confirmadas. Você pode pedir o saque instantâneo via Pix para a sua conta." },
  { q: "Quais formas de pagamento posso aceitar?", a: "Pix e cartão de crédito em até 12x, com adquirências exclusivas para manter a aprovação acima de 75%." },
  { q: "Preciso ter CNPJ?", a: "Não. Você pode vender como pessoa física com CPF ou como empresa com CNPJ." },
  { q: "Meus dados estão seguros?", a: "Sim. Usamos criptografia, antifraude em todas as transações e seguimos a LGPD." },
];

export function FaqSection() {
  return (
    <section id="duvidas" className="bg-background py-20">
      <div className="mx-auto max-w-3xl px-5">
        <SectionTitle kicker="Dúvidas" title="Perguntas frequentes" />
        <Accordion type="single" collapsible className="mt-10 vp-card px-5">
          {FAQ.map((f, i) => (
            <AccordionItem key={f.q} value={`q${i}`} className={i === FAQ.length - 1 ? "border-b-0" : undefined}>
              <AccordionTrigger className="text-left text-[16px] font-bold hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="text-[15px] leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export function CtaAndFooter({ onSignup, onLogin }: { onSignup: () => void; onLogin: () => void }) {
  return (
    <>
      <section className="bg-background px-5 pb-20">
        <div className="vp-hero mx-auto max-w-6xl px-8 py-14 text-center sm:px-14">
          <h2 className="relative z-10 font-heading text-[32px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[40px]">Comece a receber hoje.</h2>
          <p className="relative z-10 mx-auto mt-3 max-w-md text-[16px] opacity-85">Conta grátis, sem mensalidade. Seu primeiro link de pagamento em minutos.</p>
          <div className="relative z-10 mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={onSignup} variant="secondary" className="h-12 rounded-full px-7 font-bold">Abrir minha conta</Button>
            <Button size="lg" onClick={onLogin} variant="ghost" className="h-12 rounded-full px-7 font-bold text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">Já tenho conta</Button>
          </div>
        </div>
      </section>
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <VenxpayLogo size={28} />
            <span className="font-heading text-[17px] font-extrabold tracking-[-0.035em]">vempra<span className="text-primary">pay</span></span>
          </div>
          <nav className="flex flex-wrap gap-5 text-[14px] font-semibold text-muted-foreground" aria-label="Rodapé">
            <Link to="/termos-de-uso" className="hover:text-foreground">Termos de uso</Link>
            <Link to="/politica-de-privacidade" className="hover:text-foreground">Privacidade</Link>
            <Link to="/status" className="hover:text-foreground">Status</Link>
            <Link to="/documentacao" className="hover:text-foreground">Documentação</Link>
          </nav>
          <p className="text-[13px] text-muted-foreground">© {new Date().getFullYear()} Vemprapay</p>
        </div>
      </footer>
    </>
  );
}
