import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StaffRequestForm } from "@/features/staff/StaffRequestForm";

/** Pedidos ao dono (só gerente): o que está fora do que o painel deixa fazer passa por aqui. */
export default function RequestsSection() {
  return (
    <div className="space-y-5 animate-fade-in">
      <AdminPageHeader title="Pedidos ao dono" subtitle="Troca de adquirente, taxa fora do seu piso, congelar um seller: o que só o dono decide. Pedido sobre seller vale só para quem está na sua carteira." />
      <StaffRequestForm sellerHint="O e-mail que o seller usa para entrar. Precisa ser um seller da sua carteira." />
    </div>
  );
}
