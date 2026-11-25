import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, Clock, FileQuestion, RefreshCw, Undo2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { CheckoutShell } from "./components/CheckoutShell";
import { LoadErrorScreen } from "./components/Screens";
import { loadThankYou, methodLabel, parseTransactionId, type PurchaseSummary } from "./loadThankYou";
import { formatBRL } from "./pricing";

const THANK_YOU_QUERY_KEY = "thank-you-summary";

const HOME_LINK = <Link className="ck-btn" data-wide="true" to="/">Ir para a página inicial</Link>;

function Summary({ summary }: { summary: PurchaseSummary }) {
  const method = methodLabel(summary.method);
  return (
    <dl className="ck-summary">
      <div><dt>Produto</dt><dd>{summary.productName}</dd></div>
      <div><dt>Valor</dt><dd className="ck-num">{formatBRL(summary.amount)}</dd></div>
      {method && <div><dt>Forma de pagamento</dt><dd>{method}</dd></div>}
      {summary.email && <div><dt>E-mail da compra</dt><dd>{summary.email}</dd></div>}
    </dl>
  );
}

function State({ icon, tone, title, text, children }: { icon: React.ReactNode; tone?: "ok" | "error"; title: string; text: string; children?: React.ReactNode }) {
  return (
    <CheckoutShell mode="gray">
      <Seo title={`${title} · Vemprapay`} description="Resumo da sua compra." path="/obrigado" noindex />
      <main className="ck-state"><div className="ck-state-in">
        <span className="ck-badge-icon" data-tone={tone}>{icon}</span>
        <h1>{title}</h1>
        <p>{text}</p>
        {children}
      </div></main>
    </CheckoutShell>
  );
}

export function ThankYouPage({ transactionParam }: { transactionParam: string | null }) {
  const transactionId = parseTransactionId(transactionParam);
  const query = useQuery({
    queryKey: [THANK_YOU_QUERY_KEY, transactionId],
    queryFn: () => loadThankYou(transactionId as string),
    enabled: transactionId !== null,
    staleTime: 0,
    retry: 1,
    refetchOnWindowFocus: true,
    // Pix e boleto podem ser pagos com a página aberta: confere de novo até a compra mudar (no máximo ~5 min).
    refetchInterval: (current) => (current.state.data?.kind === "found" && current.state.data.summary.outcome === "pending" && current.state.dataUpdateCount < 60 ? 5000 : false),
  });

  const notFound = (
    <State icon={<FileQuestion size={28} aria-hidden="true" />} title="Compra não encontrada" text="Confira o link que você recebeu. O resumo de uma compra fica disponível por 7 dias.">
      <div className="ck-actions">{HOME_LINK}</div>
    </State>
  );
  if (transactionId === null) return notFound;
  if (query.isPending) {
    return (
      <CheckoutShell mode="gray">
        <main className="ck-state" role="status" aria-label="Carregando sua compra"><div className="ck-state-in"><div className="ck-skel" style={{ height: 64, width: 64, borderRadius: "50%", margin: "0 auto 18px" }} /><div className="ck-skel" style={{ height: 24, width: "70%", margin: "0 auto 10px" }} /><div className="ck-skel" style={{ height: 14, width: "50%", margin: "0 auto" }} /></div></main>
      </CheckoutShell>
    );
  }
  if (query.isError) return <LoadErrorScreen title="Não foi possível abrir sua compra" onRetry={() => void query.refetch()} />;
  if (query.data.kind === "missing") return notFound;

  const summary = query.data.summary;
  const greeting = summary.firstName ? `${summary.firstName}, ` : "";
  switch (summary.outcome) {
    case "approved":
      return (
        <State icon={<svg className="ck-draw" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>} tone="ok" title="Compra confirmada" text={`${greeting}seu pagamento foi aprovado.`.replace(/^./, (letter) => letter.toUpperCase())}>
          <Summary summary={summary} />
          <div className="ck-actions">
            <Link className="ck-btn" data-primary="true" data-wide="true" to="/membros-area/login">Acessar a área de membros <ArrowRight size={16} aria-hidden="true" /></Link>
            {HOME_LINK}
          </div>
        </State>
      );
    case "pending":
      return (
        <State icon={<Clock size={28} aria-hidden="true" />} title="Aguardando o pagamento" text="Assim que o pagamento for confirmado, esta página mostra a sua compra. Você pode deixá-la aberta.">
          <Summary summary={summary} />
          <div className="ck-actions"><button type="button" className="ck-btn" data-wide="true" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw size={16} aria-hidden="true" /> Conferir agora</button></div>
        </State>
      );
    case "refunded":
      return (
        <State icon={<Undo2 size={28} aria-hidden="true" />} title="Compra reembolsada" text="O valor desta compra foi devolvido, então o acesso não está mais liberado.">
          <Summary summary={summary} />
          <div className="ck-actions">{HOME_LINK}</div>
        </State>
      );
    default:
      return (
        <State icon={<AlertCircle size={28} aria-hidden="true" />} tone="error" title={summary.outcome === "expired" ? "O prazo do pagamento acabou" : "Pagamento não concluído"} text="Nada foi cobrado. Volte ao link da compra para tentar de novo.">
          <Summary summary={summary} />
          <div className="ck-actions">{HOME_LINK}</div>
        </State>
      );
  }
}
