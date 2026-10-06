DO $migration$
DECLARE definition text;
BEGIN
 definition := pg_get_functiondef('app_private.get_seller_360(uuid)'::regprocedure);
 IF position('((_s->>''chargeback_count'')::numeric + (_d->>''lost'')::numeric)' in definition)=0 THEN RAISE EXCEPTION 'Unexpected seller metrics definition'; END IF;
 definition := replace(definition, '''approved_count'', COUNT(*) FILTER (WHERE status IN (''approved'',''paid'',''completed'',''refunded'',''chargeback'',''disputed''))', '''approved_count'', COUNT(*) FILTER (WHERE status IN (''approved'',''paid'',''completed'')), ''ever_paid_count'', COUNT(*) FILTER (WHERE status IN (''approved'',''paid'',''completed'',''partially_refunded'',''refunded'',''chargeback'',''chargedback'',''charged_back'',''disputed''))');
 definition := replace(definition, 'COUNT(*) FILTER (WHERE status IN (''open'',''in_review''))', 'COUNT(*) FILTER (WHERE status IN (''open'',''in_review'',''pending_recorrer''))');
 definition := replace(definition, '_cb_rate := CASE WHEN (_s->>''approved_count'')::numeric > 0 THEN ((_s->>''chargeback_count'')::numeric + (_d->>''lost'')::numeric) / (_s->>''approved_count'')::numeric ELSE 0 END;', '_cb_rate := CASE WHEN (_s->>''ever_paid_count'')::numeric > 0 THEN (SELECT count(DISTINCT tx_id)::numeric FROM (SELECT t.id AS tx_id FROM public.transactions t WHERE t.user_id=_user_id AND t.status IN (''chargeback'',''chargedback'',''charged_back'',''disputed'') AND NOT coalesce(t.is_simulated,false) UNION SELECT d.transaction_id FROM public.disputes d JOIN public.transactions t ON t.id=d.transaction_id WHERE d.seller_user_id=_user_id AND d.type IN (''medpix'',''pre_med_pix'',''chargeback'') AND d.status=''resolved_buyer'' AND NOT coalesce(t.is_simulated,false)) losses) / (_s->>''ever_paid_count'')::numeric ELSE 0 END;');
 definition := replace(definition, '_rf_rate := CASE WHEN (_s->>''approved_count'')::numeric > 0 THEN (_s->>''refunded_count'')::numeric / (_s->>''approved_count'')::numeric ELSE 0 END;', '_rf_rate := CASE WHEN (_s->>''ever_paid_count'')::numeric > 0 THEN (_s->>''refunded_count'')::numeric / (_s->>''ever_paid_count'')::numeric ELSE 0 END;');
 EXECUTE definition;
END;
$migration$;