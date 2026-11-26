import { describe, expect, it } from 'vitest';
import { staffActionFlags, isKycPending } from '@/features/staff/staffActions';
describe('Staff panel actions', () => {
  it('maps granted keys to actions', () => expect(staffActionFlags(['approve_kyc', 'edit_fees', 'edit_seller_notes', 'view_transactions'])).toEqual({ approveKyc: true, rejectKyc: false, editFees: true, editNotes: true, viewTransactions: true }));
  it('ignores legacy dotted key for transactions', () => expect(staffActionFlags(['transactions.view']).viewTransactions).toBe(false));
  it('grants nothing without permissions', () => expect(Object.values(staffActionFlags(undefined)).some(Boolean)).toBe(false));
  it('only submitted verifications are reviewable', () => { expect(isKycPending('pending_review')).toBe(true); expect(isKycPending('pending')).toBe(false); expect(isKycPending('approved')).toBe(false); });
});
