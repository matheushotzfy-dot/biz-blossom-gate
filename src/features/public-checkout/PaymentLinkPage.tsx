import { useQuery } from "@tanstack/react-query";
import { CalendarX2, ImageIcon, Link2Off, Lock, TicketX, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Seo } from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { CheckoutShell } from "./components/CheckoutShell";
import { LoadErrorScreen } from "./components/Screens";
import { loadPaymentLink, type PublicPaymentLink } from "./loadPaymentLink";
import { formatBRL } from "./pricing";
import { safeCheckoutSlug } from "./slug";
import { readJson, writeJson } from "./storage";

const PAYMENT_LINK_QUERY_KEY = "public-payment-link";

/** O contador de cliques do vendedor soma uma vez por visita, não a cada recarga da página. */
function useCountClickOnce(slug: string | null, enabled: boolean) {
  useEffect(() => {
    if (!slug || !enabled) return;
    const key = `vp-pl-click:${slug}`;
    if (readJson("session", key)) return;
    writeJson("session", key, 1);
    void supabase.rpc("increment_payment_link_clicks", { _slug: slug }).then(() => null, () => null);
  }, [slug, enabled]);
}

function ClosedState({ icon, title, text }: { icon: "missing" | "expired" | "exhausted"; title: string; text: string }) {
  const Icon = icon === "expired" ? CalendarX2 : icon === "exhausted" ? TicketX : Link2Off;
  return (
    <CheckoutShell mode="gray">
      <main className="ck-state"><div className="ck-state-in">
        <span className="ck-badge-icon"><Icon size={28} aria-hidden="true" /></span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div></main>
    </CheckoutShell>
  );
}

function Skeleton() {
  return (
    <CheckoutShell mode="gray">
      <div className="ck-wrap ck-wrap-narrow" role="status" aria-label="Carregando o link de pagamento">
        <div className="ck-card"><div className="ck-skel" style={{ height: 22, width: "60%", marginBottom: 14 }} /><div className="ck-skel" style={{ height: 14, marginBottom: 8 }} /><div className="ck-skel" style={{ height: 14, width: "80%" }} /></div>
        <div className="ck-card" style={{ marginTop: 16 }}><div className="ck-skel" style={{ height: 34, width: "50%", marginLeft: "auto" }} /></div>
      </div>
    </CheckoutShell>
  );
}

function methodsText(link: PublicPaymentLink): string {
  if (link.acceptPix && link.acceptCard) return "Pix ou cartão de crédito";
  if (link.acceptCard) return "Cartão de crédito";
  return "Pix";
}

function LinkView({ link }: { link: PublicPaymentLink }) {
  const remaining = link.maxUses !== null ? Math.max(link.maxUses - link.currentUses, 0) : null;
  return (
    <CheckoutShell mode="gray">
      <Seo title={`${link.title} · Pagar`} description={link.description ?? `Cobrança de ${formatBRL(link.amount)}`} path={`/pl/${link.slug}`} noindex image={/^https:\/\//i.test(link.coverUrl ?? "") ? link.coverUrl : undefined} />
      <main className="ck-wrap ck-wrap-narrow">
        <header className="ck-head">
          <div className="ck-thumb" aria-hidden="true">{link.coverUrl ? <img src={link.coverUrl} alt="" /> : <ImageIcon size={26} />}</div>
          <div className="ck-head-text">
            <h1 className="ck-title">{link.title}</h1>
            <p className="ck-seller">Link de pagamento</p>
          </div>
        </header>

        {link.description && <p className="ck-card ck-desc">{link.description}</p>}

        <div className="ck-note" data-tone="warn" role="status" style={{ margin: "16px 0" }}>
          <TriangleAlert className="ck-note-icon" size={20} aria-hidden="true" />
          <div><strong>Pagamentos indisponíveis agora</strong><p>Este link ainda não está recebendo pagamentos. Nada será cobrado. Fale com quem enviou o link.</p></div>
        </div>

        <div className="ck-slip">
          <div className="ck-receipt">
            <h2>Resumo da cobrança</h2>
            <ul className="ck-lines">
              <li className="ck-line"><span className="ck-line-name">{link.title}</span><span className="ck-leader" aria-hidden="true" /><span className="ck-line-price ck-num">{formatBRL(link.amount)}</span></li>
            </ul>
            <div className="ck-cut" aria-hidden="true" />
            <div className="ck-total">
              <span className="ck-total-label">Total</span>
              <span className="ck-total-value ck-num">{formatBRL(link.amount)}</span>
            </div>
            <p className="ck-total-sub">Aceita {methodsText(link)}{remaining !== null ? ` · ${remaining} ${remaining === 1 ? "vaga" : "vagas"}` : ""}</p>
            <div style={{ marginTop: 18 }}>
              <button type="button" className="ck-cta" disabled aria-describedby="pl-cta-help"><Lock size={18} aria-hidden="true" />Pagamento indisponível</button>
              <p id="pl-cta-help" className="ck-cta-help">Quando o pagamento estiver ativo, este link passa a funcionar sozinho.</p>
            </div>
            <p className="ck-secure" style={{ marginTop: 16 }}><Lock size={14} aria-hidden="true" /> Conexão criptografada (HTTPS)</p>
          </div>
        </div>

        <footer className="ck-foot">
          <span>Pagamento Vemprapay</span>
          <span className="ck-foot-links">
            <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer">Termos de Uso</a>
            <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>
          </span>
        </footer>
      </main>
    </CheckoutShell>
  );
}

export function PaymentLinkPage({ slug }: { slug: string | undefined }) {
  const safeSlug = safeCheckoutSlug(slug);
  const query = useQuery({
    queryKey: [PAYMENT_LINK_QUERY_KEY, safeSlug],
    queryFn: () => (safeSlug ? loadPaymentLink(safeSlug) : Promise.resolve({ kind: "missing" as const })),
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  useCountClickOnce(safeSlug, query.data?.kind === "ready");

  if (query.isPending) return <Skeleton />;
  if (query.isError) return <LoadErrorScreen title="Não foi possível abrir o link" onRetry={() => void query.refetch()} />;
  const result = query.data;
  if (result.kind === "ready") return <LinkView link={result.link} />;
  if (result.kind === "blocked") return <ClosedState icon="missing" title="Este link está indisponível" text="Não é possível pagar por este link agora. Fale com quem enviou." />;
  if (result.kind === "expired") return <ClosedState icon="expired" title="Este link venceu" text="O prazo para pagar por este link acabou. Peça um novo link a quem enviou." />;
  if (result.kind === "exhausted") return <ClosedState icon="exhausted" title="Este link esgotou" text="O limite de pagamentos por este link foi atingido. Peça um novo link a quem enviou." />;
  return <ClosedState icon="missing" title="Link não encontrado" text="Este link de pagamento não existe ou foi desativado pelo vendedor." />;
}
