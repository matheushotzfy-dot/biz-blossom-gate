import { useParams } from "react-router-dom";
import { CheckoutPage } from "@/features/public-checkout/CheckoutPage";

/** Rota pública /pay/:slug e /checkout/:slug. Toda a tela mora em src/features/public-checkout. */
export default function PublicCheckout() {
  const { slug } = useParams();
  return <CheckoutPage slug={slug} />;
}
