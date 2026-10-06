export const STAFF_PERMISSIONS = [
  { key: 'view_sellers', label: 'Ver vendedores', group: 'Consultas' },
  { key: 'view_transactions', label: 'Ver transações', group: 'Consultas' },
  { key: 'view_financial', label: 'Ver financeiro', group: 'Consultas' },
  { key: 'view_disputes', label: 'Ver disputas e MED PIX', group: 'Consultas' },
  { key: 'view_withdrawals', label: 'Ver saques', group: 'Consultas' },
  { key: 'view_analytics', label: 'Ver Analytics', group: 'Consultas' },
  { key: 'approve_kyc', label: 'Aprovar KYC', group: 'Revisão' },
  { key: 'reject_kyc', label: 'Recusar KYC', group: 'Revisão' },
  { key: 'review_products', label: 'Consultar produtos', group: 'Revisão' },
  { key: 'approve_product', label: 'Aprovar produtos', group: 'Revisão' },
  { key: 'suspend_products', label: 'Suspender produtos', group: 'Revisão' },
  { key: 'edit_fees', label: 'Alterar taxas dentro do piso', group: 'Operações' },
  { key: 'edit_seller_notes', label: 'Editar observações', group: 'Operações' },
  { key: 'request_refund', label: 'Solicitar reembolso ao dono', group: 'Operações' },
  { key: 'manage_med', label: 'Revisar MED; dono finaliza', group: 'Operações' },
  { key: 'freeze_seller_withdrawals', label: 'Bloquear saques para análise', group: 'Operações' },
  { key: 'view_support', label: 'Ver suporte', group: 'Suporte' },
  { key: 'respond_support', label: 'Responder chamados', group: 'Suporte' },
  { key: 'view_rewards', label: 'Ver premiações', group: 'Premiações' },
  { key: 'ship_rewards', label: 'Registrar envio de premiações', group: 'Premiações' },
];
export interface StaffFeeLimits { min_transaction_percentage: number; min_transaction_fixed: number; min_withdrawal_fee: number }
export const DEFAULT_STAFF_LIMITS: StaffFeeLimits = { min_transaction_percentage: 2, min_transaction_fixed: 1, min_withdrawal_fee: 3 };
export function validStaffLimits(limits: StaffFeeLimits, commission: number): boolean {
  return Number.isFinite(commission) && commission >= 0 && commission <= 50 && Object.entries(limits).every(([key, value]) => Number.isFinite(value) && value >= 0 && value <= (key === 'min_transaction_percentage' ? 100 : 1000000));
}
