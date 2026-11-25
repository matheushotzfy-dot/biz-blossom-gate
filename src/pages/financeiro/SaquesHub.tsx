import { Seo } from "@/components/Seo";
import Saques from "./Saques";

/**
 * Saldo e saques. Hoje só existe o saque por Pix; `SaquesCrypto.tsx` fica no repositório, fora do app,
 * até a tela de cripto voltar ao menu — o servidor (`sensitive-financial-action`) já aceita `crypto`.
 */
export default function SaquesHub() {
  return (
    <div className="bg-background antialiased selection:bg-primary/20">
      <Seo title="Saques | Vemprapay" description="Solicite saques via Pix e acompanhe o histórico das suas retiradas." path="/financeiro/saques" noindex />
      <main className="mx-auto w-full">
        <Saques />
      </main>
    </div>
  );
}
