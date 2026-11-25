import { Link } from "react-router-dom";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { FAQ, NAV_LINKS } from "./landingData";
import { Tight } from "./Tight";

export { FAQ };

export function FaqSection() {
  return (
    <section id="duvidas" className="bg-background pb-24 pt-8 sm:pb-32">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)] lg:gap-20">
        <h2 className="text-[clamp(2rem,4.2vw,3.1rem)] font-extrabold leading-[1.07] tracking-[-0.04em] text-foreground lg:sticky lg:top-28 lg:self-start">
          <Tight>Perguntas que todo mundo faz.</Tight>
        </h2>
        <div className="lp-faq">
          {FAQ.map((f, i) => (
            <details key={f.q} name="lp-faq" open={i === 0}>
              <summary>{f.q}<i aria-hidden /></summary>
              <div>{f.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Closing({ onSignup, onLogin }: { onSignup: () => void; onLogin: () => void }) {
  return (
    <section id="comecar" className="bg-card py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1180px] items-end gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,.75fr)] lg:gap-20">
        <h2 className="text-[clamp(2.4rem,6vw,4.6rem)] font-extrabold leading-[1.02] tracking-[-0.048em] text-foreground">
          <Tight>Abra a conta, crie o produto, mande o link.</Tight>
        </h2>
        <div>
          <p className="max-w-[24rem] text-[17px] leading-[1.7] text-muted-foreground">Grátis para abrir e sem mensalidade. A primeira venda pode sair no mesmo dia em que você terminar o cadastro.</p>
          <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-4">
            <button type="button" onClick={onSignup} className="lp-btn">Abrir minha conta</button>
            <button type="button" onClick={onLogin} className="lp-link bg-transparent p-0 text-[16px]" style={{ border: 0, cursor: "pointer" }}>Já tenho conta</button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="lp-foot bg-background pb-12 pt-16">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 lg:col-span-1">
            <a href="#topo" className="inline-flex items-center gap-2.5 no-underline" aria-label="Vemprapay, voltar ao topo">
              <VenxpayLogo size={30} />
              <span className="text-[18px] font-extrabold tracking-[-0.035em] text-foreground">vempra<span className="text-primary">pay</span></span>
            </a>
            <p className="mt-4 max-w-[19rem] text-[14.5px] leading-relaxed text-muted-foreground">Checkout, área de membros, divisão de vendas e saque por Pix num painel só.</p>
          </div>
          <nav aria-label="Seções" className="flex flex-col gap-3">
            <p className="text-[14px] font-extrabold text-foreground">Na página</p>
            {NAV_LINKS.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
          </nav>
          <nav aria-label="Ajuda" className="flex flex-col gap-3">
            <p className="text-[14px] font-extrabold text-foreground">Ajuda</p>
            <Link to="/documentacao">Documentação</Link>
            <Link to="/status">Status da plataforma</Link>
            <Link to="/auth">Entrar no painel</Link>
          </nav>
          <nav aria-label="Legal" className="flex flex-col gap-3">
            <p className="text-[14px] font-extrabold text-foreground">Legal</p>
            <Link to="/termos-de-uso">Termos de uso</Link>
            <Link to="/politica-de-privacidade">Política de privacidade</Link>
          </nav>
        </div>
        <p className="mt-14 pt-6 text-[13.5px] text-muted-foreground" style={{ boxShadow: "0 -1px 0 hsl(var(--border))" }}>© {year} Vemprapay. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}
