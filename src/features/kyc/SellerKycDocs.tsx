import { Loader2, RefreshCw } from "lucide-react";
import { KycDocViewer } from "./KycDocViewer";
import { SUBMISSION_STATUS_LABEL, missingTypes } from "./kycReviewModel";
import { useKycReview } from "./useKycReview";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

/**
 * Documentos atuais da verificação na ficha do seller (Sellers → Info & KYC). Só monta quando a aba abre, porque
 * abrir os documentos fica registrado na auditoria. A decisão completa (com o histórico) fica na aba Verificações.
 */
export function SellerKycDocs({ sellerId }: { sellerId: string }) {
  const q = useKycReview(sellerId);

  if (q.isPending) return <p className="flex items-center gap-2 py-4 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando os documentos…</p>;
  if (q.isError || !q.data) {
    return (
      <p role="alert" className="flex items-center gap-2 py-4 text-[13px] text-destructive">
        Não foi possível carregar os documentos.
        <button type="button" className="inline-flex items-center gap-1 font-semibold underline" onClick={() => void q.refetch()}><RefreshCw className="h-3.5 w-3.5" />Tentar de novo</button>
      </p>
    );
  }

  const r = q.data;
  const latest = r.submissions[0] ?? null;
  const missing = missingTypes(r);

  return (
    <section aria-label="Documentos da verificação" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[14px] font-semibold text-foreground">Documentos da verificação</h4>
        <p className="text-[12.5px] text-muted-foreground">
          {latest ? `Último envio em ${when(latest.submittedAt)}: ${(SUBMISSION_STATUS_LABEL[latest.status] ?? latest.status).toLowerCase()}` : "Nenhum envio para análise ainda"}
        </p>
      </div>
      {r.documents.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nenhum documento enviado.</p>
      ) : (
        <>
          <KycDocViewer documents={r.documents} required={r.required} urls={r.urls} />
          {missing.length > 0 && <p className="text-[12.5px] text-warning">Ainda falta {missing.length === 1 ? "1 documento" : `${missing.length} documentos`} para o seller conseguir enviar para análise.</p>}
        </>
      )}
    </section>
  );
}
