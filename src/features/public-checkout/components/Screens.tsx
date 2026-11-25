import { AlertCircle, Check, Copy, ExternalLink, FileText, PackageX, RefreshCw, WifiOff } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { copyText } from "../copyText";
import type { PaymentRecord } from "../useCheckoutFlow";
import { formatBRL } from "../pricing";
import { parsePaymentPayload } from "../status";
import type { CheckoutProduct } from "../types";
import { CheckoutShell } from "./CheckoutShell";

/* ── Carregando ── */
export function CheckoutSkeleton() {
  return (
    <CheckoutShell mode="gray">
      <div className="ck-wrap" role="status" aria-label="Carregando o checkout">
        <div className="ck-head">
          <div className="ck-thumb ck-skel" style={{ boxShadow: "none" }} />
          <div className="ck-head-text"><div className="ck-skel" style={{ height: 22, width: "55%" }} /><div className="ck-skel" style={{ height: 14, width: "30%", marginTop: 8 }} /></div>
        </div>
        <div className="ck-grid">
          <div className="ck-main">
            <div className="ck-card"><div className="ck-skel" style={{ height: 20, width: "35%", marginBottom: 18 }} /><div className="ck-skel" style={{ height: 48, marginBottom: 14 }} /><div className="ck-skel" style={{ height: 48, marginBottom: 14 }} /><div className="ck-skel" style={{ height: 48 }} /></div>
            <div className="ck-card"><div className="ck-skel" style={{ height: 20, width: "30%", marginBottom: 18 }} /><div className="ck-skel" style={{ height: 64 }} /></div>
          </div>
          <div className="ck-aside"><div className="ck-card"><div className="ck-skel" style={{ height: 14, width: "40%", marginBottom: 18 }} /><div className="ck-skel" style={{ height: 18, marginBottom: 12 }} /><div className="ck-skel" style={{ height: 34, width: "60%", marginLeft: "auto" }} /></div></div>
        </div>
      </div>
    </CheckoutShell>
  );
}

/* ── Link fechado e erro de carga ── */
const CLOSED_COPY: Record<string, [string, string]> = {
  pending_review: ["Produto em análise", "Este produto está aguardando aprovação e ainda não recebe pagamentos."],
  draft: ["Produto em rascunho", "O produtor ainda não publicou este produto."],
  inactive: ["Produto indisponível", "Este produto não está aceitando pagamentos no momento."],
  rejected: ["Produto indisponível", "Este produto não está aceitando pagamentos no momento."],
};

export function ClosedScreen({ linkStatus }: { linkStatus: string | null }) {
  const [title, text] = (linkStatus && CLOSED_COPY[linkStatus]) || (linkStatus ? ["Produto indisponível", "Este produto não está aceitando pagamentos no momento."] : ["Produto não encontrado", "Confira o link e tente de novo."]);
  return (
    <CheckoutShell mode="gray">
      <main className="ck-state"><div className="ck-state-in">
        <span className="ck-badge-icon"><PackageX size={28} aria-hidden="true" /></span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div></main>
    </CheckoutShell>
  );
}

export function LoadErrorScreen({ onRetry, title = "Não foi possível abrir o checkout" }: { onRetry: () => void; title?: string }) {
  return (
    <CheckoutShell mode="gray">
      <main className="ck-state"><div className="ck-state-in">
        <span className="ck-badge-icon"><WifiOff size={28} aria-hidden="true" /></span>
        <h1>{title}</h1>
        <p>Confira sua conexão e tente de novo. Nada foi cobrado.</p>
        <div className="ck-actions"><button type="button" className="ck-btn" data-primary="true" data-wide="true" onClick={onRetry}><RefreshCw size={16} aria-hidden="true" /> Tentar de novo</button></div>
      </div></main>
    </CheckoutShell>
  );
}

/* ── Pagamento aberto (Pix ou boleto) ── */
export function PendingScreen({ product, record, onChangeMethod }: { product: CheckoutProduct; record: PaymentRecord; onChangeMethod: () => void }) {
  const display = parsePaymentPayload(record.method, record.payload);
  const [copied, setCopied] = useState<"pix" | "boleto" | "failed" | null>(null);
  const copy = async (text: string, kind: "pix" | "boleto") => {
    const ok = await copyText(text);
    setCopied(ok ? kind : "failed");
    if (ok) window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 3000);
  };
  const until = display.expiresAt ? new Date(display.expiresAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <main className="ck-center">
      <div className="ck-panel" style={{ textAlign: "center" }}>
        <p className="ck-seller">{product.name}</p>
        <p className="ck-pending-total ck-num">{formatBRL(record.total)}</p>
        <p className="ck-wait" style={{ marginTop: 14 }} role="status"><span className="ck-pulse" aria-hidden="true" /> Aguardando o pagamento</p>
      </div>

      {record.method === "pix" && (
        <div className="ck-panel">
          <h1 style={{ fontSize: 18, fontWeight: 800, textAlign: "center" }}>Pague com Pix</h1>
          {display.pixCode ? (
            <>
              <div className="ck-qr"><div className="ck-qr-tile"><QRCodeSVG value={display.pixCode} size={208} title="QR Code do Pix" /></div></div>
              <div className="ck-code-row">
                <input className="ck-input ck-input-mono" readOnly value={display.pixCode} aria-label="Código Pix copia e cola" onFocus={(event) => event.currentTarget.select()} />
                <button type="button" className="ck-btn" data-primary="true" data-wide="true" onClick={() => void copy(display.pixCode!, "pix")}>
                  {copied === "pix" ? <><Check size={16} aria-hidden="true" /> Código copiado</> : <><Copy size={16} aria-hidden="true" /> Copiar código Pix</>}
                </button>
              </div>
              {copied === "failed" && <p className="ck-msg" data-tone="error" role="alert">Não deu para copiar sozinho. Toque no código acima e copie.</p>}
              <ol className="ck-steps">
                <li>Abra o app do seu banco e escolha pagar com Pix.</li>
                <li>Leia o QR Code ou cole o código copiado.</li>
                <li>Confirme o pagamento. Esta página atualiza sozinha.</li>
              </ol>
              {until && <p className="ck-msg" style={{ textAlign: "center" }}>O código vale até {until}.</p>}
            </>
          ) : (
            <p className="ck-msg" style={{ textAlign: "center" }}>O código Pix ainda não chegou. Aguarde alguns segundos: esta página atualiza sozinha.</p>
          )}
        </div>
      )}

      {record.method === "boleto" && (
        <div className="ck-panel">
          <h1 style={{ fontSize: 18, fontWeight: 800, textAlign: "center" }}>Seu boleto foi gerado</h1>
          <div className="ck-code-row" style={{ marginTop: 16 }}>
            {display.boletoUrl && <a className="ck-btn" data-primary="true" data-wide="true" href={display.boletoUrl} target="_blank" rel="noopener noreferrer"><FileText size={16} aria-hidden="true" /> Abrir boleto <ExternalLink size={14} aria-hidden="true" /></a>}
            {display.boletoCode && (
              <>
                <input className="ck-input ck-input-mono" readOnly value={display.boletoCode} aria-label="Código de barras do boleto" onFocus={(event) => event.currentTarget.select()} />
                <button type="button" className="ck-btn" data-wide="true" onClick={() => void copy(display.boletoCode!, "boleto")}>
                  {copied === "boleto" ? <><Check size={16} aria-hidden="true" /> Código copiado</> : <><Copy size={16} aria-hidden="true" /> Copiar código de barras</>}
                </button>
              </>
            )}
          </div>
          {copied === "failed" && <p className="ck-msg" data-tone="error" role="alert">Não deu para copiar sozinho. Toque no código acima e copie.</p>}
          <p className="ck-msg" style={{ textAlign: "center", marginTop: 14 }}>O banco leva até 3 dias úteis para confirmar. Seu acesso é liberado assim que a confirmação chegar, e esta página atualiza sozinha enquanto estiver aberta.</p>
        </div>
      )}

      <p style={{ textAlign: "center", marginTop: 18 }}>
        <button type="button" className="ck-link-btn" onClick={onChangeMethod}>Cancelar e escolher outra forma de pagamento</button>
      </p>
    </main>
  );
}

/* ── Resultado ── */
export function ApprovedScreen({ product, record }: { product: CheckoutProduct; record: PaymentRecord }) {
  return (
    <main className="ck-state"><div className="ck-state-in">
      <span className="ck-badge-icon" data-tone="ok">
        <svg className="ck-draw" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </span>
      <h1>Pagamento confirmado</h1>
      <p>Seu pedido foi aprovado.</p>
      <dl className="ck-summary">
        <div><dt>Produto</dt><dd>{product.name}</dd></div>
        <div><dt>Valor pago</dt><dd className="ck-num">{formatBRL(record.total)}</dd></div>
        <div><dt>E-mail da compra</dt><dd>{record.email}</dd></div>
      </dl>
      <div className="ck-actions"><Link className="ck-btn" data-primary="true" data-wide="true" to={`/obrigado?tx=${encodeURIComponent(record.transactionId)}`}>Ver detalhes da compra</Link></div>
    </div></main>
  );
}

export function FailedScreen({ kind, onRetry }: { kind: "failed" | "expired"; onRetry: () => void }) {
  const expired = kind === "expired";
  return (
    <main className="ck-state"><div className="ck-state-in">
      <span className="ck-badge-icon" data-tone="error"><AlertCircle size={30} aria-hidden="true" /></span>
      <h1>{expired ? "O prazo do pagamento acabou" : "Pagamento não aprovado"}</h1>
      <p>{expired ? "O código venceu e nada foi cobrado. Gere um novo para continuar." : "O pagamento não foi concluído e nada foi cobrado. Confira os dados ou escolha outra forma de pagamento."}</p>
      <div className="ck-actions"><button type="button" className="ck-btn" data-primary="true" data-wide="true" onClick={onRetry}><RefreshCw size={16} aria-hidden="true" /> {expired ? "Gerar novo pagamento" : "Voltar ao checkout"}</button></div>
    </div></main>
  );
}
