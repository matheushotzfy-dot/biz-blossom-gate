import { useParams } from "react-router-dom";
import { PaymentLinkPage } from "@/features/public-checkout/PaymentLinkPage";

export default function PublicPaymentLink() {
  const { slug } = useParams<{ slug: string }>();
  return <PaymentLinkPage slug={slug} />;
}
