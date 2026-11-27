import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Seo } from "@/components/Seo";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import "@/components/landing-vp/landing.css";

/** Endereço que não existe. Mesma identidade clara da landing; quem chega aqui pode ser comprador, aluno ou vendedor. */
const DESTINATIONS = [
  { to: "/membros-area", title: "Área de membros", text: "Comprou um curso? Entre com o e-mail da compra." },
  { to: "/dashboard", title: "Painel do vendedor", text: "Vendas, saques, produtos e links de pagamento." },
  { to: "/status", title: "Status dos serviços", text: "Veja se o painel, o login e os pagamentos estão no ar." },
] as const;

const NotFound = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const shown = pathname.length > 60 ? `${pathname.slice(0, 57)}…` : pathname;

  return (
    <div className="vp-site lp min-h-dvh bg-background text-foreground">
      <Seo title="Página não encontrada — Vemprapay" description="Este endereço não leva a nenhuma página da Vemprapay." path={pathname} noindex />
      <header className="mx-auto flex h-16 max-w-[760px] items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5 no-underline" aria-label="Vemprapay, página inicial">
          <VenxpayLogo size={30} />
          <span className="text-[18px] font-extrabold tracking-[-0.035em] text-foreground">vempra<span className="text-primary">pay</span></span>
        </Link>
        <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))} className="lp-btn lp-btn-sm lp-btn-text">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar
        </button>
      </header>

      <main id="conteudo" className="mx-auto max-w-[760px] px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
        <p className="text-[14px] font-semibold text-primary">Erro 404</p>
        <h1 className="mt-2 text-[34px] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-[44px]">Esta página não existe.</h1>
        <p className="mt-4 max-w-[560px] text-[16px] leading-relaxed text-muted-foreground">
          O endereço <code className="break-all rounded-md bg-muted px-1.5 py-0.5 font-mono text-[14px] text-foreground">{shown}</code> não leva a nenhuma página.
          Ele pode ter sido digitado errado ou o link pode ser antigo.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/" className="lp-btn">Ir para o início</Link>
          <Link to="/auth" className="lp-btn lp-btn-ghost">Entrar na conta</Link>
        </div>

        <h2 className="mt-14 text-[15px] font-bold text-foreground">Talvez você esteja procurando</h2>
        <ul className="mt-3 grid gap-x-8 gap-y-5 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
          {DESTINATIONS.map((d) => (
            <li key={d.to}>
              <Link to={d.to} className="lp-link text-[15px] font-semibold">{d.title}</Link>
              <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{d.text}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
};

export default NotFound;
