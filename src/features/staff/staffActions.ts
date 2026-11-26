/** Maps the raw staff permission keys (as stored/returned by the backend) to panel actions. */
export interface StaffActionFlags { approveKyc: boolean; rejectKyc: boolean; editFees: boolean; editNotes: boolean; viewTransactions: boolean }

export function staffActionFlags(permissions: readonly string[] | undefined): StaffActionFlags {
  const has = (k: string) => (permissions ?? []).includes(k);
  return {
    approveKyc: has("approve_kyc"),
    rejectKyc: has("reject_kyc"),
    editFees: has("edit_fees"),
    editNotes: has("edit_seller_notes"),
    viewTransactions: has("view_transactions"),
  };
}

/** A equipe só decide conta em análise (o seller enviou os documentos); o servidor recusa as outras. */
export const KYC_PENDING_STATUSES = ["pending_review"] as const;
export const isKycPending = (status: string | null | undefined) => (KYC_PENDING_STATUSES as readonly string[]).includes(status ?? "");
