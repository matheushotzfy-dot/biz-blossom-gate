import { useSearchParams } from "react-router-dom";
import { ThankYouPage } from "@/features/public-checkout/ThankYouPage";

export default function ThankYou() {
  const [params] = useSearchParams();
  return <ThankYouPage transactionParam={params.get("tx")} />;
}
