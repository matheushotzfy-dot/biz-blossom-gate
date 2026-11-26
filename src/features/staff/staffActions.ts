/** Liga as chaves de permissão da equipe (como o servidor devolve) às ações do painel. */
export interface StaffActionFlags {
  approveKyc: boolean; rejectKyc: boolean; editFees: boolean; editNotes: boolean; viewTransactions: boolean;
  viewSellers: boolean; viewWithdrawals: boolean; viewDisputes: boolean; freezeWithdrawals: boolean;
  viewSupport: boolean; respondSupport: boolean;
}

export function staffActionFlags(permissions: readonly string[] | undefined): StaffActionFlags {
  const has = (k: string) => (permissions ?? []).includes(k);
  return {
    approveKyc: has("approve_kyc"),
    rejectKyc: has("reject_kyc"),
    editFees: has("edit_fees"),
    editNotes: has("edit_seller_notes"),
    viewTransactions: has("view_transactions"),
    viewSellers: has("view_sellers"),
    viewWithdrawals: has("view_withdrawals"),
    viewDisputes: has("view_disputes"),
    freezeWithdrawals: has("freeze_seller_withdrawals"),
    viewSupport: has("view_support") || has("respond_support"),
    respondSupport: has("respond_support"),
  };
}

/** A equipe só decide conta em análise (o seller enviou os documentos); o servidor recusa as outras. */
export const KYC_PENDING_STATUSES = ["pending_review"] as const;
export const isKycPending = (status: string | null | undefined) => (KYC_PENDING_STATUSES as readonly string[]).includes(status ?? "");
