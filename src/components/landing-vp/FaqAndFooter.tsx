import { Link } from "react-router-dom";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { openCookieSettings } from "@/components/CookieConsent";
import { COMPANY, FAQ, NAV_LINKS, hasCompany } from "./landingData";
import { RULE_ABOVE } from "./lines";
import { Tight } from "./Tight";

export { FAQ };

export function FaqSection() {
  return (
    <section id="duvidas" className="bg-background pb-24 pt-8 sm:pb-32">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)] lg:gap-20">
        <h2 className="lp-h2 text-foreground lg:sticky lg:top-28 lg:self-start">
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

/** Quem está por trás e como falar com a gente. Só aparece com razão social e CNPJ preenchidos em `COMPANY`. */
export function CompanySection() {
  if (!hasCompany()) return null;
  const phone = COMPANY.whatsapp?.replace(/\D/g, "") ?? "";
  return (
    <section id="empresa" className="bg-background pb-24 sm:pb-28">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="lp-company">
          <div>
            <h2 className="text-[clamp(1.6rem,3vw,2.2rem)] font-extrabold leading-[1.1] tracking-[-0.035em] text-foreground">Quem está por trás</h2>
            <p className="mt-3 max-w-[32rem] text-[16px] leading-[1.7] text-muted-foreground">
              A Vemprapay é operada pela {COMPANY.legalName}. Os dados abaixo são os mesmos dos termos de uso.
            </p>
          </div>
          <dl className="lp-company-data">
            <div><dt>Razão social</dt><dd>{COMPANY.legalName}</dd></div>
            <div><dt>CNPJ</dt><dd className="tabular-nums">{COMPANY.cnpj}</dd></div>
            {COMPANY.city && <div><dt>Cidade</dt><dd>{COMPANY.city}</dd></div>}
            {COMPANY.email && <div><dt>E-mail</dt><dd><a className="lp-link" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></dd></div>}
            {phone.length >= 10 && <div><dt>WhatsApp</dt><dd><a className="lp-link" href={`https://wa.me/55${phone}`} target="_blank" rel="noopener noreferrer">{COMPANY.whatsapp}</a></dd></div>}
          </dl>
        </div>
      </div>
    </section>
  );
}

export function Closing({ onSignup, onLogin }: { onSignup: () => void; onLogin: () => void }) {
  return (
    <section id="comecar" className="bg-background px-3 pb-6 sm:px-5">
      {/* O mesmo cartão verde do topo da página: a conversa começa e termina no saldo. */}
      <div className="vp-balance mx-auto max-w-[1340px] px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
        <div className="relative z-10 mx-auto grid max-w-[1200px] items-end gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,.75fr)] lg:gap-20">
          <h2 className="text-[clamp(2.4rem,6vw,4.6rem)] font-extrabold leading-[1.02] tracking-[-0.048em]">
            <Tight>Abra a conta, crie o produto, mande o link.</Tight>
          </h2>
          <div>
            <p className="max-w-[24rem] text-[17px] leading-[1.7] text-white/85">
              Grátis para abrir e sem mensalidade. Você monta o produto, a equipe revisa e o seu checkout começa a receber.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-4">
              <button type="button" onClick={onSignup} className="lp-btn lp-btn-light">Abrir minha conta</button>
              <button type="button" onClick={onLogin} className="lp-link lp-link-light bg-transparent p-0 text-[16px]" style={{ border: 0, cursor: "pointer" }}>Já tenho conta</button>
            </div>
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
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
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
            <button type="button" className="lp-foot-btn" onClick={openCookieSettings}>Preferências de cookies</button>
          </nav>
        </div>
        <p className="mt-14 pt-6 text-[13.5px] leading-relaxed text-muted-foreground" style={{ boxShadow: RULE_ABOVE }}>
          © {year} Vemprapay. Todos os direitos reservados.
          {hasCompany() && <> {COMPANY.legalName}, CNPJ {COMPANY.cnpj}{COMPANY.city ? `, ${COMPANY.city}` : ""}.</>}
        </p>
      </div>
    </footer>
  );
}
