import { Seo } from "@/components/Seo";
import DadosBancarios from "./DadosBancarios";

/** Rota /financeiro/config: "Dados bancários" no menu (chaves Pix e contas). */
export default function ConfigFinanceiro() {
  return (
    <>
      <Seo title="Dados bancários | Vemprapay" description="Chaves Pix e contas bancárias para receber seus saques." path="/financeiro/config" noindex />
      <DadosBancarios />
    </>
  );
}
