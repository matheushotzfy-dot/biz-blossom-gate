/**
 * ClosingScene — CTA final monumental e rodapé institucional.
 */
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Reveal, Wordmark } from "./parts";

const FOOTER_LINKS: { title: string; items: { label: string; to: string }[] }[] = [
  {
    title: "Plataforma",
    items: [
      { label: "Checkout", to: "#checkout" },
      { label: "Motor de pagamento", to: "#motor" },
      { label: "Operação", to: "#plataforma" },
      { label: "Integrações", to: "#integracoes" },
    ],
  },
  {
    title: "Recursos",
    items: [
      { label: "Documentação da API", to: "/docs" },
      { label: "Status dos serviços", to: "/status" },
      { label: "Dúvidas frequentes", to: "#faq" },
    ],
  },
  {
    title: "Legal",
    items: [
      { label: "Termos de uso", to: "/termos" },
      { label: "Política de privacidade", to: "/privacidade" },
    ],
  },
];

export function ClosingScene({ onSignup }: { onSignup: () => void }) {
  return (
    <>
      <section className="venx-cv relative overflow-hidden py-32 sm:py-44">
        <div aria-hidden className="pointer-events-none absolute inset-0 venx-mesh" />
        <div aria-hidden className="pointer-events-none absolute inset-0 venx-vignette" />
        <div className="relative mx-auto max-w-4xl px-5 text-center">
          <Reveal>
            <span className="venx-kicker mx-auto">Próximo passo</span>
            <h2 className="mt-6 text-[38px] font-extrabold leading-[1.08] text-foreground sm:text-[60px] lg:text-[76px]">
              Sua próxima venda pode
              <br />
              <span className="text-primary">cair hoje</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-[16px] leading-[1.75] text-muted-foreground">
              Crie a conta, publique o produto e comece a receber pelo mesmo checkout que você acabou de testar aqui.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button type="button" onClick={onSignup} className="venx-cta">
                Criar conta gratuita <ArrowRight className="h-4 w-4" />
              </button>
              <a href="#checkout" className="venx-ghost">
                Testar o checkout de novo
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="relative border-t border-border py-16">
        <div className="mx-auto max-w-7xl px-5">
          <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
            <div>
              <Wordmark />
              <p className="mt-5 max-w-sm text-[13.5px] leading-[1.7] text-muted-foreground">
                Infraestrutura de pagamentos para quem vende produtos digitais no Brasil. Checkout, liquidação, área de
                membros e API em um só lugar.
              </p>
            </div>
            <div className="grid gap-8 sm:grid-cols-3">
              {FOOTER_LINKS.map((col) => (
                <div key={col.title}>
                  <p className="num text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">{col.title}</p>
                  <ul className="mt-4 space-y-2.5">
                    {col.items.map((item) => (
                      <li key={item.label}>
                        {item.to.startsWith("#") ? (
                          <a
                            href={item.to}
                            className="text-[13.5px] text-muted-foreground transition-colors hover:text-primary"
                          >
                            {item.label}
                          </a>
                        ) : (
                          <Link
                            to={item.to}
                            className="text-[13.5px] text-muted-foreground transition-colors hover:text-primary"
                          >
                            {item.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 flex flex-col gap-3 border-t border-border pt-8 text-[12px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} VENXPAY. Todos os direitos reservados.</p>
            <p className="num text-[11px] uppercase tracking-[0.15em]">Feito no Brasil</p>
          </div>
        </div>
      </footer>
    </>
  );
}
