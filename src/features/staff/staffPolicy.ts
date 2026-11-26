/**
 * Permissões que a equipe pode receber. Só entram aqui as que o servidor aplica de verdade (RPCs e políticas):
 * "ver financeiro", "analytics", produtos, reembolso, MED e premiações existiam na lista, mas nada no banco nem
 * no painel da equipe as usa, então davam a impressão de liberar algo que não liberavam.
 */
export const STAFF_PERMISSIONS = [
  { key: 'view_sellers', label: 'Ver telefone, documento e último acesso dos sellers da carteira', group: 'Carteira' },
  { key: 'view_transactions', label: 'Ver as vendas da carteira', group: 'Carteira' },
  { key: 'view_withdrawals', label: 'Ver os saques da carteira', group: 'Carteira' },
  { key: 'view_disputes', label: 'Ver disputas e MED da carteira', group: 'Carteira' },
  { key: 'approve_kyc', label: 'Aprovar verificação de identidade', group: 'Verificação' },
  { key: 'reject_kyc', label: 'Reprovar verificação de identidade', group: 'Verificação' },
  { key: 'edit_fees', label: 'Alterar taxas dentro do piso', group: 'Operações' },
  { key: 'edit_seller_notes', label: 'Ler e escrever observações', group: 'Operações' },
  { key: 'freeze_seller_withdrawals', label: 'Bloquear saques para análise', group: 'Operações' },
  { key: 'view_support', label: 'Ver chamados de suporte', group: 'Suporte' },
  { key: 'respond_support', label: 'Responder chamados', group: 'Suporte' },
];
export interface StaffFeeLimits { min_transaction_percentage: number; min_transaction_fixed: number; min_withdrawal_fee: number }
export const DEFAULT_STAFF_LIMITS: StaffFeeLimits = { min_transaction_percentage: 2, min_transaction_fixed: 1, min_withdrawal_fee: 3 };
export function validStaffLimits(limits: StaffFeeLimits, commission: number): boolean {
  return Number.isFinite(commission) && commission >= 0 && commission <= 50 && Object.entries(limits).every(([key, value]) => Number.isFinite(value) && value >= 0 && value <= (key === 'min_transaction_percentage' ? 100 : 1000000));
}
