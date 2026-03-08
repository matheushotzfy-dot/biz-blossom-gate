
-- =============================================
-- STRESS TEST 40 SELLERS: Fix remaining bottlenecks
-- =============================================

-- FIX 1: disputes table - 106 seq_scans, ZERO indexes on seller_user_id
-- With 40 sellers viewing disputes simultaneously, this will lock up
CREATE INDEX IF NOT EXISTS idx_disputes_seller_user_id ON public.disputes(seller_user_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_transaction_id ON public.disputes(transaction_id) WHERE transaction_id IS NOT NULL;

-- FIX 2: user_progress - missing user_id standalone index
-- 40 sellers × students = thousands of progress queries, all seq scanning
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON public.user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_lesson_id ON public.user_progress(lesson_id);

-- FIX 3: seller_acquirer_config - 36 seq_scans, 0 idx_scans on user_id
CREATE INDEX IF NOT EXISTS idx_seller_acquirer_config_user_id ON public.seller_acquirer_config(user_id);

-- FIX 4: order_bumps - needs product_id index for RLS policy joins
CREATE INDEX IF NOT EXISTS idx_order_bumps_product_id ON public.order_bumps(product_id);
CREATE INDEX IF NOT EXISTS idx_order_bumps_bump_product_id ON public.order_bumps(bump_product_id);

-- FIX 5: retention_settings - 32 seq_scans, queried on every withdrawal
CREATE INDEX IF NOT EXISTS idx_retention_settings_user_id ON public.retention_settings(user_id) WHERE user_id IS NOT NULL;

-- FIX 6: transactions composite index for balance calculation (critical for 40 concurrent withdrawals)
-- The validate_withdrawal_amount trigger queries SUM(net_amount) WHERE user_id=X AND status='completed'
CREATE INDEX IF NOT EXISTS idx_transactions_user_completed ON public.transactions(user_id, status) WHERE status = 'completed';

-- FIX 7: withdrawals composite for balance validation trigger
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_pending ON public.withdrawals(user_id, status) WHERE status IN ('pending', 'approved');

-- FIX 8: custom_user_fees - queried per transaction for custom fee lookup
CREATE INDEX IF NOT EXISTS idx_custom_user_fees_user_id ON public.custom_user_fees(user_id);
