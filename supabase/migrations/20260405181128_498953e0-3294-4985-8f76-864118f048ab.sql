
-- Fix disputes_seller view security
DROP VIEW IF EXISTS public.disputes_seller;
CREATE VIEW public.disputes_seller WITH (security_invoker = true) AS
SELECT id, seller_user_id, transaction_id, type, status, amount, reason,
  created_at, updated_at, resolved_at,
  CASE WHEN buyer_name IS NOT NULL THEN left(buyer_name, 2) || '***' ELSE NULL END AS buyer_name_masked,
  CASE WHEN buyer_email IS NOT NULL THEN left(split_part(buyer_email, '@', 1), 2) || '***@' || split_part(buyer_email, '@', 2) ELSE NULL END AS buyer_email_masked,
  CASE WHEN buyer_phone IS NOT NULL THEN left(buyer_phone, 4) || '****' ELSE NULL END AS buyer_phone_masked
FROM disputes
WHERE seller_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role);
