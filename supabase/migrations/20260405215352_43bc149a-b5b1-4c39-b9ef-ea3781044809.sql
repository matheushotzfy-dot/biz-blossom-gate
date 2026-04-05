-- Drop the old triggers that use validate_withdrawal_amount (transaction-based, not ledger-based)
DROP TRIGGER IF EXISTS trg_validate_withdrawal_amount ON public.withdrawals;
DROP TRIGGER IF EXISTS validate_withdrawal_amount_trigger ON public.withdrawals;

-- Drop duplicate balance trigger (keep only trg_validate_withdrawal_balance)
DROP TRIGGER IF EXISTS validate_withdrawal_balance_trigger ON public.withdrawals;

-- Drop duplicate fee/validation triggers (keep only trg_* versions)
DROP TRIGGER IF EXISTS enforce_withdrawal_fee_trigger ON public.withdrawals;
DROP TRIGGER IF EXISTS rate_limit_withdrawals_trigger ON public.withdrawals;
DROP TRIGGER IF EXISTS validate_withdrawal_trigger ON public.withdrawals;

-- Drop the old function
DROP FUNCTION IF EXISTS public.validate_withdrawal_amount();
