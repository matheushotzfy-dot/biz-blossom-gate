CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX IF NOT EXISTS idx_transactions_user_created_id ON public.transactions(user_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_name_trgm ON public.transactions USING gin(customer_name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_email_trgm ON public.transactions USING gin(customer_email extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_transactions_external_id_trgm ON public.transactions USING gin(external_id extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_error_logs_open_created ON public.error_logs(created_at DESC) WHERE resolved=false;
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_status ON public.webhook_deliveries(created_at,status);
CREATE INDEX IF NOT EXISTS idx_app_deliveries_created_status ON public.app_deliveries(created_at,status);

CREATE OR REPLACE FUNCTION app_private.get_admin_command_center(_from timestamptz,_to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,app_private AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF _from IS NULL OR _to IS NULL OR _from>_to OR _to-_from>interval '367 days' THEN RAISE EXCEPTION 'Invalid period' USING ERRCODE='22023'; END IF;
 WITH risky AS (
 SELECT t.user_id, count(*) FILTER(WHERE t.status IN ('approved','paid','completed')) approved,
 count(*) FILTER(WHERE t.status IN ('refunded','chargeback','chargedback','charged_back')) bad,
 coalesce(sum(t.amount) FILTER(WHERE t.status IN ('approved','paid','completed')),0) volume
 FROM public.transactions t WHERE coalesce(t.is_simulated,false)=false AND t.created_at BETWEEN _from AND _to GROUP BY t.user_id
 ), ranked AS (
 SELECT r.user_id,coalesce(p.full_name,left(r.user_id::text,8)) name,r.approved,r.bad,r.volume,
 round(100.0*r.bad/nullif(r.approved+r.bad,0),2) rate
 FROM risky r LEFT JOIN public.profiles p ON p.user_id=r.user_id WHERE r.approved+r.bad>=5 AND r.bad>0
 ORDER BY rate DESC,r.user_id LIMIT 5
 )
 SELECT jsonb_build_object(
 'withdrawals',(SELECT jsonb_build_object('count',count(*),'amount',coalesce(sum(amount),0),'oldest',min(created_at)) FROM public.withdrawals WHERE status='pending'),
 'kyc',(SELECT count(*) FROM public.profiles p WHERE p.account_status IN ('pending','pending_review') AND NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p.user_id AND r.role IN ('admin','employee','manager','partner'))),
 'med',(SELECT count(*) FROM public.disputes WHERE status IN ('open','in_review') AND type IN ('medpix','pre_med_pix')),
 'chargebacks',(SELECT count(*) FROM public.disputes WHERE status IN ('open','in_review') AND type='chargeback'),
 'refunds',(SELECT count(*) FROM public.refund_requests WHERE status='pending_confirmation'),
 'support',(SELECT count(*) FROM public.support_tickets WHERE status<>'closed'),
 'error_count',(SELECT count(*) FROM public.error_logs WHERE resolved=false),
 'errors',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM (SELECT id,error_type,message,created_at FROM public.error_logs WHERE resolved=false ORDER BY created_at DESC,id LIMIT 6)e),'[]'::jsonb),
 'fraud',coalesce((SELECT jsonb_agg(to_jsonb(f)) FROM (SELECT id,block_type,block_reason,matched_value,created_at FROM public.fraud_logs ORDER BY created_at DESC,id LIMIT 6)f),'[]'::jsonb),
 'webhooks',(SELECT jsonb_build_object('delivered',count(*) FILTER(WHERE status='delivered'),'failed',count(*) FILTER(WHERE status='failed'),'pending',count(*) FILTER(WHERE status IN ('pending','retrying','processing'))) FROM public.webhook_deliveries WHERE created_at>=now()-interval '24 hours'),
 'apps',(SELECT jsonb_build_object('delivered',count(*) FILTER(WHERE status IN ('delivered','success')),'failed',count(*) FILTER(WHERE status='failed'),'pending',count(*) FILTER(WHERE status IN ('pending','retrying','processing'))) FROM public.app_deliveries WHERE created_at>=now()-interval '24 hours'),
 'risky_sellers',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM ranked r),'[]'::jsonb),
 'checked_at',now()
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION app_private.get_admin_command_center(timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.get_admin_command_center(timestamptz,timestamptz) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_admin_command_center(_from timestamptz,_to timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,app_private AS $$ SELECT app_private.get_admin_command_center($1,$2) $$;
REVOKE ALL ON FUNCTION public.get_admin_command_center(timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_command_center(timestamptz,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.admin_search_transactions(_query text)
RETURNS TABLE(id uuid,amount numeric,status text,customer_email text,customer_name text,created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,app_private AS $$
DECLARE q text:=trim(_query); pattern text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF q IS NULL OR length(q)<3 OR length(q)>120 THEN RAISE EXCEPTION 'Search must contain 3 to 120 characters' USING ERRCODE='22023'; END IF;
 IF q ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
 RETURN QUERY SELECT t.id,t.amount,t.status,t.customer_email,t.customer_name,t.created_at FROM public.transactions t WHERE t.id=q::uuid;
 ELSE
 pattern:='%'||replace(replace(replace(q,'\','\\'),'%','\%'),'_','\_')||'%';
 RETURN QUERY SELECT t.id,t.amount,t.status,t.customer_email,t.customer_name,t.created_at FROM public.transactions t WHERE t.customer_email ILIKE pattern OR t.customer_name ILIKE pattern OR t.customer_document=q OR t.external_id=q ORDER BY t.created_at DESC,t.id DESC LIMIT 15;
 END IF;
END $$;
REVOKE ALL ON FUNCTION app_private.admin_search_transactions(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.admin_search_transactions(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_search_transactions(_query text)
RETURNS TABLE(id uuid,amount numeric,status text,customer_email text,customer_name text,created_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,app_private AS $$ SELECT * FROM app_private.admin_search_transactions($1) $$;
REVOKE ALL ON FUNCTION public.admin_search_transactions(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_search_transactions(text) TO authenticated;