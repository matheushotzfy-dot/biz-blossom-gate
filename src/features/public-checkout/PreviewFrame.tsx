import { useEffect, useState } from "react";
import { Seo } from "@/components/Seo";
import { CheckoutExperience } from "./CheckoutPage";
import { CheckoutShell } from "./components/CheckoutShell";
import { CheckoutSkeleton } from "./components/Screens";
import { defaultCheckoutProcessor } from "./processor";
import { PREVIEW_READY, isTrustedPreviewMessage, readPreviewUpdate, type PreviewData } from "./previewProtocol";

/**
 * Prévia do construtor de checkout. Fica num iframe para ter a largura de um celular ou de um computador
 * de verdade (as regras de layout do checkout dependem da largura da janela) e mostra a MESMA tela do comprador,
 * com o mesmo processador de pagamento: hoje ele ainda não cobra, e a prévia mostra o aviso que o comprador vê.
 */
export function CheckoutPreviewFrame() {
  const framed = typeof window !== "undefined" && window.parent !== window;
  const [data, setData] = useState<PreviewData | null>(null);

  useEffect(() => {
    if (!framed) return;
    const onMessage = (event: MessageEvent) => {
      if (!isTrustedPreviewMessage(event, { origin: window.location.origin, parent: window.parent })) return;
      const next = readPreviewUpdate(event.data);
      if (next) setData(next);
    };
    window.addEventListener("message", onMessage);
    // Avisa que está pronta: o construtor responde com o estado atual (a primeira mensagem dele pode ter chegado antes).
    window.parent.postMessage({ type: PREVIEW_READY }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [framed]);

  if (!framed) {
    return (
      <CheckoutShell mode="gray">
        <Seo title="Prévia do checkout" description="Prévia do construtor de checkout." path="/checkout-preview" noindex />
        <main className="ck-state"><div className="ck-state-in">
          <h1>Prévia do checkout</h1>
          <p>Esta página só funciona dentro do construtor de checkout, no painel do vendedor.</p>
        </div></main>
      </CheckoutShell>
    );
  }
  if (!data) return <CheckoutSkeleton />;
  return (
    <CheckoutExperience
      key={data.product.id}
      slug="preview"
      product={data.product}
      bumps={data.bumps}
      pixels={[]}
      processor={defaultCheckoutProcessor}
      preview
    />
  );
}
