CREATE OR REPLACE FUNCTION app_private.get_admin_overview_metrics(_from date, _to date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_from timestamptz; v_to timestamptz; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'access denied' USING ERRCODE='42501'; END IF;
 IF _from IS NULL OR _to IS NULL OR _to < _from OR _to - _from > 365 THEN RAISE EXCEPTION 'invalid date range' USING ERRCODE='22023'; END IF;
 v_from := _from::timestamp AT TIME ZONE 'America/Sao_Paulo'; v_to := (_to+1)::timestamp AT TIME ZONE 'America/Sao_Paulo';
 WITH tx AS MATERIALIZED (
 SELECT t.*, t.status IN ('approved','paid','completed') AS paid,
 (t.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
 extract(hour FROM t.created_at AT TIME ZONE 'America/Sao_Paulo')::int AS hour,
 coalesce(t.fee_amount,0)-coalesce(t.acquirer_fee_amount,0) AS profit
 FROM public.transactions t WHERE t.created_at>=v_from AND t.created_at<v_to AND NOT coalesce(t.is_simulated,false)
 ), daily AS (
 SELECT d::date AS day, coalesce(sum(t.amount) FILTER(WHERE t.paid),0) AS gross, coalesce(sum(t.fee_amount) FILTER(WHERE t.paid),0) AS fees, coalesce(sum(t.acquirer_fee_amount) FILTER(WHERE t.paid),0) AS acquirer, coalesce(sum(t.profit) FILTER(WHERE t.paid),0) AS profit, count(t.id) FILTER(WHERE t.paid) AS sales
 FROM generate_series(_from::timestamp,_to::timestamp,interval '1 day') d LEFT JOIN tx t ON t.day=d::date GROUP BY 1
 ), hourly AS (
 SELECT h AS hour, coalesce(sum(t.amount) FILTER(WHERE t.paid),0) AS gross, coalesce(sum(t.profit) FILTER(WHERE t.paid),0) AS profit, count(t.id) FILTER(WHERE t.paid) AS sales FROM generate_series(0,23) h LEFT JOIN tx t ON t.hour=h GROUP BY 1
 ), methods AS (
 SELECT coalesce(payment_method,'other') method,count(*) total,count(*) FILTER(WHERE paid) sales,coalesce(sum(amount) FILTER(WHERE paid),0) gross FROM tx GROUP BY 1
 ), cb AS (
 SELECT DISTINCT transaction_id FROM public.disputes d JOIN public.transactions t ON t.id=d.transaction_id WHERE d.type='chargeback' AND d.created_at>=v_from AND d.created_at<v_to AND NOT coalesce(t.is_simulated,false)
 UNION SELECT id FROM tx WHERE status IN ('chargeback','chargedback','charged_back') AND payment_method IS DISTINCT FROM 'pix'
 ), med AS (
 SELECT d.* FROM public.disputes d JOIN public.transactions t ON t.id=d.transaction_id WHERE d.type IN ('medpix','pre_med_pix') AND d.created_at>=v_from AND d.created_at<v_to AND NOT coalesce(t.is_simulated,false)
 )
 SELECT jsonb_build_object(
 'summary',(SELECT jsonb_build_object('gross',coalesce(sum(amount) FILTER(WHERE paid),0),'fees',coalesce(sum(fee_amount) FILTER(WHERE paid),0),'acquirer',coalesce(sum(acquirer_fee_amount) FILTER(WHERE paid),0),'profit',coalesce(sum(profit) FILTER(WHERE paid),0),'sales',count(*) FILTER(WHERE paid),'attempts',count(*)) FROM tx),
 'daily',(SELECT coalesce(jsonb_agg(to_jsonb(daily) ORDER BY day),'[]'::jsonb) FROM daily),
 'hourly',(SELECT jsonb_agg(to_jsonb(hourly) ORDER BY hour) FROM hourly),
 'methods',(SELECT coalesce(jsonb_agg(to_jsonb(methods) ORDER BY gross DESC),'[]'::jsonb) FROM methods),
 'risk',jsonb_build_object('chargebacks',(SELECT count(*) FROM cb),'chargeback_amount',(SELECT coalesce(sum(t.amount),0) FROM public.transactions t JOIN cb ON cb.transaction_id=t.id),'med_count',(SELECT count(*) FROM med),'med_amount',(SELECT coalesce(sum(amount),0) FROM med),'med_open',(SELECT count(*) FROM public.disputes d JOIN public.transactions t ON t.id=d.transaction_id WHERE d.type IN ('medpix','pre_med_pix') AND d.status IN ('open','in_review') AND NOT coalesce(t.is_simulated,false))),
 'new_users',(SELECT count(*) FROM public.profiles p WHERE p.created_at>=v_from AND p.created_at<v_to AND NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p.user_id AND r.role IN ('admin','employee','manager','partner'))),
 'kyc_pending',(SELECT count(*) FROM public.profiles p WHERE p.account_status IN ('pending','pending_review') AND NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p.user_id AND r.role IN ('admin','employee','manager','partner'))),
 'from',_from,'to',_to,'timezone','America/Sao_Paulo') INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION app_private.get_admin_overview_metrics(date,date) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.get_admin_overview_metrics(date,date) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_admin_overview_metrics(_from date,_to date) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$ SELECT app_private.get_admin_overview_metrics(_from,_to); $$;
REVOKE ALL ON FUNCTION public.get_admin_overview_metrics(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_overview_metrics(date,date) TO authenticated;