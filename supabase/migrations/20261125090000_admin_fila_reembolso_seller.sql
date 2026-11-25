-- A fila de reembolsos do admin juntava o seller por profiles.id, mas refund_requests.seller_user_id
-- guarda o id do usuário (profiles.user_id). Resultado: nome e e-mail do seller sempre vazios.
-- Só leitura; mesma assinatura e mesmo retorno.
CREATE OR REPLACE FUNCTION app_private.admin_list_refund_requests(_status text, _limit integer, _offset integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _admin uuid := app_private.assert_admin(); _total int; _rows jsonb;
BEGIN
  SELECT count(*) INTO _total FROM public.refund_requests r WHERE _status IS NULL OR r.status = _status;
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'created_at' DESC), '[]'::jsonb) INTO _rows FROM (
    SELECT jsonb_build_object('id',r.id,'created_at',r.created_at,'status',r.status,'amount',r.amount,'debited_amount',r.debited_amount,
      'reason',r.reason,'requested_role',r.requested_role,'decision_note',r.decision_note,'proof_ref',r.proof_ref,'decided_at',r.decided_at,
      'transaction_id',r.transaction_id,'tx_amount',t.amount,'payment_method',t.payment_method,'customer_name',t.customer_name,'customer_email',t.customer_email,
      'seller_name',p.full_name,'seller_email',p.email) x
    FROM public.refund_requests r
    JOIN public.transactions t ON t.id = r.transaction_id
    LEFT JOIN public.profiles p ON p.user_id = r.seller_user_id
    WHERE _status IS NULL OR r.status = _status
    ORDER BY r.created_at DESC LIMIT LEAST(GREATEST(_limit,1),100) OFFSET GREATEST(_offset,0)) s;
  RETURN jsonb_build_object('total',_total,'rows',_rows);
END $function$;
