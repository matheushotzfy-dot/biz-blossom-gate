CREATE OR REPLACE FUNCTION app_private.get_admin_inactive_sellers_page(_days integer DEFAULT 7, _page integer DEFAULT 0, _search text DEFAULT '', _sort text DEFAULT 'days') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF _days IS NULL OR _days<1 OR _days>3650 OR _page IS NULL OR _page<0 OR _page>100000 OR _search IS NULL OR length(_search)>120 OR _sort IS NULL OR _sort NOT IN ('days','volume','fees','sales') THEN RAISE EXCEPTION 'Invalid inactivity filters' USING ERRCODE='22023'; END IF;
 WITH sellers AS MATERIALIZED (
 SELECT p.user_id,p.full_name,p.email,p.created_at,p.last_login_at,p.admin_notes,p.account_status FROM public.profiles p WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=p.user_id AND r.role IN ('admin','employee','manager','partner'))
 ), tx AS MATERIALIZED (
 SELECT t.user_id,t.created_at,t.status,t.amount,t.fee_amount FROM public.transactions t JOIN sellers s ON s.user_id=t.user_id WHERE NOT coalesce(t.is_simulated,false)
 ), agg AS (
 SELECT user_id,count(*) attempts,count(*) FILTER(WHERE status IN ('paid','approved','completed')) sales,coalesce(sum(amount) FILTER(WHERE status IN ('paid','approved','completed')),0) volume,coalesce(sum(fee_amount) FILTER(WHERE status IN ('paid','approved','completed')),0) fees,max(created_at) last_attempt_at,max(created_at) FILTER(WHERE status IN ('paid','approved','completed')) last_paid_created_at FROM tx GROUP BY user_id
 ), rows AS MATERIALIZED (
 SELECT s.*,coalesce(a.attempts,0) attempts,coalesce(a.sales,0) sales,coalesce(a.volume,0) volume,coalesce(a.fees,0) fees,a.last_attempt_at,a.last_paid_created_at,greatest(s.created_at,s.last_login_at,a.last_attempt_at) last_activity FROM sellers s LEFT JOIN agg a ON a.user_id=s.user_id
 ), filtered AS MATERIALIZED (
 SELECT *,floor(extract(epoch FROM (now()-last_activity))/86400)::integer days_since FROM rows WHERE last_activity<=now()-make_interval(days=>_days) AND (_search='' OR position(lower(btrim(_search)) in lower(coalesce(full_name,'')||' '||coalesce(email,'')||' '||user_id::text))>0)
 ), paged AS (
 SELECT * FROM filtered ORDER BY CASE WHEN _sort='days' THEN days_since END DESC,CASE WHEN _sort='volume' THEN volume END DESC,CASE WHEN _sort='fees' THEN fees END DESC,CASE WHEN _sort='sales' THEN sales END DESC,user_id LIMIT 25 OFFSET _page*25
 ) SELECT jsonb_build_object('as_of',now(),'page',_page,'page_size',25,'totals',jsonb_build_object('count',(SELECT count(*) FROM filtered),'over30',(SELECT count(*) FROM filtered WHERE days_since>=30),'volume',(SELECT coalesce(sum(volume),0) FROM filtered),'fees',(SELECT coalesce(sum(fees),0) FROM filtered)),'sellers',coalesce((SELECT jsonb_agg(to_jsonb(paged) ORDER BY CASE WHEN _sort='days' THEN days_since END DESC,CASE WHEN _sort='volume' THEN volume END DESC,CASE WHEN _sort='fees' THEN fees END DESC,CASE WHEN _sort='sales' THEN sales END DESC,user_id) FROM paged),'[]'::jsonb)) INTO result;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION app_private.get_admin_inactive_sellers_page(integer,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.get_admin_inactive_sellers_page(integer,integer,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_admin_inactive_sellers_page(_days integer DEFAULT 7,_page integer DEFAULT 0,_search text DEFAULT '',_sort text DEFAULT 'days') RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public,pg_temp AS $$ SELECT app_private.get_admin_inactive_sellers_page(_days,_page,_search,_sort); $$;
REVOKE ALL ON FUNCTION public.get_admin_inactive_sellers_page(integer,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_inactive_sellers_page(integer,integer,text,text) TO authenticated;
-- Keep the legacy signature, but remove its employee access and unbounded PII path.
CREATE OR REPLACE FUNCTION app_private.get_admin_inactive_sellers(_days_threshold integer DEFAULT 7) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public,pg_temp AS $$ SELECT app_private.get_admin_inactive_sellers_page(_days_threshold,0,'','days'); $$;
REVOKE ALL ON FUNCTION app_private.get_admin_inactive_sellers(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.get_admin_inactive_sellers(integer) TO authenticated;
REVOKE ALL ON FUNCTION public.get_admin_inactive_sellers(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_inactive_sellers(integer) TO authenticated;