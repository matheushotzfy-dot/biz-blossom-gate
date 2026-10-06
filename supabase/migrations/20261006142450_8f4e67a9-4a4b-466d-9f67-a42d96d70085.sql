CREATE OR REPLACE FUNCTION app_private.get_admin_analytics_detail(_from date, _to date, _page integer DEFAULT 0, _search text DEFAULT '', _selling_only boolean DEFAULT false, _sort text DEFAULT 'volume') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_from timestamptz; v_to timestamptz; v_today timestamptz; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF _from IS NULL OR _to IS NULL OR _to<_from OR _to-_from>365 OR _page IS NULL OR _page<0 OR _page>100000 OR _search IS NULL OR length(_search)>120 OR _selling_only IS NULL OR _sort IS NULL OR _sort NOT IN ('volume','sales','newest','risk') THEN RAISE EXCEPTION 'Invalid analytics filters' USING ERRCODE='22023'; END IF;
 v_from:=_from::timestamp AT TIME ZONE 'America/Sao_Paulo'; v_to:=(_to+1)::timestamp AT TIME ZONE 'America/Sao_Paulo'; v_today:=(now() AT TIME ZONE 'America/Sao_Paulo')::date::timestamp AT TIME ZONE 'America/Sao_Paulo';
 WITH sellers AS MATERIALIZED (
 SELECT p.user_id,p.full_name,p.email,p.account_status,p.created_at, NOT coalesce(p.frozen,false) AND NOT coalesce(p.balance_frozen,false) AND p.account_status IN ('active','approved') AS active
 FROM public.profiles p WHERE NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p.user_id AND r.role IN ('admin','employee','manager','partner'))
 ), tx AS MATERIALIZED (
 SELECT t.*, t.status IN ('approved','paid','completed') AS paid, (t.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day, nullif(lower(btrim(t.customer_email)),'') AS buyer
 FROM public.transactions t WHERE t.created_at>=v_from AND t.created_at<v_to AND NOT coalesce(t.is_simulated,false)
 ), buyers AS (SELECT buyer,count(*) AS purchases FROM tx WHERE paid AND buyer IS NOT NULL GROUP BY buyer),
 refunds AS MATERIALIZED (
 SELECT r.* FROM public.refund_requests r JOIN public.transactions t ON t.id=r.transaction_id WHERE r.status='confirmed' AND r.decided_at>=v_from AND r.decided_at<v_to AND NOT coalesce(t.is_simulated,false)
 ), cb AS MATERIALIZED (
 SELECT DISTINCT t.id AS transaction_id,t.user_id,t.amount FROM public.disputes d JOIN public.transactions t ON t.id=d.transaction_id WHERE d.type='chargeback' AND d.created_at>=v_from AND d.created_at<v_to AND NOT coalesce(t.is_simulated,false)
 UNION SELECT id,user_id,amount FROM tx WHERE status IN ('chargeback','chargedback','charged_back') AND payment_method IS DISTINCT FROM 'pix'
 ), med AS MATERIALIZED (
 SELECT d.* FROM public.disputes d JOIN public.transactions t ON t.id=d.transaction_id WHERE d.type IN ('medpix','pre_med_pix') AND d.created_at>=v_from AND d.created_at<v_to AND NOT coalesce(t.is_simulated,false)
 ), st AS (
 SELECT user_id,count(*) attempts,count(*) FILTER(WHERE paid) sales,coalesce(sum(amount) FILTER(WHERE paid),0) volume,coalesce(sum(fee_amount) FILTER(WHERE paid),0) fees,coalesce(sum(acquirer_fee_amount) FILTER(WHERE paid),0) acquirer,count(DISTINCT buyer) FILTER(WHERE paid) clients,count(*) FILTER(WHERE status IN ('failed','refused','declined','expired','cancelled','canceled')) failed FROM tx GROUP BY user_id
 ), rows AS MATERIALIZED (
 SELECT s.user_id,coalesce(nullif(s.full_name,''),'Seller') name,coalesce(s.email,'') email,s.account_status,s.active,s.created_at,
 coalesce(st.attempts,0) attempts,coalesce(st.sales,0) sales,coalesce(st.volume,0) volume,coalesce(st.fees,0) fees,coalesce(st.acquirer,0) acquirer,coalesce(st.clients,0) clients,coalesce(st.failed,0) failed,
 coalesce(rr.count,0) refunds,coalesce(rr.amount,0) refund_amount,coalesce(cc.count,0) chargebacks,coalesce(cc.amount,0) chargeback_amount,coalesce(mm.count,0) med,coalesce(mm.amount,0) med_amount,
 coalesce(rr.count,0)+coalesce(cc.count,0)+coalesce(mm.count,0) risk_events
 FROM sellers s LEFT JOIN st ON st.user_id=s.user_id
 LEFT JOIN (SELECT seller_user_id,count(*) count,sum(amount) amount FROM refunds GROUP BY 1) rr ON rr.seller_user_id=s.user_id
 LEFT JOIN (SELECT user_id,count(*) count,sum(amount) amount FROM cb GROUP BY 1) cc ON cc.user_id=s.user_id
 LEFT JOIN (SELECT seller_user_id,count(*) count,sum(amount) amount FROM med GROUP BY 1) mm ON mm.seller_user_id=s.user_id
 WHERE (NOT _selling_only OR coalesce(st.sales,0)>0) AND (_search='' OR position(lower(btrim(_search)) in lower(coalesce(s.full_name,'')||' '||coalesce(s.email,'')||' '||s.user_id::text))>0)
 ), page_rows AS (
 SELECT * FROM rows ORDER BY CASE WHEN _sort='volume' THEN volume END DESC,CASE WHEN _sort='sales' THEN sales END DESC,CASE WHEN _sort='risk' THEN risk_events END DESC,CASE WHEN _sort='newest' THEN created_at END DESC,user_id LIMIT 25 OFFSET _page*25
 ), daily AS (
 SELECT d::date AS day,count(t.id) FILTER(WHERE t.paid) sales,count(DISTINCT t.user_id) FILTER(WHERE t.paid) sellers,count(DISTINCT t.buyer) FILTER(WHERE t.paid) clients,coalesce(sum(t.amount) FILTER(WHERE t.paid),0) volume,(SELECT count(*) FROM sellers s WHERE (s.created_at AT TIME ZONE 'America/Sao_Paulo')::date=d::date) registrations
 FROM generate_series(_from::timestamp,_to::timestamp,interval '1 day') d LEFT JOIN tx t ON t.day=d::date GROUP BY d
 )
 SELECT jsonb_build_object(
 'summary',jsonb_build_object('registered_sellers',(SELECT count(*) FROM sellers),'active_sellers',(SELECT count(*) FROM sellers WHERE active),'selling_sellers',(SELECT count(DISTINCT user_id) FROM tx WHERE paid),'selling_today',(SELECT count(DISTINCT t.user_id) FROM public.transactions t WHERE t.created_at>=v_today AND t.created_at<v_today+interval '1 day' AND t.status IN ('approved','paid','completed') AND NOT coalesce(t.is_simulated,false)),
 'clients',(SELECT count(*) FROM buyers),'repeat_clients',(SELECT count(*) FROM buyers WHERE purchases>1),'unidentified_sales',(SELECT count(*) FROM tx WHERE paid AND buyer IS NULL),'new_registrations',(SELECT count(*) FROM sellers WHERE created_at>=v_from AND created_at<v_to),
 'refunds',(SELECT count(*) FROM refunds),'refund_amount',(SELECT coalesce(sum(amount),0) FROM refunds),'chargebacks',(SELECT count(*) FROM cb),'chargeback_amount',(SELECT coalesce(sum(amount),0) FROM cb),'med',(SELECT count(*) FROM med),'med_amount',(SELECT coalesce(sum(amount),0) FROM med),
 'pending_transactions',(SELECT count(*) FROM tx WHERE status IN ('pending','processing','waiting_payment','authorized')),'failed_transactions',(SELECT count(*) FROM tx WHERE status IN ('failed','refused','declined','expired','cancelled','canceled'))),
 'operations',jsonb_build_object('pending_refunds',(SELECT count(*) FROM public.refund_requests r JOIN public.transactions t ON t.id=r.transaction_id WHERE r.status='pending_confirmation' AND NOT coalesce(t.is_simulated,false)),
 'refunds_reserved',(SELECT coalesce(sum(r.debited_amount),0) FROM public.refund_requests r JOIN public.transactions t ON t.id=r.transaction_id WHERE r.status='pending_confirmation' AND NOT coalesce(t.is_simulated,false)),
 'pending_withdrawals',(SELECT count(*) FROM public.withdrawals WHERE status IN ('pending','processing')),'withdrawal_amount',(SELECT coalesce(sum(amount),0) FROM public.withdrawals WHERE status IN ('pending','processing')),
 'open_med',(SELECT count(*) FROM public.disputes d JOIN public.transactions t ON t.id=d.transaction_id WHERE d.type IN ('medpix','pre_med_pix') AND d.status IN ('open','in_review') AND NOT coalesce(t.is_simulated,false)),
 'kyc_pending',(SELECT count(*) FROM sellers WHERE account_status IN ('pending','pending_review')),'frozen_sellers',(SELECT count(*) FROM public.profiles p JOIN sellers s ON s.user_id=p.user_id WHERE coalesce(p.frozen,false) OR coalesce(p.balance_frozen,false))),
 'daily',(SELECT coalesce(jsonb_agg(to_jsonb(daily) ORDER BY day),'[]'::jsonb) FROM daily),
 'sellers',(SELECT coalesce(jsonb_agg(to_jsonb(page_rows)),'[]'::jsonb) FROM page_rows),'seller_count',(SELECT count(*) FROM rows),'page',_page,'page_size',25,'checked_at',now()
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION app_private.get_admin_analytics_detail(date,date,integer,text,boolean,text) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.get_admin_analytics_detail(date,date,integer,text,boolean,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_admin_analytics_detail(_from date,_to date,_page integer DEFAULT 0,_search text DEFAULT '',_selling_only boolean DEFAULT false,_sort text DEFAULT 'volume') RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$ SELECT app_private.get_admin_analytics_detail(_from,_to,_page,_search,_selling_only,_sort); $$;
REVOKE ALL ON FUNCTION public.get_admin_analytics_detail(date,date,integer,text,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics_detail(date,date,integer,text,boolean,text) TO authenticated;