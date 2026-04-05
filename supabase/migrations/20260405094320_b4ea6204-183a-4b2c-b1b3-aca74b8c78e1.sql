-- disputes_seller view needs security_invoker=off because the underlying disputes
-- table only allows admin SELECT. The view already masks PII and filters by seller_user_id.
ALTER VIEW public.disputes_seller SET (security_invoker = off);