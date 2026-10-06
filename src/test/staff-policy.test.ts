import { describe, expect, it } from 'vitest';
import { STAFF_PERMISSIONS, DEFAULT_STAFF_LIMITS, validStaffLimits } from '@/features/staff/staffPolicy';
describe('Staff policies', () => {
  it('has unique grantable permissions', () => expect(new Set(STAFF_PERMISSIONS.map(p => p.key)).size).toBe(STAFF_PERMISSIONS.length));
  it.each(['sellers.ban', 'sellers.delete_account', 'login_as_user', 'freeze_seller_balance', 'withdrawals.approve'])('never grants dangerous permission %s', key => expect(STAFF_PERMISSIONS.some(p => p.key === key)).toBe(false));
  it('includes separate withdrawal-only block', () => expect(STAFF_PERMISSIONS.some(p => p.key === 'freeze_seller_withdrawals')).toBe(true));
  it('accepts exact boundaries', () => { expect(validStaffLimits(DEFAULT_STAFF_LIMITS, 50)).toBe(true); expect(validStaffLimits({min_transaction_percentage:0,min_transaction_fixed:0,min_withdrawal_fee:0},0)).toBe(true); });
  it.each([NaN, Infinity, -1, 101])('rejects invalid percentage %s', value => expect(validStaffLimits({...DEFAULT_STAFF_LIMITS,min_transaction_percentage:value},0)).toBe(false));
  it.each([NaN, Infinity, -1, 50.01])('rejects invalid commission %s', value => expect(validStaffLimits(DEFAULT_STAFF_LIMITS,value)).toBe(false));
  it('rejects excessive fixed and withdrawal fees', () => { expect(validStaffLimits({...DEFAULT_STAFF_LIMITS,min_transaction_fixed:1000001},0)).toBe(false); expect(validStaffLimits({...DEFAULT_STAFF_LIMITS,min_withdrawal_fee:1000001},0)).toBe(false); });
});
